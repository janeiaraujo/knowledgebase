/**
 * Dashboard Module Routes
 * Advanced analytics and dashboard data
 */

import { ObjectId } from 'mongodb';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { tenantMiddleware } from '../../middlewares/tenant.middleware.js';

export default async function dashboardRoutes(fastify, options) {

    /**
     * Get comprehensive dashboard analytics
     */
    fastify.get('/analytics', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async(request, reply) => {
        const db = fastify.db();
        const { period = '30d' } = request.query;

        // Calculate date range
        const now = new Date();
        let startDate;
        switch (period) {
            case '7d':
                startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                break;
            case '30d':
                startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                break;
            case '90d':
                startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
                break;
            case '1y':
                startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
                break;
            default:
                startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        }

        const baseMatch = { tenant_id: request.tenantId };

        // Run all queries in parallel
        const [
            totalKBs,
            kbsByStatus,
            kbsByCategory,
            kbsCreatedOverTime,
            topContributors,
            recentActivity,
            popularKBs,
            totalComments,
            totalFavorites,
            pendingReviews,
            overdueReviews,
            tagDistribution
        ] = await Promise.all([
            // Total KBs
            db.collection('records').countDocuments(baseMatch),

            // KBs by status
            db.collection('records').aggregate([
                { $match: baseMatch },
                { $group: { _id: '$status', count: { $sum: 1 } } }
            ]).toArray(),

            // KBs by category
            db.collection('records').aggregate([
                { $match: baseMatch },
                {
                    $lookup: {
                        from: 'categories',
                        localField: 'category_id',
                        foreignField: '_id',
                        as: 'category'
                    }
                },
                { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
                {
                    $group: {
                        _id: { $ifNull: ['$category.name', 'Sem Categoria'] },
                        count: { $sum: 1 }
                    }
                },
                { $sort: { count: -1 } },
                { $limit: 10 }
            ]).toArray(),

            // KBs created over time (daily for period)
            db.collection('records').aggregate([
                { $match: {...baseMatch, created_at: { $gte: startDate } } },
                {
                    $group: {
                        _id: {
                            year: { $year: '$created_at' },
                            month: { $month: '$created_at' },
                            day: { $dayOfMonth: '$created_at' }
                        },
                        count: { $sum: 1 }
                    }
                },
                { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
            ]).toArray(),

            // Top contributors
            db.collection('records').aggregate([
                { $match: baseMatch },
                { $group: { _id: '$created_by', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 5 },
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
                        _id: 1,
                        count: 1,
                        name: '$user.name',
                        email: '$user.email'
                    }
                }
            ]).toArray(),

            // Recent activity (all changes in period)
            db.collection('records').aggregate([
                { $match: {...baseMatch, updated_at: { $gte: startDate } } },
                { $sort: { updated_at: -1 } },
                { $limit: 10 },
                {
                    $lookup: {
                        from: 'users',
                        localField: 'created_by',
                        foreignField: '_id',
                        as: 'creator'
                    }
                },
                { $unwind: { path: '$creator', preserveNullAndEmptyArrays: true } },
                {
                    $project: {
                        _id: 1,
                        title: 1,
                        status: 1,
                        updated_at: 1,
                        created_at: 1,
                        creator_name: '$creator.name'
                    }
                }
            ]).toArray(),

            // Popular KBs (by views or favorites)
            db.collection('favorites').aggregate([
                { $match: { tenant_id: request.tenantId } },
                { $group: { _id: '$record_id', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 5 },
                {
                    $lookup: {
                        from: 'records',
                        localField: '_id',
                        foreignField: '_id',
                        as: 'record'
                    }
                },
                { $unwind: '$record' },
                {
                    $project: {
                        _id: '$record._id',
                        title: '$record.title',
                        favorites: '$count'
                    }
                }
            ]).toArray(),

            // Total comments
            db.collection('kb_comments').countDocuments({ tenant_id: request.tenantId }),

            // Total favorites
            db.collection('favorites').countDocuments({ tenant_id: request.tenantId }),

            // Pending reviews count
            db.collection('records').countDocuments({...baseMatch, status: 'in_review' }),

            // Overdue reviews
            db.collection('review_settings').aggregate([
                { $match: { tenant_id: request.tenantId, next_review_date: { $lt: now } } },
                { $count: 'total' }
            ]).toArray(),

            // Tag distribution
            db.collection('records').aggregate([
                { $match: baseMatch },
                { $unwind: { path: '$tags', preserveNullAndEmptyArrays: false } },
                { $group: { _id: '$tags', count: { $sum: 1 } } },
                {
                    $lookup: {
                        from: 'tags',
                        localField: '_id',
                        foreignField: '_id',
                        as: 'tag'
                    }
                },
                { $unwind: '$tag' },
                { $sort: { count: -1 } },
                { $limit: 10 },
                {
                    $project: {
                        name: '$tag.name',
                        color: '$tag.color',
                        count: 1
                    }
                }
            ]).toArray()
        ]);

        // Format KBs over time data
        const timelineData = kbsCreatedOverTime.map(item => ({
            date: `${item._id.year}-${String(item._id.month).padStart(2, '0')}-${String(item._id.day).padStart(2, '0')}`,
            count: item.count
        }));

        // Calculate status distribution
        const statusDistribution = {};
        kbsByStatus.forEach(item => {
            statusDistribution[item._id] = item.count;
        });

        // Calculate growth metrics
        const previousPeriodStart = new Date(startDate.getTime() - (now.getTime() - startDate.getTime()));
        const previousPeriodKBs = await db.collection('records').countDocuments({
            ...baseMatch,
            created_at: { $gte: previousPeriodStart, $lt: startDate }
        });

        const currentPeriodKBs = await db.collection('records').countDocuments({
            ...baseMatch,
            created_at: { $gte: startDate }
        });

        const growth = previousPeriodKBs > 0 ?
            ((currentPeriodKBs - previousPeriodKBs) / previousPeriodKBs * 100).toFixed(1) :
            100;

        return {
            summary: {
                totalKBs,
                totalComments,
                totalFavorites,
                pendingReviews,
                overdueReviews: overdueReviews[0] ?.total || 0,
                currentPeriodKBs,
                growth: parseFloat(growth)
            },
            statusDistribution,
            categoryDistribution: kbsByCategory.map(c => ({ name: c._id, count: c.count })),
            timeline: timelineData,
            topContributors,
            recentActivity,
            popularKBs,
            tagDistribution,
            period
        };
    });

    /**
     * Get user activity summary
     */
    fastify.get('/my-activity', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async(request, reply) => {
        const db = fastify.db();
        const userId = request.userId;
        const baseMatch = { tenant_id: request.tenantId, created_by: new ObjectId(userId) };

        const [
            myKBs,
            myDrafts,
            myPendingApproval,
            myPublished,
            myRecentKBs,
            myFavorites,
            myComments,
            activeSessions
        ] = await Promise.all([
            db.collection('records').countDocuments(baseMatch),
            db.collection('records').countDocuments({...baseMatch, status: 'draft' }),
            db.collection('records').countDocuments({...baseMatch, status: 'in_review' }),
            db.collection('records').countDocuments({...baseMatch, status: 'published' }),
            db.collection('records').find(baseMatch)
            .sort({ updated_at: -1 })
            .limit(5)
            .project({ title: 1, status: 1, updated_at: 1 })
            .toArray(),
            db.collection('favorites').countDocuments({
                tenant_id: request.tenantId,
                user_id: new ObjectId(userId)
            }),
            db.collection('kb_comments').countDocuments({
                tenant_id: request.tenantId,
                user_id: new ObjectId(userId)
            }),
            // GPS Sessions ativas do usuário
            db.collection('gps_sessions').find({
                tenant_id: request.tenantId,
                user_id: new ObjectId(userId),
                status: 'active'
            })
            .sort({ started_at: -1 })
            .limit(5)
            .project({ flow_name: 1, started_at: 1, current_step: 1, responses: 1 })
            .toArray()
        ]);

        return {
            totalKBs: myKBs,
            drafts: myDrafts,
            pendingApproval: myPendingApproval,
            published: myPublished,
            favorites: myFavorites,
            comments: myComments,
            recentKBs: myRecentKBs,
            activeSessions: activeSessions
        };
    });

    /**
     * Get content health metrics
     */
    fastify.get('/content-health', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async(request, reply) => {
        const db = fastify.db();
        const baseMatch = { tenant_id: request.tenantId };

        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

        const [
            totalPublished,
            recentlyUpdated,
            staleContent,
            veryOldContent,
            noCategory,
            noTags,
            shortContent
        ] = await Promise.all([
            db.collection('records').countDocuments({...baseMatch, status: 'published' }),
            db.collection('records').countDocuments({
                ...baseMatch,
                status: 'published',
                updated_at: { $gte: thirtyDaysAgo }
            }),
            db.collection('records').countDocuments({
                ...baseMatch,
                status: 'published',
                updated_at: { $lt: ninetyDaysAgo, $gte: oneYearAgo }
            }),
            db.collection('records').countDocuments({
                ...baseMatch,
                status: 'published',
                updated_at: { $lt: oneYearAgo }
            }),
            db.collection('records').countDocuments({
                ...baseMatch,
                status: 'published',
                category_id: { $exists: false }
            }),
            db.collection('records').countDocuments({
                ...baseMatch,
                status: 'published',
                $or: [{ tags: { $exists: false } }, { tags: { $size: 0 } }]
            }),
            db.collection('records').aggregate([
                { $match: {...baseMatch, status: 'published' } },
                {
                    $project: {
                        contentLength: { $strLenCP: { $ifNull: ['$content_md', ''] } }
                    }
                },
                { $match: { contentLength: { $lt: 200 } } },
                { $count: 'total' }
            ]).toArray()
        ]);

        // Calculate health score (0-100)
        const healthFactors = [];

        // Factor 1: Update freshness (0-25 points)
        const freshRatio = totalPublished > 0 ? recentlyUpdated / totalPublished : 0;
        healthFactors.push(Math.min(25, freshRatio * 50));

        // Factor 2: Stale content penalty (0-25 points, penalty for stale)
        const staleRatio = totalPublished > 0 ? staleContent / totalPublished : 0;
        healthFactors.push(25 - Math.min(25, staleRatio * 50));

        // Factor 3: Categorization (0-25 points)
        const categorizedRatio = totalPublished > 0 ? (totalPublished - noCategory) / totalPublished : 0;
        healthFactors.push(categorizedRatio * 25);

        // Factor 4: Tagging (0-25 points)
        const taggedRatio = totalPublished > 0 ? (totalPublished - noTags) / totalPublished : 0;
        healthFactors.push(taggedRatio * 25);

        const healthScore = Math.round(healthFactors.reduce((a, b) => a + b, 0));

        return {
            healthScore,
            metrics: {
                totalPublished,
                recentlyUpdated,
                staleContent,
                veryOldContent,
                noCategory,
                noTags,
                shortContent: shortContent[0] ?.total || 0
            },
            recommendations: generateHealthRecommendations({
                staleContent,
                veryOldContent,
                noCategory,
                noTags,
                shortContent: shortContent[0] ?.total || 0,
                totalPublished
            })
        };
    });

    /**
     * Get trending KBs
     */
    fastify.get('/trending', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async(request, reply) => {
        const db = fastify.db();
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        // Get KBs with most activity (comments, favorites, views) in last 7 days
        const trendingByComments = await db.collection('kb_comments').aggregate([{
                $match: {
                    tenant_id: request.tenantId,
                    created_at: { $gte: sevenDaysAgo }
                }
            },
            { $group: { _id: '$record_id', comments: { $sum: 1 } } },
            { $sort: { comments: -1 } },
            { $limit: 5 },
            {
                $lookup: {
                    from: 'records',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'record'
                }
            },
            { $unwind: '$record' },
            { $match: { 'record.status': 'published' } },
            {
                $project: {
                    _id: '$record._id',
                    title: '$record.title',
                    activity: '$comments',
                    type: { $literal: 'comments' }
                }
            }
        ]).toArray();

        const trendingByFavorites = await db.collection('favorites').aggregate([{
                $match: {
                    tenant_id: request.tenantId,
                    created_at: { $gte: sevenDaysAgo }
                }
            },
            { $group: { _id: '$record_id', favorites: { $sum: 1 } } },
            { $sort: { favorites: -1 } },
            { $limit: 5 },
            {
                $lookup: {
                    from: 'records',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'record'
                }
            },
            { $unwind: '$record' },
            { $match: { 'record.status': 'published' } },
            {
                $project: {
                    _id: '$record._id',
                    title: '$record.title',
                    activity: '$favorites',
                    type: { $literal: 'favorites' }
                }
            }
        ]).toArray();

        return {
            byComments: trendingByComments,
            byFavorites: trendingByFavorites
        };
    });

    /**
     * Get system/API statistics
     */
    fastify.get('/system-stats', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async(request, reply) => {
        const db = fastify.db();
        const tenantId = request.tenantId;
        
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const thisWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        const [
            // User statistics
            totalUsers,
            activeUsers,
            
            // Content statistics
            totalRecords,
            publishedRecords,
            draftRecords,
            
            // Session statistics
            activeSessions,
            completedSessionsThisWeek,
            
            // Webhook statistics
            activeWebhooks,
            webhookDeliveriesToday,
            
            // Interaction statistics
            commentsThisMonth,
            favoritesThisMonth,
            
            // Incident statistics
            openIncidents,
            resolvedThisWeek,
            
            // GPS statistics
            totalGPSFlows,
            activeGPSFlows
        ] = await Promise.all([
            // Users
            db.collection('users').countDocuments({ tenant_id: tenantId, active: true }),
            db.collection('users').countDocuments({ 
                tenant_id: tenantId, 
                active: true, 
                last_login: { $gte: thisWeek } 
            }),
            
            // Records
            db.collection('records').countDocuments({ tenant_id: tenantId }),
            db.collection('records').countDocuments({ tenant_id: tenantId, status: 'published' }),
            db.collection('records').countDocuments({ tenant_id: tenantId, status: 'draft' }),
            
            // GPS Sessions
            db.collection('gps_sessions').countDocuments({ tenant_id: tenantId, status: 'active' }),
            db.collection('gps_sessions').countDocuments({ 
                tenant_id: tenantId, 
                status: 'completed',
                completed_at: { $gte: thisWeek }
            }),
            
            // Webhooks
            db.collection('webhooks').countDocuments({ tenant_id: tenantId, is_active: true, deleted_at: null }),
            db.collection('webhook_deliveries').countDocuments({ 
                tenant_id: tenantId, 
                created_at: { $gte: today }
            }),
            
            // Comments
            db.collection('kb_comments').countDocuments({ 
                tenant_id: tenantId, 
                created_at: { $gte: thisMonth }
            }),
            
            // Favorites
            db.collection('favorites').countDocuments({ 
                tenant_id: tenantId, 
                created_at: { $gte: thisMonth }
            }),
            
            // Incidents
            db.collection('incidents').countDocuments({ 
                tenant_id: tenantId, 
                status: { $in: ['open', 'investigating', 'identified'] }
            }),
            db.collection('incidents').countDocuments({ 
                tenant_id: tenantId, 
                status: 'resolved',
                resolved_at: { $gte: thisWeek }
            }),
            
            // GPS Flows
            db.collection('gps_flows').countDocuments({ tenant_id: tenantId, deleted_at: null }),
            db.collection('gps_flows').countDocuments({ tenant_id: tenantId, is_active: true, deleted_at: null })
        ]);

        // Calculate storage usage (estimated)
        const stats = await db.stats();
        const storageUsedMB = Math.round(stats.dataSize / 1024 / 1024);

        return {
            users: {
                total: totalUsers,
                activeThisWeek: activeUsers,
                activityRate: totalUsers > 0 ? Math.round((activeUsers / totalUsers) * 100) : 0
            },
            content: {
                total: totalRecords,
                published: publishedRecords,
                drafts: draftRecords,
                publishRate: totalRecords > 0 ? Math.round((publishedRecords / totalRecords) * 100) : 0
            },
            gps: {
                totalFlows: totalGPSFlows,
                activeFlows: activeGPSFlows,
                activeSessions: activeSessions,
                completedThisWeek: completedSessionsThisWeek
            },
            incidents: {
                open: openIncidents,
                resolvedThisWeek: resolvedThisWeek
            },
            webhooks: {
                active: activeWebhooks,
                deliveriesToday: webhookDeliveriesToday
            },
            engagement: {
                commentsThisMonth: commentsThisMonth,
                favoritesThisMonth: favoritesThisMonth
            },
            storage: {
                usedMB: storageUsedMB
            },
            timestamp: new Date().toISOString()
        };
    });
}

/**
 * Generate health recommendations based on metrics
 */
function generateHealthRecommendations(metrics) {
    const recommendations = [];

    if (metrics.staleContent > 0) {
        recommendations.push({
            type: 'warning',
            icon: 'clock-history',
            message: `${metrics.staleContent} KBs não foram atualizados nos últimos 90 dias`,
            action: 'Revisar conteúdo desatualizado',
            link: '/reviews?filter=stale'
        });
    }

    if (metrics.veryOldContent > 0) {
        recommendations.push({
            type: 'danger',
            icon: 'exclamation-triangle',
            message: `${metrics.veryOldContent} KBs têm mais de 1 ano sem atualização`,
            action: 'Verificar se ainda são relevantes',
            link: '/kb?sort=updated_at&order=asc'
        });
    }

    if (metrics.noCategory > 0 && metrics.totalPublished > 0) {
        const percent = Math.round((metrics.noCategory / metrics.totalPublished) * 100);
        recommendations.push({
            type: 'info',
            icon: 'folder',
            message: `${percent}% dos KBs publicados não têm categoria`,
            action: 'Categorizar conteúdo para melhor organização',
            link: '/kb?filter=no_category'
        });
    }

    if (metrics.noTags > 0 && metrics.totalPublished > 0) {
        const percent = Math.round((metrics.noTags / metrics.totalPublished) * 100);
        recommendations.push({
            type: 'info',
            icon: 'tags',
            message: `${percent}% dos KBs publicados não têm tags`,
            action: 'Adicionar tags para melhorar busca',
            link: '/kb?filter=no_tags'
        });
    }

    if (metrics.shortContent > 0) {
        recommendations.push({
            type: 'warning',
            icon: 'file-text',
            message: `${metrics.shortContent} KBs têm conteúdo muito curto (<200 caracteres)`,
            action: 'Expandir conteúdo para maior utilidade',
            link: '/kb?filter=short'
        });
    }

    return recommendations;
}