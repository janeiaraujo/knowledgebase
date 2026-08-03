/**
 * Reports Module - Backend Routes
 * 
 * Features:
 * - Generate PDF/Excel reports
 * - Scheduled reports
 * - Custom report templates
 * - Email delivery
 */

import { ObjectId } from 'mongodb';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { tenantMiddleware } from '../../middlewares/tenant.middleware.js';

export default async function reportsRoutes(fastify, options) {
    const db = () => fastify.db();

    const toObjectId = (id) => {
        try {
            return new ObjectId(id);
        } catch {
            return null;
        }
    };

    // ==================== REPORT TEMPLATES ====================

    /**
     * List available report templates
     */
    fastify.get('/templates', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async (request, reply) => {
        const templates = [
            {
                id: 'kb-summary',
                name: 'Resumo de KBs',
                description: 'Visão geral de todos os artigos da base de conhecimento',
                icon: 'bi-book',
                category: 'knowledge-base',
                parameters: ['period', 'status', 'category'],
                formats: ['pdf', 'excel', 'csv']
            },
            {
                id: 'incident-report',
                name: 'Relatório de Incidentes',
                description: 'Análise completa de incidentes por período',
                icon: 'bi-exclamation-triangle',
                category: 'incidents',
                parameters: ['period', 'severity', 'status'],
                formats: ['pdf', 'excel']
            },
            {
                id: 'user-activity',
                name: 'Atividade de Usuários',
                description: 'Métricas de engajamento e contribuições',
                icon: 'bi-people',
                category: 'users',
                parameters: ['period', 'user_id'],
                formats: ['pdf', 'excel', 'csv']
            },
            {
                id: 'content-health',
                name: 'Saúde do Conteúdo',
                description: 'Análise de qualidade e atualização do conteúdo',
                icon: 'bi-heart-pulse',
                category: 'quality',
                parameters: ['period'],
                formats: ['pdf']
            },
            {
                id: 'postmortem-summary',
                name: 'Resumo de Post-Mortems',
                description: 'Compilação de post-mortems e RCAs',
                icon: 'bi-file-medical',
                category: 'incidents',
                parameters: ['period', 'status'],
                formats: ['pdf', 'excel']
            },
            {
                id: 'analytics-overview',
                name: 'Visão Geral de Analytics',
                description: 'Dashboard completo em formato relatório',
                icon: 'bi-graph-up',
                category: 'analytics',
                parameters: ['period'],
                formats: ['pdf']
            },
            {
                id: 'search-analytics',
                name: 'Analytics de Busca',
                description: 'Termos mais buscados e taxa de sucesso',
                icon: 'bi-search',
                category: 'analytics',
                parameters: ['period'],
                formats: ['pdf', 'excel', 'csv']
            },
            {
                id: 'team-performance',
                name: 'Desempenho da Equipe',
                description: 'Métricas de produtividade por membro',
                icon: 'bi-trophy',
                category: 'users',
                parameters: ['period', 'team_id'],
                formats: ['pdf', 'excel']
            }
        ];

        // Get custom templates from database
        const customTemplates = await db().collection('report_templates')
            .find({ tenant_id: request.tenantId })
            .toArray();

        return {
            success: true,
            templates: [
                ...templates,
                ...customTemplates.map(t => ({ ...t, custom: true }))
            ]
        };
    });

    // ==================== GENERATE REPORTS ====================

    /**
     * Generate a report
     */
    fastify.post('/generate', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async (request, reply) => {
        const {
            template_id,
            format = 'pdf',
            parameters = {},
            delivery = 'download' // 'download', 'email', 'save'
        } = request.body;

        if (!template_id) {
            return reply.status(400).send({ error: 'Template ID é obrigatório' });
        }

        try {
            // Get report data based on template
            const reportData = await generateReportData(
                db(),
                request.tenantId,
                template_id,
                parameters
            );

            // Store report record
            const reportRecord = {
                tenant_id: request.tenantId,
                template_id,
                generated_by: request.currentUser._id,
                generated_by_name: request.currentUser.name,
                parameters,
                format,
                delivery,
                status: 'completed',
                data_snapshot: reportData.summary,
                created_at: new Date()
            };

            const result = await db().collection('generated_reports').insertOne(reportRecord);

            // Return appropriate response based on delivery method
            if (delivery === 'download') {
                return {
                    success: true,
                    report_id: result.insertedId,
                    data: reportData,
                    metadata: {
                        template_id,
                        format,
                        generated_at: new Date().toISOString(),
                        generated_by: request.currentUser.name,
                        parameters
                    }
                };
            }

            return {
                success: true,
                report_id: result.insertedId,
                message: delivery === 'email' 
                    ? 'Relatório será enviado por email'
                    : 'Relatório salvo com sucesso'
            };

        } catch (error) {
            fastify.log.error('Report generation error:', error);
            return reply.status(500).send({ error: 'Erro ao gerar relatório' });
        }
    });

    /**
     * List generated reports
     */
    fastify.get('/history', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async (request, reply) => {
        const { page = 1, limit = 20, template_id } = request.query;

        const filter = { tenant_id: request.tenantId };
        if (template_id) filter.template_id = template_id;

        const [reports, total] = await Promise.all([
            db().collection('generated_reports')
                .find(filter)
                .sort({ created_at: -1 })
                .skip((parseInt(page) - 1) * parseInt(limit))
                .limit(parseInt(limit))
                .toArray(),
            db().collection('generated_reports').countDocuments(filter)
        ]);

        return {
            success: true,
            reports,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            }
        };
    });

    // ==================== SCHEDULED REPORTS ====================

    /**
     * Create scheduled report
     */
    fastify.post('/schedules', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async (request, reply) => {
        const {
            template_id,
            name,
            format = 'pdf',
            parameters = {},
            schedule, // { frequency: 'daily'|'weekly'|'monthly', day?: number, time: 'HH:mm' }
            recipients = [], // email addresses
            enabled = true
        } = request.body;

        if (!template_id || !schedule || !name) {
            return reply.status(400).send({ 
                error: 'Nome, template e agendamento são obrigatórios' 
            });
        }

        const scheduledReport = {
            tenant_id: request.tenantId,
            created_by: request.currentUser._id,
            name,
            template_id,
            format,
            parameters,
            schedule,
            recipients: recipients.length > 0 ? recipients : [request.currentUser.email],
            enabled,
            last_run: null,
            next_run: calculateNextRun(schedule),
            run_count: 0,
            created_at: new Date(),
            updated_at: new Date()
        };

        const result = await db().collection('scheduled_reports').insertOne(scheduledReport);

        return {
            success: true,
            schedule_id: result.insertedId,
            next_run: scheduledReport.next_run
        };
    });

    /**
     * List scheduled reports
     */
    fastify.get('/schedules', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async (request, reply) => {
        const schedules = await db().collection('scheduled_reports')
            .find({ tenant_id: request.tenantId })
            .sort({ created_at: -1 })
            .toArray();

        return {
            success: true,
            schedules
        };
    });

    /**
     * Update scheduled report
     */
    fastify.put('/schedules/:id', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async (request, reply) => {
        const { id } = request.params;
        const updates = request.body;

        const objectId = toObjectId(id);
        if (!objectId) {
            return reply.status(400).send({ error: 'ID inválido' });
        }

        // Recalculate next run if schedule changed
        if (updates.schedule) {
            updates.next_run = calculateNextRun(updates.schedule);
        }

        updates.updated_at = new Date();

        await db().collection('scheduled_reports').updateOne(
            { _id: objectId, tenant_id: request.tenantId },
            { $set: updates }
        );

        return { success: true };
    });

    /**
     * Delete scheduled report
     */
    fastify.delete('/schedules/:id', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async (request, reply) => {
        const { id } = request.params;
        const objectId = toObjectId(id);

        if (!objectId) {
            return reply.status(400).send({ error: 'ID inválido' });
        }

        await db().collection('scheduled_reports').deleteOne({
            _id: objectId,
            tenant_id: request.tenantId
        });

        return { success: true };
    });

    // ==================== HELPER FUNCTIONS ====================

    async function generateReportData(db, tenantId, templateId, parameters) {
        const { period = '30d', status, category, severity, user_id } = parameters;
        
        // Calculate date range
        const now = new Date();
        const periodDays = {
            '7d': 7,
            '30d': 30,
            '90d': 90,
            '1y': 365
        };
        const days = periodDays[period] || 30;
        const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

        switch (templateId) {
            case 'kb-summary':
                return await generateKBSummary(db, tenantId, startDate, { status, category });
            
            case 'incident-report':
                return await generateIncidentReport(db, tenantId, startDate, { severity, status });
            
            case 'user-activity':
                return await generateUserActivityReport(db, tenantId, startDate, { user_id });
            
            case 'content-health':
                return await generateContentHealthReport(db, tenantId, startDate);
            
            case 'postmortem-summary':
                return await generatePostMortemReport(db, tenantId, startDate, { status });
            
            case 'analytics-overview':
                return await generateAnalyticsOverview(db, tenantId, startDate);
            
            case 'search-analytics':
                return await generateSearchAnalytics(db, tenantId, startDate);
            
            case 'team-performance':
                return await generateTeamPerformance(db, tenantId, startDate);
            
            default:
                throw new Error('Template não encontrado');
        }
    }

    async function generateKBSummary(db, tenantId, startDate, filters) {
        const match = { tenant_id: tenantId };
        if (filters.status) match.status = filters.status;
        if (filters.category) match.category = filters.category;

        const [
            totalKBs,
            newKBs,
            statusBreakdown,
            categoryBreakdown,
            topContributors,
            recentKBs
        ] = await Promise.all([
            db.collection('knowledge_base').countDocuments(match),
            db.collection('knowledge_base').countDocuments({
                ...match,
                created_at: { $gte: startDate }
            }),
            db.collection('knowledge_base').aggregate([
                { $match: match },
                { $group: { _id: '$status', count: { $sum: 1 } } }
            ]).toArray(),
            db.collection('knowledge_base').aggregate([
                { $match: match },
                { $group: { _id: '$category', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 10 }
            ]).toArray(),
            db.collection('knowledge_base').aggregate([
                { $match: { ...match, created_at: { $gte: startDate } } },
                { $group: { _id: '$created_by', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 10 },
                { $lookup: {
                    from: 'users',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'user'
                }},
                { $unwind: '$user' },
                { $project: { name: '$user.name', email: '$user.email', count: 1 } }
            ]).toArray(),
            db.collection('knowledge_base')
                .find(match)
                .sort({ created_at: -1 })
                .limit(20)
                .toArray()
        ]);

        return {
            title: 'Resumo da Base de Conhecimento',
            period: { start: startDate, end: new Date() },
            summary: {
                total_kbs: totalKBs,
                new_kbs: newKBs,
                growth_rate: totalKBs > 0 ? Math.round((newKBs / totalKBs) * 100) : 0
            },
            breakdown: {
                by_status: statusBreakdown.reduce((acc, item) => {
                    acc[item._id] = item.count;
                    return acc;
                }, {}),
                by_category: categoryBreakdown
            },
            top_contributors: topContributors,
            recent_articles: recentKBs.map(kb => ({
                id: kb._id,
                title: kb.title,
                status: kb.status,
                category: kb.category,
                created_at: kb.created_at,
                views: kb.views || 0
            }))
        };
    }

    async function generateIncidentReport(db, tenantId, startDate, filters) {
        const match = { 
            tenant_id: tenantId,
            created_at: { $gte: startDate }
        };
        if (filters.severity) match.severity = filters.severity;
        if (filters.status) match.status = filters.status;

        const [
            totalIncidents,
            severityBreakdown,
            statusBreakdown,
            mttrData,
            timeline
        ] = await Promise.all([
            db.collection('incidents').countDocuments(match),
            db.collection('incidents').aggregate([
                { $match: match },
                { $group: { _id: '$severity', count: { $sum: 1 } } }
            ]).toArray(),
            db.collection('incidents').aggregate([
                { $match: match },
                { $group: { _id: '$status', count: { $sum: 1 } } }
            ]).toArray(),
            db.collection('incidents').aggregate([
                { $match: { ...match, resolved_at: { $exists: true } } },
                { $project: {
                    resolution_time: { $subtract: ['$resolved_at', '$created_at'] }
                }},
                { $group: {
                    _id: null,
                    avg_mttr: { $avg: '$resolution_time' },
                    min_mttr: { $min: '$resolution_time' },
                    max_mttr: { $max: '$resolution_time' }
                }}
            ]).toArray(),
            db.collection('incidents').aggregate([
                { $match: match },
                { $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$created_at' } },
                    count: { $sum: 1 }
                }},
                { $sort: { _id: 1 } }
            ]).toArray()
        ]);

        return {
            title: 'Relatório de Incidentes',
            period: { start: startDate, end: new Date() },
            summary: {
                total_incidents: totalIncidents,
                avg_mttr_hours: mttrData[0] ? Math.round(mttrData[0].avg_mttr / 3600000) : null
            },
            breakdown: {
                by_severity: severityBreakdown.reduce((acc, item) => {
                    acc[item._id] = item.count;
                    return acc;
                }, {}),
                by_status: statusBreakdown.reduce((acc, item) => {
                    acc[item._id] = item.count;
                    return acc;
                }, {})
            },
            timeline
        };
    }

    async function generateUserActivityReport(db, tenantId, startDate, filters) {
        const match = { 
            tenant_id: tenantId,
            timestamp: { $gte: startDate }
        };
        if (filters.user_id) match.user_id = toObjectId(filters.user_id);

        const [
            totalActions,
            actionsByType,
            topUsers,
            dailyActivity
        ] = await Promise.all([
            db.collection('activity_logs').countDocuments(match),
            db.collection('activity_logs').aggregate([
                { $match: match },
                { $group: { _id: '$action', count: { $sum: 1 } } },
                { $sort: { count: -1 } }
            ]).toArray(),
            db.collection('activity_logs').aggregate([
                { $match: match },
                { $group: { _id: '$user_id', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 10 },
                { $lookup: {
                    from: 'users',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'user'
                }},
                { $unwind: '$user' },
                { $project: { name: '$user.name', count: 1 } }
            ]).toArray(),
            db.collection('activity_logs').aggregate([
                { $match: match },
                { $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
                    count: { $sum: 1 }
                }},
                { $sort: { _id: 1 } }
            ]).toArray()
        ]);

        return {
            title: 'Relatório de Atividade de Usuários',
            period: { start: startDate, end: new Date() },
            summary: {
                total_actions: totalActions,
                unique_users: topUsers.length
            },
            breakdown: {
                by_type: actionsByType
            },
            top_users: topUsers,
            daily_activity: dailyActivity
        };
    }

    async function generateContentHealthReport(db, tenantId, startDate) {
        const [
            totalKBs,
            outdatedKBs,
            unreviewed,
            orphanedKBs,
            lowQuality
        ] = await Promise.all([
            db.collection('knowledge_base').countDocuments({ tenant_id: tenantId }),
            db.collection('knowledge_base').countDocuments({
                tenant_id: tenantId,
                updated_at: { $lt: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000) }
            }),
            db.collection('knowledge_base').countDocuments({
                tenant_id: tenantId,
                status: 'draft',
                created_at: { $lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
            }),
            db.collection('knowledge_base').countDocuments({
                tenant_id: tenantId,
                $or: [
                    { tags: { $size: 0 } },
                    { tags: { $exists: false } }
                ]
            }),
            db.collection('knowledge_base').aggregate([
                { $match: { tenant_id: tenantId } },
                { $project: {
                    title: 1,
                    content_length: { $strLenCP: { $ifNull: ['$content_md', ''] } },
                    has_tags: { $gt: [{ $size: { $ifNull: ['$tags', []] } }, 0] }
                }},
                { $match: { content_length: { $lt: 200 } } },
                { $count: 'count' }
            ]).toArray()
        ]);

        // Calculate health score
        const issues = outdatedKBs + unreviewed + orphanedKBs + (lowQuality[0]?.count || 0);
        const healthScore = Math.max(0, Math.min(100, 100 - (issues / totalKBs) * 100));

        return {
            title: 'Relatório de Saúde do Conteúdo',
            period: { start: startDate, end: new Date() },
            summary: {
                health_score: Math.round(healthScore),
                total_kbs: totalKBs,
                total_issues: issues
            },
            issues: {
                outdated: {
                    count: outdatedKBs,
                    description: 'Artigos não atualizados há mais de 6 meses'
                },
                unreviewed_drafts: {
                    count: unreviewed,
                    description: 'Rascunhos não revisados há mais de 30 dias'
                },
                missing_tags: {
                    count: orphanedKBs,
                    description: 'Artigos sem tags'
                },
                low_quality: {
                    count: lowQuality[0]?.count || 0,
                    description: 'Artigos com menos de 200 caracteres'
                }
            },
            recommendations: generateHealthRecommendations(healthScore, {
                outdatedKBs, unreviewed, orphanedKBs, lowQuality: lowQuality[0]?.count || 0
            })
        };
    }

    async function generatePostMortemReport(db, tenantId, startDate, filters) {
        const match = { 
            tenant_id: tenantId,
            created_at: { $gte: startDate }
        };
        if (filters.status) match.status = filters.status;

        const [
            total,
            statusBreakdown,
            recent
        ] = await Promise.all([
            db.collection('postmortems').countDocuments(match),
            db.collection('postmortems').aggregate([
                { $match: match },
                { $group: { _id: '$status', count: { $sum: 1 } } }
            ]).toArray(),
            db.collection('postmortems')
                .find(match)
                .sort({ created_at: -1 })
                .limit(10)
                .toArray()
        ]);

        return {
            title: 'Resumo de Post-Mortems',
            period: { start: startDate, end: new Date() },
            summary: {
                total_postmortems: total
            },
            breakdown: {
                by_status: statusBreakdown.reduce((acc, item) => {
                    acc[item._id] = item.count;
                    return acc;
                }, {})
            },
            recent_postmortems: recent.map(pm => ({
                id: pm._id,
                title: pm.title,
                incident_date: pm.incident_date,
                status: pm.status,
                severity: pm.severity
            }))
        };
    }

    async function generateAnalyticsOverview(db, tenantId, startDate) {
        // Combine multiple report types
        const [kbSummary, incidentReport, contentHealth] = await Promise.all([
            generateKBSummary(db, tenantId, startDate, {}),
            generateIncidentReport(db, tenantId, startDate, {}),
            generateContentHealthReport(db, tenantId, startDate)
        ]);

        return {
            title: 'Visão Geral de Analytics',
            period: { start: startDate, end: new Date() },
            sections: {
                knowledge_base: kbSummary,
                incidents: incidentReport,
                content_health: contentHealth
            }
        };
    }

    async function generateSearchAnalytics(db, tenantId, startDate) {
        const [
            totalSearches,
            topQueries,
            noResultsQueries,
            dailySearches
        ] = await Promise.all([
            db.collection('search_logs').countDocuments({
                tenant_id: tenantId,
                timestamp: { $gte: startDate }
            }),
            db.collection('search_logs').aggregate([
                { $match: { tenant_id: tenantId, timestamp: { $gte: startDate } } },
                { $group: { _id: '$query', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 20 }
            ]).toArray(),
            db.collection('search_logs').aggregate([
                { $match: { 
                    tenant_id: tenantId, 
                    timestamp: { $gte: startDate },
                    results_count: 0
                }},
                { $group: { _id: '$query', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 20 }
            ]).toArray(),
            db.collection('search_logs').aggregate([
                { $match: { tenant_id: tenantId, timestamp: { $gte: startDate } } },
                { $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
                    count: { $sum: 1 }
                }},
                { $sort: { _id: 1 } }
            ]).toArray()
        ]);

        return {
            title: 'Analytics de Busca',
            period: { start: startDate, end: new Date() },
            summary: {
                total_searches: totalSearches,
                no_results_rate: noResultsQueries.length > 0 
                    ? Math.round((noResultsQueries.reduce((a, b) => a + b.count, 0) / totalSearches) * 100) 
                    : 0
            },
            top_queries: topQueries,
            no_results_queries: noResultsQueries,
            daily_searches: dailySearches
        };
    }

    async function generateTeamPerformance(db, tenantId, startDate) {
        // TODO: kbsByUser e reviewsByUser sao calculados e descartados - o
        // relatorio nunca os usa. Sao duas agregacoes caras rodando a toa.
        // Ou o relatorio deveria mostra-los, ou as consultas deveriam sair.
        const [
            userStats,
            _kbsByUser,
            _reviewsByUser
        ] = await Promise.all([
            db.collection('users').aggregate([
                { $match: { tenant_id: tenantId, status: 'active' } },
                { $lookup: {
                    from: 'knowledge_base',
                    let: { userId: '$_id' },
                    pipeline: [
                        { $match: {
                            $expr: { $eq: ['$created_by', '$$userId'] },
                            tenant_id: tenantId,
                            created_at: { $gte: startDate }
                        }},
                        { $count: 'count' }
                    ],
                    as: 'kbs'
                }},
                { $lookup: {
                    from: 'comments',
                    let: { userId: '$_id' },
                    pipeline: [
                        { $match: {
                            $expr: { $eq: ['$user_id', '$$userId'] },
                            tenant_id: tenantId,
                            created_at: { $gte: startDate }
                        }},
                        { $count: 'count' }
                    ],
                    as: 'comments'
                }},
                { $project: {
                    name: 1,
                    email: 1,
                    role: 1,
                    kbs_created: { $ifNull: [{ $arrayElemAt: ['$kbs.count', 0] }, 0] },
                    comments_made: { $ifNull: [{ $arrayElemAt: ['$comments.count', 0] }, 0] }
                }},
                { $sort: { kbs_created: -1 } }
            ]).toArray(),
            db.collection('knowledge_base').aggregate([
                { $match: { tenant_id: tenantId, created_at: { $gte: startDate } } },
                { $group: { _id: '$created_by', count: { $sum: 1 } } },
                { $sort: { count: -1 } }
            ]).toArray(),
            db.collection('knowledge_base').aggregate([
                { $match: { 
                    tenant_id: tenantId, 
                    'review_history.reviewed_at': { $gte: startDate }
                }},
                { $unwind: '$review_history' },
                { $match: { 'review_history.reviewed_at': { $gte: startDate } } },
                { $group: { _id: '$review_history.reviewed_by', count: { $sum: 1 } } },
                { $sort: { count: -1 } }
            ]).toArray()
        ]);

        return {
            title: 'Desempenho da Equipe',
            period: { start: startDate, end: new Date() },
            summary: {
                total_members: userStats.length,
                total_kbs_created: userStats.reduce((a, b) => a + b.kbs_created, 0),
                total_comments: userStats.reduce((a, b) => a + b.comments_made, 0)
            },
            team_members: userStats
        };
    }

    function generateHealthRecommendations(score, issues) {
        const recommendations = [];

        if (issues.outdatedKBs > 0) {
            recommendations.push({
                type: 'warning',
                priority: 'high',
                message: `${issues.outdatedKBs} artigos precisam ser revisados (> 6 meses sem atualização)`,
                action: 'Revisar conteúdo desatualizado'
            });
        }

        if (issues.unreviewed > 0) {
            recommendations.push({
                type: 'info',
                priority: 'medium',
                message: `${issues.unreviewed} rascunhos aguardando revisão há mais de 30 dias`,
                action: 'Revisar ou arquivar rascunhos antigos'
            });
        }

        if (issues.orphanedKBs > 0) {
            recommendations.push({
                type: 'warning',
                priority: 'medium',
                message: `${issues.orphanedKBs} artigos sem tags categorizados`,
                action: 'Adicionar tags para melhor organização'
            });
        }

        if (issues.lowQuality > 0) {
            recommendations.push({
                type: 'danger',
                priority: 'high',
                message: `${issues.lowQuality} artigos com conteúdo muito curto`,
                action: 'Expandir ou remover conteúdo de baixa qualidade'
            });
        }

        return recommendations;
    }

    function calculateNextRun(schedule) {
        const now = new Date();
        const [hours, minutes] = schedule.time.split(':').map(Number);
        
        let nextRun = new Date(now);
        nextRun.setHours(hours, minutes, 0, 0);

        switch (schedule.frequency) {
            case 'daily':
                if (nextRun <= now) {
                    nextRun.setDate(nextRun.getDate() + 1);
                }
                break;
            
            case 'weekly': {
                const targetDay = schedule.day || 1; // Default Monday
                const daysUntil = (targetDay - now.getDay() + 7) % 7 || 7;
                nextRun.setDate(now.getDate() + daysUntil);
                if (nextRun <= now) {
                    nextRun.setDate(nextRun.getDate() + 7);
                }
                break;
            }
            
            case 'monthly':
                nextRun.setDate(schedule.day || 1);
                if (nextRun <= now) {
                    nextRun.setMonth(nextRun.getMonth() + 1);
                }
                break;
        }

        return nextRun;
    }
}
