/**
 * Review Module Routes
 * Handles periodic review scheduling and reminders for KBs
 */

import { ObjectId } from 'mongodb';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { tenantMiddleware } from '../../middlewares/tenant.middleware.js';
import { createAndBroadcastNotification } from '../websocket/websocket.routes.js';

export default async function reviewRoutes(fastify, options) {

    /**
     * Get review settings for tenant
     */
    fastify.get('/settings', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async(request, reply) => {
        const db = fastify.db();

        const settings = await db.collection('review_settings').findOne({
            tenant_id: request.tenantId
        });

        return {
            settings: settings || {
                default_review_period_days: 90,
                reminder_days_before: [30, 7, 1],
                auto_deprecate_after_days: null, // null = don't auto-deprecate
                notify_owner: true,
                notify_admins: true,
                enabled: true
            }
        };
    });

    /**
     * Update review settings
     */
    fastify.put('/settings', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async(request, reply) => {
        const db = fastify.db();
        const {
            default_review_period_days,
            reminder_days_before,
            auto_deprecate_after_days,
            notify_owner,
            notify_admins,
            enabled
        } = request.body;

        await db.collection('review_settings').updateOne({ tenant_id: request.tenantId }, {
            $set: {
                default_review_period_days: default_review_period_days || 90,
                reminder_days_before: reminder_days_before || [30, 7, 1],
                auto_deprecate_after_days,
                notify_owner: notify_owner !== false,
                notify_admins: notify_admins !== false,
                enabled: enabled !== false,
                updated_at: new Date(),
                updated_by: request.userId
            },
            $setOnInsert: {
                tenant_id: request.tenantId,
                created_at: new Date()
            }
        }, { upsert: true });

        return { success: true };
    });

    /**
     * Set review date for a specific KB
     */
    fastify.post('/records/:recordId/schedule', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async(request, reply) => {
        const db = fastify.db();
        const { recordId } = request.params;
        const { next_review_date, review_period_days, notes } = request.body;

        const record = await db.collection('records').findOne({
            _id: new ObjectId(recordId),
            tenant_id: request.tenantId
        });

        if (!record) {
            return reply.status(404).send({ error: 'Record not found' });
        }

        // Calculate next review date
        let reviewDate;
        if (next_review_date) {
            reviewDate = new Date(next_review_date);
        } else if (review_period_days) {
            reviewDate = new Date();
            reviewDate.setDate(reviewDate.getDate() + parseInt(review_period_days));
        } else {
            // Use default from settings
            const settings = await db.collection('review_settings').findOne({
                tenant_id: request.tenantId
            });
            const periodDays = settings ?.default_review_period_days || 90;
            reviewDate = new Date();
            reviewDate.setDate(reviewDate.getDate() + periodDays);
        }

        // Update record with review info
        await db.collection('records').updateOne({ _id: new ObjectId(recordId), tenant_id: request.tenantId }, {
            $set: {
                next_review_date: reviewDate,
                review_period_days: review_period_days || null,
                review_notes: notes || null,
                review_scheduled_by: request.userId,
                review_scheduled_at: new Date()
            }
        });

        // Log review schedule
        await db.collection('review_logs').insertOne({
            tenant_id: request.tenantId,
            record_id: new ObjectId(recordId),
            action: 'scheduled',
            next_review_date: reviewDate,
            notes,
            created_by: request.userId,
            created_at: new Date()
        });

        return {
            success: true,
            next_review_date: reviewDate
        };
    });

    /**
     * Mark KB as reviewed
     */
    fastify.post('/records/:recordId/complete', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async(request, reply) => {
        const db = fastify.db();
        const { recordId } = request.params;
        const { notes, schedule_next = true } = request.body;

        const record = await db.collection('records').findOne({
            _id: new ObjectId(recordId),
            tenant_id: request.tenantId
        });

        if (!record) {
            return reply.status(404).send({ error: 'Record not found' });
        }

        // Calculate next review date
        let nextReviewDate = null;
        if (schedule_next) {
            const settings = await db.collection('review_settings').findOne({
                tenant_id: request.tenantId
            });
            const periodDays = record.review_period_days || settings ?.default_review_period_days || 90;
            nextReviewDate = new Date();
            nextReviewDate.setDate(nextReviewDate.getDate() + periodDays);
        }

        // Update record
        await db.collection('records').updateOne({ _id: new ObjectId(recordId), tenant_id: request.tenantId }, {
            $set: {
                last_reviewed_at: new Date(),
                last_reviewed_by: request.userId,
                next_review_date: nextReviewDate,
                review_status: 'completed'
            }
        });

        // Log review completion
        await db.collection('review_logs').insertOne({
            tenant_id: request.tenantId,
            record_id: new ObjectId(recordId),
            action: 'completed',
            notes,
            next_review_date: nextReviewDate,
            created_by: request.userId,
            created_at: new Date()
        });

        return {
            success: true,
            last_reviewed_at: new Date(),
            next_review_date: nextReviewDate
        };
    });

    /**
     * Get KBs pending review
     */
    fastify.get('/pending', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async(request, reply) => {
        const db = fastify.db();
        const {
            page = 1,
                limit = 20,
                status = 'all', // all, overdue, upcoming, this_week, this_month
                owner_id
        } = request.query;

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const now = new Date();

        const filter = {
            tenant_id: request.tenantId,
            status: { $in: ['approved', 'published'] },
            next_review_date: { $exists: true, $ne: null }
        };

        // Filter by status
        switch (status) {
            case 'overdue':
                filter.next_review_date = { $lt: now };
                break;
            case 'upcoming':
                filter.next_review_date = { $gte: now };
                break;
            case 'this_week':
                const weekFromNow = new Date(now);
                weekFromNow.setDate(weekFromNow.getDate() + 7);
                filter.next_review_date = { $lte: weekFromNow };
                break;
            case 'this_month':
                const monthFromNow = new Date(now);
                monthFromNow.setDate(monthFromNow.getDate() + 30);
                filter.next_review_date = { $lte: monthFromNow };
                break;
        }

        if (owner_id) {
            filter.created_by = new ObjectId(owner_id);
        }

        const [records, total] = await Promise.all([
            db.collection('records')
            .aggregate([
                { $match: filter },
                { $sort: { next_review_date: 1 } },
                { $skip: skip },
                { $limit: parseInt(limit) },
                {
                    $lookup: {
                        from: 'users',
                        localField: 'created_by',
                        foreignField: '_id',
                        as: 'owner'
                    }
                },
                {
                    $lookup: {
                        from: 'categories',
                        localField: 'category_id',
                        foreignField: '_id',
                        as: 'category'
                    }
                },
                {
                    $project: {
                        _id: 1,
                        title: 1,
                        status: 1,
                        next_review_date: 1,
                        last_reviewed_at: 1,
                        created_at: 1,
                        updated_at: 1,
                        owner: { $arrayElemAt: ['$owner', 0] },
                        category: { $arrayElemAt: ['$category', 0] },
                        days_until_review: {
                            $divide: [
                                { $subtract: ['$next_review_date', now] },
                                1000 * 60 * 60 * 24
                            ]
                        }
                    }
                }
            ])
            .toArray(),
            db.collection('records').countDocuments(filter)
        ]);

        // Classify records
        const classified = records.map(r => ({
            ...r,
            review_status: r.next_review_date < now ? 'overdue' : r.days_until_review <= 7 ? 'urgent' : r.days_until_review <= 30 ? 'upcoming' : 'scheduled',
            days_until_review: Math.ceil(r.days_until_review)
        }));

        return {
            records: classified,
            pagination: {
                total,
                page: parseInt(page),
                pages: Math.ceil(total / parseInt(limit))
            },
            summary: {
                overdue: classified.filter(r => r.review_status === 'overdue').length,
                urgent: classified.filter(r => r.review_status === 'urgent').length,
                upcoming: classified.filter(r => r.review_status === 'upcoming').length
            }
        };
    });

    /**
     * Get review history for a KB
     */
    fastify.get('/records/:recordId/history', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async(request, reply) => {
        const db = fastify.db();
        const { recordId } = request.params;

        const logs = await db.collection('review_logs')
            .aggregate([{
                    $match: {
                        tenant_id: request.tenantId,
                        record_id: new ObjectId(recordId)
                    }
                },
                { $sort: { created_at: -1 } },
                { $limit: 50 },
                {
                    $lookup: {
                        from: 'users',
                        localField: 'created_by',
                        foreignField: '_id',
                        as: 'user'
                    }
                },
                {
                    $project: {
                        _id: 1,
                        action: 1,
                        notes: 1,
                        next_review_date: 1,
                        created_at: 1,
                        user: { $arrayElemAt: ['$user', 0] }
                    }
                }
            ])
            .toArray();

        return { history: logs };
    });

    /**
     * Get KBs that have never been reviewed (stale)
     */
    fastify.get('/stale', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async(request, reply) => {
        const db = fastify.db();
        const { days = 90, page = 1, limit = 20 } = request.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const staleDate = new Date();
        staleDate.setDate(staleDate.getDate() - parseInt(days));

        const filter = {
            tenant_id: request.tenantId,
            status: { $in: ['approved', 'published'] },
            $and: [{
                    $or: [
                        { next_review_date: { $exists: false } },
                        { next_review_date: null }
                    ]
                },
                {
                    $or: [
                        { last_reviewed_at: { $exists: false } },
                        { last_reviewed_at: null },
                        { last_reviewed_at: { $lt: staleDate } }
                    ]
                }
            ],
            updated_at: { $lt: staleDate }
        };

        const [records, total] = await Promise.all([
            db.collection('records')
            .aggregate([
                { $match: filter },
                { $sort: { updated_at: 1 } },
                { $skip: skip },
                { $limit: parseInt(limit) },
                {
                    $lookup: {
                        from: 'users',
                        localField: 'created_by',
                        foreignField: '_id',
                        as: 'owner'
                    }
                },
                {
                    $project: {
                        _id: 1,
                        title: 1,
                        status: 1,
                        created_at: 1,
                        updated_at: 1,
                        last_reviewed_at: 1,
                        owner: { $arrayElemAt: ['$owner', 0] },
                        days_since_update: {
                            $divide: [
                                { $subtract: [new Date(), '$updated_at'] },
                                1000 * 60 * 60 * 24
                            ]
                        }
                    }
                }
            ])
            .toArray(),
            db.collection('records').countDocuments(filter)
        ]);

        return {
            records: records.map(r => ({
                ...r,
                days_since_update: Math.floor(r.days_since_update)
            })),
            pagination: {
                total,
                page: parseInt(page),
                pages: Math.ceil(total / parseInt(limit))
            }
        };
    });

    /**
     * Bulk schedule reviews
     */
    fastify.post('/bulk-schedule', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async(request, reply) => {
        const db = fastify.db();
        const { record_ids, review_period_days } = request.body;

        if (!Array.isArray(record_ids) || record_ids.length === 0) {
            return reply.status(400).send({ error: 'Record IDs array is required' });
        }

        const settings = await db.collection('review_settings').findOne({
            tenant_id: request.tenantId
        });
        const periodDays = review_period_days || settings ?.default_review_period_days || 90;

        const nextReviewDate = new Date();
        nextReviewDate.setDate(nextReviewDate.getDate() + periodDays);

        const result = await db.collection('records').updateMany({
            _id: { $in: record_ids.map(id => new ObjectId(id)) },
            tenant_id: request.tenantId
        }, {
            $set: {
                next_review_date: nextReviewDate,
                review_period_days: periodDays,
                review_scheduled_by: request.userId,
                review_scheduled_at: new Date()
            }
        });

        return {
            success: true,
            updated: result.modifiedCount,
            next_review_date: nextReviewDate
        };
    });

    /**
     * Process review reminders (called by cron job or manually)
     */
    fastify.post('/process-reminders', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async(request, reply) => {
        const db = fastify.db();

        const settings = await db.collection('review_settings').findOne({
            tenant_id: request.tenantId
        });

        if (!settings ?.enabled) {
            return { success: true, message: 'Review reminders disabled', sent: 0 };
        }

        const reminderDays = settings.reminder_days_before || [30, 7, 1];
        const now = new Date();
        let sentCount = 0;

        for (const days of reminderDays) {
            const targetDate = new Date(now);
            targetDate.setDate(targetDate.getDate() + days);

            // Find KBs due for review on this target date (within same day)
            const startOfDay = new Date(targetDate);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(targetDate);
            endOfDay.setHours(23, 59, 59, 999);

            const records = await db.collection('records')
                .find({
                    tenant_id: request.tenantId,
                    status: { $in: ['approved', 'published'] },
                    next_review_date: { $gte: startOfDay, $lte: endOfDay }
                })
                .toArray();

            for (const record of records) {
                // Check if reminder already sent today
                const existingReminder = await db.collection('review_reminders').findOne({
                    record_id: record._id,
                    days_before: days,
                    sent_at: { $gte: new Date(now.setHours(0, 0, 0, 0)) }
                });

                if (existingReminder) continue;

                // Send notification to owner
                if (settings.notify_owner && record.created_by) {
                    await createAndBroadcastNotification(db, {
                        tenant_id: request.tenantId,
                        user_id: record.created_by,
                        type: 'review_reminder',
                        title: `Revisão pendente em ${days} dia${days > 1 ? 's' : ''}`,
                        message: `O KB "${record.title}" precisa ser revisado`,
                        link: `/kb/view/${record._id}`,
                        related_id: record._id,
                        priority: days <= 1 ? 'high' : 'normal'
                    });
                    sentCount++;
                }

                // Log reminder
                await db.collection('review_reminders').insertOne({
                    tenant_id: request.tenantId,
                    record_id: record._id,
                    days_before: days,
                    sent_at: new Date()
                });
            }
        }

        return {
            success: true,
            reminders_sent: sentCount
        };
    });
}