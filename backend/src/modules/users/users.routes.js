import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { toObjectId } from '../../utils/mongodb.js';
import { tenantMiddleware } from '../../middlewares/tenant.middleware.js';
import { requirePermission } from '../../middlewares/rbac.middleware.js';
import { requireRole } from '../../middlewares/rbac.middleware.js';
import Joi from 'joi';
import { hashPassword } from '../auth/auth.service.js';
import bcrypt from 'bcrypt';

export default async function userRoutes(fastify, options) {

    // List users in organization
    fastify.get('/', {
        preHandler: [authMiddleware, tenantMiddleware, requirePermission('user:read')]
    }, async(request, reply) => {
        const db = fastify.db();

        const users = await db.collection('users')
            .find({ tenant_id: request.tenantId })
            .project({ password: 0 })
            .toArray();

        return { users };
    });

    // Create user (admin/owner only)
    fastify.post('/', {
        preHandler: [authMiddleware, tenantMiddleware, requireRole(['admin', 'owner'])]
    }, async(request, reply) => {
        const db = fastify.db();
        const { email, name, password, role } = request.body;

        if (!email || !name || !password || !role) {
            return reply.status(400).send({ error: 'Email, name, password and role are required' });
        }

        // Check if user already exists in tenant
        const existing = await db.collection('users').findOne({
            tenant_id: request.tenantId,
            email
        });

        if (existing) {
            return reply.status(400).send({ error: 'User already exists in this organization' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user
        const user = {
            tenant_id: request.tenantId,
            email,
            name,
            password: hashedPassword,
            role,
            active: true,
            email_verified: true,
            created_by: request.currentUser._id,
            created_at: new Date(),
            updated_at: new Date()
        };

        const result = await db.collection('users').insertOne(user);

        return {
            success: true,
            userId: result.insertedId,
            user: {
                _id: result.insertedId,
                email,
                name,
                role,
                created_at: user.created_at
            }
        };
    });

    // Update user (admin/owner only)
    const updateUserHandler = async(request, reply) => {
        const db = fastify.db();
        const { userId } = request.params;
        const { name, email, password, role } = request.body;

        const objectId = toObjectId(userId);
        if (!objectId) {
            return reply.status(400).send({ error: 'Invalid user ID' });
        }

        // Check if user exists
        const user = await db.collection('users').findOne({
            _id: objectId,
            tenant_id: request.tenantId
        });

        if (!user) {
            return reply.status(404).send({ error: 'User not found' });
        }

        const updates = {
            updated_at: new Date()
        };

        if (name) updates.name = name;
        if (role) updates.role = role;

        // Update password if provided
        if (password) {
            updates.password = await bcrypt.hash(password, 10);
        }

        // NOTE: email update intentionally not supported here (matches current UI behavior)
        await db.collection('users').updateOne({
            _id: objectId,
            tenant_id: request.tenantId
        }, { $set: updates });

        return { success: true };
    };

    fastify.put('/:userId', {
        preHandler: [authMiddleware, tenantMiddleware, requireRole(['admin', 'owner'])]
    }, updateUserHandler);

    fastify.patch('/:userId', {
        preHandler: [authMiddleware, tenantMiddleware, requireRole(['admin', 'owner'])]
    }, updateUserHandler);

    // Delete user (admin/owner only)
    fastify.delete('/:userId', {
        preHandler: [authMiddleware, tenantMiddleware, requireRole(['admin', 'owner'])]
    }, async(request, reply) => {
        const db = fastify.db();
        const { userId } = request.params;

        const objectId = toObjectId(userId);
        if (!objectId) {
            return reply.status(400).send({ error: 'Invalid user ID' });
        }

        // Cannot delete self
        if (objectId.equals(request.currentUser._id)) {
            return reply.status(400).send({ error: 'Cannot delete yourself' });
        }

        const result = await db.collection('users').deleteOne({
            _id: objectId,
            tenant_id: request.tenantId
        });

        if (result.deletedCount === 0) {
            return reply.status(404).send({ error: 'User not found' });
        }

        // Remove from groups
        await db.collection('user_groups').deleteMany({
            user_id: objectId,
            tenant_id: request.tenantId
        });

        return { success: true };
    });

    // Invite user
    fastify.post('/invite', {
        preHandler: [authMiddleware, tenantMiddleware, requirePermission('user:invite')]
    }, async(request, reply) => {
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
        await db.collection('subscriptions').updateOne({ tenant_id: request.tenantId }, { $inc: { 'usage.users': 1 } });

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
}