import { ObjectId } from 'mongodb';

export default async function commentsRoutes(fastify, options) {

    // Get all comments for a record
    fastify.get('/records/:recordId/comments', {
        onRequest: [fastify.authenticate]
    }, async(request, reply) => {
        const { recordId } = request.params;
        const tenantId = request.user.tenantId;
        const db = fastify.db();
        const records = db.collection('records');
        const comments = db.collection('comments');

        // Verify record exists and belongs to tenant
        const record = await records.findOne({
            _id: new ObjectId(recordId),
            tenant_id: tenantId,
            deleted_at: null
        });

        if (!record) {
            return reply.status(404).send({ error: 'Record not found' });
        }

        // Get all comments with user info
        const commentsList = await comments.aggregate([{
                $match: {
                    record_id: new ObjectId(recordId),
                    deleted_at: null
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'created_by',
                    foreignField: '_id',
                    as: 'author'
                }
            },
            { $unwind: '$author' },
            {
                $project: {
                    _id: 1,
                    content: 1,
                    parent_id: 1,
                    created_at: 1,
                    updated_at: 1,
                    'author._id': 1,
                    'author.name': 1,
                    'author.email': 1
                }
            },
            { $sort: { created_at: 1 } }
        ]).toArray();

        // Organize into tree structure
        const commentsMap = new Map();
        const rootComments = [];

        commentsList.forEach(comment => {
            comment.replies = [];
            commentsMap.set(comment._id.toString(), comment);
        });

        commentsList.forEach(comment => {
            if (comment.parent_id) {
                const parent = commentsMap.get(comment.parent_id.toString());
                if (parent) {
                    parent.replies.push(comment);
                }
            } else {
                rootComments.push(comment);
            }
        });

        return { comments: rootComments, total: commentsList.length };
    });

    // Create a comment
    fastify.post('/records/:recordId/comments', {
        onRequest: [fastify.authenticate],
        schema: {
            body: {
                type: 'object',
                required: ['content'],
                properties: {
                    content: { type: 'string', minLength: 1, maxLength: 10000 },
                    parent_id: { type: 'string' }
                }
            }
        }
    }, async(request, reply) => {
        const { recordId } = request.params;
        const { content, parent_id } = request.body;
        const tenantId = request.user.tenantId;
        const userId = new ObjectId(request.user._id);
        const db = fastify.db();
        const records = db.collection('records');
        const comments = db.collection('comments');

        // Verify record exists and belongs to tenant
        const record = await records.findOne({
            _id: new ObjectId(recordId),
            tenant_id: tenantId,
            deleted_at: null
        });

        if (!record) {
            return reply.status(404).send({ error: 'Record not found' });
        }

        // If replying, verify parent comment exists
        if (parent_id) {
            const parentComment = await comments.findOne({
                _id: new ObjectId(parent_id),
                record_id: new ObjectId(recordId),
                deleted_at: null
            });

            if (!parentComment) {
                return reply.status(404).send({ error: 'Parent comment not found' });
            }
        }

        const newComment = {
            record_id: new ObjectId(recordId),
            tenant_id: tenantId,
            content,
            parent_id: parent_id ? new ObjectId(parent_id) : null,
            created_by: userId,
            created_at: new Date(),
            updated_at: new Date(),
            deleted_at: null
        };

        const result = await comments.insertOne(newComment);

        // Get the created comment with author info
        const createdComment = await comments.aggregate([
            { $match: { _id: result.insertedId } },
            {
                $lookup: {
                    from: 'users',
                    localField: 'created_by',
                    foreignField: '_id',
                    as: 'author'
                }
            },
            { $unwind: '$author' },
            {
                $project: {
                    _id: 1,
                    content: 1,
                    parent_id: 1,
                    created_at: 1,
                    updated_at: 1,
                    'author._id': 1,
                    'author.name': 1,
                    'author.email': 1
                }
            }
        ]).toArray();

        // Create notification for record owner (if commenter is not the owner)
        if (record.created_by.toString() !== userId.toString()) {
            const notifications = db.collection('notifications');
            await notifications.insertOne({
                tenant_id: tenantId,
                user_id: record.created_by,
                type: 'new_comment',
                title: 'Novo comentário em seu KB',
                message: `${request.user.name} comentou em "${record.title}"`,
                data: {
                    record_id: record._id,
                    comment_id: result.insertedId
                },
                read: false,
                created_at: new Date()
            });
        }

        // If it's a reply, notify the parent comment author
        if (parent_id) {
            const parentComment = await comments.findOne({ _id: new ObjectId(parent_id) });
            if (parentComment && parentComment.created_by.toString() !== userId.toString()) {
                const notifications = db.collection('notifications');
                await notifications.insertOne({
                    tenant_id: tenantId,
                    user_id: parentComment.created_by,
                    type: 'comment_reply',
                    title: 'Nova resposta ao seu comentário',
                    message: `${request.user.name} respondeu ao seu comentário em "${record.title}"`,
                    data: {
                        record_id: record._id,
                        comment_id: result.insertedId,
                        parent_comment_id: new ObjectId(parent_id)
                    },
                    read: false,
                    created_at: new Date()
                });
            }
        }

        // Log the activity
        const auditLogs = db.collection('audit_logs');
        await auditLogs.insertOne({
            tenant_id: tenantId,
            user_id: userId,
            action: 'create',
            resource: 'comment',
            resource_id: result.insertedId,
            details: {
                record_id: record._id,
                record_title: record.title
            },
            created_at: new Date()
        });

        return reply.status(201).send({
            comment: {...createdComment[0], replies: [] },
            message: 'Comment created successfully'
        });
    });

    // Update a comment
    fastify.put('/comments/:commentId', {
        onRequest: [fastify.authenticate],
        schema: {
            body: {
                type: 'object',
                required: ['content'],
                properties: {
                    content: { type: 'string', minLength: 1, maxLength: 10000 }
                }
            }
        }
    }, async(request, reply) => {
        const { commentId } = request.params;
        const { content } = request.body;
        const userId = new ObjectId(request.user._id);
        const db = fastify.db();
        const comments = db.collection('comments');

        const comment = await comments.findOne({
            _id: new ObjectId(commentId),
            deleted_at: null
        });

        if (!comment) {
            return reply.status(404).send({ error: 'Comment not found' });
        }

        // Only the author can edit their comment
        if (comment.created_by.toString() !== userId.toString()) {
            return reply.status(403).send({ error: 'You can only edit your own comments' });
        }

        await comments.updateOne({ _id: new ObjectId(commentId) }, {
            $set: {
                content,
                updated_at: new Date()
            }
        });

        return { message: 'Comment updated successfully' };
    });

    // Delete a comment (soft delete)
    fastify.delete('/comments/:commentId', {
        onRequest: [fastify.authenticate]
    }, async(request, reply) => {
        const { commentId } = request.params;
        const userId = new ObjectId(request.user._id);
        const userRole = request.user.role;
        const db = fastify.db();
        const comments = db.collection('comments');

        const comment = await comments.findOne({
            _id: new ObjectId(commentId),
            deleted_at: null
        });

        if (!comment) {
            return reply.status(404).send({ error: 'Comment not found' });
        }

        // Only the author or admins can delete
        if (comment.created_by.toString() !== userId.toString() && !['owner', 'admin'].includes(userRole)) {
            return reply.status(403).send({ error: 'Not authorized to delete this comment' });
        }

        await comments.updateOne({ _id: new ObjectId(commentId) }, {
            $set: {
                deleted_at: new Date(),
                deleted_by: userId
            }
        });

        // Also soft delete all replies
        await comments.updateMany({ parent_id: new ObjectId(commentId) }, {
            $set: {
                deleted_at: new Date(),
                deleted_by: userId
            }
        });

        return { message: 'Comment deleted successfully' };
    });
}