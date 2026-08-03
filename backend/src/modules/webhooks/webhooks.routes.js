/**
 * Webhooks Module Routes
 * 
 * Allows external integrations to receive notifications when events occur
 * Events: kb.created, kb.updated, kb.published, incident.created, gps.session_completed
 */

import { ObjectId } from 'mongodb';
import crypto from 'crypto';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { tenantMiddleware } from '../../middlewares/tenant.middleware.js';

export default async function webhooksRoutes(fastify, options) {
    
    // Helper: Convert string to ObjectId safely
    const toObjectId = (id) => {
        try {
            return new ObjectId(id);
        } catch {
            return null;
        }
    };

    // Helper: Generate webhook secret
    const generateSecret = () => {
        return crypto.randomBytes(32).toString('hex');
    };

    // Helper: Create signature for payload
    const createSignature = (payload, secret) => {
        return crypto.createHmac('sha256', secret)
            .update(JSON.stringify(payload))
            .digest('hex');
    };

    // ==================== WEBHOOK MANAGEMENT ====================

    // List all webhooks
    fastify.get('/', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async (request, reply) => {
        const db = fastify.db();
        
        const webhooks = await db.collection('webhooks')
            .find({ 
                tenant_id: request.tenantId,
                deleted_at: null 
            })
            .sort({ created_at: -1 })
            .toArray();

        // Mask secrets
        const maskedWebhooks = webhooks.map(wh => ({
            ...wh,
            secret: wh.secret ? `${wh.secret.substring(0, 8)}...` : null
        }));

        return { webhooks: maskedWebhooks };
    });

    // Get single webhook
    fastify.get('/:webhookId', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async (request, reply) => {
        const db = fastify.db();
        const { webhookId } = request.params;
        const objectId = toObjectId(webhookId);

        if (!objectId) {
            return reply.status(400).send({ error: 'ID de webhook inválido' });
        }

        const webhook = await db.collection('webhooks').findOne({
            _id: objectId,
            tenant_id: request.tenantId,
            deleted_at: null
        });

        if (!webhook) {
            return reply.status(404).send({ error: 'Webhook não encontrado' });
        }

        // Mask secret
        webhook.secret = webhook.secret ? `${webhook.secret.substring(0, 8)}...` : null;

        // Get recent delivery logs
        const deliveries = await db.collection('webhook_deliveries')
            .find({ webhook_id: objectId })
            .sort({ created_at: -1 })
            .limit(10)
            .toArray();

        return { webhook, deliveries };
    });

    // Create webhook
    fastify.post('/', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async (request, reply) => {
        const db = fastify.db();
        const { name, url, events, headers } = request.body;

        if (!name || !url) {
            return reply.status(400).send({ error: 'Nome e URL são obrigatórios' });
        }

        // Validate URL
        try {
            new URL(url);
        } catch {
            return reply.status(400).send({ error: 'URL inválida' });
        }

        // Validate events
        const validEvents = [
            'kb.created', 'kb.updated', 'kb.published', 'kb.deleted',
            'incident.created', 'incident.updated', 'incident.resolved',
            'gps.session_started', 'gps.session_completed',
            'comment.created', 'user.joined'
        ];

        const selectedEvents = events || ['kb.created', 'kb.published'];
        const invalidEvents = selectedEvents.filter(e => !validEvents.includes(e));
        
        if (invalidEvents.length > 0) {
            return reply.status(400).send({ 
                error: `Eventos inválidos: ${invalidEvents.join(', ')}`,
                valid_events: validEvents
            });
        }

        const newWebhook = {
            tenant_id: request.tenantId,
            name,
            url,
            events: selectedEvents,
            headers: headers || {},
            secret: generateSecret(),
            is_active: true,
            retry_count: 3,
            timeout_ms: 10000,
            created_by: request.currentUser._id,
            created_at: new Date(),
            updated_at: new Date(),
            deleted_at: null,
            stats: {
                total_deliveries: 0,
                successful_deliveries: 0,
                failed_deliveries: 0,
                last_delivery_at: null
            }
        };

        const result = await db.collection('webhooks').insertOne(newWebhook);
        newWebhook._id = result.insertedId;

        // Return full secret only on creation
        return reply.status(201).send({ 
            webhook: newWebhook,
            message: 'Webhook criado. Guarde o secret, ele não será mostrado novamente.'
        });
    });

    // Update webhook
    fastify.put('/:webhookId', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async (request, reply) => {
        const db = fastify.db();
        const { webhookId } = request.params;
        const objectId = toObjectId(webhookId);

        if (!objectId) {
            return reply.status(400).send({ error: 'ID de webhook inválido' });
        }

        const { name, url, events, headers, is_active, retry_count, timeout_ms } = request.body;

        const updateData = { updated_at: new Date() };

        if (name !== undefined) updateData.name = name;
        if (url !== undefined) {
            try {
                new URL(url);
                updateData.url = url;
            } catch {
                return reply.status(400).send({ error: 'URL inválida' });
            }
        }
        if (events !== undefined) updateData.events = events;
        if (headers !== undefined) updateData.headers = headers;
        if (is_active !== undefined) updateData.is_active = is_active;
        if (retry_count !== undefined) updateData.retry_count = Math.min(5, Math.max(0, retry_count));
        if (timeout_ms !== undefined) updateData.timeout_ms = Math.min(30000, Math.max(1000, timeout_ms));

        const result = await db.collection('webhooks').findOneAndUpdate(
            { _id: objectId, tenant_id: request.tenantId, deleted_at: null },
            { $set: updateData },
            { returnDocument: 'after' }
        );

        if (!result) {
            return reply.status(404).send({ error: 'Webhook não encontrado' });
        }

        result.secret = result.secret ? `${result.secret.substring(0, 8)}...` : null;
        return { webhook: result };
    });

    // Regenerate webhook secret
    fastify.post('/:webhookId/regenerate-secret', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async (request, reply) => {
        const db = fastify.db();
        const { webhookId } = request.params;
        const objectId = toObjectId(webhookId);

        if (!objectId) {
            return reply.status(400).send({ error: 'ID de webhook inválido' });
        }

        const newSecret = generateSecret();

        const result = await db.collection('webhooks').findOneAndUpdate(
            { _id: objectId, tenant_id: request.tenantId, deleted_at: null },
            { $set: { secret: newSecret, updated_at: new Date() } },
            { returnDocument: 'after' }
        );

        if (!result) {
            return reply.status(404).send({ error: 'Webhook não encontrado' });
        }

        return { 
            secret: newSecret,
            message: 'Novo secret gerado. Guarde-o, ele não será mostrado novamente.'
        };
    });

    // Test webhook
    fastify.post('/:webhookId/test', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async (request, reply) => {
        const db = fastify.db();
        const { webhookId } = request.params;
        const objectId = toObjectId(webhookId);

        if (!objectId) {
            return reply.status(400).send({ error: 'ID de webhook inválido' });
        }

        const webhook = await db.collection('webhooks').findOne({
            _id: objectId,
            tenant_id: request.tenantId,
            deleted_at: null
        });

        if (!webhook) {
            return reply.status(404).send({ error: 'Webhook não encontrado' });
        }

        // Send test payload
        const testPayload = {
            event: 'webhook.test',
            timestamp: new Date().toISOString(),
            webhook_id: webhookId,
            data: {
                message: 'Este é um webhook de teste',
                triggered_by: request.currentUser.name
            }
        };

        try {
            const result = await deliverWebhook(webhook, testPayload);
            
            // Log delivery
            await db.collection('webhook_deliveries').insertOne({
                webhook_id: objectId,
                tenant_id: request.tenantId,
                event: 'webhook.test',
                payload: testPayload,
                status: result.success ? 'success' : 'failed',
                response_status: result.status,
                response_body: result.body,
                duration_ms: result.duration,
                created_at: new Date()
            });

            return { 
                success: result.success,
                status_code: result.status,
                duration_ms: result.duration,
                response: result.body?.substring(0, 500)
            };
        } catch (error) {
            return reply.status(500).send({ 
                error: 'Falha ao testar webhook',
                details: error.message 
            });
        }
    });

    // Delete webhook
    fastify.delete('/:webhookId', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async (request, reply) => {
        const db = fastify.db();
        const { webhookId } = request.params;
        const objectId = toObjectId(webhookId);

        if (!objectId) {
            return reply.status(400).send({ error: 'ID de webhook inválido' });
        }

        await db.collection('webhooks').updateOne(
            { _id: objectId, tenant_id: request.tenantId },
            { $set: { deleted_at: new Date(), is_active: false } }
        );

        return { success: true };
    });

    // Get webhook delivery logs
    fastify.get('/:webhookId/deliveries', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async (request, reply) => {
        const db = fastify.db();
        const { webhookId } = request.params;
        const { page = 1, limit = 20 } = request.query;
        const objectId = toObjectId(webhookId);

        if (!objectId) {
            return reply.status(400).send({ error: 'ID de webhook inválido' });
        }

        const deliveries = await db.collection('webhook_deliveries')
            .find({ webhook_id: objectId, tenant_id: request.tenantId })
            .sort({ created_at: -1 })
            .skip((parseInt(page) - 1) * parseInt(limit))
            .limit(parseInt(limit))
            .toArray();

        const total = await db.collection('webhook_deliveries').countDocuments({
            webhook_id: objectId,
            tenant_id: request.tenantId
        });

        return {
            deliveries,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total
            }
        };
    });

    // ==================== INTERNAL DELIVERY FUNCTION ====================

    async function deliverWebhook(webhook, payload) {
        const startTime = Date.now();
        const signature = createSignature(payload, webhook.secret);

        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), webhook.timeout_ms || 10000);

            const response = await fetch(webhook.url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Webhook-Signature': signature,
                    'X-Webhook-Event': payload.event,
                    'X-Webhook-Delivery-Id': new ObjectId().toString(),
                    ...webhook.headers
                },
                body: JSON.stringify(payload),
                signal: controller.signal
            });

            clearTimeout(timeout);
            const duration = Date.now() - startTime;
            const body = await response.text();

            return {
                success: response.ok,
                status: response.status,
                body,
                duration
            };
        } catch (error) {
            return {
                success: false,
                status: 0,
                body: error.message,
                duration: Date.now() - startTime
            };
        }
    }

    // ==================== WEBHOOK TRIGGER SERVICE ====================

    // This function can be called from other modules to trigger webhooks
    fastify.decorate('triggerWebhook', async (tenantId, event, data) => {
        const db = fastify.db();

        // Find all active webhooks for this event
        const webhooks = await db.collection('webhooks').find({
            tenant_id: tenantId,
            events: event,
            is_active: true,
            deleted_at: null
        }).toArray();

        if (webhooks.length === 0) return;

        const payload = {
            event,
            timestamp: new Date().toISOString(),
            data
        };

        // Deliver to all webhooks asynchronously
        for (const webhook of webhooks) {
            // Don't await - fire and forget with retry logic
            deliverWithRetry(db, webhook, payload);
        }
    });

    async function deliverWithRetry(db, webhook, payload, attempt = 1) {
        const result = await deliverWebhook(webhook, payload);

        // Log delivery
        await db.collection('webhook_deliveries').insertOne({
            webhook_id: webhook._id,
            tenant_id: webhook.tenant_id,
            event: payload.event,
            payload,
            status: result.success ? 'success' : 'failed',
            response_status: result.status,
            response_body: result.body?.substring(0, 1000),
            duration_ms: result.duration,
            attempt,
            created_at: new Date()
        });

        // Update stats
        const statsUpdate = {
            'stats.total_deliveries': 1,
            'stats.last_delivery_at': new Date()
        };

        if (result.success) {
            statsUpdate['stats.successful_deliveries'] = 1;
        } else {
            statsUpdate['stats.failed_deliveries'] = 1;

            // Retry if failed and attempts remaining
            if (attempt < webhook.retry_count) {
                const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
                setTimeout(() => {
                    deliverWithRetry(db, webhook, payload, attempt + 1);
                }, delay);
            }
        }

        // O tenant sai do proprio webhook: esta funcao roda fora do ciclo da
        // requisicao (entrega assincrona, com retry agendado por setTimeout),
        // entao `request` nao existe aqui.
        await db.collection('webhooks').updateOne(
            { _id: webhook._id, tenant_id: webhook.tenant_id },
            { $inc: statsUpdate }
        );
    }

    // Get available events
    fastify.get('/events/list', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async (request, reply) => {
        return {
            events: [
                { id: 'kb.created', name: 'KB Criado', description: 'Quando um novo KB é criado' },
                { id: 'kb.updated', name: 'KB Atualizado', description: 'Quando um KB é editado' },
                { id: 'kb.published', name: 'KB Publicado', description: 'Quando um KB é publicado' },
                { id: 'kb.deleted', name: 'KB Excluído', description: 'Quando um KB é excluído' },
                { id: 'incident.created', name: 'Incidente Criado', description: 'Quando um novo incidente é registrado' },
                { id: 'incident.updated', name: 'Incidente Atualizado', description: 'Quando um incidente é atualizado' },
                { id: 'incident.resolved', name: 'Incidente Resolvido', description: 'Quando um incidente é marcado como resolvido' },
                { id: 'gps.session_started', name: 'Sessão GPS Iniciada', description: 'Quando uma sessão de diagnóstico é iniciada' },
                { id: 'gps.session_completed', name: 'Sessão GPS Concluída', description: 'Quando uma sessão de diagnóstico é concluída' },
                { id: 'comment.created', name: 'Comentário Adicionado', description: 'Quando um comentário é adicionado a um KB' },
                { id: 'user.joined', name: 'Usuário Entrou', description: 'Quando um novo usuário entra na organização' }
            ]
        };
    });
}
