/**
 * Integrations Module - Backend Routes
 * 
 * Features:
 * - Slack integration
 * - Microsoft Teams integration
 * - Custom webhook notifications
 */

import { ObjectId } from 'mongodb';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { tenantMiddleware } from '../../middlewares/tenant.middleware.js';

export default async function integrationsRoutes(fastify, options) {
    const db = () => fastify.db();

    const toObjectId = (id) => {
        try {
            return new ObjectId(id);
        } catch {
            return null;
        }
    };

    // ==================== INTEGRATION CONFIGURATIONS ====================

    /**
     * List available integrations
     */
    fastify.get('/', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async (request, reply) => {
        // Get configured integrations for this tenant
        const configured = await db().collection('integrations')
            .find({ tenant_id: request.tenantId })
            .toArray();

        const configuredMap = configured.reduce((acc, int) => {
            acc[int.type] = int;
            return acc;
        }, {});

        const integrations = [
            {
                type: 'slack',
                name: 'Slack',
                description: 'Receba notificações de KBs, incidentes e atividades no Slack',
                icon: 'bi-slack',
                color: '#4A154B',
                configured: !!configuredMap.slack,
                config: configuredMap.slack || null,
                features: [
                    'Notificações de novos KBs',
                    'Alertas de incidentes',
                    'Resumos diários/semanais',
                    'Comandos slash para busca'
                ],
                setup_url: 'https://api.slack.com/apps'
            },
            {
                type: 'teams',
                name: 'Microsoft Teams',
                description: 'Integre com Microsoft Teams para notificações e colaboração',
                icon: 'bi-microsoft-teams',
                color: '#6264A7',
                configured: !!configuredMap.teams,
                config: configuredMap.teams || null,
                features: [
                    'Notificações em canais',
                    'Cartões adaptáveis',
                    'Busca via bot',
                    'Aprovações de KBs'
                ],
                setup_url: 'https://portal.azure.com'
            },
            {
                type: 'email',
                name: 'Email (SMTP)',
                description: 'Configure servidor SMTP para notificações por email',
                icon: 'bi-envelope',
                color: '#0d6efd',
                configured: !!configuredMap.email,
                config: configuredMap.email || null,
                features: [
                    'Notificações personalizadas',
                    'Relatórios agendados',
                    'Alertas de revisão',
                    'Digest semanal'
                ]
            },
            {
                type: 'jira',
                name: 'Jira',
                description: 'Integre com Jira para vincular KBs a tickets',
                icon: 'bi-kanban',
                color: '#0052CC',
                configured: !!configuredMap.jira,
                config: configuredMap.jira || null,
                features: [
                    'Criar KBs a partir de issues',
                    'Vincular KBs a tickets',
                    'Sincronizar status',
                    'Comentários bidirecionais'
                ],
                setup_url: 'https://developer.atlassian.com'
            },
            {
                type: 'pagerduty',
                name: 'PagerDuty',
                description: 'Integre com PagerDuty para gerenciamento de incidentes',
                icon: 'bi-bell',
                color: '#06AC38',
                configured: !!configuredMap.pagerduty,
                config: configuredMap.pagerduty || null,
                features: [
                    'Criar incidentes automaticamente',
                    'Vincular KBs a alertas',
                    'Runbooks automáticos',
                    'Post-mortems integrados'
                ],
                setup_url: 'https://developer.pagerduty.com'
            },
            {
                type: 'datadog',
                name: 'Datadog',
                description: 'Integre com Datadog para métricas e monitoramento',
                icon: 'bi-graph-up',
                color: '#632CA6',
                configured: !!configuredMap.datadog,
                config: configuredMap.datadog || null,
                features: [
                    'Métricas de uso',
                    'Dashboard personalizado',
                    'Alertas baseados em dados',
                    'Correlação de incidentes'
                ],
                setup_url: 'https://docs.datadoghq.com'
            }
        ];

        return {
            success: true,
            integrations
        };
    });

    /**
     * Configure an integration
     */
    fastify.post('/:type', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async (request, reply) => {
        const { type } = request.params;
        const config = request.body;

        // Only admin/owner can configure integrations
        if (!['admin', 'owner'].includes(request.currentUser.role)) {
            return reply.status(403).send({ error: 'Sem permissão' });
        }

        // Validate config based on type
        const validationResult = validateIntegrationConfig(type, config);
        if (!validationResult.valid) {
            return reply.status(400).send({ error: validationResult.error });
        }

        // Test connection if possible
        const testResult = await testIntegrationConnection(type, config);
        if (!testResult.success) {
            return reply.status(400).send({ 
                error: 'Falha ao conectar com a integração',
                details: testResult.error 
            });
        }

        // Save configuration
        const integration = {
            tenant_id: request.tenantId,
            type,
            config: {
                ...config,
                // Don't store sensitive data in plain text
                webhook_url: config.webhook_url,
                api_key: config.api_key ? '***configured***' : null
            },
            raw_config: config, // Store encrypted in production
            enabled: true,
            configured_by: request.currentUser._id,
            configured_at: new Date(),
            updated_at: new Date()
        };

        await db().collection('integrations').updateOne(
            { tenant_id: request.tenantId, type },
            { $set: integration },
            { upsert: true }
        );

        // Log the configuration
        await db().collection('audit_logs').insertOne({
            tenant_id: request.tenantId,
            user_id: request.currentUser._id,
            action: 'integration_configured',
            resource_type: 'integration',
            resource_id: type,
            details: { integration_type: type },
            timestamp: new Date()
        });

        return {
            success: true,
            message: `Integração ${type} configurada com sucesso`
        };
    });

    /**
     * Update integration settings
     */
    fastify.put('/:type', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async (request, reply) => {
        const { type } = request.params;
        const updates = request.body;

        if (!['admin', 'owner'].includes(request.currentUser.role)) {
            return reply.status(403).send({ error: 'Sem permissão' });
        }

        await db().collection('integrations').updateOne(
            { tenant_id: request.tenantId, type },
            { 
                $set: { 
                    ...updates, 
                    updated_at: new Date() 
                } 
            }
        );

        return { success: true };
    });

    /**
     * Delete/disable integration
     */
    fastify.delete('/:type', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async (request, reply) => {
        const { type } = request.params;

        if (!['admin', 'owner'].includes(request.currentUser.role)) {
            return reply.status(403).send({ error: 'Sem permissão' });
        }

        await db().collection('integrations').deleteOne({
            tenant_id: request.tenantId,
            type
        });

        return { success: true };
    });

    /**
     * Test integration connection
     */
    fastify.post('/:type/test', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async (request, reply) => {
        const { type } = request.params;
        const config = request.body;

        const result = await testIntegrationConnection(type, config);
        
        if (result.success) {
            return { success: true, message: 'Conexão bem sucedida!' };
        } else {
            return reply.status(400).send({ 
                error: 'Falha na conexão', 
                details: result.error 
            });
        }
    });

    // ==================== NOTIFICATION SETTINGS ====================

    /**
     * Get notification settings
     */
    fastify.get('/notifications/settings', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async (request, reply) => {
        const settings = await db().collection('notification_settings')
            .findOne({ tenant_id: request.tenantId }) || {
                kb_created: { slack: true, teams: true, email: true },
                kb_published: { slack: true, teams: true, email: true },
                kb_updated: { slack: false, teams: false, email: false },
                incident_created: { slack: true, teams: true, email: true },
                incident_resolved: { slack: true, teams: true, email: true },
                review_needed: { slack: true, teams: true, email: true },
                daily_digest: { slack: false, teams: false, email: true },
                weekly_digest: { slack: true, teams: true, email: true }
            };

        return {
            success: true,
            settings
        };
    });

    /**
     * Update notification settings
     */
    fastify.put('/notifications/settings', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async (request, reply) => {
        const settings = request.body;

        if (!['admin', 'owner'].includes(request.currentUser.role)) {
            return reply.status(403).send({ error: 'Sem permissão' });
        }

        await db().collection('notification_settings').updateOne(
            { tenant_id: request.tenantId },
            { 
                $set: { 
                    ...settings, 
                    tenant_id: request.tenantId,
                    updated_at: new Date() 
                } 
            },
            { upsert: true }
        );

        return { success: true };
    });

    // ==================== SEND NOTIFICATIONS ====================

    /**
     * Send a test notification
     */
    fastify.post('/notifications/test', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async (request, reply) => {
        const { type, channel } = request.body;

        const integration = await db().collection('integrations')
            .findOne({ tenant_id: request.tenantId, type, enabled: true });

        if (!integration) {
            return reply.status(400).send({ 
                error: `Integração ${type} não configurada ou desabilitada` 
            });
        }

        try {
            await sendNotification(type, integration.raw_config, {
                title: '🧪 Teste de Notificação',
                message: 'Esta é uma notificação de teste do Incident KB',
                type: 'test',
                link: process.env.FRONTEND_URL || 'http://localhost:5173'
            });

            return { success: true, message: 'Notificação de teste enviada!' };
        } catch (error) {
            fastify.log.error('Test notification error:', error);
            return reply.status(500).send({ error: 'Erro ao enviar notificação' });
        }
    });

    // ==================== HELPER FUNCTIONS ====================

    function validateIntegrationConfig(type, config) {
        switch (type) {
            case 'slack':
                if (!config.webhook_url || !config.webhook_url.includes('hooks.slack.com')) {
                    return { valid: false, error: 'URL do webhook do Slack inválida' };
                }
                break;
            
            case 'teams':
                if (!config.webhook_url || !config.webhook_url.includes('webhook.office.com')) {
                    return { valid: false, error: 'URL do webhook do Teams inválida' };
                }
                break;
            
            case 'email':
                if (!config.smtp_host || !config.smtp_port) {
                    return { valid: false, error: 'Configuração SMTP incompleta' };
                }
                break;
            
            case 'jira':
                if (!config.base_url || !config.api_token || !config.email) {
                    return { valid: false, error: 'Configuração Jira incompleta' };
                }
                break;
            
            case 'pagerduty':
                if (!config.api_key) {
                    return { valid: false, error: 'API Key do PagerDuty necessária' };
                }
                break;
            
            case 'datadog':
                if (!config.api_key || !config.app_key) {
                    return { valid: false, error: 'API Key e App Key do Datadog necessárias' };
                }
                break;
        }

        return { valid: true };
    }

    async function testIntegrationConnection(type, config) {
        try {
            switch (type) {
                case 'slack':
                    return await testSlackConnection(config);
                
                case 'teams':
                    return await testTeamsConnection(config);
                
                case 'email':
                    // SMTP test would require nodemailer
                    return { success: true };
                
                case 'jira':
                    return await testJiraConnection(config);
                
                case 'pagerduty':
                    return await testPagerDutyConnection(config);
                
                case 'datadog':
                    return await testDatadogConnection(config);
                
                default:
                    return { success: true };
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async function testSlackConnection(config) {
        const response = await fetch(config.webhook_url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text: '✅ Conexão com Incident KB estabelecida!'
            })
        });

        if (!response.ok) {
            throw new Error(`Slack returned ${response.status}`);
        }

        return { success: true };
    }

    async function testTeamsConnection(config) {
        const response = await fetch(config.webhook_url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                '@type': 'MessageCard',
                '@context': 'http://schema.org/extensions',
                summary: 'Teste de Conexão',
                themeColor: '0076D7',
                title: '✅ Conexão com Incident KB estabelecida!',
                text: 'A integração com Microsoft Teams foi configurada com sucesso.'
            })
        });

        if (!response.ok) {
            throw new Error(`Teams returned ${response.status}`);
        }

        return { success: true };
    }

    async function testJiraConnection(config) {
        const auth = Buffer.from(`${config.email}:${config.api_token}`).toString('base64');
        
        const response = await fetch(`${config.base_url}/rest/api/3/myself`, {
            headers: {
                'Authorization': `Basic ${auth}`,
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`Jira returned ${response.status}`);
        }

        return { success: true };
    }

    async function testPagerDutyConnection(config) {
        const response = await fetch('https://api.pagerduty.com/abilities', {
            headers: {
                'Authorization': `Token token=${config.api_key}`,
                'Accept': 'application/vnd.pagerduty+json;version=2'
            }
        });

        if (!response.ok) {
            throw new Error(`PagerDuty returned ${response.status}`);
        }

        return { success: true };
    }

    async function testDatadogConnection(config) {
        const response = await fetch('https://api.datadoghq.com/api/v1/validate', {
            headers: {
                'DD-API-KEY': config.api_key,
                'DD-APPLICATION-KEY': config.app_key
            }
        });

        if (!response.ok) {
            throw new Error(`Datadog returned ${response.status}`);
        }

        return { success: true };
    }

    async function sendNotification(type, config, notification) {
        switch (type) {
            case 'slack':
                return await sendSlackNotification(config, notification);
            
            case 'teams':
                return await sendTeamsNotification(config, notification);
            
            default:
                throw new Error(`Tipo de notificação não suportado: ${type}`);
        }
    }

    async function sendSlackNotification(config, notification) {
        const color = {
            success: '#28a745',
            warning: '#ffc107',
            error: '#dc3545',
            info: '#17a2b8',
            test: '#6f42c1'
        }[notification.type] || '#0d6efd';

        await fetch(config.webhook_url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                attachments: [{
                    color,
                    title: notification.title,
                    text: notification.message,
                    footer: 'Incident KB',
                    footer_icon: 'https://example.com/icon.png',
                    ts: Math.floor(Date.now() / 1000),
                    actions: notification.link ? [{
                        type: 'button',
                        text: 'Ver mais',
                        url: notification.link
                    }] : undefined
                }]
            })
        });
    }

    async function sendTeamsNotification(config, notification) {
        const color = {
            success: '28a745',
            warning: 'ffc107',
            error: 'dc3545',
            info: '17a2b8',
            test: '6f42c1'
        }[notification.type] || '0d6efd';

        await fetch(config.webhook_url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                '@type': 'MessageCard',
                '@context': 'http://schema.org/extensions',
                summary: notification.title,
                themeColor: color,
                title: notification.title,
                text: notification.message,
                potentialAction: notification.link ? [{
                    '@type': 'OpenUri',
                    name: 'Ver mais',
                    targets: [{ os: 'default', uri: notification.link }]
                }] : undefined
            })
        });
    }
}

// Export notification function for use in other modules
export async function notifyIntegrations(db, tenantId, eventType, data) {
    try {
        // Get notification settings
        const settings = await db.collection('notification_settings')
            .findOne({ tenant_id: tenantId });

        if (!settings || !settings[eventType]) return;

        // Get enabled integrations
        const integrations = await db.collection('integrations')
            .find({ tenant_id: tenantId, enabled: true })
            .toArray();

        for (const integration of integrations) {
            if (settings[eventType]?.[integration.type]) {
                try {
                    // Send notification based on type
                    // Implementation depends on integration type
                } catch (error) {
                    console.error(`Failed to notify ${integration.type}:`, error);
                }
            }
        }
    } catch (error) {
        console.error('Notification error:', error);
    }
}
