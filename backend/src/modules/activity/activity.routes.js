/**
 * User Activity Tracking Module
 * 
 * Tracks user activity across the platform:
 * - KB views (who viewed, when, how long)
 * - Login sessions
 * - Actions performed (create, edit, comment, etc.)
 * - Real-time online users per tenant
 */

import { ObjectId } from 'mongodb';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { tenantMiddleware } from '../../middlewares/tenant.middleware.js';

export default async function activityRoutes(fastify, options) {
    
    const toObjectId = (id) => {
        try {
            return new ObjectId(id);
        } catch {
            return null;
        }
    };

    // ==================== KB VIEW TRACKING ====================

    /**
     * Record a KB view
     * Called when a user opens a KB article
     */
    fastify.post('/kb-views', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async (request, reply) => {
        const db = fastify.db();
        const { kb_id, duration_seconds, scroll_depth } = request.body;
        const kbObjectId = toObjectId(kb_id);

        if (!kbObjectId) {
            return reply.status(400).send({ error: 'ID de KB inválido' });
        }

        // Get user agent info
        const userAgent = request.headers['user-agent'] || '';
        const ip = request.headers['x-forwarded-for']?.split(',')[0] || request.ip;

        const viewRecord = {
            tenant_id: request.tenantId,
            kb_id: kbObjectId,
            user_id: request.currentUser._id,
            user_name: request.currentUser.name,
            user_email: request.currentUser.email,
            user_role: request.currentUser.role,
            viewed_at: new Date(),
            duration_seconds: duration_seconds || null,
            scroll_depth: scroll_depth || null,
            user_agent: userAgent,
            ip_address: ip,
            device_type: detectDeviceType(userAgent)
        };

        await db.collection('kb_views').insertOne(viewRecord);

        // Update KB view count
        await db.collection('records').updateOne(
            { _id: kbObjectId, tenant_id: request.tenantId },
            { 
                $inc: { view_count: 1 },
                $set: { last_viewed_at: new Date() }
            }
        );

        // Update user's last activity
        await db.collection('users').updateOne(
            { _id: request.currentUser._id },
            { 
                $set: { 
                    last_activity: new Date(),
                    last_activity_type: 'kb_view'
                }
            }
        );

        return { success: true };
    });

    /**
     * Update view duration (called when leaving KB)
     */
    fastify.put('/kb-views/:viewId', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async (request, reply) => {
        const db = fastify.db();
        const { viewId } = request.params;
        const { duration_seconds, scroll_depth } = request.body;
        const objectId = toObjectId(viewId);

        if (!objectId) {
            return reply.status(400).send({ error: 'ID de view inválido' });
        }

        await db.collection('kb_views').updateOne(
            { _id: objectId, user_id: request.currentUser._id },
            { 
                $set: { 
                    duration_seconds,
                    scroll_depth,
                    updated_at: new Date()
                }
            }
        );

        return { success: true };
    });

    /**
     * Get views for a specific KB (for KB owners/admins)
     */
    fastify.get('/kb-views/:kbId', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async (request, reply) => {
        const db = fastify.db();
        const { kbId } = request.params;
        const { page = 1, limit = 50, unique = false } = request.query;
        const objectId = toObjectId(kbId);

        if (!objectId) {
            return reply.status(400).send({ error: 'ID de KB inválido' });
        }

        let pipeline = [
            { $match: { tenant_id: request.tenantId, kb_id: objectId } }
        ];

        if (unique === 'true') {
            // Get unique viewers
            pipeline.push(
                { $group: {
                    _id: '$user_id',
                    user_name: { $first: '$user_name' },
                    user_email: { $first: '$user_email' },
                    first_view: { $min: '$viewed_at' },
                    last_view: { $max: '$viewed_at' },
                    view_count: { $sum: 1 },
                    total_duration: { $sum: { $ifNull: ['$duration_seconds', 0] } }
                }},
                { $sort: { last_view: -1 } }
            );
        } else {
            pipeline.push({ $sort: { viewed_at: -1 } });
        }

        pipeline.push(
            { $skip: (parseInt(page) - 1) * parseInt(limit) },
            { $limit: parseInt(limit) }
        );

        const views = await db.collection('kb_views').aggregate(pipeline).toArray();

        // Get total count
        const totalPipeline = [
            { $match: { tenant_id: request.tenantId, kb_id: objectId } }
        ];
        if (unique === 'true') {
            totalPipeline.push({ $group: { _id: '$user_id' } });
        }
        totalPipeline.push({ $count: 'total' });

        const totalResult = await db.collection('kb_views').aggregate(totalPipeline).toArray();
        const total = totalResult[0]?.total || 0;

        // Get total view stats
        const statsResult = await db.collection('kb_views').aggregate([
            { $match: { tenant_id: request.tenantId, kb_id: objectId } },
            { $group: {
                _id: null,
                total_views: { $sum: 1 },
                unique_viewers: { $addToSet: '$user_id' },
                avg_duration: { $avg: { $ifNull: ['$duration_seconds', 0] } }
            }},
            { $project: {
                total_views: 1,
                unique_viewers: { $size: '$unique_viewers' },
                avg_duration: { $round: ['$avg_duration', 0] }
            }}
        ]).toArray();

        return {
            views,
            stats: statsResult[0] || { total_views: 0, unique_viewers: 0, avg_duration: 0 },
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total
            }
        };
    });

    // ==================== USER ACTIVITY TRACKING ====================

    /**
     * Record general user activity
     */
    fastify.post('/log', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async (request, reply) => {
        const db = fastify.db();
        const { action, entity_type, entity_id, metadata } = request.body;

        const activityLog = {
            tenant_id: request.tenantId,
            user_id: request.currentUser._id,
            user_name: request.currentUser.name,
            user_email: request.currentUser.email,
            action,
            entity_type,
            entity_id: entity_id ? toObjectId(entity_id) : null,
            metadata: metadata || {},
            ip_address: request.headers['x-forwarded-for']?.split(',')[0] || request.ip,
            user_agent: request.headers['user-agent'] || '',
            created_at: new Date()
        };

        await db.collection('activity_logs').insertOne(activityLog);

        // Update user's last activity
        await db.collection('users').updateOne(
            { _id: request.currentUser._id },
            { 
                $set: { 
                    last_activity: new Date(),
                    last_activity_type: action
                }
            }
        );

        return { success: true };
    });

    /**
     * Get user activity statistics (for owners/admins)
     */
    fastify.get('/users', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async (request, reply) => {
        const db = fastify.db();
        const { period = '30d', page = 1, limit = 50 } = request.query;

        // Only allow owners and admins
        if (!['owner', 'admin'].includes(request.currentUser.role)) {
            return reply.status(403).send({ error: 'Acesso negado' });
        }

        // Calculate date range
        const now = new Date();
        let startDate;
        switch (period) {
            case '7d': startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); break;
            case '30d': startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); break;
            case '90d': startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000); break;
            default: startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        }

        // Get all users with their activity stats
        const users = await db.collection('users').find({
            tenant_id: request.tenantId,
            active: true
        }).project({
            name: 1,
            email: 1,
            role: 1,
            last_login: 1,
            last_activity: 1,
            last_activity_type: 1,
            created_at: 1
        }).toArray();

        // Get activity counts for each user
        const userStats = await Promise.all(users.map(async (user) => {
            const [kbViews, logins, actions, kbsCreated, comments] = await Promise.all([
                // KB views count
                db.collection('kb_views').countDocuments({
                    tenant_id: request.tenantId,
                    user_id: user._id,
                    viewed_at: { $gte: startDate }
                }),
                // Login count
                db.collection('activity_logs').countDocuments({
                    tenant_id: request.tenantId,
                    user_id: user._id,
                    action: 'login',
                    created_at: { $gte: startDate }
                }),
                // Total actions
                db.collection('activity_logs').countDocuments({
                    tenant_id: request.tenantId,
                    user_id: user._id,
                    created_at: { $gte: startDate }
                }),
                // KBs created
                db.collection('records').countDocuments({
                    tenant_id: request.tenantId,
                    created_by: user._id,
                    created_at: { $gte: startDate }
                }),
                // Comments made
                db.collection('kb_comments').countDocuments({
                    tenant_id: request.tenantId,
                    user_id: user._id,
                    created_at: { $gte: startDate }
                })
            ]);

            // Calculate if user is "active" (had activity in last 24h)
            const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            const isActive = user.last_activity && new Date(user.last_activity) > oneDayAgo;

            return {
                ...user,
                stats: {
                    kb_views: kbViews,
                    logins: logins,
                    total_actions: actions,
                    kbs_created: kbsCreated,
                    comments: comments
                },
                is_active_today: isActive
            };
        }));

        // Sort by last activity
        userStats.sort((a, b) => {
            const aDate = a.last_activity ? new Date(a.last_activity) : new Date(0);
            const bDate = b.last_activity ? new Date(b.last_activity) : new Date(0);
            return bDate - aDate;
        });

        // Paginate
        const paginatedUsers = userStats.slice(
            (parseInt(page) - 1) * parseInt(limit),
            parseInt(page) * parseInt(limit)
        );

        // Get summary stats
        const activeToday = userStats.filter(u => u.is_active_today).length;
        const activeThisWeek = userStats.filter(u => {
            if (!u.last_activity) return false;
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            return new Date(u.last_activity) > weekAgo;
        }).length;

        return {
            users: paginatedUsers,
            summary: {
                total_users: users.length,
                active_today: activeToday,
                active_this_week: activeThisWeek,
                inactive: users.length - activeThisWeek
            },
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: users.length
            }
        };
    });

    /**
     * Get detailed activity for a specific user (for owners/admins)
     */
    fastify.get('/users/:userId', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async (request, reply) => {
        const db = fastify.db();
        const { userId } = request.params;
        const { period = '30d' } = request.query;
        const objectId = toObjectId(userId);

        if (!objectId) {
            return reply.status(400).send({ error: 'ID de usuário inválido' });
        }

        // Only allow owners, admins, or the user themselves
        if (!['owner', 'admin'].includes(request.currentUser.role) && 
            request.currentUser._id.toString() !== userId) {
            return reply.status(403).send({ error: 'Acesso negado' });
        }

        // Calculate date range
        const now = new Date();
        let startDate;
        switch (period) {
            case '7d': startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); break;
            case '30d': startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); break;
            case '90d': startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000); break;
            default: startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        }

        // Get user info
        const user = await db.collection('users').findOne({
            _id: objectId,
            tenant_id: request.tenantId
        }, {
            projection: {
                password: 0,
                magic_link_token: 0
            }
        });

        if (!user) {
            return reply.status(404).send({ error: 'Usuário não encontrado' });
        }

        // Get KB views
        const recentViews = await db.collection('kb_views').aggregate([
            { $match: { 
                tenant_id: request.tenantId, 
                user_id: objectId,
                viewed_at: { $gte: startDate }
            }},
            { $lookup: {
                from: 'records',
                localField: 'kb_id',
                foreignField: '_id',
                as: 'kb'
            }},
            { $unwind: { path: '$kb', preserveNullAndEmptyArrays: true } },
            { $project: {
                kb_id: 1,
                kb_title: '$kb.title',
                viewed_at: 1,
                duration_seconds: 1
            }},
            { $sort: { viewed_at: -1 } },
            { $limit: 50 }
        ]).toArray();

        // Get activity logs
        const activityLogs = await db.collection('activity_logs')
            .find({
                tenant_id: request.tenantId,
                user_id: objectId,
                created_at: { $gte: startDate }
            })
            .sort({ created_at: -1 })
            .limit(100)
            .toArray();

        // Get activity by day
        const activityByDay = await db.collection('activity_logs').aggregate([
            { $match: { 
                tenant_id: request.tenantId, 
                user_id: objectId,
                created_at: { $gte: startDate }
            }},
            { $group: {
                _id: {
                    year: { $year: '$created_at' },
                    month: { $month: '$created_at' },
                    day: { $dayOfMonth: '$created_at' }
                },
                count: { $sum: 1 }
            }},
            { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
        ]).toArray();

        // Get most viewed KBs by this user
        const topViewedKBs = await db.collection('kb_views').aggregate([
            { $match: { 
                tenant_id: request.tenantId, 
                user_id: objectId,
                viewed_at: { $gte: startDate }
            }},
            { $group: {
                _id: '$kb_id',
                view_count: { $sum: 1 },
                last_viewed: { $max: '$viewed_at' }
            }},
            { $lookup: {
                from: 'records',
                localField: '_id',
                foreignField: '_id',
                as: 'kb'
            }},
            { $unwind: '$kb' },
            { $project: {
                kb_id: '$_id',
                kb_title: '$kb.title',
                view_count: 1,
                last_viewed: 1
            }},
            { $sort: { view_count: -1 } },
            { $limit: 10 }
        ]).toArray();

        return {
            user,
            recent_views: recentViews,
            activity_logs: activityLogs,
            activity_by_day: activityByDay.map(d => ({
                date: `${d._id.year}-${String(d._id.month).padStart(2, '0')}-${String(d._id.day).padStart(2, '0')}`,
                count: d.count
            })),
            top_viewed_kbs: topViewedKBs
        };
    });

    /**
     * Get real-time active users count
     */
    fastify.get('/online', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async (request, reply) => {
        const db = fastify.db();

        // Consider users active if they had activity in last 15 minutes
        const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

        const onlineUsers = await db.collection('users').find({
            tenant_id: request.tenantId,
            active: true,
            last_activity: { $gte: fifteenMinutesAgo }
        }).project({
            name: 1,
            email: 1,
            role: 1,
            last_activity: 1,
            last_activity_type: 1
        }).toArray();

        return {
            count: onlineUsers.length,
            users: onlineUsers
        };
    });

    /**
     * Get tenant-wide activity summary (for admin/owner)
     */
    fastify.get('/tenant-summary', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async (request, reply) => {
        const db = fastify.db();

        // Allow owners and admins
        if (!['owner', 'admin'].includes(request.currentUser.role)) {
            return reply.status(403).send({ error: 'Acesso negado. Você não tem permissão para esta ação.' });
        }

        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const thisWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        const [
            totalUsers,
            activeToday,
            activeThisWeek,
            viewsToday,
            viewsThisWeek,
            viewsThisMonth,
            topViewersThisWeek,
            mostViewedKBsThisWeek,
            activityByHour
        ] = await Promise.all([
            // Total users
            db.collection('users').countDocuments({ 
                tenant_id: request.tenantId, 
                active: true 
            }),
            
            // Active today
            db.collection('users').countDocuments({ 
                tenant_id: request.tenantId, 
                active: true,
                last_activity: { $gte: today }
            }),
            
            // Active this week
            db.collection('users').countDocuments({ 
                tenant_id: request.tenantId, 
                active: true,
                last_activity: { $gte: thisWeek }
            }),
            
            // Views today
            db.collection('kb_views').countDocuments({ 
                tenant_id: request.tenantId,
                viewed_at: { $gte: today }
            }),
            
            // Views this week
            db.collection('kb_views').countDocuments({ 
                tenant_id: request.tenantId,
                viewed_at: { $gte: thisWeek }
            }),
            
            // Views this month
            db.collection('kb_views').countDocuments({ 
                tenant_id: request.tenantId,
                viewed_at: { $gte: thisMonth }
            }),
            
            // Top viewers this week
            db.collection('kb_views').aggregate([
                { $match: { 
                    tenant_id: request.tenantId,
                    viewed_at: { $gte: thisWeek }
                }},
                { $group: {
                    _id: '$user_id',
                    user_name: { $first: '$user_name' },
                    user_email: { $first: '$user_email' },
                    view_count: { $sum: 1 }
                }},
                { $sort: { view_count: -1 } },
                { $limit: 10 }
            ]).toArray(),
            
            // Most viewed KBs this week
            db.collection('kb_views').aggregate([
                { $match: { 
                    tenant_id: request.tenantId,
                    viewed_at: { $gte: thisWeek }
                }},
                { $group: {
                    _id: '$kb_id',
                    view_count: { $sum: 1 },
                    unique_viewers: { $addToSet: '$user_id' }
                }},
                { $lookup: {
                    from: 'records',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'kb'
                }},
                { $unwind: '$kb' },
                { $project: {
                    kb_id: '$_id',
                    kb_title: '$kb.title',
                    view_count: 1,
                    unique_viewers: { $size: '$unique_viewers' }
                }},
                { $sort: { view_count: -1 } },
                { $limit: 10 }
            ]).toArray(),
            
            // Activity by hour (last 24h)
            db.collection('kb_views').aggregate([
                { $match: { 
                    tenant_id: request.tenantId,
                    viewed_at: { $gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) }
                }},
                { $group: {
                    _id: { $hour: '$viewed_at' },
                    count: { $sum: 1 }
                }},
                { $sort: { _id: 1 } }
            ]).toArray()
        ]);

        return {
            users: {
                total: totalUsers,
                active_today: activeToday,
                active_this_week: activeThisWeek,
                engagement_rate: totalUsers > 0 ? Math.round((activeThisWeek / totalUsers) * 100) : 0
            },
            views: {
                today: viewsToday,
                this_week: viewsThisWeek,
                this_month: viewsThisMonth
            },
            top_viewers: topViewersThisWeek,
            most_viewed_kbs: mostViewedKBsThisWeek,
            activity_by_hour: activityByHour,
            timestamp: new Date().toISOString()
        };
    });
}

// Helper function to detect device type
function detectDeviceType(userAgent) {
    if (/mobile/i.test(userAgent)) return 'mobile';
    if (/tablet/i.test(userAgent)) return 'tablet';
    return 'desktop';
}
