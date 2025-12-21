import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { toObjectId } from '../../utils/mongodb.js';
import { tenantMiddleware } from '../../middlewares/tenant.middleware.js';
import { requirePermission } from '../../middlewares/rbac.middleware.js';
import Joi from 'joi';
import crypto from 'crypto';

export default async function eventRoutes(fastify, options) {
  
  // Ingest external events
  fastify.post('/ingest', async (request, reply) => {
    const db = fastify.db();
    const apiToken = request.headers['x-api-token'];
    
    // Validate API token
    const tokenDoc = await db.collection('api_tokens').findOne({
      token: apiToken,
      active: true
    });
    
    if (!tokenDoc) {
      return reply.status(401).send({ error: 'Invalid API token' });
    }
    
    const tenantId = tokenDoc.tenant_id;
    
    // Check subscription limits
    const subscription = await db.collection('subscriptions').findOne({
      tenant_id: tenantId,
      status: 'active'
    });
    
    // Get current month's event count
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    
    const eventCount = await db.collection('events').countDocuments({
      tenant_id: tenantId,
      created_at: { $gte: startOfMonth }
    });
    
    if (eventCount >= subscription.limits.max_events_per_month) {
      return reply.status(429).send({ 
        error: 'Event limit reached for this month.' 
      });
    }
    
    const { source, event_type, severity, title, description, timestamp, metadata } = request.body;
    
    // Generate event hash for deduplication
    const eventHash = crypto
      .createHash('md5')
      .update(`${source}:${event_type}:${title}`)
      .digest('hex');
    
    // Check for duplicates in last 5 minutes
    const recentDuplicate = await db.collection('events').findOne({
      tenant_id: tenantId,
      event_hash: eventHash,
      created_at: { $gte: new Date(Date.now() - 5 * 60 * 1000) }
    });
    
    if (recentDuplicate) {
      // Update occurrence count
      await db.collection('events').updateOne(
        { _id: recentDuplicate._id },
        { 
          $inc: { occurrence_count: 1 },
          $set: { last_occurrence: new Date() }
        }
      );
      
      return { 
        success: true, 
        deduplicated: true,
        eventId: recentDuplicate._id 
      };
    }
    
    // Create new event
    const event = {
      tenant_id: tenantId,
      event_hash: eventHash,
      source,
      event_type,
      severity: severity || 'info',
      title,
      description: description || '',
      timestamp: timestamp ? new Date(timestamp) : new Date(),
      metadata: metadata || {},
      occurrence_count: 1,
      last_occurrence: new Date(),
      created_at: new Date(),
      related_incidents: [],
      related_kbs: []
    };
    
    const result = await db.collection('events').insertOne(event);
    
    // Update subscription usage
    await db.collection('subscriptions').updateOne(
      { tenant_id: tenantId },
      { $inc: { 'usage.events': 1 } }
    );
    
    // Try to auto-relate with existing KBs (async)
    findRelatedKBs(db, result.insertedId, tenantId, title, description).catch(err => {
      fastify.log.error('Failed to find related KBs:', err);
    });
    
    return { 
      success: true, 
      eventId: result.insertedId 
    };
  });
  
  // List events
  fastify.get('/', {
    preHandler: [authMiddleware, tenantMiddleware, requirePermission('event:read')]
  }, async (request, reply) => {
    const db = fastify.db();
    const { source, severity, page = 1, limit = 50 } = request.query;
    
    const filter = { tenant_id: request.tenantId };
    if (source) filter.source = source;
    if (severity) filter.severity = severity;
    
    const events = await db.collection('events')
      .find(filter)
      .sort({ created_at: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .toArray();
    
    return { events };
  });
  
  // Convert event to incident
  fastify.post('/:eventId/convert-to-incident', {
    preHandler: [authMiddleware, tenantMiddleware, requirePermission('incident:create')]
  }, async (request, reply) => {
    const db = fastify.db();
    const { eventId } = request.params;
    
    const event = await db.collection('events').findOne({
      _id: objectId,
      tenant_id: request.tenantId
    });
    
    if (!event) {
      return reply.status(404).send({ error: 'Event not found' });
    }
    
    // Create incident from event
    const incident = {
      tenant_id: request.tenantId,
      title: event.title,
      description: event.description || `Converted from ${event.source} event`,
      severity: event.severity === 'critical' ? 'critical' : 'high',
      affected_services: [],
      status: 'open',
      created_by: request.currentUser._id,
      created_at: new Date(),
      updated_at: new Date(),
      source_event_id: objectId,
      timeline: [{
        action: 'created_from_event',
        user_id: request.currentUser._id,
        timestamp: new Date(),
        note: `Created from ${event.source} event`
      }]
    };
    
    const result = await db.collection('incidents').insertOne(incident);
    
    // Link event to incident
    await db.collection('events').updateOne(
      { _id: objectId },
      { $push: { related_incidents: result.insertedId } }
    );
    
    return { success: true, incidentId: result.insertedId };
  });
}

// Helper function to find related KBs
async function findRelatedKBs(db, eventId, tenantId, title, description) {
  const searchText = `${title} ${description}`.toLowerCase();
  
  const relatedKBs = await db.collection('records')
    .find({
      tenant_id: tenantId,
      status: { $in: ['approved', 'published'] },
      $text: { $search: searchText }
    })
    .limit(3)
    .toArray();
  
  if (relatedKBs.length > 0) {
    await db.collection('events').updateOne(
      { _id: objectId },
      { $set: { related_kbs: relatedKBs.map(kb => kb._id) } }
    );
  }
}
