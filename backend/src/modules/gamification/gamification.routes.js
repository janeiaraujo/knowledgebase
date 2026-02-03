/**
 * Gamification Module
 * 
 * Features:
 * - Points system
 * - Badges/achievements
 * - Leaderboard
 * - Streaks
 * - Challenges
 */

import { ObjectId } from 'mongodb';

// Badge definitions
const BADGES = {
    // Contribution badges
    first_kb: {
        id: 'first_kb',
        name: 'Primeiro Passo',
        description: 'Criou seu primeiro KB',
        icon: '🎯',
        category: 'contribution',
        points: 10,
        criteria: { type: 'kb_count', value: 1 }
    },
    prolific_writer: {
        id: 'prolific_writer',
        name: 'Escritor Prolífico',
        description: 'Criou 10 KBs',
        icon: '✍️',
        category: 'contribution',
        points: 50,
        criteria: { type: 'kb_count', value: 10 }
    },
    knowledge_master: {
        id: 'knowledge_master',
        name: 'Mestre do Conhecimento',
        description: 'Criou 50 KBs',
        icon: '📚',
        category: 'contribution',
        points: 200,
        criteria: { type: 'kb_count', value: 50 }
    },
    
    // Quality badges
    quality_champion: {
        id: 'quality_champion',
        name: 'Campeão da Qualidade',
        description: 'Teve 10 KBs aprovados na primeira revisão',
        icon: '⭐',
        category: 'quality',
        points: 100,
        criteria: { type: 'first_approval_count', value: 10 }
    },
    helpful_guru: {
        id: 'helpful_guru',
        name: 'Guru Prestativo',
        description: 'Seus KBs foram favoritados 50 vezes',
        icon: '💡',
        category: 'quality',
        points: 75,
        criteria: { type: 'favorites_received', value: 50 }
    },
    
    // Engagement badges
    active_reviewer: {
        id: 'active_reviewer',
        name: 'Revisor Ativo',
        description: 'Revisou 20 KBs',
        icon: '👁️',
        category: 'engagement',
        points: 60,
        criteria: { type: 'reviews_done', value: 20 }
    },
    comment_king: {
        id: 'comment_king',
        name: 'Rei dos Comentários',
        description: 'Fez 100 comentários construtivos',
        icon: '💬',
        category: 'engagement',
        points: 80,
        criteria: { type: 'comments_count', value: 100 }
    },
    
    // Streak badges
    week_streak: {
        id: 'week_streak',
        name: 'Semana de Fogo',
        description: 'Contribuiu por 7 dias seguidos',
        icon: '🔥',
        category: 'streak',
        points: 30,
        criteria: { type: 'streak_days', value: 7 }
    },
    month_streak: {
        id: 'month_streak',
        name: 'Mês Dedicado',
        description: 'Contribuiu por 30 dias seguidos',
        icon: '🏆',
        category: 'streak',
        points: 150,
        criteria: { type: 'streak_days', value: 30 }
    },
    
    // Special badges
    incident_hero: {
        id: 'incident_hero',
        name: 'Herói dos Incidentes',
        description: 'Documentou 5 post-mortems',
        icon: '🦸',
        category: 'special',
        points: 100,
        criteria: { type: 'postmortem_count', value: 5 }
    },
    search_optimizer: {
        id: 'search_optimizer',
        name: 'Otimizador de Busca',
        description: 'Adicionou tags relevantes a 20 KBs',
        icon: '🔍',
        category: 'special',
        points: 40,
        criteria: { type: 'tags_added', value: 20 }
    },
    gps_creator: {
        id: 'gps_creator',
        name: 'Criador de Jornadas',
        description: 'Criou 5 fluxos GPS',
        icon: '🗺️',
        category: 'special',
        points: 75,
        criteria: { type: 'gps_flows_count', value: 5 }
    }
};

// Points configuration
const POINTS_CONFIG = {
    kb_created: 5,
    kb_published: 10,
    kb_approved: 3,
    comment_added: 1,
    review_completed: 5,
    postmortem_created: 15,
    gps_flow_created: 10,
    gps_session_completed: 2,
    favorite_received: 2,
    kb_viewed: 0.1,
    helpful_vote: 3
};

export default async function gamificationRoutes(fastify) {
    const db = fastify.mongo.db;

    // Get user profile with gamification stats
    fastify.get('/profile', {
        preHandler: [fastify.authenticate]
    }, async (request, reply) => {
        const userId = request.user.id;

        const [profile, badges, stats] = await Promise.all([
            getOrCreateProfile(db, userId),
            db.collection('user_badges').find({ user_id: new ObjectId(userId) }).toArray(),
            calculateUserStats(db, userId)
        ]);

        // Calculate level
        const level = calculateLevel(profile.total_points);

        return {
            profile: {
                ...profile,
                level,
                badges: badges.map(b => ({
                    ...BADGES[b.badge_id],
                    earned_at: b.earned_at
                })),
                stats
            }
        };
    });

    // Get all available badges
    fastify.get('/badges', {
        preHandler: [fastify.authenticate]
    }, async (request, reply) => {
        const userId = request.user.id;

        const userBadges = await db.collection('user_badges')
            .find({ user_id: new ObjectId(userId) })
            .toArray();

        const earnedIds = new Set(userBadges.map(b => b.badge_id));

        const badges = Object.values(BADGES).map(badge => ({
            ...badge,
            earned: earnedIds.has(badge.id),
            earned_at: userBadges.find(b => b.badge_id === badge.id)?.earned_at
        }));

        // Group by category
        const grouped = badges.reduce((acc, badge) => {
            if (!acc[badge.category]) {
                acc[badge.category] = [];
            }
            acc[badge.category].push(badge);
            return acc;
        }, {});

        return {
            badges: grouped,
            total: Object.keys(BADGES).length,
            earned: earnedIds.size
        };
    });

    // Get leaderboard
    fastify.get('/leaderboard', {
        preHandler: [fastify.authenticate]
    }, async (request, reply) => {
        const { period = 'all', limit = 10 } = request.query;
        const tenantId = request.user.tenantId;

        let dateFilter = {};
        if (period !== 'all') {
            const now = new Date();
            const periods = {
                'week': 7,
                'month': 30,
                'quarter': 90
            };
            const days = periods[period] || 30;
            dateFilter = { 
                updated_at: { 
                    $gte: new Date(now - days * 24 * 60 * 60 * 1000) 
                } 
            };
        }

        // Convert tenantId to ObjectId if needed
        let tenantObjId = tenantId;
        if (typeof tenantId === 'string') {
            try {
                tenantObjId = new ObjectId(tenantId);
            } catch (e) {
                // Keep as string if not valid ObjectId
            }
        }

        const profiles = await db.collection('user_gamification')
            .find({ tenant_id: tenantObjId, ...dateFilter })
            .sort({ total_points: -1 })
            .limit(parseInt(limit))
            .toArray();

        // Get user details
        const userIds = profiles.map(p => p.user_id);
        const users = await db.collection('users')
            .find({ _id: { $in: userIds } })
            .project({ name: 1, email: 1 })
            .toArray();

        const userMap = new Map(users.map(u => [u._id.toString(), u]));

        const leaderboard = profiles.map((profile, index) => {
            const user = userMap.get(profile.user_id.toString());
            return {
                rank: index + 1,
                user_id: profile.user_id,
                name: user?.name || 'Usuário',
                points: profile.total_points,
                level: calculateLevel(profile.total_points),
                badges_count: profile.badges_count || 0,
                streak_days: profile.current_streak || 0
            };
        });

        // Get current user rank
        const currentUserProfile = await db.collection('user_gamification')
            .findOne({ user_id: new ObjectId(request.user.id), tenant_id: tenantObjId });

        let userRank = null;
        if (currentUserProfile) {
            const higherCount = await db.collection('user_gamification')
                .countDocuments({
                    tenant_id: tenantObjId,
                    total_points: { $gt: currentUserProfile.total_points },
                    ...dateFilter
                });
            userRank = higherCount + 1;
        }

        return {
            leaderboard,
            current_user: {
                rank: userRank,
                points: currentUserProfile?.total_points || 0,
                level: calculateLevel(currentUserProfile?.total_points || 0)
            }
        };
    });

    // Get active challenges
    fastify.get('/challenges', {
        preHandler: [fastify.authenticate]
    }, async (request, reply) => {
        const userId = request.user.id;
        const tenantId = request.user.tenantId;

        // Get active challenges
        const challenges = await db.collection('challenges')
            .find({
                tenant_id: tenantId,
                active: true,
                end_date: { $gt: new Date() }
            })
            .toArray();

        // Get user progress for each challenge
        const userProgress = await db.collection('challenge_progress')
            .find({ user_id: new ObjectId(userId) })
            .toArray();

        const progressMap = new Map(userProgress.map(p => [p.challenge_id.toString(), p]));

        const enrichedChallenges = challenges.map(challenge => {
            const progress = progressMap.get(challenge._id.toString());
            return {
                ...challenge,
                progress: progress?.current_value || 0,
                completed: progress?.completed || false
            };
        });

        return { challenges: enrichedChallenges };
    });

    // Record activity and award points
    fastify.post('/activity', {
        preHandler: [fastify.authenticate]
    }, async (request, reply) => {
        const { activity_type, entity_id, metadata } = request.body;
        const userId = request.user.id;
        const tenantId = request.user.tenantId;

        const points = POINTS_CONFIG[activity_type] || 0;

        // Record activity
        await db.collection('user_activities').insertOne({
            user_id: new ObjectId(userId),
            tenant_id: tenantId,
            activity_type,
            entity_id,
            metadata,
            points,
            created_at: new Date()
        });

        // Update profile
        const profile = await getOrCreateProfile(db, userId);
        
        // Update streak
        const lastActivity = profile.last_activity_date;
        const today = new Date().toDateString();
        const yesterday = new Date(Date.now() - 86400000).toDateString();
        
        let newStreak = profile.current_streak || 0;
        if (lastActivity) {
            const lastDate = new Date(lastActivity).toDateString();
            if (lastDate === today) {
                // Same day, keep streak
            } else if (lastDate === yesterday) {
                // Consecutive day, increment streak
                newStreak += 1;
            } else {
                // Streak broken
                newStreak = 1;
            }
        } else {
            newStreak = 1;
        }

        await db.collection('user_gamification').updateOne(
            { user_id: new ObjectId(userId) },
            {
                $inc: { total_points: points },
                $set: {
                    current_streak: newStreak,
                    last_activity_date: new Date(),
                    updated_at: new Date()
                },
                $max: { longest_streak: newStreak }
            }
        );

        // Check for new badges
        const newBadges = await checkAndAwardBadges(db, userId, tenantId);

        return {
            points_earned: points,
            total_points: (profile.total_points || 0) + points,
            streak: newStreak,
            new_badges: newBadges
        };
    });

    // Get user activity history
    fastify.get('/activity', {
        preHandler: [fastify.authenticate]
    }, async (request, reply) => {
        const { page = 1, limit = 20 } = request.query;
        const userId = request.user.id;

        const activities = await db.collection('user_activities')
            .find({ user_id: new ObjectId(userId) })
            .sort({ created_at: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit))
            .toArray();

        const total = await db.collection('user_activities')
            .countDocuments({ user_id: new ObjectId(userId) });

        return {
            activities,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        };
    });

    // Admin: Create challenge
    fastify.post('/challenges', {
        preHandler: [fastify.authenticate]
    }, async (request, reply) => {
        if (!['admin', 'owner'].includes(request.user.role)) {
            return reply.status(403).send({ error: 'Acesso negado' });
        }

        const {
            name,
            description,
            goal_type,
            goal_value,
            points_reward,
            badge_reward,
            start_date,
            end_date
        } = request.body;

        const challenge = {
            tenant_id: request.user.tenantId,
            name,
            description,
            goal_type,
            goal_value,
            points_reward,
            badge_reward,
            start_date: new Date(start_date),
            end_date: new Date(end_date),
            active: true,
            created_by: new ObjectId(request.user.id),
            created_at: new Date()
        };

        const result = await db.collection('challenges').insertOne(challenge);

        return {
            message: 'Desafio criado',
            challenge: { ...challenge, _id: result.insertedId }
        };
    });
}

// Helper functions
async function getOrCreateProfile(db, userId) {
    let profile = await db.collection('user_gamification')
        .findOne({ user_id: new ObjectId(userId) });

    if (!profile) {
        const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
        profile = {
            user_id: new ObjectId(userId),
            tenant_id: user?.tenant_id,
            total_points: 0,
            current_streak: 0,
            longest_streak: 0,
            badges_count: 0,
            last_activity_date: null,
            created_at: new Date(),
            updated_at: new Date()
        };
        await db.collection('user_gamification').insertOne(profile);
    }

    return profile;
}

function calculateLevel(points) {
    // Level formula: Each level requires more points
    // Level 1: 0-99, Level 2: 100-299, Level 3: 300-599, etc.
    const levels = [
        { level: 1, name: 'Iniciante', min: 0, max: 99 },
        { level: 2, name: 'Aprendiz', min: 100, max: 299 },
        { level: 3, name: 'Contribuidor', min: 300, max: 599 },
        { level: 4, name: 'Especialista', min: 600, max: 999 },
        { level: 5, name: 'Veterano', min: 1000, max: 1499 },
        { level: 6, name: 'Expert', min: 1500, max: 2199 },
        { level: 7, name: 'Mestre', min: 2200, max: 2999 },
        { level: 8, name: 'Grão-Mestre', min: 3000, max: 3999 },
        { level: 9, name: 'Lenda', min: 4000, max: 5499 },
        { level: 10, name: 'Imortal', min: 5500, max: Infinity }
    ];

    const current = levels.find(l => points >= l.min && points <= l.max) || levels[0];
    const nextLevel = levels.find(l => l.level === current.level + 1);

    return {
        ...current,
        points,
        next_level: nextLevel,
        progress: nextLevel
            ? ((points - current.min) / (nextLevel.min - current.min)) * 100
            : 100
    };
}

async function calculateUserStats(db, userId) {
    const userObjId = new ObjectId(userId);

    const [kbCount, commentsCount, reviewsCount, favoritesReceived] = await Promise.all([
        db.collection('records').countDocuments({ created_by: userObjId }),
        db.collection('comments').countDocuments({ created_by: userObjId }),
        db.collection('audit_logs').countDocuments({
            user_id: userObjId,
            action: { $regex: /review/i }
        }),
        db.collection('favorites').countDocuments({
            record_id: {
                $in: (await db.collection('records')
                    .find({ created_by: userObjId })
                    .project({ _id: 1 })
                    .toArray()).map(r => r._id)
            }
        })
    ]);

    return {
        kbs_created: kbCount,
        comments_made: commentsCount,
        reviews_completed: reviewsCount,
        favorites_received: favoritesReceived
    };
}

async function checkAndAwardBadges(db, userId, tenantId) {
    const userObjId = new ObjectId(userId);
    const newBadges = [];

    // Get already earned badges
    const earnedBadges = await db.collection('user_badges')
        .find({ user_id: userObjId })
        .toArray();
    const earnedIds = new Set(earnedBadges.map(b => b.badge_id));

    // Check each badge criteria
    for (const [badgeId, badge] of Object.entries(BADGES)) {
        if (earnedIds.has(badgeId)) continue;

        let earned = false;
        const criteria = badge.criteria;

        switch (criteria.type) {
            case 'kb_count':
                const kbCount = await db.collection('records')
                    .countDocuments({ created_by: userObjId });
                earned = kbCount >= criteria.value;
                break;

            case 'comments_count':
                const commentsCount = await db.collection('comments')
                    .countDocuments({ created_by: userObjId });
                earned = commentsCount >= criteria.value;
                break;

            case 'streak_days':
                const profile = await db.collection('user_gamification')
                    .findOne({ user_id: userObjId });
                earned = (profile?.longest_streak || 0) >= criteria.value;
                break;

            case 'postmortem_count':
                const pmCount = await db.collection('postmortems')
                    .countDocuments({ created_by: userObjId });
                earned = pmCount >= criteria.value;
                break;

            case 'gps_flows_count':
                const gpsCount = await db.collection('gps_flows')
                    .countDocuments({ created_by: userObjId });
                earned = gpsCount >= criteria.value;
                break;

            case 'favorites_received':
                const favCount = await db.collection('favorites').countDocuments({
                    record_id: {
                        $in: (await db.collection('records')
                            .find({ created_by: userObjId })
                            .project({ _id: 1 })
                            .toArray()).map(r => r._id)
                    }
                });
                earned = favCount >= criteria.value;
                break;
        }

        if (earned) {
            await db.collection('user_badges').insertOne({
                user_id: userObjId,
                tenant_id: tenantId,
                badge_id: badgeId,
                earned_at: new Date()
            });

            // Award badge points
            await db.collection('user_gamification').updateOne(
                { user_id: userObjId },
                {
                    $inc: {
                        total_points: badge.points,
                        badges_count: 1
                    }
                }
            );

            newBadges.push(badge);
        }
    }

    return newBadges;
}
