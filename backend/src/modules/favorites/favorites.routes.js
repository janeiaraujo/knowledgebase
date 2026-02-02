import { ObjectId } from 'mongodb';

export default async function favoritesRoutes(fastify, options) {
    const db = fastify.mongo.db;
    const favorites = db.collection('favorites');
    const records = db.collection('records');

    // Get user's favorites
    fastify.get('/favorites', {
        onRequest: [fastify.authenticate]
    }, async(request, reply) => {
        const userId = new ObjectId(request.user._id);
        const tenantId = request.user.tenantId;
        const { page = 1, limit = 20 } = request.query;

        const skip = (page - 1) * limit;

        const favoritesList = await favorites.aggregate([{
                $match: {
                    user_id: userId,
                    tenant_id: tenantId
                }
            },
            { $sort: { created_at: -1 } },
            { $skip: skip },
            { $limit: parseInt(limit) },
            {
                $lookup: {
                    from: 'records',
                    let: { recordId: '$record_id' },
                    pipeline: [{
                        $match: {
                            $expr: {
                                $and: [
                                    { $eq: ['$_id', '$$recordId'] },
                                    { $eq: ['$deleted_at', null] }
                                ]
                            }
                        }
                    }],
                    as: 'record'
                }
            },
            { $unwind: { path: '$record', preserveNullAndEmptyArrays: true } },
            {
                $lookup: {
                    from: 'users',
                    localField: 'record.created_by',
                    foreignField: '_id',
                    as: 'author'
                }
            },
            { $unwind: { path: '$author', preserveNullAndEmptyArrays: true } },
            {
                $project: {
                    _id: 1,
                    created_at: 1,
                    'record._id': 1,
                    'record.title': 1,
                    'record.status': 1,
                    'record.created_at': 1,
                    'record.updated_at': 1,
                    'author.name': 1
                }
            }
        ]).toArray();

        // Filter out favorites where record was deleted
        const validFavorites = favoritesList.filter(f => f.record);

        const total = await favorites.countDocuments({
            user_id: userId,
            tenant_id: tenantId
        });

        return {
            favorites: validFavorites,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        };
    });

    // Check if a record is favorited
    fastify.get('/favorites/check/:recordId', {
        onRequest: [fastify.authenticate]
    }, async(request, reply) => {
        const { recordId } = request.params;
        const userId = new ObjectId(request.user._id);
        const tenantId = request.user.tenantId;

        const favorite = await favorites.findOne({
            user_id: userId,
            record_id: new ObjectId(recordId),
            tenant_id: tenantId
        });

        return { isFavorite: !!favorite };
    });

    // Add to favorites
    fastify.post('/favorites/:recordId', {
        onRequest: [fastify.authenticate]
    }, async(request, reply) => {
        const { recordId } = request.params;
        const userId = new ObjectId(request.user._id);
        const tenantId = request.user.tenantId;

        // Verify record exists and belongs to tenant
        const record = await records.findOne({
            _id: new ObjectId(recordId),
            tenant_id: tenantId,
            deleted_at: null
        });

        if (!record) {
            return reply.status(404).send({ error: 'Record not found' });
        }

        // Check if already favorited
        const existing = await favorites.findOne({
            user_id: userId,
            record_id: new ObjectId(recordId),
            tenant_id: tenantId
        });

        if (existing) {
            return reply.status(400).send({ error: 'Already in favorites' });
        }

        await favorites.insertOne({
            user_id: userId,
            record_id: new ObjectId(recordId),
            tenant_id: tenantId,
            created_at: new Date()
        });

        return reply.status(201).send({
            message: 'Added to favorites',
            isFavorite: true
        });
    });

    // Remove from favorites
    fastify.delete('/favorites/:recordId', {
        onRequest: [fastify.authenticate]
    }, async(request, reply) => {
        const { recordId } = request.params;
        const userId = new ObjectId(request.user._id);
        const tenantId = request.user.tenantId;

        const result = await favorites.deleteOne({
            user_id: userId,
            record_id: new ObjectId(recordId),
            tenant_id: tenantId
        });

        if (result.deletedCount === 0) {
            return reply.status(404).send({ error: 'Favorite not found' });
        }

        return {
            message: 'Removed from favorites',
            isFavorite: false
        };
    });

    // Toggle favorite (convenience endpoint)
    fastify.post('/favorites/:recordId/toggle', {
        onRequest: [fastify.authenticate]
    }, async(request, reply) => {
        const { recordId } = request.params;
        const userId = new ObjectId(request.user._id);
        const tenantId = request.user.tenantId;

        // Verify record exists and belongs to tenant
        const record = await records.findOne({
            _id: new ObjectId(recordId),
            tenant_id: tenantId,
            deleted_at: null
        });

        if (!record) {
            return reply.status(404).send({ error: 'Record not found' });
        }

        // Check if favorited
        const existing = await favorites.findOne({
            user_id: userId,
            record_id: new ObjectId(recordId),
            tenant_id: tenantId
        });

        if (existing) {
            await favorites.deleteOne({ _id: existing._id });
            return { message: 'Removed from favorites', isFavorite: false };
        } else {
            await favorites.insertOne({
                user_id: userId,
                record_id: new ObjectId(recordId),
                tenant_id: tenantId,
                created_at: new Date()
            });
            return { message: 'Added to favorites', isFavorite: true };
        }
    });

    // Get favorite records IDs (for quick checks in lists)
    fastify.get('/favorites/ids', {
        onRequest: [fastify.authenticate]
    }, async(request, reply) => {
        const userId = new ObjectId(request.user._id);
        const tenantId = request.user.tenantId;

        const favoriteIds = await favorites.find({
            user_id: userId,
            tenant_id: tenantId
        }).project({ record_id: 1 }).toArray();

        return {
            ids: favoriteIds.map(f => f.record_id.toString())
        };
    });
}