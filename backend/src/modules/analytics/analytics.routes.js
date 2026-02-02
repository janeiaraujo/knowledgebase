import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { tenantMiddleware } from '../../middlewares/tenant.middleware.js';
import { requirePermission } from '../../middlewares/rbac.middleware.js';
import { toObjectId } from '../../utils/mongodb.js';

export default async function analyticsRoutes(fastify, options) {

    // Get dashboard overview metrics
    fastify.get('/overview', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async(request, reply) => {
        const db = fastify.db();
        const { period = '30d' } = request.query;

        // Calculate date range
        const now = new Date();
        let startDate;
        switch (period) {
            case '7d':
                startDate = new Date(now.setDate(now.getDate() - 7));
                break;
            case '30d':
                startDate = new Date(now.setDate(now.getDate() - 30));
                break;
            case '90d':
                startDate = new Date(now.setDate(now.getDate() - 90));
                break;
            case '1y':
                startDate = new Date(now.setFullYear(now.getFullYear() - 1));
                break;
            default:
                startDate = new Date(now.setDate(now.getDate() - 30));
        }

        // Get total counts
        const [
            totalKBs,
            publishedKBs,
            draftKBs,
            inReviewKBs,
            totalIncidents,
            totalUsers,
            totalComments
        ] = await Promise.all([
            db.collection('records').countDocuments({ tenant_id: request.tenantId }),
            db.collection('records').countDocuments({ tenant_id: request.tenantId, status: 'published' }),
            db.collection('records').countDocuments({ tenant_id: request.tenantId, status: 'draft' }),
            db.collection('records').countDocuments({ tenant_id: request.tenantId, status: 'in_review' }),
            db.collection('incidents').countDocuments({ tenant_id: request.tenantId }),
            db.collection('users').countDocuments({ tenant_id: request.tenantId }),
            db.collection('comments').countDocuments({ tenant_id: request.tenantId })
        ]);

        // Get KBs created in period
        const kbsCreatedInPeriod = await db.collection('records').countDocuments({
            tenant_id: request.tenantId,
            created_at: { $gte: startDate }
        });

        // Get view statistics
        const viewStats = await db.collection('records').aggregate([
            { $match: { tenant_id: request.tenantId } },
            {
                $group: {
                    _id: null,
                    totalViews: { $sum: { $ifNull: ['$views', 0] } },
                    avgViews: { $avg: { $ifNull: ['$views', 0] } }
                }
            }
        ]).toArray();

        // Get top viewed KBs
        const topKBs = await db.collection('records')
            .find({ tenant_id: request.tenantId, views: { $gt: 0 } })
            .sort({ views: -1 })
            .limit(5)
            .project({ title: 1, views: 1, status: 1 })
            .toArray();

        // Get recent activity count
        const recentActivity = await db.collection('audit_logs').countDocuments({
            tenant_id: request.tenantId,
            timestamp: { $gte: startDate }
        });

        return {
            period,
            totals: {
                kbs: totalKBs,
                published: publishedKBs,
                drafts: draftKBs,
                inReview: inReviewKBs,
                incidents: totalIncidents,
                users: totalUsers,
                comments: totalComments
            },
            periodStats: {
                kbsCreated: kbsCreatedInPeriod,
                activityCount: recentActivity
            },
            views: {
                total: viewStats[0] ?.totalViews || 0,
                average: Math.round(viewStats[0] ?.avgViews || 0)
            },
            topKBs
        };
    });

    // Get KB creation trends
    fastify.get('/trends/kbs', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async(request, reply) => {
        const db = fastify.db();
        const { period = '30d', groupBy = 'day' } = request.query;

        const now = new Date();
        let startDate;
        let dateFormat;

        switch (period) {
            case '7d':
                startDate = new Date(now.setDate(now.getDate() - 7));
                dateFormat = '%Y-%m-%d';
                break;
            case '30d':
                startDate = new Date(now.setDate(now.getDate() - 30));
                dateFormat = groupBy === 'week' ? '%Y-%U' : '%Y-%m-%d';
                break;
            case '90d':
                startDate = new Date(now.setDate(now.getDate() - 90));
                dateFormat = '%Y-%U';
                break;
            case '1y':
                startDate = new Date(now.setFullYear(now.getFullYear() - 1));
                dateFormat = '%Y-%m';
                break;
            default:
                startDate = new Date(now.setDate(now.getDate() - 30));
                dateFormat = '%Y-%m-%d';
        }

        const trends = await db.collection('records').aggregate([{
                $match: {
                    tenant_id: request.tenantId,
                    created_at: { $gte: startDate }
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: dateFormat, date: '$created_at' } },
                    count: { $sum: 1 },
                    published: {
                        $sum: { $cond: [{ $eq: ['$status', 'published'] }, 1, 0] }
                    }
                }
            },
            { $sort: { _id: 1 } }
        ]).toArray();

        return { trends, period, groupBy };
    });

    // Get status distribution
    fastify.get('/distribution/status', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async(request, reply) => {
        const db = fastify.db();

        const distribution = await db.collection('records').aggregate([
            { $match: { tenant_id: request.tenantId } },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }
            }
        ]).toArray();

        return { distribution };
    });

    // Get category distribution
    fastify.get('/distribution/categories', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async(request, reply) => {
        const db = fastify.db();

        const distribution = await db.collection('records').aggregate([
            { $match: { tenant_id: request.tenantId, category_id: { $ne: null } } },
            {
                $lookup: {
                    from: 'categories',
                    localField: 'category_id',
                    foreignField: '_id',
                    as: 'category'
                }
            },
            { $unwind: '$category' },
            {
                $group: {
                    _id: '$category._id',
                    name: { $first: '$category.name' },
                    color: { $first: '$category.color' },
                    count: { $sum: 1 }
                }
            },
            { $sort: { count: -1 } }
        ]).toArray();

        return { distribution };
    });

    // Get tag usage distribution
    fastify.get('/distribution/tags', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async(request, reply) => {
        const db = fastify.db();

        const distribution = await db.collection('records').aggregate([
            { $match: { tenant_id: request.tenantId, tags: { $exists: true, $ne: [] } } },
            { $unwind: '$tags' },
            {
                $lookup: {
                    from: 'tags',
                    localField: 'tags',
                    foreignField: '_id',
                    as: 'tag'
                }
            },
            { $unwind: '$tag' },
            {
                $group: {
                    _id: '$tag._id',
                    name: { $first: '$tag.name' },
                    color: { $first: '$tag.color' },
                    count: { $sum: 1 }
                }
            },
            { $sort: { count: -1 } },
            { $limit: 15 }
        ]).toArray();

        return { distribution };
    });

    // Get user activity leaderboard
    fastify.get('/leaderboard/users', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async(request, reply) => {
        const db = fastify.db();
        const { period = '30d' } = request.query;

        const now = new Date();
        let startDate;
        switch (period) {
            case '7d':
                startDate = new Date(now.setDate(now.getDate() - 7));
                break;
            case '30d':
                startDate = new Date(now.setDate(now.getDate() - 30));
                break;
            case '90d':
                startDate = new Date(now.setDate(now.getDate() - 90));
                break;
            default:
                startDate = new Date(now.setDate(now.getDate() - 30));
        }

        // KBs created by user
        const kbLeaderboard = await db.collection('records').aggregate([{
                $match: {
                    tenant_id: request.tenantId,
                    created_at: { $gte: startDate }
                }
            },
            {
                $group: {
                    _id: '$created_by',
                    kbsCreated: { $sum: 1 },
                    published: { $sum: { $cond: [{ $eq: ['$status', 'published'] }, 1, 0] } }
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'user'
                }
            },
            { $unwind: '$user' },
            {
                $project: {
                    userId: '$_id',
                    name: '$user.name',
                    email: '$user.email',
                    kbsCreated: 1,
                    published: 1
                }
            },
            { $sort: { kbsCreated: -1 } },
            { $limit: 10 }
        ]).toArray();

        return { leaderboard: kbLeaderboard, period };
    });

    // Get recent activity feed
    fastify.get('/activity', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async(request, reply) => {
        const db = fastify.db();
        const { limit = 20 } = request.query;

        const activities = await db.collection('audit_logs').aggregate([
            { $match: { tenant_id: request.tenantId } },
            { $sort: { timestamp: -1 } },
            { $limit: parseInt(limit) },
            {
                $lookup: {
                    from: 'users',
                    localField: 'user_id',
                    foreignField: '_id',
                    as: 'user'
                }
            },
            {
                $unwind: {
                    path: '$user',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $project: {
                    action: 1,
                    resource: 1,
                    resource_id: 1,
                    timestamp: 1,
                    metadata: 1,
                    'user.name': 1,
                    'user.email': 1
                }
            }
        ]).toArray();

        return { activities };
    });

    // Track view (increment view count for a KB)
    fastify.post('/track/view/:recordId', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async(request, reply) => {
        const db = fastify.db();
        const { recordId } = request.params;

        const objectId = toObjectId(recordId);
        if (!objectId) {
            return reply.status(400).send({ error: 'Invalid record ID' });
        }

        await db.collection('records').updateOne({ _id: objectId, tenant_id: request.tenantId }, { $inc: { views: 1 } });

        // Also log the view in analytics collection for detailed tracking
        await db.collection('kb_views').insertOne({
            tenant_id: request.tenantId,
            record_id: objectId,
            user_id: request.currentUser._id,
            viewed_at: new Date(),
            user_agent: request.headers['user-agent']
        });

        return { success: true };
    });

    // Get AI usage statistics
    fastify.get('/ai-usage', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async(request, reply) => {
        const db = fastify.db();
        const { period = '30d' } = request.query;

        const now = new Date();
        let startDate;
        switch (period) {
            case '7d':
                startDate = new Date(now.setDate(now.getDate() - 7));
                break;
            case '30d':
                startDate = new Date(now.setDate(now.getDate() - 30));
                break;
            default:
                startDate = new Date(now.setDate(now.getDate() - 30));
        }

        const usage = await db.collection('ai_usage').aggregate([{
                $match: {
                    tenant_id: request.tenantId,
                    created_at: { $gte: startDate }
                }
            },
            {
                $group: {
                    _id: '$action',
                    count: { $sum: 1 },
                    totalTokens: { $sum: '$tokens' },
                    totalCredits: { $sum: '$cost_credits' }
                }
            }
        ]).toArray();

        const totals = await db.collection('ai_usage').aggregate([{
                $match: {
                    tenant_id: request.tenantId,
                    created_at: { $gte: startDate }
                }
            },
            {
                $group: {
                    _id: null,
                    totalRequests: { $sum: 1 },
                    totalTokens: { $sum: '$tokens' },
                    totalCredits: { $sum: '$cost_credits' }
                }
            }
        ]).toArray();

        return {
            period,
            byAction: usage,
            totals: totals[0] || { totalRequests: 0, totalTokens: 0, totalCredits: 0 }
        };
    });

    // Get search analytics
    fastify.get('/search-analytics', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async(request, reply) => {
        const db = fastify.db();
        const { period = '30d' } = request.query;

        const now = new Date();
        let startDate;
        switch (period) {
            case '7d':
                startDate = new Date(now.setDate(now.getDate() - 7));
                break;
            case '30d':
                startDate = new Date(now.setDate(now.getDate() - 30));
                break;
            default:
                startDate = new Date(now.setDate(now.getDate() - 30));
        }

        // Get popular search queries
        const popularQueries = await db.collection('search_logs').aggregate([{
                $match: {
                    tenant_id: request.tenantId,
                    searched_at: { $gte: startDate }
                }
            },
            {
                $group: {
                    _id: '$query',
                    count: { $sum: 1 },
                    avgResults: { $avg: '$results_count' }
                }
            },
            { $sort: { count: -1 } },
            { $limit: 20 }
        ]).toArray();

        // Get zero-result queries (queries that found nothing)
        const zeroResultQueries = await db.collection('search_logs').aggregate([{
                $match: {
                    tenant_id: request.tenantId,
                    searched_at: { $gte: startDate },
                    results_count: 0
                }
            },
            {
                $group: {
                    _id: '$query',
                    count: { $sum: 1 }
                }
            },
            { $sort: { count: -1 } },
            { $limit: 10 }
        ]).toArray();

        return {
            period,
            popularQueries,
            zeroResultQueries
        };
    });
}