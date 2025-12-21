import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { toObjectId } from '../../utils/mongodb.js';
import { tenantMiddleware } from '../../middlewares/tenant.middleware.js';
import { requireAdmin } from '../../middlewares/rbac.middleware.js';
import Joi from 'joi';

export default async function organizationRoutes(fastify, options) {
  
  // Get current organization
  fastify.get('/', {
    preHandler: [authMiddleware, tenantMiddleware]
  }, async (request, reply) => {
    const db = fastify.db();
    
    const org = await db.collection('organizations').findOne({
      tenant_id: request.tenantId
    });
    
    if (!org) {
      return reply.status(404).send({ error: 'Organization not found' });
    }
    
    return { organization: org };
  });
  
  // Update organization
  fastify.patch('/', {
    preHandler: [authMiddleware, tenantMiddleware, requireAdmin]
  }, async (request, reply) => {
    const db = fastify.db();
    const { name, settings } = request.body;
    
    const updateData = {
      updated_at: new Date()
    };
    
    if (name) updateData.name = name;
    if (settings) updateData.settings = settings;
    
    await db.collection('organizations').updateOne(
      { tenant_id: request.tenantId },
      { $set: updateData }
    );
    
    // Audit log
    await db.collection('audit_logs').insertOne({
      tenant_id: request.tenantId,
      user_id: request.currentUser._id,
      action: 'organization.updated',
      resource: 'organization',
      timestamp: new Date(),
      metadata: updateData
    });
    
    return { success: true };
  });
}
