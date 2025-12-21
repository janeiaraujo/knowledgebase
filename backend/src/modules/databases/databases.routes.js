import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { toObjectId } from '../../utils/mongodb.js';
import { tenantMiddleware } from '../../middlewares/tenant.middleware.js';
import { requirePermission } from '../../middlewares/rbac.middleware.js';
import Joi from 'joi';

export default async function databaseRoutes(fastify, options) {
  
  // List databases
  fastify.get('/', {
    preHandler: [authMiddleware, tenantMiddleware]
  }, async (request, reply) => {
    const db = fastify.db();
    
    const databases = await db.collection('databases')
      .find({ tenant_id: request.tenantId })
      .toArray();
    
    return { databases };
  });
  
  // Create database
  fastify.post('/', {
    preHandler: [authMiddleware, tenantMiddleware, requirePermission('kb:create')]
  }, async (request, reply) => {
    const db = fastify.db();
    const { name, description, icon, properties } = request.body;
    
    // Default properties for KB
    const defaultProperties = [
      { name: 'Status', type: 'select', options: ['captured', 'draft', 'in_review', 'approved', 'published', 'deprecated'] },
      { name: 'Priority', type: 'select', options: ['low', 'medium', 'high', 'critical'] },
      { name: 'Category', type: 'select', options: ['incident', 'problem', 'change', 'howto', 'troubleshooting'] },
      { name: 'Tags', type: 'multi-select', options: [] },
      { name: 'Created By', type: 'text' },
      { name: 'Created At', type: 'date' },
      { name: 'Last Updated', type: 'date' }
    ];
    
    const database = {
      tenant_id: request.tenantId,
      name,
      description: description || '',
      icon: icon || '📚',
      properties: properties || defaultProperties,
      created_by: request.currentUser._id,
      created_at: new Date(),
      updated_at: new Date()
    };
    
    const result = await db.collection('databases').insertOne(database);
    
    return { success: true, databaseId: result.insertedId };
  });
  
  // Get database
  fastify.get('/:databaseId', {
    preHandler: [authMiddleware, tenantMiddleware]
  }, async (request, reply) => {
    const db = fastify.db();
    const { databaseId } = request.params;
    
    const database = await db.collection('databases').findOne({
      _id: objectId,
      tenant_id: request.tenantId
    });
    
    if (!database) {
      return reply.status(404).send({ error: 'Database not found' });
    }
    
    return { database };
  });
  
  // Update database
  fastify.patch('/:databaseId', {
    preHandler: [authMiddleware, tenantMiddleware, requirePermission('kb:edit')]
  }, async (request, reply) => {
    const db = fastify.db();
    const { databaseId } = request.params;
    const updates = request.body;
    
    await db.collection('databases').updateOne(
      { _id: objectId, tenant_id: request.tenantId },
      { $set: { ...updates, updated_at: new Date() } }
    );
    
    return { success: true };
  });
}
