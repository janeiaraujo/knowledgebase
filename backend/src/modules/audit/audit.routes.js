import { ObjectId } from 'mongodb';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { tenantMiddleware } from '../../middlewares/tenant.middleware.js';
import { requireRole } from '../../middlewares/rbac.middleware.js';

export default async function auditRoutes(fastify) {
    // Get audit logs (admin/owner only)
    fastify.get('/logs', {
        preHandler: [authMiddleware, tenantMiddleware, requireRole(['admin', 'owner'])]
    }, async(request) => {
        const db = fastify.db();
        const {
            action,
            entity_type,
            user_id,
            start_date,
            date_from,
            date_to,
            end_date,
            search,
            page = 1,
            limit = 100,
            skip = 0
        } = request.query;

        const query = { tenant_id: request.tenantId };

        if (action) query.action = action;
        if (entity_type) query.entity_type = entity_type;
        if (user_id) {
            try {
                query.user_id = new ObjectId(user_id);
            } catch {
                // Invalid user_id, ignore
            }
        }
        
        // Search in details
        if (search) {
            query.$or = [
                { action: { $regex: search, $options: 'i' } },
                { entity_type: { $regex: search, $options: 'i' } },
                { 'details.title': { $regex: search, $options: 'i' } }
            ];
        }

        // Date range filter (support both naming conventions)
        const startDate = start_date || date_from;
        const endDate = end_date || date_to;
        if (startDate || endDate) {
            query.created_at = {};
            if (startDate) query.created_at.$gte = new Date(startDate);
            if (endDate) query.created_at.$lte = new Date(endDate);
        }

        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skipNum = skip ? parseInt(skip) : (pageNum - 1) * limitNum;

        const logs = await db.collection('audit_logs')
            .aggregate([
                { $match: query },
                { $sort: { created_at: -1 } },
                { $skip: skipNum },
                { $limit: limitNum },
                {
                    $lookup: {
                        from: 'users',
                        localField: 'user_id',
                        foreignField: '_id',
                        as: 'user_info'
                    }
                },
                {
                    $addFields: {
                        user_info: { $arrayElemAt: ['$user_info', 0] }
                    }
                },
                {
                    $project: {
                        _id: 1,
                        action: 1,
                        entity_type: 1,
                        entity_id: 1,
                        details: 1,
                        ip_address: 1,
                        user_agent: 1,
                        created_at: 1,
                        'user_info._id': 1,
                        'user_info.name': 1,
                        'user_info.email': 1
                    }
                }
            ])
            .toArray();

        const total = await db.collection('audit_logs').countDocuments(query);

        return {
            logs,
            pagination: {
                total,
                page: pageNum,
                limit: limitNum,
                pages: Math.ceil(total / limitNum)
            }
        };
    });

    // Get audit log by ID (admin/owner only)
    fastify.get('/:id', {
        preHandler: [authMiddleware, tenantMiddleware, requireRole(['admin', 'owner'])]
    }, async(request, reply) => {
        const db = fastify.db();
        let id;

        try {
            id = new ObjectId(request.params.id);
        } catch {
            return reply.code(400).send({ error: 'Invalid audit log ID' });
        }

        const log = await db.collection('audit_logs').findOne({
            _id: id,
            tenant_id: request.tenantId
        });

        if (!log) {
            return reply.code(404).send({ error: 'Audit log not found' });
        }

        return log;
    });

    // Get audit stats (admin/owner only)
    fastify.get('/stats/summary', {
        preHandler: [authMiddleware, tenantMiddleware, requireRole(['admin', 'owner'])]
    }, async(request) => {
        const db = fastify.db();
        const { start_date, end_date } = request.query;

        const query = { tenant_id: request.tenantId };

        // Date range filter
        if (start_date || end_date) {
            query.created_at = {};
            if (start_date) query.created_at.$gte = new Date(start_date);
            if (end_date) query.created_at.$lte = new Date(end_date);
        }

        // Aggregate by action
        const byAction = await db.collection('audit_logs').aggregate([
            { $match: query },
            { $group: { _id: '$action', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]).toArray();

        // Aggregate by entity type
        const byEntityType = await db.collection('audit_logs').aggregate([
            { $match: query },
            { $group: { _id: '$entity_type', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]).toArray();

        // Aggregate by user
        const byUser = await db.collection('audit_logs').aggregate([
            { $match: query },
            { $group: { _id: '$user_id', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 }
        ]).toArray();

        const total = await db.collection('audit_logs').countDocuments(query);

        return {
            total,
            by_action: byAction,
            by_entity_type: byEntityType,
            top_users: byUser
        };
    });

    // Get user activity (admin/owner only)
    fastify.get('/users/:user_id', {
        preHandler: [authMiddleware, tenantMiddleware, requireRole(['admin', 'owner'])]
    }, async(request, reply) => {
        const db = fastify.db();
        let userId;

        try {
            userId = new ObjectId(request.params.user_id);
        } catch {
            return reply.code(400).send({ error: 'Invalid user ID' });
        }

        const { limit = 50, skip = 0 } = request.query;

        const logs = await db.collection('audit_logs')
            .find({
                user_id: userId,
                tenant_id: request.tenantId
            })
            .sort({ created_at: -1 })
            .limit(parseInt(limit))
            .skip(parseInt(skip))
            .toArray();

        const total = await db.collection('audit_logs').countDocuments({
            user_id: userId,
            tenant_id: request.tenantId
        });

        return {
            logs,
            total,
            limit: parseInt(limit),
            skip: parseInt(skip)
        };
    });

    // Get KB activity (admin/owner/reviewer)
    fastify.get('/kb/:kb_id', {
        preHandler: [authMiddleware, tenantMiddleware, requireRole(['admin', 'owner', 'reviewer'])]
    }, async(request) => {
        const db = fastify.db();
        const { kb_id } = request.params;
        const { limit = 50, skip = 0 } = request.query;

        const logs = await db.collection('audit_logs')
            .find({
                entity_id: kb_id,
                entity_type: 'kb',
                tenant_id: request.tenantId
            })
            .sort({ created_at: -1 })
            .limit(parseInt(limit))
            .skip(parseInt(skip))
            .toArray();

        const total = await db.collection('audit_logs').countDocuments({
            entity_id: kb_id,
            entity_type: 'kb',
            tenant_id: request.tenantId
        });

        return {
            logs,
            total,
            limit: parseInt(limit),
            skip: parseInt(skip)
        };
    });
}