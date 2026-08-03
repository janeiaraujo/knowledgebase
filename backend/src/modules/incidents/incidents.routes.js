import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { toObjectId } from '../../utils/mongodb.js';
import { tenantMiddleware } from '../../middlewares/tenant.middleware.js';
import { requirePermission } from '../../middlewares/rbac.middleware.js';
import { ObjectId } from 'mongodb';
import Joi from 'joi';

// Helper to get OpenAI instance
const getOpenAI = async () => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return null;
    const { default: OpenAI } = await import('openai');
    return new OpenAI({ apiKey });
};

export default async function incidentRoutes(fastify, options) {

    // ==================== QUICK CAPTURE ====================
    
    // Quick Capture - Generate KB draft from incident description
    fastify.post('/quick-capture', {
        preHandler: [authMiddleware, tenantMiddleware, requirePermission('kb:create')]
    }, async (request, reply) => {
        const db = fastify.db();
        const { problem, solution, severity, affected_services, tags, category_id, logs, images, incident_id } = request.body;

        if (!problem || !solution) {
            return reply.status(400).send({
                error: 'Problema e solução são obrigatórios'
            });
        }

        // logs: texto colado (stack trace, mensagens de erro, trechos de log).
        // images: [{ url, filename, description }] - ja enviadas via /api/files/upload,
        // com description opcionalmente preenchida pela IA (POST /api/ai/describe-image).
        const cleanLogs = typeof logs === 'string' ? logs.trim() : '';
        const cleanImages = Array.isArray(images)
            ? images.filter(img => img && typeof img.url === 'string').slice(0, 10)
            : [];
        // Quando a Captura Rapida e aberta a partir de um incidente resolvido
        // (ver PATCH /incidents/:id/status), liga o KB gerado de volta a ele.
        const linkedIncidentId = incident_id ? toObjectId(incident_id) : null;

        try {
            // Check if OpenAI is configured
            const openaiKey = process.env.OPENAI_API_KEY;
            let generatedContent = null;
            let generatedTitle = null;
            let generatedSummary = null;

            if (openaiKey) {
                // Use AI to generate KB article
                const openai = await getOpenAI();

                const logsBlock = cleanLogs
                    ? `\n**Logs/Mensagens de Erro Capturadas:**\n\`\`\`\n${cleanLogs.substring(0, 4000)}\n\`\`\`\n`
                    : '';
                const imagesBlock = cleanImages.length
                    ? `\n**Evidências Visuais (${cleanImages.length} captura(s) de tela):**\n${cleanImages
                        .map((img, i) => `${i + 1}. ${img.description || img.filename || 'Screenshot sem descrição'}`)
                        .join('\n')}\n`
                    : '';

                const prompt = `Você é um especialista em documentação técnica. Com base no relato de incidente abaixo, gere um artigo de Knowledge Base profissional e bem estruturado em Markdown.

## Relato do Incidente

**Problema/Indisponibilidade:**
${problem}

**Solução Aplicada:**
${solution}

${severity ? `**Severidade:** ${severity}` : ''}
${affected_services ? `**Serviços Afetados:** ${affected_services}` : ''}
${logsBlock}${imagesBlock}
## Instruções

Gere um artigo KB completo com:
1. **Título** - Claro e descritivo (máximo 80 caracteres)
2. **Resumo** - Breve descrição do problema (2-3 linhas)
3. **Sintomas** - Lista de sintomas observados
4. **Causa Raiz** - Análise da causa do problema
5. **Solução** - Passos detalhados da solução
6. **Prevenção** - Como evitar que ocorra novamente

${cleanLogs ? 'Cite trechos relevantes dos logs (mensagens de erro, códigos de status, stack traces) nas seções de Sintomas e Causa Raiz, entre crases ou em bloco de código.' : ''}
${cleanImages.length ? 'Referencie o que as evidências visuais mostram, quando relevante para os Sintomas ou a Causa Raiz.' : ''}
NÃO inclua uma seção de evidências/anexos no conteúdo - ela será adicionada automaticamente depois.

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

${cleanLogs ? `## Logs/Mensagens de Erro\n\`\`\`\n${cleanLogs.substring(0, 4000)}\n\`\`\`\n` : ''}
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

            // Anexa a secao de evidencias com as URLs reais (nao confiar na IA para
            // reproduzir URLs literalmente). Feito fora dos dois ramos acima para
            // valer tanto para o artigo gerado por IA quanto para o template basico.
            if (cleanImages.length || (cleanLogs && openaiKey)) {
                let evidenceSection = '\n\n## Evidências\n';

                if (cleanImages.length) {
                    evidenceSection += cleanImages
                        .map(img => `\n![${(img.description || img.filename || 'Screenshot').replace(/[[\]]/g, '')}](${img.url})\n${img.description ? `*${img.description}*\n` : ''}`)
                        .join('');
                }

                // No caminho com IA, os logs ja citados no prompt podem nao aparecer
                // literalmente no texto gerado - garante o bloco bruto disponivel.
                if (cleanLogs && openaiKey) {
                    evidenceSection += `\n**Log completo capturado:**\n\`\`\`\n${cleanLogs.substring(0, 8000)}\n\`\`\`\n`;
                }

                generatedContent += evidenceSection;
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
                incident_id: linkedIncidentId,
                properties: {
                    summary: generatedSummary,
                    severity: severity || 'medium',
                    source: 'quick_capture',
                    original_problem: problem,
                    original_solution: solution,
                    affected_services: affected_services || '',
                    logs: cleanLogs || undefined,
                    images: cleanImages.length ? cleanImages : undefined
                },
                tags: tags ? tags.map(t => new ObjectId(t)) : [],
                views: 0,
                helpful_count: 0,
                not_helpful_count: 0
            };

            const result = await db.collection('records').insertOne(newRecord);
            newRecord._id = result.insertedId;

            if (linkedIncidentId) {
                await db.collection('incidents').updateOne(
                    { _id: linkedIncidentId, tenant_id: request.tenantId },
                    {
                        $push: {
                            related_kb_ids: result.insertedId,
                            timeline: {
                                action: 'kb_created',
                                user_id: request.currentUser._id,
                                timestamp: new Date(),
                                note: 'KB gerado a partir deste incidente via Captura Rápida'
                            }
                        },
                        $set: { updated_at: new Date() }
                    }
                );
            }

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
                    solution_length: solution.length,
                    has_logs: Boolean(cleanLogs),
                    image_count: cleanImages.length
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
    
    if (!title) {
      return reply.status(400).send({ error: 'Título é obrigatório' });
    }

    const incident = {
      tenant_id: request.tenantId,
      title,
      description: description || '',
      severity: severity || 'medium',
      affected_services: affected_services || [],
      status: 'open',
      created_by: request.currentUser._id,
      created_via: 'manual',
      created_at: new Date(),
      updated_at: new Date(),
      acknowledged_at: null,
      acknowledged_by: null,
      resolved_at: null,
      related_kb_ids: [],
      timeline: [{
        action: 'created',
        user_id: request.currentUser._id,
        timestamp: new Date(),
        note: 'Incidente criado'
      }]
    };

    const result = await db.collection('incidents').insertOne(incident);
    incident._id = result.insertedId;

    // Audit log
    await db.collection('audit_logs').insertOne({
      tenant_id: request.tenantId,
      user_id: request.currentUser._id,
      action: 'incident.created',
      resource: 'incident',
      resource_id: result.insertedId,
      timestamp: new Date()
    });

    return reply.status(201).send({ success: true, incidentId: result.insertedId, incident });
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
  
  // Update incident (campos gerais - titulo, descricao, servicos afetados...)
  // Mudanca de status NAO passa por aqui: usa PATCH /:incidentId/status, que
  // valida a transicao. `status` no corpo desta rota e ignorado de proposito.
  fastify.patch('/:incidentId', {
    preHandler: [authMiddleware, tenantMiddleware, requirePermission('incident:edit')]
  }, async (request, reply) => {
    const db = fastify.db();
    const { incidentId } = request.params;
    const objectId = toObjectId(incidentId);
    const { note, status, ...updates } = request.body;

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
          updated_at: new Date()
        },
        $push: { timeline: timelineEntry }
      }
    );

    return { success: true };
  });

  // Transicoes de status do incidente, seguindo o modelo de lifecycle mais
  // comum em ferramentas de on-call (PagerDuty/Opsgenie): aberto (triggered)
  // -> reconhecido (acknowledged, "pausa" a notificacao enquanto alguem
  // trabalha nele) -> resolvido. Reabertura e permitida a partir de
  // reconhecido ou resolvido.
  const INCIDENT_TRANSITIONS = {
    open: ['acknowledged', 'resolved'],
    acknowledged: ['open', 'resolved'],
    resolved: ['open']
  };

  const STATUS_NOTES = {
    open: 'Incidente reaberto',
    acknowledged: 'Incidente reconhecido - notificações pausadas enquanto está em tratamento',
    resolved: 'Incidente resolvido'
  };

  fastify.patch('/:incidentId/status', {
    preHandler: [authMiddleware, tenantMiddleware, requirePermission('incident:edit')]
  }, async (request, reply) => {
    const db = fastify.db();
    const objectId = toObjectId(request.params.incidentId);
    if (!objectId) {
      return reply.status(400).send({ error: 'Invalid incident ID' });
    }

    const { status: nextStatus, note } = request.body || {};
    if (!nextStatus || !(nextStatus in INCIDENT_TRANSITIONS)) {
      return reply.status(400).send({ error: 'status deve ser "open", "acknowledged" ou "resolved"' });
    }

    const incident = await db.collection('incidents').findOne({
      _id: objectId,
      tenant_id: request.tenantId
    });

    if (!incident) {
      return reply.status(404).send({ error: 'Incident not found' });
    }

    const allowedNext = INCIDENT_TRANSITIONS[incident.status] || [];
    if (incident.status === nextStatus) {
      return reply.status(400).send({ error: `Incidente já está em "${nextStatus}"` });
    }
    if (!allowedNext.includes(nextStatus)) {
      return reply.status(400).send({
        error: `Transição inválida de "${incident.status}" para "${nextStatus}"`,
        allowed: allowedNext
      });
    }

    const update = { status: nextStatus, updated_at: new Date() };

    if (nextStatus === 'acknowledged') {
      update.acknowledged_at = new Date();
      update.acknowledged_by = request.currentUser._id;
    }
    if (nextStatus === 'resolved') {
      update.resolved_at = new Date();
    }
    if (nextStatus === 'open') {
      // Reabertura: limpa marcas de reconhecimento/resolucao anteriores
      update.acknowledged_at = null;
      update.acknowledged_by = null;
      update.resolved_at = null;
    }

    const timelineEntry = {
      action: `status_${nextStatus}`,
      user_id: request.currentUser._id,
      timestamp: new Date(),
      note: note || STATUS_NOTES[nextStatus]
    };

    await db.collection('incidents').updateOne(
      { _id: objectId, tenant_id: request.tenantId },
      { $set: update, $push: { timeline: timelineEntry } }
    );

    await db.collection('audit_logs').insertOne({
      tenant_id: request.tenantId,
      user_id: request.currentUser._id,
      action: `incident.${nextStatus}`,
      resource: 'incident',
      resource_id: objectId,
      timestamp: new Date()
    });

    // "Prompt, nao force": ao resolver, sugere criar KB sempre, e sugere
    // postmortem quando a severidade justifica - a pessoa decide se cria.
    return {
      success: true,
      status: nextStatus,
      suggestions: nextStatus === 'resolved' ? {
        kb: true,
        postmortem: ['critical', 'high'].includes(incident.severity)
      } : null
    };
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
