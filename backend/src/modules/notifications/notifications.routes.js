/**
 * Notifications Module Routes
 * Handles in-app notifications for workflow events
 */

import { ObjectId } from 'mongodb';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { tenantMiddleware } from '../../middlewares/tenant.middleware.js';

export default async function notificationsRoutes(fastify, options) {

    // Note: Indexes are created in server.js during startup

    /**
     * List notifications for current user
     */
    fastify.get('/', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async(request) => {
        const db = fastify.db();
        const { page = 1, limit = 20, unread_only } = request.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const query = {
            tenant_id: request.tenantId,
            user_id: request.userId
        };

        if (unread_only === 'true' || unread_only === true) {
            query.read = false;
        }

        const [notifications, total, unread_count] = await Promise.all([
            db.collection('notifications')
            .find(query)
            .sort({ created_at: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .toArray(),
            db.collection('notifications').countDocuments(query),
            db.collection('notifications').countDocuments({
                tenant_id: request.tenantId,
                user_id: request.userId,
                read: false
            })
        ]);

        return {
            notifications,
            pagination: {
                total,
                page: parseInt(page),
                pages: Math.ceil(total / parseInt(limit))
            },
            unread_count
        };
    });

    /**
     * Get unread count only (for badge)
     */
    fastify.get('/count', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async(request) => {
        const db = fastify.db();
        const count = await db.collection('notifications').countDocuments({
            tenant_id: request.tenantId,
            user_id: request.userId,
            read: false
        });

        return { unread_count: count };
    });

    /**
     * Mark notification as read
     */
    fastify.patch('/:id/read', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async(request, reply) => {
        const db = fastify.db();

        let objectId;
        try {
            objectId = new ObjectId(request.params.id);
        } catch (err) {
            return reply.status(400).send({ error: 'Invalid notification ID' });
        }

        const result = await db.collection('notifications').updateOne({
            _id: objectId,
            tenant_id: request.tenantId,
            user_id: request.userId
        }, { $set: { read: true, read_at: new Date() } });

        if (result.matchedCount === 0) {
            return reply.status(404).send({ error: 'Notificação não encontrada' });
        }

        return { success: true };
    });

    /**
     * Mark all notifications as read
     */
    fastify.post('/mark-all-read', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async(request) => {
        const db = fastify.db();
        const result = await db.collection('notifications').updateMany({
            tenant_id: request.tenantId,
            user_id: request.userId,
            read: false
        }, { $set: { read: true, read_at: new Date() } });

        return { success: true, updated: result.modifiedCount };
    });

    /**
     * Delete a notification
     */
    fastify.delete('/:id', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async(request, reply) => {
        const db = fastify.db();

        let objectId;
        try {
            objectId = new ObjectId(request.params.id);
        } catch (err) {
            return reply.status(400).send({ error: 'Invalid notification ID' });
        }

        const result = await db.collection('notifications').deleteOne({
            _id: objectId,
            tenant_id: request.tenantId,
            user_id: request.userId
        });

        if (result.deletedCount === 0) {
            return reply.status(404).send({ error: 'Notificação não encontrada' });
        }

        return { success: true };
    });
}

/**
 * Helper to create notifications (exported for use in other modules)
 */
export async function createNotification(db, { tenant_id, user_id, type, title, message, link, related_id }) {
    const notification = {
        tenant_id: new ObjectId(tenant_id),
        user_id: new ObjectId(user_id),
        type,
        title,
        message,
        link,
        related_id: related_id ? new ObjectId(related_id) : null,
        read: false,
        created_at: new Date()
    };

    await db.collection('notifications').insertOne(notification);
    return notification;
}

/**
 * Notify all approvers about a new KB submission
 */
export async function notifyApprovers(db, { tenant_id, kb_id, kb_title, submitter_name }) {
    // Get all users with approve permission
    const users = await db.collection('users').find({
        tenant_id: new ObjectId(tenant_id),
        status: 'active',
        role: { $in: ['admin', 'owner'] } // Admins and owners can approve
    }).toArray();

    const notifications = users.map(user => ({
        tenant_id: new ObjectId(tenant_id),
        user_id: user._id,
        type: 'kb_submitted',
        title: 'Novo KB para Revisão',
        message: `"${kb_title}" foi enviado para revisão por ${submitter_name}`,
        link: `/kb/${kb_id}`,
        related_id: new ObjectId(kb_id),
        read: false,
        created_at: new Date()
    }));

    if (notifications.length > 0) {
        await db.collection('notifications').insertMany(notifications);
    }
}

/**
 * Notify KB creator about approval/rejection
 */
export async function notifyCreator(db, { tenant_id, creator_id, kb_id, kb_title, type, reviewer_name, reason }) {
    const typeConfig = {
            kb_approved: {
                title: 'KB Aprovado',
                message: `"${kb_title}" foi aprovado por ${reviewer_name}`
            },
            kb_rejected: {
                title: 'KB Rejeitado',
                message: `"${kb_title}" foi rejeitado por ${reviewer_name}${reason ? `: ${reason}` : ''}`
    },
    kb_published: {
      title: 'KB Publicado',
      message: `"${kb_title}" foi publicado e está disponível para todos`
    }
  };
  
  const config = typeConfig[type];
  if (!config) return;
  
  await createNotification(db, {
    tenant_id,
    user_id: creator_id,
    type,
    title: config.title,
    message: config.message,
    link: `/kb/${kb_id}`,
    related_id: kb_id
  });
}