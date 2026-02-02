import { ObjectId } from 'mongodb';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { toObjectId } from '../../utils/mongodb.js';
import { tenantMiddleware } from '../../middlewares/tenant.middleware.js';
import { requirePermission } from '../../middlewares/rbac.middleware.js';
import { filterKBsByAccess } from '../../middlewares/kbAccess.middleware.js';

export default async function kbRoutes(fastify, options) {

    const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Search KB (textual + semantic)
    fastify.get('/search', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async(request, reply) => {
        const db = fastify.db();
        const {
            q,
            limit = 20,
            page = 1,
            status,
            category_id,
            tags,
            date_from,
            date_to,
            sort_by = 'relevance'
        } = request.query;

        if (!q) {
            return reply.status(400).send({ error: 'Query parameter required' });
        }

        const accessFilter = await filterKBsByAccess(
            db,
            request.tenantId,
            request.userId,
            request.userRole
        );

        const trimmed = String(q).trim();
        const safe = escapeRegExp(trimmed);

        const filter = {
            ...accessFilter,
            $or: [
                { title: { $regex: safe, $options: 'i' } },
                { content_md: { $regex: safe, $options: 'i' } }
            ]
        };

        // Apply filters
        if (status) {
            filter.status = status;
        }

        if (category_id) {
            filter.category_id = toObjectId(category_id);
        }

        if (tags) {
            const tagIds = tags.split(',').map(id => toObjectId(id)).filter(Boolean);
            if (tagIds.length > 0) {
                filter.tags = { $in: tagIds };
            }
        }

        if (date_from || date_to) {
            filter.created_at = {};
            if (date_from) {
                filter.created_at.$gte = new Date(date_from);
            }
            if (date_to) {
                filter.created_at.$lte = new Date(date_to);
            }
        }

        // Determine sort order
        let sortOption = { updated_at: -1 };
        switch (sort_by) {
            case 'date_desc':
                sortOption = { created_at: -1 };
                break;
            case 'date_asc':
                sortOption = { created_at: 1 };
                break;
            case 'title':
                sortOption = { title: 1 };
                break;
            case 'views':
                sortOption = { views: -1 };
                break;
            default:
                sortOption = { updated_at: -1 };
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Get total count
        const total = await db.collection('records').countDocuments(filter);

        const textResults = await db.collection('records')
            .aggregate([
                { $match: filter },
                { $sort: sortOption },
                { $skip: skip },
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
                },
                // Lookup creator
                {
                    $lookup: {
                        from: 'users',
                        localField: 'created_by',
                        foreignField: '_id',
                        as: 'creator_info'
                    }
                },
                {
                    $unwind: {
                        path: '$creator_info',
                        preserveNullAndEmptyArrays: true
                    }
                },
                {
                    $project: {
                        'creator_info.password_hash': 0
                    }
                }
            ])
            .toArray();

        // TODO: Semantic search using embeddings (implemented in AI module)

        return {
            results: textResults,
            total,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(total / parseInt(limit))
        };
    });

    // Quick capture (for incident response)
    fastify.post('/capture', {
        preHandler: [authMiddleware, tenantMiddleware, requirePermission('kb:create')]
    }, async(request, reply) => {
        const db = fastify.db();
        const { title, content, incident_id } = request.body;

        const record = {
            tenant_id: request.tenantId,
            database_id: null, // Will be categorized later
            title: title || `Quick Capture - ${new Date().toISOString()}`,
            content_md: content,
            properties: {},
            status: 'captured',
            version: 1,
            created_by: request.currentUser._id,
            created_at: new Date(),
            updated_at: new Date(),
            incident_id: incident_id || null
        };

        const result = await db.collection('records').insertOne(record);

        return { success: true, recordId: result.insertedId };
    });

    // Get related KBs - Enhanced with semantic similarity
    fastify.get('/:recordId/related', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async(request, reply) => {
        const db = fastify.db();
        const { recordId } = request.params;
        const { limit = 6, include_semantic = 'true' } = request.query;

        const record = await db.collection('records').findOne({
            _id: new ObjectId(recordId),
            tenant_id: request.tenantId
        });

        if (!record) {
            return reply.status(404).send({ error: 'Record not found' });
        }

        const results = {
            by_category: [],
            by_tags: [],
            by_semantic: [],
            combined: []
        };

        const baseFilter = {
            tenant_id: request.tenantId,
            _id: { $ne: new ObjectId(recordId) },
            status: { $in: ['approved', 'published'] }
        };

        // 1. Related by category
        if (record.category_id) {
            const byCategory = await db.collection('records')
                .aggregate([{
                        $match: {
                            ...baseFilter,
                            category_id: record.category_id
                        }
                    },
                    { $limit: parseInt(limit) },
                    {
                        $lookup: {
                            from: 'categories',
                            localField: 'category_id',
                            foreignField: '_id',
                            as: 'category_info'
                        }
                    },
                    {
                        $lookup: {
                            from: 'tags',
                            localField: 'tags',
                            foreignField: '_id',
                            as: 'tags_info'
                        }
                    },
                    {
                        $project: {
                            _id: 1,
                            title: 1,
                            status: 1,
                            views: 1,
                            created_at: 1,
                            category_info: { $arrayElemAt: ['$category_info', 0] },
                            tags_info: 1
                        }
                    }
                ])
                .toArray();

            results.by_category = byCategory.map(r => ({...r, relation_type: 'category' }));
        }

        // 2. Related by tags
        if (record.tags && record.tags.length > 0) {
            const byTags = await db.collection('records')
                .aggregate([{
                        $match: {
                            ...baseFilter,
                            tags: { $in: record.tags }
                        }
                    },
                    {
                        $addFields: {
                            matching_tags_count: {
                                $size: { $setIntersection: ['$tags', record.tags] }
                            }
                        }
                    },
                    { $sort: { matching_tags_count: -1 } },
                    { $limit: parseInt(limit) },
                    {
                        $lookup: {
                            from: 'categories',
                            localField: 'category_id',
                            foreignField: '_id',
                            as: 'category_info'
                        }
                    },
                    {
                        $lookup: {
                            from: 'tags',
                            localField: 'tags',
                            foreignField: '_id',
                            as: 'tags_info'
                        }
                    },
                    {
                        $project: {
                            _id: 1,
                            title: 1,
                            status: 1,
                            views: 1,
                            created_at: 1,
                            matching_tags_count: 1,
                            category_info: { $arrayElemAt: ['$category_info', 0] },
                            tags_info: 1
                        }
                    }
                ])
                .toArray();

            results.by_tags = byTags.map(r => ({...r, relation_type: 'tags' }));
        }

        // 3. Semantic similarity (if enabled and embeddings exist)
        if (include_semantic === 'true') {
            try {
                // Check if current record has embedding
                const currentEmbedding = await db.collection('ai_embeddings').findOne({
                    record_id: new ObjectId(recordId),
                    tenant_id: request.tenantId
                });

                if (currentEmbedding ?.embedding) {
                    // Find similar records using vector similarity
                    const similarRecords = await db.collection('ai_embeddings')
                        .aggregate([{
                                $match: {
                                    tenant_id: request.tenantId,
                                    record_id: { $ne: new ObjectId(recordId) }
                                }
                            },
                            {
                                $addFields: {
                                    similarity: {
                                        $reduce: {
                                            input: { $range: [0, { $size: '$embedding' }] },
                                            initialValue: 0,
                                            in: {
                                                $add: [
                                                    '$$value',
                                                    {
                                                        $multiply: [
                                                            { $arrayElemAt: ['$embedding', '$$this'] },
                                                            { $arrayElemAt: [currentEmbedding.embedding, '$$this'] }
                                                        ]
                                                    }
                                                ]
                                            }
                                        }
                                    }
                                }
                            },
                            { $sort: { similarity: -1 } },
                            { $limit: parseInt(limit) * 2 }, // Get more to filter
                            {
                                $lookup: {
                                    from: 'records',
                                    localField: 'record_id',
                                    foreignField: '_id',
                                    as: 'record'
                                }
                            },
                            { $unwind: '$record' },
                            {
                                $match: {
                                    'record.status': { $in: ['approved', 'published'] }
                                }
                            },
                            { $limit: parseInt(limit) },
                            {
                                $lookup: {
                                    from: 'categories',
                                    localField: 'record.category_id',
                                    foreignField: '_id',
                                    as: 'category_info'
                                }
                            },
                            {
                                $lookup: {
                                    from: 'tags',
                                    localField: 'record.tags',
                                    foreignField: '_id',
                                    as: 'tags_info'
                                }
                            },
                            {
                                $project: {
                                    _id: '$record._id',
                                    title: '$record.title',
                                    status: '$record.status',
                                    views: '$record.views',
                                    created_at: '$record.created_at',
                                    similarity: 1,
                                    category_info: { $arrayElemAt: ['$category_info', 0] },
                                    tags_info: 1
                                }
                            }
                        ])
                        .toArray();

                    results.by_semantic = similarRecords
                        .filter(r => r.similarity > 0.7) // Only high similarity
                        .map(r => ({
                            ...r,
                            relation_type: 'semantic',
                            similarity_score: Math.round(r.similarity * 100) / 100
                        }));
                }
            } catch (err) {
                console.error('Semantic search error:', err);
                // Continue without semantic results
            }
        }

        // 4. Combine and deduplicate results
        const seenIds = new Set();
        const combined = [];

        // Priority: semantic > tags > category
        for (const item of[...results.by_semantic, ...results.by_tags, ...results.by_category]) {
            const idStr = item._id.toString();
            if (!seenIds.has(idStr)) {
                seenIds.add(idStr);
                combined.push(item);
                if (combined.length >= parseInt(limit)) break;
            }
        }

        results.combined = combined;

        return {
            related: results.combined,
            breakdown: {
                by_category: results.by_category.length,
                by_tags: results.by_tags.length,
                by_semantic: results.by_semantic.length
            }
        };
    });

    // Generate embedding for a record (for semantic search)
    fastify.post('/:recordId/generate-embedding', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async(request, reply) => {
        const db = fastify.db();
        const { recordId } = request.params;

        const record = await db.collection('records').findOne({
            _id: new ObjectId(recordId),
            tenant_id: request.tenantId
        });

        if (!record) {
            return reply.status(404).send({ error: 'Record not found' });
        }

        // Get OpenAI API key from settings
        const settings = await db.collection('settings').findOne({ tenant_id: request.tenantId });
        const apiKey = settings ?.openai_api_key || process.env.OPENAI_API_KEY;

        if (!apiKey) {
            return reply.status(400).send({ error: 'OpenAI API key not configured' });
        }

        try {
            // Prepare text for embedding
            const textToEmbed = `${record.title}\n\n${record.content_md || record.content || ''}`.slice(0, 8000);

            const response = await fetch('https://api.openai.com/v1/embeddings', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'text-embedding-3-small',
                    input: textToEmbed
                })
            });

            if (!response.ok) {
                throw new Error('OpenAI API error');
            }

            const data = await response.json();
            const embedding = data.data[0].embedding;

            // Save or update embedding
            await db.collection('ai_embeddings').updateOne({
                record_id: new ObjectId(recordId),
                tenant_id: request.tenantId
            }, {
                $set: {
                    embedding,
                    model: 'text-embedding-3-small',
                    updated_at: new Date()
                },
                $setOnInsert: {
                    created_at: new Date()
                }
            }, { upsert: true });

            return { success: true, message: 'Embedding generated successfully' };
        } catch (error) {
            console.error('Embedding generation error:', error);
            return reply.status(500).send({ error: 'Failed to generate embedding' });
        }
    });
}