import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { tenantMiddleware } from '../../middlewares/tenant.middleware.js';
import { requirePermission } from '../../middlewares/rbac.middleware.js';
import { toObjectId } from '../../utils/mongodb.js';
import { filterKBsByAccess } from '../../middlewares/kbAccess.middleware.js';
import auditMiddleware from '../../middlewares/audit.middleware.js';
import { notifyApprovers, notifyCreator } from '../notifications/notifications.routes.js';

export default async function recordRoutes(fastify, options) {

    const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // List records (with access control)
    fastify.get('/', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async(request, reply) => {
        const db = fastify.db();
        const { database_id, status, search, page = 1, limit = 50, category_id, tag_id } = request.query;

        // Get accessible KB filter based on user permissions
        const accessFilter = await filterKBsByAccess(
            db,
            request.tenantId,
            request.userId,
            request.userRole
        );

        const filter = {...accessFilter };
        if (database_id) filter.database_id = database_id;
        if (status) filter.status = status;

        // Category filter
        if (category_id) {
            filter.category_id = toObjectId(category_id);
        }

        // Tag filter
        if (tag_id) {
            filter.tags = toObjectId(tag_id);
        }

        // Text search
        if (search) {
            const trimmed = String(search).trim();
            if (trimmed) {
                const safe = escapeRegExp(trimmed);
                filter.$or = [
                    { title: { $regex: safe, $options: 'i' } },
                    { content_md: { $regex: safe, $options: 'i' } }
                ];
            }
        }

        // Use aggregation to include tags and category info
        const records = await db.collection('records')
            .aggregate([
                { $match: filter },
                { $sort: { created_at: -1 } },
                { $skip: (parseInt(page) - 1) * parseInt(limit) },
                { $limit: parseInt(limit) },
                // Lookup tags
                {
                    $lookup: {
                        from: 'tags',
                        localField: 'tags',
                        foreignField: '_id',
                        as: 'tags_info'
                    }
                },
                // Lookup category
                {
                    $lookup: {
                        from: 'categories',
                        localField: 'category_id',
                        foreignField: '_id',
                        as: 'category_info'
                    }
                },
                {
                    $unwind: {
                        path: '$category_info',
                        preserveNullAndEmptyArrays: true
                    }
                }
            ])
            .toArray();

        const total = await db.collection('records').countDocuments(filter);

        return {
            records,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total
            }
        };
    });

    // Create record (with audit)
    fastify.post('/', {
        preHandler: [authMiddleware, tenantMiddleware, requirePermission('kb:create'), auditMiddleware('kb_created')]
    }, async(request, reply) => {
        const db = fastify.db();
        const { database_id, title, content_md, properties, custom_properties, status, tags, category_id } = request.body;

        // Check subscription limits
        const subscription = await db.collection('subscriptions').findOne({
            tenant_id: request.tenantId,
            status: 'active'
        });

        const recordCount = await db.collection('records').countDocuments({
            tenant_id: request.tenantId
        });

        if (recordCount >= subscription.limits.max_records) {
            return reply.status(400).send({
                error: 'Record limit reached. Please upgrade your plan.'
            });
        }

        const record = {
            tenant_id: request.tenantId,
            database_id,
            title,
            content_md,
            properties: properties || {},
            custom_properties: custom_properties || {}, // Notion-like custom properties
            tags: tags ?.map(id => toObjectId(id)) || [],
            category_id: category_id ? toObjectId(category_id) : null,
            status: status || 'draft',
            version: 1,
            created_by: request.currentUser._id,
            created_at: new Date(),
            updated_at: new Date(),
            approved_by: null,
            approved_at: null,
            published_at: null
        };

        const result = await db.collection('records').insertOne(record);
        const recordId = result.insertedId;

        // Create version
        await db.collection('record_versions').insertOne({
            tenant_id: request.tenantId,
            record_id: recordId,
            version: 1,
            title,
            content_md,
            properties,
            custom_properties: custom_properties || {},
            created_by: request.currentUser._id,
            created_at: new Date()
        });

        // Update subscription usage
        await db.collection('subscriptions').updateOne({ tenant_id: request.tenantId }, { $inc: { 'usage.records': 1 } });

        // Audit log
        await db.collection('audit_logs').insertOne({
            tenant_id: request.tenantId,
            user_id: request.currentUser._id,
            action: 'record.created',
            resource: 'record',
            resource_id: recordId,
            timestamp: new Date()
        });

        return { success: true, recordId };
    });

    // Get record
    fastify.get('/:recordId', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async(request, reply) => {
        const db = fastify.db();
        const { recordId } = request.params;

        const objectId = toObjectId(recordId);
        if (!objectId) {
            return reply.status(400).send({ error: 'Invalid record ID' });
        }

        const record = await db.collection('records').findOne({
            _id: objectId,
            tenant_id: request.tenantId
        });

        if (!record) {
            return reply.status(404).send({ error: 'Record not found' });
        }

        return { record };
    });

    // Update record
    fastify.patch('/:recordId', {
        preHandler: [authMiddleware, tenantMiddleware, requirePermission('kb:edit')]
    }, async(request, reply) => {
        const db = fastify.db();
        const { recordId } = request.params;
        const { tags, category_id, ...updates } = request.body;

        const objectId = toObjectId(recordId);
        if (!objectId) {
            return reply.status(400).send({ error: 'Invalid record ID' });
        }

        // Get current record
        const record = await db.collection('records').findOne({
            _id: objectId,
            tenant_id: request.tenantId
        });

        if (!record) {
            return reply.status(404).send({ error: 'Record not found' });
        }

        // Cannot edit approved/published records
        if (['approved', 'published'].includes(record.status)) {
            return reply.status(400).send({
                error: 'Cannot edit approved/published records. Create a new version instead.'
            });
        }

        // Build update object with tags and category
        const updateData = {
            ...updates,
            ...(tags !== undefined && { tags: tags.map(id => toObjectId(id)) }),
            ...(category_id !== undefined && { category_id: category_id ? toObjectId(category_id) : null })
        };

        // Update record
        const newVersion = record.version + 1;
        await db.collection('records').updateOne({ _id: objectId, tenant_id: request.tenantId }, {
            $set: {
                ...updateData,
                version: newVersion,
                updated_at: new Date()
            }
        });

        // Create new version
        await db.collection('record_versions').insertOne({
            tenant_id: request.tenantId,
            record_id: objectId,
            version: newVersion,
            title: updates.title || record.title,
            content_md: updates.content_md || record.content_md,
            properties: updates.properties || record.properties,
            custom_properties: updates.custom_properties || record.custom_properties || {},
            created_by: request.currentUser._id,
            created_at: new Date()
        });

        // Audit log
        await db.collection('audit_logs').insertOne({
            tenant_id: request.tenantId,
            user_id: request.currentUser._id,
            action: 'record.updated',
            resource: 'record',
            resource_id: objectId,
            timestamp: new Date(),
            metadata: { version: newVersion }
        });

        return { success: true, version: newVersion };
    });

    // Approve record
    fastify.post('/:recordId/approve', {
        preHandler: [authMiddleware, tenantMiddleware, requirePermission('kb:approve')]
    }, async(request, reply) => {
        const db = fastify.db();
        const { recordId } = request.params;

        const objectId = toObjectId(recordId);
        if (!objectId) {
            return reply.status(400).send({ error: 'Invalid record ID' });
        }

        const record = await db.collection('records').findOne({
            _id: objectId,
            tenant_id: request.tenantId
        });

        if (!record) {
            return reply.status(404).send({ error: 'Record not found' });
        }

        // Check if user can approve (cannot approve own KB)
        if (record.created_by.toString() === request.currentUser._id.toString()) {
            return reply.status(403).send({ error: 'Cannot approve your own KB' });
        }

        if (record.status !== 'in_review') {
            return reply.status(400).send({ error: 'Record must be in review status' });
        }

        await db.collection('records').updateOne({ _id: objectId, tenant_id: request.tenantId }, {
            $set: {
                status: 'approved',
                approved_by: request.currentUser._id,
                approved_at: new Date(),
                updated_at: new Date()
            }
        });

        // Audit log
        await db.collection('audit_logs').insertOne({
            tenant_id: request.tenantId,
            user_id: request.currentUser._id,
            action: 'record.approved',
            resource: 'record',
            resource_id: objectId,
            timestamp: new Date()
        });

        // Notify creator about approval
        try {
            await notifyCreator(db, {
                tenant_id: request.tenantId.toString(),
                creator_id: record.created_by.toString(),
                kb_id: recordId,
                kb_title: record.title,
                type: 'kb_approved',
                reviewer_name: request.currentUser.name || request.currentUser.email
            });
        } catch (notifyError) {
            console.error('Failed to send notification:', notifyError);
        }

        return { success: true };
    });

    // Submit for review
    fastify.post('/:recordId/submit-for-review', {
        preHandler: [authMiddleware, tenantMiddleware, requirePermission('kb:edit')]
    }, async(request, reply) => {
        const db = fastify.db();
        const { recordId } = request.params;

        const objectId = toObjectId(recordId);
        if (!objectId) {
            return reply.status(400).send({ error: 'Invalid record ID' });
        }

        const record = await db.collection('records').findOne({
            _id: objectId,
            tenant_id: request.tenantId
        });

        if (!record) {
            return reply.status(404).send({ error: 'Record not found' });
        }

        if (!['draft', 'rejected'].includes(record.status)) {
            return reply.status(400).send({ error: 'Can only submit draft or rejected records for review' });
        }

        await db.collection('records').updateOne({ _id: objectId, tenant_id: request.tenantId }, {
            $set: {
                status: 'in_review',
                submitted_for_review_at: new Date(),
                submitted_for_review_by: request.currentUser._id,
                updated_at: new Date()
            },
            $unset: {
                rejection_reason: '',
                rejected_by: '',
                rejected_at: ''
            }
        });

        // Audit log
        await db.collection('audit_logs').insertOne({
            tenant_id: request.tenantId,
            user_id: request.currentUser._id,
            action: 'record.submitted_for_review',
            resource: 'record',
            resource_id: objectId,
            timestamp: new Date()
        });

        // Send notifications to approvers
        try {
            await notifyApprovers(db, {
                tenant_id: request.tenantId.toString(),
                kb_id: recordId,
                kb_title: record.title,
                submitter_name: request.currentUser.name || request.currentUser.email
            });
        } catch (notifyError) {
            console.error('Failed to send notifications:', notifyError);
            // Don't fail the request if notifications fail
        }

        return { success: true };
    });

    // Reject record
    fastify.post('/:recordId/reject', {
        preHandler: [authMiddleware, tenantMiddleware, requirePermission('kb:approve')]
    }, async(request, reply) => {
        const db = fastify.db();
        const { recordId } = request.params;
        const { reason } = request.body || {};

        const objectId = toObjectId(recordId);
        if (!objectId) {
            return reply.status(400).send({ error: 'Invalid record ID' });
        }

        const record = await db.collection('records').findOne({
            _id: objectId,
            tenant_id: request.tenantId
        });

        if (!record) {
            return reply.status(404).send({ error: 'Record not found' });
        }

        // Cannot reject own KB
        if (record.created_by.toString() === request.currentUser._id.toString()) {
            return reply.status(403).send({ error: 'Cannot reject your own KB' });
        }

        if (record.status !== 'in_review') {
            return reply.status(400).send({ error: 'Record must be in review status' });
        }

        await db.collection('records').updateOne({ _id: objectId, tenant_id: request.tenantId }, {
            $set: {
                status: 'rejected',
                rejection_reason: reason || 'No reason provided',
                rejected_by: request.currentUser._id,
                rejected_at: new Date(),
                updated_at: new Date()
            }
        });

        // Audit log
        await db.collection('audit_logs').insertOne({
            tenant_id: request.tenantId,
            user_id: request.currentUser._id,
            action: 'record.rejected',
            resource: 'record',
            resource_id: objectId,
            timestamp: new Date(),
            metadata: { reason: reason || 'No reason provided' }
        });

        // Notify creator about rejection
        try {
            await notifyCreator(db, {
                tenant_id: request.tenantId.toString(),
                creator_id: record.created_by.toString(),
                kb_id: recordId,
                kb_title: record.title,
                type: 'kb_rejected',
                reviewer_name: request.currentUser.name || request.currentUser.email,
                reason: reason
            });
        } catch (notifyError) {
            console.error('Failed to send notification:', notifyError);
        }

        return { success: true };
    });

    // Publish record
    fastify.post('/:recordId/publish', {
        preHandler: [authMiddleware, tenantMiddleware, requirePermission('kb:publish')]
    }, async(request, reply) => {
        const db = fastify.db();
        const { recordId } = request.params;

        const objectId = toObjectId(recordId);
        if (!objectId) {
            return reply.status(400).send({ error: 'Invalid record ID' });
        }

        const record = await db.collection('records').findOne({
            _id: objectId,
            tenant_id: request.tenantId
        });

        if (!record) {
            return reply.status(404).send({ error: 'Record not found' });
        }

        if (record.status !== 'approved') {
            return reply.status(400).send({ error: 'Record must be approved first' });
        }

        await db.collection('records').updateOne({ _id: objectId, tenant_id: request.tenantId }, {
            $set: {
                status: 'published',
                published_at: new Date(),
                updated_at: new Date()
            }
        });

        // Audit log
        await db.collection('audit_logs').insertOne({
            tenant_id: request.tenantId,
            user_id: request.currentUser._id,
            action: 'record.published',
            resource: 'record',
            resource_id: objectId,
            timestamp: new Date()
        });

        return { success: true };
    });

    // Get record versions
    fastify.get('/:recordId/versions', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async(request, reply) => {
        const db = fastify.db();
        const { recordId } = request.params;

        const objectId = toObjectId(recordId);
        if (!objectId) {
            return reply.status(400).send({ error: 'Invalid record ID' });
        }

        const versions = await db.collection('record_versions')
            .find({
                tenant_id: request.tenantId,
                record_id: objectId
            })
            .sort({ version: -1 })
            .toArray();

        // Populate user info
        for (const version of versions) {
            const user = await db.collection('users').findOne({ _id: version.created_by });
            version.created_by_name = user ?.name || user ?.email || 'Unknown';
        }

        return { versions };
    });

    // Get specific version
    fastify.get('/:recordId/versions/:version', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async(request, reply) => {
        const db = fastify.db();
        const { recordId, version } = request.params;

        const objectId = toObjectId(recordId);
        if (!objectId) {
            return reply.status(400).send({ error: 'Invalid record ID' });
        }

        const versionDoc = await db.collection('record_versions').findOne({
            tenant_id: request.tenantId,
            record_id: objectId,
            version: parseInt(version)
        });

        if (!versionDoc) {
            return reply.status(404).send({ error: 'Version not found' });
        }

        // Populate user info
        const user = await db.collection('users').findOne({ _id: versionDoc.created_by });
        versionDoc.created_by_name = user ?.name || user ?.email || 'Unknown';

        return { version: versionDoc };
    });

    // Compare two versions
    fastify.get('/:recordId/compare', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async(request, reply) => {
        const db = fastify.db();
        const { recordId } = request.params;
        const { from, to } = request.query;

        if (!from || !to) {
            return reply.status(400).send({ error: 'Both from and to version parameters required' });
        }

        const objectId = toObjectId(recordId);
        if (!objectId) {
            return reply.status(400).send({ error: 'Invalid record ID' });
        }

        const [fromVersion, toVersion] = await Promise.all([
            db.collection('record_versions').findOne({
                tenant_id: request.tenantId,
                record_id: objectId,
                version: parseInt(from)
            }),
            db.collection('record_versions').findOne({
                tenant_id: request.tenantId,
                record_id: objectId,
                version: parseInt(to)
            })
        ]);

        if (!fromVersion || !toVersion) {
            return reply.status(404).send({ error: 'One or both versions not found' });
        }

        return {
            from: fromVersion,
            to: toVersion
        };
    });

    // Restore a specific version
    fastify.post('/:recordId/restore/:version', {
        preHandler: [authMiddleware, tenantMiddleware, requirePermission('kb:edit')]
    }, async(request, reply) => {
        const db = fastify.db();
        const { recordId, version } = request.params;

        const objectId = toObjectId(recordId);
        if (!objectId) {
            return reply.status(400).send({ error: 'Invalid record ID' });
        }

        // Get current record
        const record = await db.collection('records').findOne({
            _id: objectId,
            tenant_id: request.tenantId
        });

        if (!record) {
            return reply.status(404).send({ error: 'Record not found' });
        }

        // Cannot restore approved/published records
        if (['approved', 'published'].includes(record.status)) {
            return reply.status(400).send({
                error: 'Cannot restore approved/published records'
            });
        }

        // Get version to restore
        const versionDoc = await db.collection('record_versions').findOne({
            tenant_id: request.tenantId,
            record_id: objectId,
            version: parseInt(version)
        });

        if (!versionDoc) {
            return reply.status(404).send({ error: 'Version not found' });
        }

        // Create new version with restored content
        const newVersion = record.version + 1;

        await db.collection('records').updateOne({ _id: objectId, tenant_id: request.tenantId }, {
            $set: {
                title: versionDoc.title,
                content_md: versionDoc.content_md,
                properties: versionDoc.properties,
                custom_properties: versionDoc.custom_properties,
                version: newVersion,
                updated_at: new Date()
            }
        });

        // Save as new version
        await db.collection('record_versions').insertOne({
            tenant_id: request.tenantId,
            record_id: objectId,
            version: newVersion,
            title: versionDoc.title,
            content_md: versionDoc.content_md,
            properties: versionDoc.properties,
            custom_properties: versionDoc.custom_properties,
            created_by: request.currentUser._id,
            created_at: new Date(),
            restored_from: parseInt(version)
        });

        // Audit log
        await db.collection('audit_logs').insertOne({
            tenant_id: request.tenantId,
            user_id: request.currentUser._id,
            action: 'record.restored',
            resource: 'record',
            resource_id: objectId,
            timestamp: new Date(),
            metadata: {
                restored_from_version: parseInt(version),
                new_version: newVersion
            }
        });

        return { success: true, version: newVersion };
    });

    // Delete record
    fastify.delete('/:recordId', {
        preHandler: [authMiddleware, tenantMiddleware, requirePermission('kb:delete')]
    }, async(request, reply) => {
        const db = fastify.db();
        const { recordId } = request.params;

        const objectId = toObjectId(recordId);
        if (!objectId) {
            return reply.status(400).send({ error: 'Invalid record ID' });
        }

        try {
            const deleteResult = await db.collection('records').deleteOne({
                _id: objectId,
                tenant_id: request.tenantId
            });

            if (deleteResult.deletedCount === 0) {
                return reply.status(404).send({ error: 'KB não encontrado' });
            }

            // Delete versions
            await db.collection('record_versions').deleteMany({
                record_id: objectId,
                tenant_id: request.tenantId
            });

            // Update subscription usage
            await db.collection('subscriptions').updateOne({ tenant_id: request.tenantId }, { $inc: { 'usage.records': -1 } });

            await db.collection('audit_logs').insertOne({
                tenant_id: request.tenantId,
                user_id: request.currentUser._id,
                action: 'kb.deleted',
                resource: 'record',
                resource_id: objectId,
                timestamp: new Date()
            });

            return { success: true };
        } catch (error) {
            fastify.log.error({ err: error }, 'Falha ao excluir KB');
            return reply.status(500).send({ error: 'Falha ao excluir KB', details: error.message });
        }
    });
}