import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { toObjectId } from '../../utils/mongodb.js';
import { tenantMiddleware } from '../../middlewares/tenant.middleware.js';
import { requirePermission } from '../../middlewares/rbac.middleware.js';
import Joi from 'joi';
import { hashPassword } from '../auth/auth.service.js';

export default async function userRoutes(fastify, options) {
  
  // List users in organization
  fastify.get('/', {
    preHandler: [authMiddleware, tenantMiddleware, requirePermission('user:read')]
  }, async (request, reply) => {
    const db = fastify.db();
    
    const users = await db.collection('users')
      .find({ tenant_id: request.tenantId })
      .project({ password: 0 })
      .toArray();
    
    return { users };
  });
  
  // Invite user
  fastify.post('/invite', {
    preHandler: [authMiddleware, tenantMiddleware, requirePermission('user:invite')]
  }, async (request, reply) => {
    const db = fastify.db();
    const { email, name, role } = request.body;
    
    // Check if user already exists
    const existing = await db.collection('users').findOne({ 
      tenant_id: request.tenantId,
      email 
    });
    
    if (existing) {
      return reply.status(400).send({ error: 'User already exists' });
    }
    
    // Check subscription limits
    const subscription = await db.collection('subscriptions').findOne({
      tenant_id: request.tenantId,
      status: 'active'
    });
    
    const userCount = await db.collection('users').countDocuments({
      tenant_id: request.tenantId
    });
    
    if (userCount >= subscription.limits.max_users) {
      return reply.status(400).send({ 
        error: 'User limit reached. Please upgrade your plan.' 
      });
    }
    
    // Create user
    const user = {
      tenant_id: request.tenantId,
      email,
      name,
      role,
      active: true,
      email_verified: false,
      invited_by: request.currentUser._id,
      created_at: new Date()
    };
    
    const result = await db.collection('users').insertOne(user);
    
    // Update subscription usage
    await db.collection('subscriptions').updateOne(
      { tenant_id: request.tenantId },
      { $inc: { 'usage.users': 1 } }
    );
    
    // Audit log
    await db.collection('audit_logs').insertOne({
      tenant_id: request.tenantId,
      user_id: request.currentUser._id,
      action: 'user.invited',
      resource: 'user',
      resource_id: result.insertedId,
      timestamp: new Date(),
      metadata: { email, role }
    });
    
    // TODO: Send invitation email
    
    return { success: true, userId: result.insertedId };
  });
  
  // Update user
  fastify.patch('/:userId', {
    preHandler: [authMiddleware, tenantMiddleware, requirePermission('user:manage')]
  }, async (request, reply) => {
    const db = fastify.db();
    const { userId } = request.params;
    const updates = request.body;
    
    await db.collection('users').updateOne(
      { 
        _id: objectId,
        tenant_id: request.tenantId
      },
      { 
        $set: {
          ...updates,
          updated_at: new Date()
        }
      }
    );
    
    return { success: true };
  });
  
  // Delete user
  fastify.delete('/:userId', {
    preHandler: [authMiddleware, tenantMiddleware, requirePermission('user:manage')]
  }, async (request, reply) => {
    const db = fastify.db();
    const { userId } = request.params;
    
    // Cannot delete self
    if (userId === request.currentUser._id.toString()) {
      return reply.status(400).send({ error: 'Cannot delete yourself' });
    }
    
    await db.collection('users').deleteOne({
      _id: objectId,
      tenant_id: request.tenantId
    });
    
    // Update subscription usage
    await db.collection('subscriptions').updateOne(
      { tenant_id: request.tenantId },
      { $inc: { 'usage.users': -1 } }
    );
    
    return { success: true };
  });
}
