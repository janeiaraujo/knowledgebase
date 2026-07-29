/**
 * Post-Mortem & RCA (Root Cause Analysis) Module
 * 
 * Based on best practices from:
 * - Google SRE Book
 * - Netflix Incident Management
 * - AWS Well-Architected Framework
 * - Microsoft Azure DevOps
 * 
 * Features:
 * - Structured post-mortem templates
 * - Timeline creation
 * - 5 Whys analysis
 * - Ishikawa (Fishbone) diagram support
 * - Action items tracking
 * - Blameless culture support
 */

import { ObjectId } from 'mongodb';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { tenantMiddleware } from '../../middlewares/tenant.middleware.js';
import { getOpenAI } from '../../utils/ai.js';

export default async function postMortemRoutes(fastify, options) {
    const db = () => fastify.db();
    
    const toObjectId = (id) => {
        try {
            return new ObjectId(id);
        } catch {
            return null;
        }
    };

    // ==================== POST-MORTEM CRUD ====================

    /**
     * Create a new post-mortem document
     */
    fastify.post('/', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async (request, reply) => {
        const {
            title,
            incident_id,
            incident_date,
            severity,
            template = 'google_sre', // google_sre, netflix, aws, custom
            affected_services = [],
            participants = []
        } = request.body;

        if (!title) {
            return reply.status(400).send({ error: 'Título é obrigatório' });
        }

        // Get template structure
        const templateData = getPostMortemTemplate(template);

        const postMortem = {
            tenant_id: request.tenantId,
            title,
            incident_id: incident_id ? toObjectId(incident_id) : null,
            incident_date: incident_date ? new Date(incident_date) : new Date(),
            severity: severity || 'medium', // critical, high, medium, low
            template,
            status: 'draft', // draft, in_review, published, archived
            
            // Metadata
            affected_services,
            participants,
            
            // Document sections (from template)
            sections: templateData.sections,
            
            // Timeline
            timeline: [],
            
            // Root Cause Analysis
            rca: {
                method: null, // five_whys, fishbone, fault_tree
                analysis: null,
                root_causes: [],
                contributing_factors: []
            },
            
            // Impact Assessment
            impact: {
                duration_minutes: null,
                users_affected: null,
                revenue_impact: null,
                sla_breached: false,
                description: ''
            },
            
            // Action Items
            action_items: [],
            
            // Lessons Learned
            lessons_learned: [],
            
            // Generated content
            executive_summary: '',
            generated_content: null,
            
            // Audit
            created_by: request.currentUser._id,
            created_at: new Date(),
            updated_at: new Date(),
            published_at: null,
            published_by: null,
            
            // Collaboration
            comments: [],
            reviewers: [],
            approved_by: null
        };

        const result = await db().collection('postmortems').insertOne(postMortem);

        return {
            success: true,
            postmortem_id: result.insertedId,
            template: templateData.name
        };
    });

    /**
     * List post-mortems
     */
    fastify.get('/', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async (request, reply) => {
        const {
            status,
            severity,
            from_date,
            to_date,
            search,
            page = 1,
            limit = 20,
            sort = 'created_at',
            order = 'desc'
        } = request.query;

        const filter = { tenant_id: request.tenantId };

        if (status) filter.status = status;
        if (severity) filter.severity = severity;
        if (from_date || to_date) {
            filter.incident_date = {};
            if (from_date) filter.incident_date.$gte = new Date(from_date);
            if (to_date) filter.incident_date.$lte = new Date(to_date);
        }
        if (search) {
            filter.$or = [
                { title: { $regex: search, $options: 'i' } },
                { executive_summary: { $regex: search, $options: 'i' } }
            ];
        }

        const sortOrder = order === 'asc' ? 1 : -1;

        const [postmortems, total] = await Promise.all([
            db().collection('postmortems')
                .find(filter)
                .sort({ [sort]: sortOrder })
                .skip((parseInt(page) - 1) * parseInt(limit))
                .limit(parseInt(limit))
                .toArray(),
            db().collection('postmortems').countDocuments(filter)
        ]);

        return {
            postmortems,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            }
        };
    });

    /**
     * Get a single post-mortem
     */
    fastify.get('/:id', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async (request, reply) => {
        const { id } = request.params;
        const objectId = toObjectId(id);

        if (!objectId) {
            return reply.status(400).send({ error: 'ID inválido' });
        }

        const postMortem = await db().collection('postmortems').findOne({
            _id: objectId,
            tenant_id: request.tenantId
        });

        if (!postMortem) {
            return reply.status(404).send({ error: 'Post-mortem não encontrado' });
        }

        // Get related incident if exists
        let incident = null;
        if (postMortem.incident_id) {
            incident = await db().collection('incidents').findOne({
                _id: postMortem.incident_id
            });
        }

        return { postMortem, incident };
    });

    /**
     * Update post-mortem
     */
    fastify.put('/:id', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async (request, reply) => {
        const { id } = request.params;
        const objectId = toObjectId(id);

        if (!objectId) {
            return reply.status(400).send({ error: 'ID inválido' });
        }

        const allowedFields = [
            'title', 'incident_date', 'severity', 'affected_services',
            'participants', 'sections', 'timeline', 'rca', 'impact',
            'action_items', 'lessons_learned', 'executive_summary', 'status'
        ];

        const updateDoc = { updated_at: new Date() };
        
        for (const field of allowedFields) {
            if (request.body[field] !== undefined) {
                updateDoc[field] = request.body[field];
            }
        }

        const result = await db().collection('postmortems').findOneAndUpdate(
            { _id: objectId, tenant_id: request.tenantId },
            { $set: updateDoc },
            { returnDocument: 'after' }
        );

        if (!result) {
            return reply.status(404).send({ error: 'Post-mortem não encontrado' });
        }

        return { success: true, postMortem: result };
    });

    /**
     * Delete post-mortem
     */
    fastify.delete('/:id', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async (request, reply) => {
        const { id } = request.params;
        const objectId = toObjectId(id);

        if (!objectId) {
            return reply.status(400).send({ error: 'ID inválido' });
        }

        const result = await db().collection('postmortems').deleteOne({
            _id: objectId,
            tenant_id: request.tenantId
        });

        if (result.deletedCount === 0) {
            return reply.status(404).send({ error: 'Post-mortem não encontrado' });
        }

        return { success: true };
    });

    // ==================== TIMELINE ====================

    /**
     * Add timeline entry
     */
    fastify.post('/:id/timeline', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async (request, reply) => {
        const { id } = request.params;
        const { timestamp, description, type = 'event', actor } = request.body;
        const objectId = toObjectId(id);

        if (!timestamp || !description) {
            return reply.status(400).send({ error: 'Timestamp e descrição são obrigatórios' });
        }

        const entry = {
            _id: new ObjectId(),
            timestamp: new Date(timestamp),
            description,
            type, // detection, investigation, mitigation, resolution, event
            actor: actor || request.currentUser.name,
            created_by: request.currentUser._id,
            created_at: new Date()
        };

        const result = await db().collection('postmortems').findOneAndUpdate(
            { _id: objectId, tenant_id: request.tenantId },
            { 
                $push: { timeline: { $each: [entry], $sort: { timestamp: 1 } } },
                $set: { updated_at: new Date() }
            },
            { returnDocument: 'after' }
        );

        if (!result) {
            return reply.status(404).send({ error: 'Post-mortem não encontrado' });
        }

        return { success: true, entry, timeline: result.timeline };
    });

    /**
     * Remove timeline entry
     */
    fastify.delete('/:id/timeline/:entryId', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async (request, reply) => {
        const { id, entryId } = request.params;
        const objectId = toObjectId(id);
        const entryObjectId = toObjectId(entryId);

        const result = await db().collection('postmortems').findOneAndUpdate(
            { _id: objectId, tenant_id: request.tenantId },
            { 
                $pull: { timeline: { _id: entryObjectId } },
                $set: { updated_at: new Date() }
            },
            { returnDocument: 'after' }
        );

        if (!result) {
            return reply.status(404).send({ error: 'Post-mortem não encontrado' });
        }

        return { success: true, timeline: result.timeline };
    });

    // ==================== ROOT CAUSE ANALYSIS ====================

    /**
     * Perform 5 Whys analysis with AI assistance
     */
    fastify.post('/:id/rca/five-whys', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async (request, reply) => {
        const { id } = request.params;
        const { initial_problem, whys = [] } = request.body;
        const objectId = toObjectId(id);

        if (!initial_problem) {
            return reply.status(400).send({ error: 'Problema inicial é obrigatório' });
        }

        // If AI assistance requested and whys array is empty or incomplete
        let aiSuggestions = null;
        if (whys.length < 5) {
            try {
                aiSuggestions = await generateFiveWhys(initial_problem, whys);
            } catch (err) {
                fastify.log.warn('Failed to generate 5 Whys:', err);
            }
        }

        const rcaData = {
            method: 'five_whys',
            analysis: {
                initial_problem,
                whys: whys.length > 0 ? whys : (aiSuggestions?.whys || []),
                ai_generated: whys.length === 0 && aiSuggestions !== null
            },
            root_causes: aiSuggestions?.root_causes || [],
            contributing_factors: aiSuggestions?.contributing_factors || []
        };

        const result = await db().collection('postmortems').findOneAndUpdate(
            { _id: objectId, tenant_id: request.tenantId },
            { 
                $set: { 
                    rca: rcaData,
                    updated_at: new Date()
                }
            },
            { returnDocument: 'after' }
        );

        if (!result) {
            return reply.status(404).send({ error: 'Post-mortem não encontrado' });
        }

        return { 
            success: true, 
            rca: result.rca,
            ai_suggestions: aiSuggestions
        };
    });

    /**
     * Perform Fishbone (Ishikawa) analysis
     */
    fastify.post('/:id/rca/fishbone', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async (request, reply) => {
        const { id } = request.params;
        const { problem_statement, categories } = request.body;
        const objectId = toObjectId(id);

        // Standard Ishikawa categories (6M)
        const defaultCategories = {
            people: { name: 'Pessoas', causes: [] },
            process: { name: 'Processo', causes: [] },
            technology: { name: 'Tecnologia', causes: [] },
            environment: { name: 'Ambiente', causes: [] },
            measurement: { name: 'Medição', causes: [] },
            materials: { name: 'Materiais/Dados', causes: [] }
        };

        const rcaData = {
            method: 'fishbone',
            analysis: {
                problem_statement,
                categories: categories || defaultCategories
            },
            root_causes: [],
            contributing_factors: []
        };

        // AI can help populate categories
        if (!categories) {
            try {
                const aiAnalysis = await generateFishboneAnalysis(problem_statement);
                if (aiAnalysis) {
                    rcaData.analysis.categories = aiAnalysis.categories;
                    rcaData.root_causes = aiAnalysis.root_causes;
                    rcaData.analysis.ai_generated = true;
                }
            } catch (err) {
                fastify.log.warn('Failed to generate Fishbone analysis:', err);
            }
        }

        const result = await db().collection('postmortems').findOneAndUpdate(
            { _id: objectId, tenant_id: request.tenantId },
            { 
                $set: { 
                    rca: rcaData,
                    updated_at: new Date()
                }
            },
            { returnDocument: 'after' }
        );

        if (!result) {
            return reply.status(404).send({ error: 'Post-mortem não encontrado' });
        }

        return { success: true, rca: result.rca };
    });

    // ==================== ACTION ITEMS ====================

    /**
     * Add action item
     */
    fastify.post('/:id/action-items', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async (request, reply) => {
        const { id } = request.params;
        const {
            title,
            description,
            priority = 'medium',
            assignee_id,
            due_date,
            category = 'preventive' // preventive, detective, corrective
        } = request.body;
        const objectId = toObjectId(id);

        if (!title) {
            return reply.status(400).send({ error: 'Título é obrigatório' });
        }

        const actionItem = {
            _id: new ObjectId(),
            title,
            description: description || '',
            priority, // critical, high, medium, low
            category,
            status: 'open', // open, in_progress, completed, cancelled
            assignee_id: assignee_id ? toObjectId(assignee_id) : null,
            due_date: due_date ? new Date(due_date) : null,
            completed_at: null,
            created_by: request.currentUser._id,
            created_at: new Date()
        };

        const result = await db().collection('postmortems').findOneAndUpdate(
            { _id: objectId, tenant_id: request.tenantId },
            { 
                $push: { action_items: actionItem },
                $set: { updated_at: new Date() }
            },
            { returnDocument: 'after' }
        );

        if (!result) {
            return reply.status(404).send({ error: 'Post-mortem não encontrado' });
        }

        return { success: true, action_item: actionItem };
    });

    /**
     * Update action item
     */
    fastify.put('/:id/action-items/:itemId', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async (request, reply) => {
        const { id, itemId } = request.params;
        const objectId = toObjectId(id);
        const itemObjectId = toObjectId(itemId);

        const updateFields = {};
        const allowedFields = ['title', 'description', 'priority', 'category', 'status', 'assignee_id', 'due_date'];
        
        for (const field of allowedFields) {
            if (request.body[field] !== undefined) {
                if (field === 'assignee_id' && request.body[field]) {
                    updateFields[`action_items.$.${field}`] = toObjectId(request.body[field]);
                } else if (field === 'due_date' && request.body[field]) {
                    updateFields[`action_items.$.${field}`] = new Date(request.body[field]);
                } else {
                    updateFields[`action_items.$.${field}`] = request.body[field];
                }
            }
        }

        // If status changed to completed, set completed_at
        if (request.body.status === 'completed') {
            updateFields['action_items.$.completed_at'] = new Date();
        }

        updateFields.updated_at = new Date();

        const result = await db().collection('postmortems').findOneAndUpdate(
            { 
                _id: objectId, 
                tenant_id: request.tenantId,
                'action_items._id': itemObjectId
            },
            { $set: updateFields },
            { returnDocument: 'after' }
        );

        if (!result) {
            return reply.status(404).send({ error: 'Post-mortem ou action item não encontrado' });
        }

        return { success: true, action_items: result.action_items };
    });

    // ==================== AI GENERATION ====================

    /**
     * Generate complete post-mortem document using AI
     */
    fastify.post('/:id/generate', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async (request, reply) => {
        const { id } = request.params;
        const { sections_to_generate = 'all' } = request.body;
        const objectId = toObjectId(id);

        const postMortem = await db().collection('postmortems').findOne({
            _id: objectId,
            tenant_id: request.tenantId
        });

        if (!postMortem) {
            return reply.status(404).send({ error: 'Post-mortem não encontrado' });
        }

        try {
            const generatedContent = await generatePostMortemContent(postMortem, sections_to_generate);

            const updateDoc = {
                generated_content: generatedContent,
                updated_at: new Date()
            };

            // If generating executive summary
            if (sections_to_generate === 'all' || sections_to_generate === 'summary') {
                updateDoc.executive_summary = generatedContent.executive_summary;
            }

            // If generating lessons learned
            if (sections_to_generate === 'all' || sections_to_generate === 'lessons') {
                updateDoc.lessons_learned = generatedContent.lessons_learned;
            }

            await db().collection('postmortems').updateOne(
                { _id: objectId },
                { $set: updateDoc }
            );

            return {
                success: true,
                generated: generatedContent
            };

        } catch (error) {
            fastify.log.error('AI generation error:', error);
            return reply.status(500).send({ error: 'Falha ao gerar conteúdo' });
        }
    });

    /**
     * Generate action items from analysis
     */
    fastify.post('/:id/generate-actions', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async (request, reply) => {
        const { id } = request.params;
        const objectId = toObjectId(id);

        const postMortem = await db().collection('postmortems').findOne({
            _id: objectId,
            tenant_id: request.tenantId
        });

        if (!postMortem) {
            return reply.status(404).send({ error: 'Post-mortem não encontrado' });
        }

        try {
            const suggestedActions = await generateActionItems(postMortem);

            return {
                success: true,
                suggested_actions: suggestedActions
            };

        } catch (error) {
            fastify.log.error('Action generation error:', error);
            return reply.status(500).send({ error: 'Falha ao gerar ações' });
        }
    });

    // ==================== PUBLISHING & EXPORT ====================

    /**
     * Publish post-mortem
     */
    fastify.post('/:id/publish', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async (request, reply) => {
        const { id } = request.params;
        const objectId = toObjectId(id);

        // Require admin/owner role
        if (!['admin', 'owner'].includes(request.currentUser.role)) {
            return reply.status(403).send({ error: 'Permissão negada' });
        }

        const result = await db().collection('postmortems').findOneAndUpdate(
            { _id: objectId, tenant_id: request.tenantId },
            { 
                $set: {
                    status: 'published',
                    published_at: new Date(),
                    published_by: request.currentUser._id,
                    updated_at: new Date()
                }
            },
            { returnDocument: 'after' }
        );

        if (!result) {
            return reply.status(404).send({ error: 'Post-mortem não encontrado' });
        }

        return { success: true, postMortem: result };
    });

    /**
     * Export post-mortem as Markdown
     */
    fastify.get('/:id/export/markdown', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async (request, reply) => {
        const { id } = request.params;
        const objectId = toObjectId(id);

        const postMortem = await db().collection('postmortems').findOne({
            _id: objectId,
            tenant_id: request.tenantId
        });

        if (!postMortem) {
            return reply.status(404).send({ error: 'Post-mortem não encontrado' });
        }

        const markdown = generateMarkdownExport(postMortem);

        reply.header('Content-Type', 'text/markdown');
        reply.header('Content-Disposition', `attachment; filename="postmortem-${postMortem._id}.md"`);
        return markdown;
    });

    /**
     * Create KB from post-mortem
     */
    fastify.post('/:id/create-kb', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async (request, reply) => {
        const { id } = request.params;
        const { include_sections = ['summary', 'timeline', 'rca', 'lessons'] } = request.body;
        const objectId = toObjectId(id);

        const postMortem = await db().collection('postmortems').findOne({
            _id: objectId,
            tenant_id: request.tenantId
        });

        if (!postMortem) {
            return reply.status(404).send({ error: 'Post-mortem não encontrado' });
        }

        // Generate KB content from post-mortem
        const kbContent = generateKBFromPostMortem(postMortem, include_sections);

        const kb = {
            tenant_id: request.tenantId,
            title: `Post-Mortem: ${postMortem.title}`,
            content_md: kbContent,
            status: 'draft',
            created_by: request.currentUser._id,
            created_from_postmortem: objectId,
            tags: ['post-mortem', 'incidente', postMortem.severity],
            version: 1,
            created_at: new Date(),
            updated_at: new Date()
        };

        const result = await db().collection('records').insertOne(kb);

        return {
            success: true,
            kb_id: result.insertedId
        };
    });

    // ==================== STATISTICS ====================

    /**
     * Get post-mortem statistics
     */
    fastify.get('/stats', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async (request, reply) => {
        const { period = '90d' } = request.query;

        const now = new Date();
        let startDate;
        switch (period) {
            case '30d': startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); break;
            case '90d': startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000); break;
            case '365d': startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000); break;
            default: startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        }

        const [total, bySeverity, byStatus, byMonth, avgResolution, actionItemStats] = await Promise.all([
            // Total count
            db().collection('postmortems').countDocuments({ tenant_id: request.tenantId }),

            // By severity
            db().collection('postmortems').aggregate([
                { $match: { tenant_id: request.tenantId, incident_date: { $gte: startDate } } },
                { $group: { _id: '$severity', count: { $sum: 1 } } }
            ]).toArray(),

            // By status
            db().collection('postmortems').aggregate([
                { $match: { tenant_id: request.tenantId } },
                { $group: { _id: '$status', count: { $sum: 1 } } }
            ]).toArray(),

            // By month
            db().collection('postmortems').aggregate([
                { $match: { tenant_id: request.tenantId, incident_date: { $gte: startDate } } },
                { $group: {
                    _id: {
                        year: { $year: '$incident_date' },
                        month: { $month: '$incident_date' }
                    },
                    count: { $sum: 1 }
                }},
                { $sort: { '_id.year': 1, '_id.month': 1 } }
            ]).toArray(),

            // Average time to resolution
            db().collection('postmortems').aggregate([
                { $match: { 
                    tenant_id: request.tenantId,
                    'impact.duration_minutes': { $exists: true, $ne: null }
                }},
                { $group: {
                    _id: null,
                    avg_duration: { $avg: '$impact.duration_minutes' }
                }}
            ]).toArray(),

            // Action item completion stats
            db().collection('postmortems').aggregate([
                { $match: { tenant_id: request.tenantId } },
                { $unwind: '$action_items' },
                { $group: {
                    _id: '$action_items.status',
                    count: { $sum: 1 }
                }}
            ]).toArray()
        ]);

        return {
            total,
            by_severity: bySeverity.reduce((acc, s) => { acc[s._id] = s.count; return acc; }, {}),
            by_status: byStatus.reduce((acc, s) => { acc[s._id] = s.count; return acc; }, {}),
            by_month: byMonth.map(m => ({
                month: `${m._id.year}-${String(m._id.month).padStart(2, '0')}`,
                count: m.count
            })),
            avg_resolution_minutes: avgResolution[0]?.avg_duration || null,
            action_items: actionItemStats.reduce((acc, s) => { acc[s._id] = s.count; return acc; }, {})
        };
    });

    /**
     * Get available templates
     */
    fastify.get('/templates', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async (request, reply) => {
        return {
            templates: [
                {
                    id: 'google_sre',
                    name: 'Google SRE',
                    description: 'Baseado no Google Site Reliability Engineering Book',
                    sections: ['summary', 'impact', 'timeline', 'root_cause', 'lessons', 'action_items']
                },
                {
                    id: 'netflix',
                    name: 'Netflix',
                    description: 'Abordagem blameless focada em sistemas',
                    sections: ['summary', 'detection', 'response', 'mitigation', 'prevention']
                },
                {
                    id: 'aws',
                    name: 'AWS Well-Architected',
                    description: 'Baseado no AWS COE (Correction of Error)',
                    sections: ['summary', 'impact', 'timeline', '5_whys', 'action_items', 'monitoring']
                },
                {
                    id: 'simple',
                    name: 'Simplificado',
                    description: 'Template simplificado para incidentes menores',
                    sections: ['summary', 'what_happened', 'resolution', 'next_steps']
                }
            ]
        };
    });
}

// ==================== HELPER FUNCTIONS ====================

function getPostMortemTemplate(templateId) {
    const templates = {
        google_sre: {
            name: 'Google SRE Post-Mortem',
            sections: {
                summary: {
                    title: 'Resumo Executivo',
                    content: '',
                    order: 1
                },
                impact: {
                    title: 'Avaliação de Impacto',
                    content: '',
                    subsections: ['Duração', 'Usuários Afetados', 'Impacto Financeiro'],
                    order: 2
                },
                timeline: {
                    title: 'Linha do Tempo',
                    content: '',
                    order: 3
                },
                root_cause: {
                    title: 'Causa Raiz',
                    content: '',
                    order: 4
                },
                trigger: {
                    title: 'Gatilho',
                    content: '',
                    order: 5
                },
                resolution: {
                    title: 'Resolução',
                    content: '',
                    order: 6
                },
                detection: {
                    title: 'Detecção',
                    content: '',
                    subsections: ['Como foi detectado?', 'Tempo até detecção'],
                    order: 7
                },
                lessons: {
                    title: 'Lições Aprendidas',
                    content: '',
                    subsections: ['O que funcionou bem', 'O que não funcionou', 'Onde tivemos sorte'],
                    order: 8
                },
                action_items: {
                    title: 'Itens de Ação',
                    content: '',
                    order: 9
                }
            }
        },
        netflix: {
            name: 'Netflix Post-Incident Review',
            sections: {
                summary: {
                    title: 'Resumo',
                    content: '',
                    order: 1
                },
                detection: {
                    title: 'Detecção e Alertas',
                    content: '',
                    order: 2
                },
                response: {
                    title: 'Resposta da Equipe',
                    content: '',
                    order: 3
                },
                mitigation: {
                    title: 'Mitigação',
                    content: '',
                    order: 4
                },
                systems_analysis: {
                    title: 'Análise de Sistemas',
                    content: '',
                    subsections: ['Pontos de Falha', 'Resiliência', 'Dependências'],
                    order: 5
                },
                prevention: {
                    title: 'Prevenção Futura',
                    content: '',
                    order: 6
                }
            }
        },
        aws: {
            name: 'AWS COE (Correction of Error)',
            sections: {
                summary: {
                    title: 'Resumo do Evento',
                    content: '',
                    order: 1
                },
                customer_impact: {
                    title: 'Impacto ao Cliente',
                    content: '',
                    order: 2
                },
                timeline: {
                    title: 'Linha do Tempo',
                    content: '',
                    order: 3
                },
                five_whys: {
                    title: 'Análise dos 5 Porquês',
                    content: '',
                    order: 4
                },
                corrective_actions: {
                    title: 'Ações Corretivas',
                    content: '',
                    order: 5
                },
                monitoring: {
                    title: 'Melhorias de Monitoramento',
                    content: '',
                    order: 6
                }
            }
        },
        simple: {
            name: 'Template Simplificado',
            sections: {
                summary: {
                    title: 'O que aconteceu?',
                    content: '',
                    order: 1
                },
                impact: {
                    title: 'Qual foi o impacto?',
                    content: '',
                    order: 2
                },
                resolution: {
                    title: 'Como foi resolvido?',
                    content: '',
                    order: 3
                },
                prevention: {
                    title: 'Como evitar no futuro?',
                    content: '',
                    order: 4
                }
            }
        }
    };

    return templates[templateId] || templates.google_sre;
}

async function generateFiveWhys(initialProblem, existingWhys) {
    try {
        const openai = await getOpenAI();
        
        const completion = await openai.chat.completions.create({
            model: 'gpt-4',
            messages: [
                {
                    role: 'system',
                    content: `Você é um especialista em análise de causa raiz. Realize uma análise dos "5 Porquês" para identificar a causa raiz de um problema técnico.

Para cada "porquê", vá mais fundo na cadeia causal até chegar à verdadeira causa raiz.

Responda em JSON com o formato:
{
  "whys": [
    { "why": "Por que [problema]?", "answer": "[resposta]" },
    { "why": "Por que [resposta anterior]?", "answer": "[resposta]" },
    ...
  ],
  "root_causes": ["causa raiz 1", "causa raiz 2"],
  "contributing_factors": ["fator 1", "fator 2"]
}`
                },
                {
                    role: 'user',
                    content: `Problema inicial: ${initialProblem}\n\nPorquês já identificados: ${JSON.stringify(existingWhys)}`
                }
            ],
            temperature: 0.5,
            response_format: { type: 'json_object' }
        });

        return JSON.parse(completion.choices[0].message.content);
    } catch (error) {
        console.error('Failed to generate 5 Whys:', error);
        return null;
    }
}

async function generateFishboneAnalysis(problemStatement) {
    try {
        const openai = await getOpenAI();
        
        const completion = await openai.chat.completions.create({
            model: 'gpt-4',
            messages: [
                {
                    role: 'system',
                    content: `Você é um especialista em análise de causa raiz usando o Diagrama de Ishikawa (Espinha de Peixe).

Analise o problema e identifique causas potenciais em cada categoria:
- Pessoas: fatores humanos, treinamento, habilidades
- Processo: procedimentos, políticas, fluxos de trabalho
- Tecnologia: sistemas, ferramentas, software, hardware
- Ambiente: infraestrutura, condições externas
- Medição: métricas, monitoramento, alertas
- Materiais/Dados: qualidade de dados, inputs

Responda em JSON com o formato:
{
  "categories": {
    "people": { "name": "Pessoas", "causes": ["causa1", "causa2"] },
    "process": { "name": "Processo", "causes": [] },
    "technology": { "name": "Tecnologia", "causes": [] },
    "environment": { "name": "Ambiente", "causes": [] },
    "measurement": { "name": "Medição", "causes": [] },
    "materials": { "name": "Materiais/Dados", "causes": [] }
  },
  "root_causes": ["principais causas identificadas"]
}`
                },
                {
                    role: 'user',
                    content: `Problema: ${problemStatement}`
                }
            ],
            temperature: 0.5,
            response_format: { type: 'json_object' }
        });

        return JSON.parse(completion.choices[0].message.content);
    } catch (error) {
        console.error('Failed to generate Fishbone analysis:', error);
        return null;
    }
}

async function generatePostMortemContent(postMortem, sectionsToGenerate) {
    try {
        const openai = await getOpenAI();

        const context = `
Título: ${postMortem.title}
Data do Incidente: ${postMortem.incident_date}
Severidade: ${postMortem.severity}
Serviços Afetados: ${postMortem.affected_services.join(', ')}
Timeline: ${JSON.stringify(postMortem.timeline.slice(-10))}
RCA: ${JSON.stringify(postMortem.rca)}
Impacto: ${JSON.stringify(postMortem.impact)}
Seções existentes: ${JSON.stringify(postMortem.sections)}
`;

        const completion = await openai.chat.completions.create({
            model: 'gpt-4',
            messages: [
                {
                    role: 'system',
                    content: `Você é um especialista em documentação de incidentes seguindo as melhores práticas de empresas como Google, Netflix e AWS.

Gere conteúdo profissional para um documento de post-mortem. O conteúdo deve ser:
- Objetivo e factual (cultura blameless)
- Focado em sistemas, não em pessoas
- Acionável com lições claras
- Bem estruturado em Markdown

Responda em JSON com o formato:
{
  "executive_summary": "Resumo executivo em 2-3 parágrafos",
  "lessons_learned": [
    { "type": "what_went_well", "items": ["item1", "item2"] },
    { "type": "what_went_wrong", "items": ["item1", "item2"] },
    { "type": "where_we_got_lucky", "items": ["item1"] }
  ],
  "recommendations": ["recomendação 1", "recomendação 2"]
}`
                },
                {
                    role: 'user',
                    content: `Gere conteúdo para o post-mortem com base nestas informações:\n\n${context}`
                }
            ],
            temperature: 0.5,
            response_format: { type: 'json_object' }
        });

        return JSON.parse(completion.choices[0].message.content);
    } catch (error) {
        console.error('Failed to generate post-mortem content:', error);
        throw error;
    }
}

async function generateActionItems(postMortem) {
    try {
        const openai = await getOpenAI();

        const context = `
Título: ${postMortem.title}
RCA: ${JSON.stringify(postMortem.rca)}
Lições Aprendidas: ${JSON.stringify(postMortem.lessons_learned)}
Impacto: ${JSON.stringify(postMortem.impact)}
`;

        const completion = await openai.chat.completions.create({
            model: 'gpt-4',
            messages: [
                {
                    role: 'system',
                    content: `Com base na análise do post-mortem, sugira ações práticas e específicas.

Categorize as ações em:
- preventive: evitar que o problema ocorra novamente
- detective: melhorar detecção de problemas similares
- corrective: corrigir problemas existentes

Responda em JSON:
{
  "action_items": [
    {
      "title": "Ação específica",
      "description": "Detalhes da ação",
      "category": "preventive|detective|corrective",
      "priority": "critical|high|medium|low",
      "estimated_effort": "Estimativa de esforço"
    }
  ]
}`
                },
                {
                    role: 'user',
                    content: context
                }
            ],
            temperature: 0.5,
            response_format: { type: 'json_object' }
        });

        return JSON.parse(completion.choices[0].message.content).action_items;
    } catch (error) {
        console.error('Failed to generate action items:', error);
        throw error;
    }
}

function generateMarkdownExport(postMortem) {
    let md = `# Post-Mortem: ${postMortem.title}\n\n`;
    md += `**Data do Incidente:** ${new Date(postMortem.incident_date).toLocaleDateString('pt-BR')}\n`;
    md += `**Severidade:** ${postMortem.severity}\n`;
    md += `**Status:** ${postMortem.status}\n\n`;

    if (postMortem.affected_services.length > 0) {
        md += `**Serviços Afetados:** ${postMortem.affected_services.join(', ')}\n\n`;
    }

    md += `---\n\n`;

    // Executive Summary
    if (postMortem.executive_summary) {
        md += `## Resumo Executivo\n\n${postMortem.executive_summary}\n\n`;
    }

    // Impact
    if (postMortem.impact) {
        md += `## Impacto\n\n`;
        if (postMortem.impact.duration_minutes) {
            md += `- **Duração:** ${postMortem.impact.duration_minutes} minutos\n`;
        }
        if (postMortem.impact.users_affected) {
            md += `- **Usuários Afetados:** ${postMortem.impact.users_affected}\n`;
        }
        if (postMortem.impact.description) {
            md += `\n${postMortem.impact.description}\n`;
        }
        md += `\n`;
    }

    // Timeline
    if (postMortem.timeline.length > 0) {
        md += `## Linha do Tempo\n\n`;
        for (const entry of postMortem.timeline) {
            const time = new Date(entry.timestamp).toLocaleString('pt-BR');
            md += `- **${time}** [${entry.type}] ${entry.description}\n`;
        }
        md += `\n`;
    }

    // RCA
    if (postMortem.rca && postMortem.rca.method) {
        md += `## Análise de Causa Raiz (${postMortem.rca.method})\n\n`;
        
        if (postMortem.rca.method === 'five_whys' && postMortem.rca.analysis.whys) {
            for (let i = 0; i < postMortem.rca.analysis.whys.length; i++) {
                const why = postMortem.rca.analysis.whys[i];
                md += `### ${i + 1}º Por quê?\n`;
                md += `**Pergunta:** ${why.why}\n`;
                md += `**Resposta:** ${why.answer}\n\n`;
            }
        }

        if (postMortem.rca.root_causes.length > 0) {
            md += `### Causas Raiz Identificadas\n`;
            for (const cause of postMortem.rca.root_causes) {
                md += `- ${cause}\n`;
            }
            md += `\n`;
        }
    }

    // Lessons Learned
    if (postMortem.lessons_learned.length > 0) {
        md += `## Lições Aprendidas\n\n`;
        for (const lesson of postMortem.lessons_learned) {
            md += `- ${lesson}\n`;
        }
        md += `\n`;
    }

    // Action Items
    if (postMortem.action_items.length > 0) {
        md += `## Itens de Ação\n\n`;
        md += `| Prioridade | Ação | Status | Categoria |\n`;
        md += `|------------|------|--------|----------|\n`;
        for (const item of postMortem.action_items) {
            md += `| ${item.priority} | ${item.title} | ${item.status} | ${item.category} |\n`;
        }
        md += `\n`;
    }

    // Sections
    if (postMortem.sections) {
        const sortedSections = Object.entries(postMortem.sections)
            .sort((a, b) => (a[1].order || 0) - (b[1].order || 0));
        
        for (const [key, section] of sortedSections) {
            if (section.content) {
                md += `## ${section.title}\n\n${section.content}\n\n`;
            }
        }
    }

    md += `---\n\n`;
    md += `*Documento gerado em ${new Date().toLocaleString('pt-BR')}*\n`;

    return md;
}

function generateKBFromPostMortem(postMortem, includeSections) {
    let content = `# ${postMortem.title}\n\n`;
    
    if (includeSections.includes('summary') && postMortem.executive_summary) {
        content += `## Resumo\n\n${postMortem.executive_summary}\n\n`;
    }

    content += `## Informações do Incidente\n\n`;
    content += `- **Data:** ${new Date(postMortem.incident_date).toLocaleDateString('pt-BR')}\n`;
    content += `- **Severidade:** ${postMortem.severity}\n`;
    if (postMortem.affected_services.length > 0) {
        content += `- **Serviços:** ${postMortem.affected_services.join(', ')}\n`;
    }
    content += `\n`;

    if (includeSections.includes('timeline') && postMortem.timeline.length > 0) {
        content += `## Linha do Tempo\n\n`;
        for (const entry of postMortem.timeline.slice(0, 10)) {
            const time = new Date(entry.timestamp).toLocaleString('pt-BR');
            content += `- **${time}:** ${entry.description}\n`;
        }
        content += `\n`;
    }

    if (includeSections.includes('rca') && postMortem.rca?.root_causes?.length > 0) {
        content += `## Causas Raiz\n\n`;
        for (const cause of postMortem.rca.root_causes) {
            content += `- ${cause}\n`;
        }
        content += `\n`;
    }

    if (includeSections.includes('lessons') && postMortem.lessons_learned.length > 0) {
        content += `## Lições Aprendidas\n\n`;
        for (const lesson of postMortem.lessons_learned) {
            content += `- ${lesson}\n`;
        }
        content += `\n`;
    }

    if (postMortem.action_items.length > 0) {
        const preventive = postMortem.action_items.filter(a => a.category === 'preventive');
        if (preventive.length > 0) {
            content += `## Como Prevenir\n\n`;
            for (const item of preventive) {
                content += `- ${item.title}\n`;
            }
            content += `\n`;
        }
    }

    return content;
}
