/**
 * WebSocket Module for Real-Time Notifications
 * Uses Fastify WebSocket plugin for bidirectional communication
 */

import { ObjectId } from 'mongodb';

// Store active WebSocket connections by user
const connections = new Map(); // Map<tenantId_userId, Set<WebSocket>>

export function getConnections() {
    return connections;
}

export function broadcastToUser(tenantId, userId, message) {
    const key = `${tenantId}_${userId}`;
    const userConnections = connections.get(key);

    if (userConnections) {
        const payload = JSON.stringify(message);
        userConnections.forEach(ws => {
            if (ws.readyState === 1) { // OPEN
                ws.send(payload);
            }
        });
        return true;
    }
    return false;
}

export function broadcastToTenant(tenantId, message, excludeUserId = null) {
    const payload = JSON.stringify(message);
    let count = 0;

    connections.forEach((userConnections, key) => {
        if (key.startsWith(`${tenantId}_`)) {
            const userId = key.split('_')[1];
            if (excludeUserId && userId === excludeUserId.toString()) return;

            userConnections.forEach(ws => {
                if (ws.readyState === 1) {
                    ws.send(payload);
                    count++;
                }
            });
        }
    });

    return count;
}

export default async function websocketRoutes(fastify, options) {
    // Register WebSocket plugin if not already registered
    try {
        await fastify.register(
            import ('@fastify/websocket'));
    } catch (err) {
        // Plugin might already be registered
        fastify.log.warn('WebSocket plugin may already be registered');
    }

    // WebSocket endpoint for real-time notifications
    fastify.get('/ws/notifications', { websocket: true }, async(connection, request) => {
        const ws = connection.socket || connection;

        // Parse token from query string
        const token = request.query.token;

        if (!token) {
            ws.close(4001, 'Authentication required');
            return;
        }

        try {
            // Verify JWT token
            const decoded = fastify.jwt.verify(token);
            const tenantId = new ObjectId(decoded.tenant_id);
            const userId = new ObjectId(decoded.userId);
            const key = `${tenantId}_${userId}`;

            // Add connection to map
            if (!connections.has(key)) {
                connections.set(key, new Set());
            }
            connections.get(key).add(ws);

            fastify.log.info(`WebSocket connected: User ${userId} from Tenant ${tenantId}`);

            // Send initial connection success message
            ws.send(JSON.stringify({
                type: 'connected',
                message: 'Real-time notifications enabled',
                timestamp: new Date().toISOString()
            }));

            // Send unread count on connect
            const db = fastify.db();
            const unreadCount = await db.collection('notifications').countDocuments({
                tenant_id: tenantId,
                user_id: userId,
                read: false
            });

            ws.send(JSON.stringify({
                type: 'unread_count',
                count: unreadCount,
                timestamp: new Date().toISOString()
            }));

            // Handle incoming messages
            ws.on('message', async(rawMessage) => {
                try {
                    const message = JSON.parse(rawMessage.toString());

                    switch (message.type) {
                        case 'ping':
                            ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
                            break;

                        case 'mark_read':
                            if (message.notificationId) {
                                await db.collection('notifications').updateOne({
                                    _id: new ObjectId(message.notificationId),
                                    tenant_id: tenantId,
                                    user_id: userId
                                }, { $set: { read: true, read_at: new Date() } });

                                // Broadcast updated count
                                const newCount = await db.collection('notifications').countDocuments({
                                    tenant_id: tenantId,
                                    user_id: userId,
                                    read: false
                                });

                                ws.send(JSON.stringify({
                                    type: 'unread_count',
                                    count: newCount,
                                    timestamp: new Date().toISOString()
                                }));
                            }
                            break;

                        case 'mark_all_read':
                            await db.collection('notifications').updateMany({
                                tenant_id: tenantId,
                                user_id: userId,
                                read: false
                            }, { $set: { read: true, read_at: new Date() } });

                            ws.send(JSON.stringify({
                                type: 'unread_count',
                                count: 0,
                                timestamp: new Date().toISOString()
                            }));
                            break;

                        default:
                            fastify.log.warn(`Unknown WebSocket message type: ${message.type}`);
                    }
                } catch (err) {
                    fastify.log.error('WebSocket message error:', err);
                }
            });

            // Handle disconnect
            ws.on('close', () => {
                const userConnections = connections.get(key);
                if (userConnections) {
                    userConnections.delete(ws);
                    if (userConnections.size === 0) {
                        connections.delete(key);
                    }
                }
                fastify.log.info(`WebSocket disconnected: User ${userId}`);
            });

            // Handle errors
            ws.on('error', (err) => {
                fastify.log.error('WebSocket error:', err);
            });

        } catch (err) {
            fastify.log.error('WebSocket auth error:', err);
            ws.close(4001, 'Invalid token');
        }
    });

    // API endpoint to send notification and broadcast via WebSocket
    fastify.post('/ws/notify', {
        preHandler: [
            (request, reply, done) => {
                // Internal API - check for internal key or admin
                const internalKey = request.headers['x-internal-key'];
                if (internalKey !== process.env.INTERNAL_API_KEY &&
                    !request.headers.authorization) {
                    return reply.status(401).send({ error: 'Unauthorized' });
                }
                done();
            }
        ]
    }, async(request, reply) => {
        const { tenant_id, user_id, notification } = request.body;

        const sent = broadcastToUser(tenant_id, user_id, {
            type: 'notification',
            notification,
            timestamp: new Date().toISOString()
        });

        return { success: true, delivered: sent };
    });

    // Get WebSocket connection stats
    fastify.get('/ws/stats', async(request, reply) => {
        const stats = {
            total_connections: 0,
            connections_by_tenant: {}
        };

        connections.forEach((userConnections, key) => {
            const [tenantId] = key.split('_');
            stats.total_connections += userConnections.size;
            stats.connections_by_tenant[tenantId] =
                (stats.connections_by_tenant[tenantId] || 0) + userConnections.size;
        });

        return stats;
    });
}

// Helper function to create and broadcast notification
export async function createAndBroadcastNotification(db, {
    tenant_id,
    user_id,
    type,
    title,
    message,
    link,
    related_id,
    icon,
    priority = 'normal'
}) {
    const notification = {
        tenant_id: new ObjectId(tenant_id),
        user_id: new ObjectId(user_id),
        type,
        title,
        message,
        link,
        related_id: related_id ? new ObjectId(related_id) : null,
        icon: icon || getIconForType(type),
        priority,
        read: false,
        created_at: new Date()
    };

    const result = await db.collection('notifications').insertOne(notification);
    notification._id = result.insertedId;

    // Broadcast via WebSocket
    broadcastToUser(tenant_id.toString(), user_id.toString(), {
        type: 'notification',
        notification,
        timestamp: new Date().toISOString()
    });

    return notification;
}

function getIconForType(type) {
    const icons = {
        kb_submitted: 'bi-send',
        kb_approved: 'bi-check-circle',
        kb_rejected: 'bi-x-circle',
        kb_published: 'bi-globe',
        kb_comment: 'bi-chat-dots',
        kb_mentioned: 'bi-at',
        kb_updated: 'bi-pencil',
        system: 'bi-bell',
        default: 'bi-bell'
    };
    return icons[type] || icons.default;
}