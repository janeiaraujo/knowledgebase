import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { toObjectId } from '../../utils/mongodb.js';
import { tenantMiddleware } from '../../middlewares/tenant.middleware.js';
import { requirePermission } from '../../middlewares/rbac.middleware.js';

export default async function kbRoutes(fastify, options) {
  
  // Search KB (textual + semantic)
  fastify.get('/search', {
    preHandler: [authMiddleware, tenantMiddleware]
  }, async (request, reply) => {
    const db = fastify.db();
    const { q, limit = 20 } = request.query;
    
    if (!q) {
      return reply.status(400).send({ error: 'Query parameter required' });
    }
    
    // Textual search
    const textResults = await db.collection('records')
      .find({
        tenant_id: request.tenantId,
        status: { $in: ['approved', 'published'] },
        $text: { $search: q }
      }, {
        score: { $meta: 'textScore' }
      })
      .sort({ score: { $meta: 'textScore' } })
      .limit(parseInt(limit))
      .toArray();
    
    // TODO: Semantic search using embeddings (implemented in AI module)
    
    return { 
      results: textResults,
      count: textResults.length 
    };
  });
  
  // Quick capture (for incident response)
  fastify.post('/capture', {
    preHandler: [authMiddleware, tenantMiddleware, requirePermission('kb:create')]
  }, async (request, reply) => {
    const db = fastify.db();
    const { title, content, incident_id } = request.body;
    
    const record = {
      tenant_id: request.tenantId,
      database_id: null, // Will be categorized later
      title: title || `Quick Capture - ${new Date().toISOString()}`,
      content_md: content,
      properties: {},
      status: 'captured',
      version: 1,
      created_by: request.currentUser._id,
      created_at: new Date(),
      updated_at: new Date(),
      incident_id: incident_id || null
    };
    
    const result = await db.collection('records').insertOne(record);
    
    return { success: true, recordId: result.insertedId };
  });
  
  // Get related KBs
  fastify.get('/:recordId/related', {
    preHandler: [authMiddleware, tenantMiddleware]
  }, async (request, reply) => {
    const db = fastify.db();
    const { recordId } = request.params;
    
    const record = await db.collection('records').findOne({
      _id: recordId,
      tenant_id: request.tenantId
    });
    
    if (!record) {
      return reply.status(404).send({ error: 'Record not found' });
    }
    
    // Simple text-based similarity (can be enhanced with AI)
    const related = await db.collection('records')
      .find({
        tenant_id: request.tenantId,
        _id: { $ne: recordId },
        status: { $in: ['approved', 'published'] },
        $or: [
          { 'properties.category': record.properties?.category },
          { 'properties.tags': { $in: record.properties?.tags || [] } }
        ]
      })
      .limit(5)
      .toArray();
    
    return { related };
  });
}
