import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { toObjectId } from '../../utils/mongodb.js';
import { tenantMiddleware } from '../../middlewares/tenant.middleware.js';
import { requirePermission } from '../../middlewares/rbac.middleware.js';
import { requireRole } from '../../middlewares/rbac.middleware.js';
import Joi from 'joi';
import { hashPassword } from '../auth/auth.service.js';
import bcrypt from 'bcrypt';

const SUPPORTED_LANGUAGES = ['pt', 'en'];
const SUPPORTED_THEMES = ['light', 'dark', 'system'];

const publicProfile = (user) => ({
    _id: user._id,
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    active: user.active,
    email_verified: user.email_verified,
    created_at: user.created_at,
    last_login: user.last_login,
    preferences: {
        language: user.preferences?.language || 'pt',
        theme: user.preferences?.theme || 'system'
    }
});

export default async function userRoutes(fastify, options) {

    // ==================== PERFIL DO PROPRIO USUARIO ====================
    // Auto-servico: qualquer usuario autenticado gerencia o proprio perfil.
    // As rotas de /:userId abaixo exigem admin/owner e servem para gerenciar
    // OUTROS usuarios - sem estas, um membro comum nao conseguia nem trocar
    // a propria senha.
    // Rotas estaticas ficam antes das parametricas para nao colidir com /:userId.

    fastify.get('/me', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async(request, reply) => {
        return { user: publicProfile(request.currentUser) };
    });

    fastify.patch('/me', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async(request, reply) => {
        const db = fastify.db();
        const { name, preferences } = request.body || {};

        const updates = { updated_at: new Date() };

        if (name !== undefined) {
            const trimmed = String(name).trim();
            if (!trimmed) {
                return reply.status(400).send({ error: 'Nome não pode ficar vazio' });
            }
            updates.name = trimmed;
        }

        if (preferences) {
            if (preferences.language !== undefined) {
                if (!SUPPORTED_LANGUAGES.includes(preferences.language)) {
                    return reply.status(400).send({
                        error: `Idioma inválido. Use: ${SUPPORTED_LANGUAGES.join(', ')}`
                    });
                }
                updates['preferences.language'] = preferences.language;
            }
            if (preferences.theme !== undefined) {
                if (!SUPPORTED_THEMES.includes(preferences.theme)) {
                    return reply.status(400).send({
                        error: `Tema inválido. Use: ${SUPPORTED_THEMES.join(', ')}`
                    });
                }
                updates['preferences.theme'] = preferences.theme;
            }
        }

        await db.collection('users').updateOne(
            { _id: request.currentUser._id, tenant_id: request.tenantId },
            { $set: updates }
        );

        const updated = await db.collection('users').findOne({ _id: request.currentUser._id });
        return { success: true, user: publicProfile(updated) };
    });

    // Troca da propria senha - exige a senha atual, diferente do PATCH
    // /:userId (admin), que redefine sem conferir a anterior.
    fastify.post('/me/password', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async(request, reply) => {
        const db = fastify.db();
        const { currentPassword, newPassword } = request.body || {};

        if (!currentPassword || !newPassword) {
            return reply.status(400).send({ error: 'Senha atual e nova senha são obrigatórias' });
        }

        if (String(newPassword).length < 8) {
            return reply.status(400).send({ error: 'A nova senha deve ter no mínimo 8 caracteres' });
        }

        const user = await db.collection('users').findOne({ _id: request.currentUser._id });

        if (!user?.password) {
            return reply.status(400).send({
                error: 'Esta conta não usa senha (login por magic link). Defina uma senha com o administrador.'
            });
        }

        const matches = await bcrypt.compare(currentPassword, user.password);
        if (!matches) {
            return reply.status(400).send({ error: 'Senha atual incorreta' });
        }

        await db.collection('users').updateOne(
            { _id: user._id },
            { $set: { password: await bcrypt.hash(newPassword, 10), updated_at: new Date() } }
        );

        await db.collection('audit_logs').insertOne({
            tenant_id: request.tenantId,
            user_id: user._id,
            action: 'user.password_changed',
            resource: 'user',
            resource_id: user._id,
            timestamp: new Date()
        });

        return { success: true };
    });

    // ==================== GESTAO DE USUARIOS (admin/owner) ====================

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