import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { toObjectId } from '../../utils/mongodb.js';
import { tenantMiddleware } from '../../middlewares/tenant.middleware.js';
import { requirePermission } from '../../middlewares/rbac.middleware.js';
import { ObjectId } from 'mongodb';
import Joi from 'joi';

// Helper to get OpenAI instance
const getOpenAI = () => {
    const OpenAI = require('openai').default;
    return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
};

export default async function incidentRoutes(fastify, options) {

    // ==================== QUICK CAPTURE ====================
    
    // Quick Capture - Generate KB draft from incident description
    fastify.post('/quick-capture', {
        preHandler: [authMiddleware, tenantMiddleware, requirePermission('kb:create')]
    }, async (request, reply) => {
        const db = fastify.db();
        const { problem, solution, severity, affected_services, tags, category_id } = request.body;

        if (!problem || !solution) {
            return reply.status(400).send({ 
                error: 'Problema e solução são obrigatórios' 
            });
        }

        try {
            // Check if OpenAI is configured
            const openaiKey = process.env.OPENAI_API_KEY;
            let generatedContent = null;
            let generatedTitle = null;
            let generatedSummary = null;

            if (openaiKey) {
                // Use AI to generate KB article
                const openai = getOpenAI();

                const prompt = `Você é um especialista em documentação técnica. Com base no relato de incidente abaixo, gere um artigo de Knowledge Base profissional e bem estruturado em Markdown.

## Relato do Incidente

**Problema/Indisponibilidade:**
${problem}

**Solução Aplicada:**
${solution}

${severity ? `**Severidade:** ${severity}` : ''}
${affected_services ? `**Serviços Afetados:** ${affected_services}` : ''}

## Instruções

Gere um artigo KB completo com:
1. **Título** - Claro e descritivo (máximo 80 caracteres)
2. **Resumo** - Breve descrição do problema (2-3 linhas)
3. **Sintomas** - Lista de sintomas observados
4. **Causa Raiz** - Análise da causa do problema
5. **Solução** - Passos detalhados da solução
6. **Prevenção** - Como evitar que ocorra novamente

Use formatação Markdown apropriada com headers, listas, código quando necessário.

Responda APENAS no formato JSON válido:
{"title": "Título do artigo", "summary": "Resumo breve", "content": "Conteúdo completo em Markdown"}`;

                const completion = await openai.chat.completions.create({
                    model: 'gpt-4o-mini',
                    messages: [
                        { role: 'system', content: 'Você é um assistente especializado em criar documentação técnica. Responda sempre em JSON válido.' },
                        { role: 'user', content: prompt }
                    ],
                    temperature: 0.7,
                    max_tokens: 2000
                });

                try {
                    const responseText = completion.choices[0].message.content;
                    // Try to extract JSON from response
                    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        const aiResponse = JSON.parse(jsonMatch[0]);
                        generatedTitle = aiResponse.title;
                        generatedSummary = aiResponse.summary;
                        generatedContent = aiResponse.content;
                    } else {
                        throw new Error('No JSON found in response');
                    }
                } catch (parseError) {
                    fastify.log.warn('Failed to parse AI response, using fallback:', parseError);
                    generatedTitle = `Incidente: ${problem.substring(0, 60)}`;
                    generatedSummary = problem.substring(0, 200);
                    generatedContent = completion.choices[0].message.content;
                }

                // Track AI usage
                await db.collection('ai_usage').insertOne({
                    tenant_id: request.tenantId,
                    user_id: request.currentUser._id,
                    action: 'quick_capture',
                    tokens: completion.usage.total_tokens,
                    cost_credits: Math.ceil(completion.usage.total_tokens / 500),
                    created_at: new Date()
                });

            } else {
                // Fallback: Generate simple template without AI
                generatedTitle = `Incidente: ${problem.substring(0, 60)}${problem.length > 60 ? '...' : ''}`;
                generatedSummary = problem.substring(0, 200);
                generatedContent = `# ${generatedTitle}

## Resumo
${problem.substring(0, 200)}

## Problema Reportado
${problem}

## Solução Aplicada
${solution}

${severity ? `## Severidade\n${severity}\n` : ''}
${affected_services ? `## Serviços Afetados\n${affected_services}\n` : ''}

## Prevenção
*A ser preenchido*

## Referências
*A ser preenchido*

---
*Artigo gerado automaticamente via Quick Capture*
`;
            }

            // Create draft KB record
            const newRecord = {
                tenant_id: request.tenantId,
                title: generatedTitle,
                content_md: generatedContent,
                status: 'draft',
                version: 1,
                created_by: request.currentUser._id,
                created_at: new Date(),
                updated_at: new Date(),
                deleted_at: null,
                category_id: category_id ? new ObjectId(category_id) : null,
                properties: {
                    summary: generatedSummary,
                    severity: severity || 'medium',
                    source: 'quick_capture',
                    original_problem: problem,
                    original_solution: solution,
                    affected_services: affected_services || ''
                },
                tags: tags ? tags.map(t => new ObjectId(t)) : [],
                views: 0,
                helpful_count: 0,
                not_helpful_count: 0
            };

            const result = await db.collection('records').insertOne(newRecord);
            newRecord._id = result.insertedId;

            // Log the capture
            await db.collection('audit_logs').insertOne({
                tenant_id: request.tenantId,
                user_id: request.currentUser._id,
                action: 'incident.quick_capture',
                resource: 'record',
                resource_id: result.insertedId,
                details: {
                    ai_generated: !!openaiKey,
                    problem_length: problem.length,
                    solution_length: solution.length
                },
                timestamp: new Date()
            });

            return reply.status(201).send({
                success: true,
                record: newRecord,
                ai_generated: !!openaiKey,
                message: openaiKey 
                    ? 'KB gerado com IA! Revise e ajuste conforme necessário.'
                    : 'KB criado com template básico. Configure OPENAI_API_KEY para geração com IA.'
            });

        } catch (error) {
            fastify.log.error('Quick capture error:', error);
            return reply.status(500).send({ 
                error: 'Falha ao gerar KB',
                details: error.message 
            });
        }
    });

    // List recent quick captures
    fastify.get('/quick-captures', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async (request, reply) => {
        const db = fastify.db();
        const { page = 1, limit = 20 } = request.query;

        const records = await db.collection('records')
            .find({
                tenant_id: request.tenantId,
                'properties.source': 'quick_capture',
                deleted_at: null
            })
            .sort({ created_at: -1 })
            .skip((parseInt(page) - 1) * parseInt(limit))
            .limit(parseInt(limit))
            .toArray();

        const total = await db.collection('records').countDocuments({
            tenant_id: request.tenantId,
            'properties.source': 'quick_capture',
            deleted_at: null
        });

        return {
            records,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total
            }
        };
    });

    // ==================== INCIDENTS ====================
  
  // List incidents
  fastify.get('/', {
    preHandler: [authMiddleware, tenantMiddleware]
  }, async (request, reply) => {
    const db = fastify.db();
    const { status, page = 1, limit = 50 } = request.query;
    
    const filter = { tenant_id: request.tenantId };
    if (status) filter.status = status;
    
    const incidents = await db.collection('incidents')
      .find(filter)
      .sort({ created_at: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .toArray();
    
    return { incidents };
  });
  
  // Create incident
  fastify.post('/', {
    preHandler: [authMiddleware, tenantMiddleware, requirePermission('incident:create')]
  }, async (request, reply) => {
    const db = fastify.db();
    const { title, description, severity, affected_services } = request.body;
    
    const incident = {
      tenant_id: request.tenantId,
      title,
      description,
      severity: severity || 'medium',
      affected_services: affected_services || [],
      status: 'open',
      created_by: request.currentUser._id,
      created_at: new Date(),
      updated_at: new Date(),
      resolved_at: null,
      timeline: [{
        action: 'created',
        user_id: request.currentUser._id,
        timestamp: new Date(),
        note: 'Incident created'
      }]
    };
    
    const result = await db.collection('incidents').insertOne(incident);
    
    // Audit log
    await db.collection('audit_logs').insertOne({
      tenant_id: request.tenantId,
      user_id: request.currentUser._id,
      action: 'incident.created',
      resource: 'incident',
      resource_id: result.insertedId,
      timestamp: new Date()
    });
    
    return { success: true, incidentId: result.insertedId };
  });
  
  // Get incident
  fastify.get('/:incidentId', {
    preHandler: [authMiddleware, tenantMiddleware]
  }, async (request, reply) => {
    const db = fastify.db();
    const { incidentId } = request.params;
    const objectId = toObjectId(incidentId);
    
    if (!objectId) {
      return reply.status(400).send({ error: 'Invalid incident ID' });
    }
    
    const incident = await db.collection('incidents').findOne({
      _id: objectId,
      tenant_id: request.tenantId
    });
    
    if (!incident) {
      return reply.status(404).send({ error: 'Incident not found' });
    }
    
    // Get related KBs
    const relatedKBs = await db.collection('records')
      .find({
        tenant_id: request.tenantId,
        incident_id: objectId
      })
      .toArray();
    
    return { incident, relatedKBs };
  });
  
  // Update incident
  fastify.patch('/:incidentId', {
    preHandler: [authMiddleware, tenantMiddleware, requirePermission('incident:edit')]
  }, async (request, reply) => {
    const db = fastify.db();
    const { incidentId } = request.params;
    const objectId = toObjectId(incidentId);
    const { note, ...updates } = request.body;
    
    if (!objectId) {
      return reply.status(400).send({ error: 'Invalid incident ID' });
    }
    
    const timelineEntry = {
      action: 'updated',
      user_id: request.currentUser._id,
      timestamp: new Date(),
      note: note || 'Incident updated',
      changes: updates
    };
    
    await db.collection('incidents').updateOne(
      { _id: objectId, tenant_id: request.tenantId },
      { 
        $set: { 
          ...updates, 
          updated_at: new Date(),
          ...(updates.status === 'resolved' && { resolved_at: new Date() })
        },
        $push: { timeline: timelineEntry }
      }
    );
    
    return { success: true };
  });
  
  // Add note to incident
  fastify.post('/:incidentId/notes', {
    preHandler: [authMiddleware, tenantMiddleware]
  }, async (request, reply) => {
    const db = fastify.db();
    const { incidentId } = request.params;
    const objectId = toObjectId(incidentId);
    const { note } = request.body;
    
    if (!objectId) {
      return reply.status(400).send({ error: 'Invalid incident ID' });
    }
    
    const timelineEntry = {
      action: 'note_added',
      user_id: request.currentUser._id,
      timestamp: new Date(),
      note
    };
    
    await db.collection('incidents').updateOne(
      { _id: objectId, tenant_id: request.tenantId },
      { 
        $push: { timeline: timelineEntry },
        $set: { updated_at: new Date() }
      }
    );
    
    return { success: true };
  });
}
