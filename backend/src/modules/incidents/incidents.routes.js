import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { toObjectId } from '../../utils/mongodb.js';
import { tenantMiddleware } from '../../middlewares/tenant.middleware.js';
import { requirePermission } from '../../middlewares/rbac.middleware.js';
import Joi from 'joi';

export default async function incidentRoutes(fastify, options) {
  
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
    const { note, ...updates } = request.body;
    
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
    const { note } = request.body;
    
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
