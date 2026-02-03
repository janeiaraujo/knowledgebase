import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { tenantMiddleware } from '../../middlewares/tenant.middleware.js';
import { ObjectId } from 'mongodb';

/**
 * GPS (Guided Problem Solving) Routes
 * 
 * Collections:
 * - gps_flows: Flow definitions (created by admins)
 * - gps_sessions: Active/completed sessions
 * 
 * Flow Structure:
 * {
 *   _id, tenant_id, name, description, category, is_active,
 *   steps: [
 *     { 
 *       id, type: 'question|action|evidence|condition|end',
 *       title, description, options, next_step, evidence_type, ...
 *     }
 *   ],
 *   created_by, created_at, updated_at
 * }
 * 
 * Session Structure:
 * {
 *   _id, tenant_id, flow_id, user_id, status: 'active|completed|abandoned',
 *   current_step, started_at, completed_at,
 *   responses: [{ step_id, response, evidence, timestamp }],
 *   summary, rca_generated
 * }
 */

async function gpsRoutes(fastify, options) {
    
    // Helper: Convert string to ObjectId safely
    const toObjectId = (id) => {
        try {
            return new ObjectId(id);
        } catch {
            return null;
        }
    };

    // Helper: Get OpenAI client
    const getOpenAI = async () => {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) return null;
        const { default: OpenAI } = await import('openai');
        return new OpenAI({ apiKey });
    };

    // ==================== FLOW MANAGEMENT ====================

    // List all GPS flows
    fastify.get('/flows', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async (request, reply) => {
        const db = fastify.db();
        const { category, active_only = true, page = 1, limit = 50 } = request.query;

        const filter = { 
            tenant_id: request.tenantId,
            deleted_at: null
        };
        
        if (active_only === 'true' || active_only === true) {
            filter.is_active = true;
        }
        if (category) {
            filter.category = category;
        }

        const flows = await db.collection('gps_flows')
            .find(filter)
            .sort({ name: 1 })
            .skip((parseInt(page) - 1) * parseInt(limit))
            .limit(parseInt(limit))
            .toArray();

        const total = await db.collection('gps_flows').countDocuments(filter);

        return {
            flows,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total
            }
        };
    });

    // Get single flow
    fastify.get('/flows/:flowId', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async (request, reply) => {
        const db = fastify.db();
        const { flowId } = request.params;
        const objectId = toObjectId(flowId);

        if (!objectId) {
            return reply.status(400).send({ error: 'Invalid flow ID' });
        }

        const flow = await db.collection('gps_flows').findOne({
            _id: objectId,
            tenant_id: request.tenantId,
            deleted_at: null
        });

        if (!flow) {
            return reply.status(404).send({ error: 'Flow not found' });
        }

        return { flow };
    });

    // Create new flow
    fastify.post('/flows', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async (request, reply) => {
        const db = fastify.db();
        const { name, description, category, steps } = request.body;

        if (!name) {
            return reply.status(400).send({ error: 'Name is required' });
        }

        const newFlow = {
            tenant_id: request.tenantId,
            name,
            description: description || '',
            category: category || 'general',
            is_active: false, // Start as inactive until published
            steps: steps || [
                {
                    id: 'start',
                    type: 'question',
                    title: 'Início',
                    description: 'Descreva brevemente o problema.',
                    input_type: 'textarea',
                    required: true,
                    next_step: 'end'
                },
                {
                    id: 'end',
                    type: 'end',
                    title: 'Fim',
                    description: 'Fluxo concluído.'
                }
            ],
            created_by: request.currentUser._id,
            created_at: new Date(),
            updated_at: new Date(),
            deleted_at: null
        };

        const result = await db.collection('gps_flows').insertOne(newFlow);
        newFlow._id = result.insertedId;

        return reply.status(201).send({ flow: newFlow });
    });

    // Update flow
    fastify.put('/flows/:flowId', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async (request, reply) => {
        const db = fastify.db();
        const { flowId } = request.params;
        const objectId = toObjectId(flowId);

        if (!objectId) {
            return reply.status(400).send({ error: 'Invalid flow ID' });
        }

        const { name, description, category, steps, is_active } = request.body;

        const updateData = {
            updated_at: new Date()
        };

        if (name !== undefined) updateData.name = name;
        if (description !== undefined) updateData.description = description;
        if (category !== undefined) updateData.category = category;
        if (steps !== undefined) updateData.steps = steps;
        if (is_active !== undefined) updateData.is_active = is_active;

        const result = await db.collection('gps_flows').findOneAndUpdate(
            { _id: objectId, tenant_id: request.tenantId, deleted_at: null },
            { $set: updateData },
            { returnDocument: 'after' }
        );

        if (!result) {
            return reply.status(404).send({ error: 'Flow not found' });
        }

        return { flow: result };
    });

    // Delete flow (soft delete)
    fastify.delete('/flows/:flowId', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async (request, reply) => {
        const db = fastify.db();
        const { flowId } = request.params;
        const objectId = toObjectId(flowId);

        if (!objectId) {
            return reply.status(400).send({ error: 'Invalid flow ID' });
        }

        await db.collection('gps_flows').updateOne(
            { _id: objectId, tenant_id: request.tenantId },
            { $set: { deleted_at: new Date(), is_active: false } }
        );

        return { success: true };
    });

    // Duplicate flow
    fastify.post('/flows/:flowId/duplicate', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async (request, reply) => {
        const db = fastify.db();
        const { flowId } = request.params;
        const objectId = toObjectId(flowId);

        if (!objectId) {
            return reply.status(400).send({ error: 'Invalid flow ID' });
        }

        const original = await db.collection('gps_flows').findOne({
            _id: objectId,
            tenant_id: request.tenantId,
            deleted_at: null
        });

        if (!original) {
            return reply.status(404).send({ error: 'Flow not found' });
        }

        const newFlow = {
            ...original,
            _id: undefined,
            name: `${original.name} (Cópia)`,
            is_active: false,
            created_by: request.currentUser._id,
            created_at: new Date(),
            updated_at: new Date()
        };
        delete newFlow._id;

        const result = await db.collection('gps_flows').insertOne(newFlow);
        newFlow._id = result.insertedId;

        return reply.status(201).send({ flow: newFlow });
    });

    // ==================== SESSION MANAGEMENT ====================

    // Start new session
    fastify.post('/sessions', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async (request, reply) => {
        const db = fastify.db();
        const { flow_id, incident_id, context } = request.body;
        const flowObjectId = toObjectId(flow_id);

        if (!flowObjectId) {
            return reply.status(400).send({ error: 'Invalid flow ID' });
        }

        // Verify flow exists and is active
        const flow = await db.collection('gps_flows').findOne({
            _id: flowObjectId,
            tenant_id: request.tenantId,
            is_active: true,
            deleted_at: null
        });

        if (!flow) {
            return reply.status(404).send({ error: 'Flow not found or inactive' });
        }

        // Find the start step
        const startStep = flow.steps.find(s => s.id === 'start') || flow.steps[0];

        const newSession = {
            tenant_id: request.tenantId,
            flow_id: flowObjectId,
            flow_name: flow.name,
            user_id: request.currentUser._id,
            user_name: request.currentUser.name,
            incident_id: incident_id ? toObjectId(incident_id) : null,
            status: 'active',
            current_step: startStep.id,
            started_at: new Date(),
            completed_at: null,
            responses: [],
            context: context || {},
            summary: null,
            rca_generated: null
        };

        const result = await db.collection('gps_sessions').insertOne(newSession);
        newSession._id = result.insertedId;

        return reply.status(201).send({ 
            session: newSession, 
            current_step: startStep,
            flow_steps_count: flow.steps.length
        });
    });

    // Get session with current step
    fastify.get('/sessions/:sessionId', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async (request, reply) => {
        const db = fastify.db();
        const { sessionId } = request.params;
        const objectId = toObjectId(sessionId);

        if (!objectId) {
            return reply.status(400).send({ error: 'Invalid session ID' });
        }

        const session = await db.collection('gps_sessions').findOne({
            _id: objectId,
            tenant_id: request.tenantId
        });

        if (!session) {
            return reply.status(404).send({ error: 'Session not found' });
        }

        // Get flow for current step info
        const flow = await db.collection('gps_flows').findOne({
            _id: session.flow_id
        });

        if (!flow) {
            return reply.status(404).send({ error: 'Associated flow not found' });
        }

        const currentStep = flow.steps.find(s => s.id === session.current_step);
        const progress = {
            current: session.responses.length + 1,
            total: flow.steps.filter(s => s.type !== 'condition').length
        };

        return { 
            session, 
            current_step: currentStep,
            flow,
            progress
        };
    });

    // List user's sessions
    fastify.get('/sessions', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async (request, reply) => {
        const db = fastify.db();
        const { status, page = 1, limit = 20 } = request.query;

        const filter = {
            tenant_id: request.tenantId,
            user_id: request.currentUser._id
        };

        if (status) {
            filter.status = status;
        }

        const sessions = await db.collection('gps_sessions')
            .find(filter)
            .sort({ started_at: -1 })
            .skip((parseInt(page) - 1) * parseInt(limit))
            .limit(parseInt(limit))
            .toArray();

        const total = await db.collection('gps_sessions').countDocuments(filter);

        return {
            sessions,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total
            }
        };
    });

    // Submit response and advance to next step
    fastify.post('/sessions/:sessionId/respond', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async (request, reply) => {
        const db = fastify.db();
        const { sessionId } = request.params;
        const objectId = toObjectId(sessionId);
        const { step_id, response, evidence } = request.body;

        if (!objectId) {
            return reply.status(400).send({ error: 'Invalid session ID' });
        }

        // Get session
        const session = await db.collection('gps_sessions').findOne({
            _id: objectId,
            tenant_id: request.tenantId,
            status: 'active'
        });

        if (!session) {
            return reply.status(404).send({ error: 'Active session not found' });
        }

        // Get flow
        const flow = await db.collection('gps_flows').findOne({
            _id: session.flow_id
        });

        if (!flow) {
            return reply.status(404).send({ error: 'Flow not found' });
        }

        // Find current step
        const currentStep = flow.steps.find(s => s.id === step_id);
        if (!currentStep) {
            return reply.status(400).send({ error: 'Invalid step ID' });
        }

        // Record response
        const responseEntry = {
            step_id,
            step_title: currentStep.title,
            response,
            evidence: evidence || null,
            timestamp: new Date()
        };

        // Determine next step
        let nextStepId = currentStep.next_step;
        
        // Handle conditional branching
        if (currentStep.type === 'question' && currentStep.options) {
            const selectedOption = currentStep.options.find(o => o.value === response);
            if (selectedOption?.next_step) {
                nextStepId = selectedOption.next_step;
            }
        }

        // Check if this is the end
        const nextStep = flow.steps.find(s => s.id === nextStepId);
        const isComplete = !nextStep || nextStep.type === 'end';

        const updateData = {
            $push: { responses: responseEntry },
            $set: {
                current_step: nextStepId || 'end',
                ...(isComplete && {
                    status: 'completed',
                    completed_at: new Date()
                })
            }
        };

        await db.collection('gps_sessions').updateOne(
            { _id: objectId },
            updateData
        );

        // Get updated session
        const updatedSession = await db.collection('gps_sessions').findOne({ _id: objectId });

        return {
            session: updatedSession,
            next_step: nextStep,
            is_complete: isComplete,
            progress: {
                current: updatedSession.responses.length + (isComplete ? 0 : 1),
                total: flow.steps.filter(s => s.type !== 'condition').length
            }
        };
    });

    // Abandon session
    fastify.post('/sessions/:sessionId/abandon', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async (request, reply) => {
        const db = fastify.db();
        const { sessionId } = request.params;
        const objectId = toObjectId(sessionId);
        const { reason } = request.body;

        if (!objectId) {
            return reply.status(400).send({ error: 'Invalid session ID' });
        }

        await db.collection('gps_sessions').updateOne(
            { _id: objectId, tenant_id: request.tenantId, status: 'active' },
            { 
                $set: { 
                    status: 'abandoned',
                    abandoned_at: new Date(),
                    abandon_reason: reason || 'User abandoned'
                }
            }
        );

        return { success: true };
    });

    // Generate RCA/Summary for completed session
    fastify.post('/sessions/:sessionId/generate-rca', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async (request, reply) => {
        const db = fastify.db();
        const { sessionId } = request.params;
        const objectId = toObjectId(sessionId);

        if (!objectId) {
            return reply.status(400).send({ error: 'Invalid session ID' });
        }

        const session = await db.collection('gps_sessions').findOne({
            _id: objectId,
            tenant_id: request.tenantId,
            status: 'completed'
        });

        if (!session) {
            return reply.status(404).send({ error: 'Completed session not found' });
        }

        // Get flow for context
        const flow = await db.collection('gps_flows').findOne({ _id: session.flow_id });

        // Build context from responses
        const responseSummary = session.responses.map(r => 
            `**${r.step_title}:** ${r.response}${r.evidence ? ` [Evidência anexada]` : ''}`
        ).join('\n');

        let rcaContent;
        const openai = await getOpenAI();

        if (openai) {
            try {
                const completion = await openai.chat.completions.create({
                    model: 'gpt-4o-mini',
                    messages: [
                        {
                            role: 'system',
                            content: `Você é um especialista em análise de incidentes de TI. 
                            Analise as respostas do diagnóstico guiado e gere:
                            1. RESUMO: Descrição breve do problema
                            2. CAUSA RAIZ: Provável causa identificada
                            3. IMPACTO: Serviços/usuários afetados
                            4. AÇÕES TOMADAS: Passos realizados
                            5. RECOMENDAÇÕES: Melhorias futuras
                            6. LIÇÕES APRENDIDAS: Pontos importantes
                            
                            Formato Markdown. Seja objetivo e técnico.`
                        },
                        {
                            role: 'user',
                            content: `Fluxo: ${flow?.name || 'Diagnóstico'}\n\nRespostas do diagnóstico:\n${responseSummary}`
                        }
                    ],
                    max_tokens: 1500
                });

                rcaContent = completion.choices[0].message.content;
            } catch (error) {
                fastify.log.error('OpenAI RCA generation error:', error);
                // Fallback to template
                rcaContent = generateTemplateRCA(session, flow);
            }
        } else {
            rcaContent = generateTemplateRCA(session, flow);
        }

        // Save RCA to session
        await db.collection('gps_sessions').updateOne(
            { _id: objectId },
            { 
                $set: { 
                    rca_generated: {
                        content: rcaContent,
                        generated_at: new Date(),
                        ai_generated: !!openai
                    }
                }
            }
        );

        return {
            rca: rcaContent,
            ai_generated: !!openai
        };
    });

    // Helper: Generate template RCA without AI
    function generateTemplateRCA(session, flow) {
        const responses = session.responses || [];
        
        let content = `# Análise de Diagnóstico\n\n`;
        content += `**Fluxo:** ${flow?.name || 'N/A'}\n`;
        content += `**Data:** ${new Date(session.started_at).toLocaleString('pt-BR')}\n`;
        content += `**Operador:** ${session.user_name || 'N/A'}\n\n`;
        
        content += `## Respostas do Diagnóstico\n\n`;
        responses.forEach((r, i) => {
            content += `### ${i + 1}. ${r.step_title}\n`;
            content += `${r.response}\n`;
            if (r.evidence) {
                content += `_Evidência anexada_\n`;
            }
            content += `\n`;
        });
        
        content += `## Próximos Passos\n\n`;
        content += `- [ ] Documentar solução aplicada\n`;
        content += `- [ ] Verificar se problema foi resolvido\n`;
        content += `- [ ] Atualizar base de conhecimento\n`;
        
        return content;
    }

    // Get flow categories
    fastify.get('/categories', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async (request, reply) => {
        const db = fastify.db();

        const categories = await db.collection('gps_flows').distinct('category', {
            tenant_id: request.tenantId,
            deleted_at: null
        });

        // Default categories if none exist
        const defaultCategories = [
            'general',
            'network',
            'hardware',
            'software',
            'access',
            'email',
            'database',
            'security'
        ];

        const allCategories = [...new Set([...categories, ...defaultCategories])];

        return { categories: allCategories };
    });
}

export default gpsRoutes;
