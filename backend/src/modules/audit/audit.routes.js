import { ObjectId } from 'mongodb';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { tenantMiddleware } from '../../middlewares/tenant.middleware.js';
import { requireRole } from '../../middlewares/rbac.middleware.js';

export default async function auditRoutes(fastify) {
  // Get audit logs (admin only)
  fastify.get('/', {
    preHandler: [authMiddleware, tenantMiddleware, requireRole(['admin'])]
  }, async (request) => {
    const db = fastify.db();
    const { 
      action, 
      entity_type, 
      user_id, 
      start_date, 
      end_date, 
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

    // Date range filter
    if (start_date || end_date) {
      query.created_at = {};
      if (start_date) query.created_at.$gte = new Date(start_date);
      if (end_date) query.created_at.$lte = new Date(end_date);
    }

    const logs = await db.collection('audit_logs')
      .find(query)
      .sort({ created_at: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .toArray();

    const total = await db.collection('audit_logs').countDocuments(query);

    return { 
      logs,
      total,
      limit: parseInt(limit),
      skip: parseInt(skip)
    };
  });

  // Get audit log by ID (admin only)
  fastify.get('/:id', {
    preHandler: [authMiddleware, tenantMiddleware, requireRole(['admin'])]
  }, async (request, reply) => {
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

  // Get audit stats (admin only)
  fastify.get('/stats/summary', {
    preHandler: [authMiddleware, tenantMiddleware, requireRole(['admin'])]
  }, async (request) => {
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

  // Get user activity (admin only)
  fastify.get('/users/:user_id', {
    preHandler: [authMiddleware, tenantMiddleware, requireRole(['admin'])]
  }, async (request, reply) => {
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

  // Get KB activity (admin/reviewer)
  fastify.get('/kb/:kb_id', {
    preHandler: [authMiddleware, tenantMiddleware, requireRole(['admin', 'reviewer'])]
  }, async (request) => {
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


