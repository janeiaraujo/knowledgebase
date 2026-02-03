/**
 * Smart Search & KB Request Module
 * 
 * Features:
 * - Combined text + semantic search
 * - Problem-based search (finds similar issues)
 * - KB request queue when no solution found
 * - AI-enhanced context improvement
 */

import { ObjectId } from 'mongodb';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { tenantMiddleware } from '../../middlewares/tenant.middleware.js';

// Lazy load OpenAI
let openai;
async function getOpenAI() {
    if (!openai) {
        const OpenAI = (await import('openai')).default;
        openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }
    return openai;
}

export default async function smartSearchRoutes(fastify, options) {
    const db = () => fastify.db();
    
    const toObjectId = (id) => {
        try {
            return new ObjectId(id);
        } catch {
            return null;
        }
    };

    // ==================== SMART SEARCH ====================

    /**
     * Intelligent search combining text, semantic, and problem matching
     */
    fastify.post('/search', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async (request, reply) => {
        const { 
            query, 
            search_type = 'smart', // 'text', 'semantic', 'problem', 'smart'
            include_draft = false,
            limit = 20,
            min_similarity = 0.35
        } = request.body;

        if (!query || query.trim().length < 3) {
            return reply.status(400).send({ error: 'Query deve ter pelo menos 3 caracteres' });
        }

        const results = {
            exact_matches: [],
            semantic_matches: [],
            problem_matches: [],
            combined: [],
            suggestions: [],
            stats: {
                total_found: 0,
                search_methods_used: [],
                query_enhanced: false
            }
        };

        const statusFilter = include_draft 
            ? { $in: ['draft', 'approved', 'published'] }
            : { $in: ['approved', 'published'] };

        try {
            // 1. TEXT SEARCH (always run for exact matches)
            if (['text', 'smart'].includes(search_type)) {
                results.stats.search_methods_used.push('text');
                const textResults = await performTextSearch(
                    db(), 
                    request.tenantId, 
                    query, 
                    statusFilter, 
                    limit
                );
                results.exact_matches = textResults;
            }

            // 2. SEMANTIC SEARCH (AI-powered similarity)
            if (['semantic', 'smart', 'problem'].includes(search_type)) {
                results.stats.search_methods_used.push('semantic');
                const semanticResults = await performSemanticSearch(
                    db(),
                    request.tenantId,
                    query,
                    statusFilter,
                    limit,
                    min_similarity
                );
                results.semantic_matches = semanticResults.results;
                
                if (semanticResults.enhanced_query) {
                    results.stats.query_enhanced = true;
                    results.stats.enhanced_query = semanticResults.enhanced_query;
                }
            }

            // 3. PROBLEM MATCHING (for incident-like queries)
            if (['problem', 'smart'].includes(search_type)) {
                const isProblemQuery = await detectProblemQuery(query);
                if (isProblemQuery) {
                    results.stats.search_methods_used.push('problem');
                    const problemResults = await performProblemSearch(
                        db(),
                        request.tenantId,
                        query,
                        statusFilter,
                        limit
                    );
                    results.problem_matches = problemResults;
                }
            }

            // 4. COMBINE AND DEDUPLICATE
            const seenIds = new Set();
            const combined = [];

            // Priority: exact > problem > semantic
            const allResults = [
                ...results.exact_matches.map(r => ({ ...r, match_type: 'exact' })),
                ...results.problem_matches.map(r => ({ ...r, match_type: 'problem' })),
                ...results.semantic_matches.map(r => ({ ...r, match_type: 'semantic' }))
            ];

            for (const item of allResults) {
                const idStr = item._id.toString();
                if (!seenIds.has(idStr)) {
                    seenIds.add(idStr);
                    combined.push(item);
                }
            }

            // Sort by relevance score
            combined.sort((a, b) => {
                const scoreA = calculateRelevanceScore(a, query);
                const scoreB = calculateRelevanceScore(b, query);
                return scoreB - scoreA;
            });

            results.combined = combined.slice(0, limit);
            results.stats.total_found = combined.length;

            // 5. GENERATE SUGGESTIONS if few results
            if (results.combined.length < 3) {
                results.suggestions = await generateSearchSuggestions(
                    db(),
                    request.tenantId,
                    query
                );
            }

            return {
                success: true,
                results: results.combined,
                breakdown: {
                    exact_matches: results.exact_matches.length,
                    semantic_matches: results.semantic_matches.length,
                    problem_matches: results.problem_matches.length
                },
                stats: results.stats,
                suggestions: results.suggestions,
                no_results: results.combined.length === 0
            };

        } catch (error) {
            fastify.log.error('Smart search error:', error);
            return reply.status(500).send({ error: 'Erro na busca' });
        }
    });

    // ==================== KB REQUEST SYSTEM ====================

    /**
     * Request creation of a new KB article
     * Used when user can't find what they're looking for
     */
    fastify.post('/kb-requests', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async (request, reply) => {
        const { 
            title,
            problem_description,
            search_query,
            urgency = 'normal', // 'low', 'normal', 'high', 'critical'
            context,
            tags = []
        } = request.body;

        if (!problem_description || problem_description.trim().length < 20) {
            return reply.status(400).send({ 
                error: 'Descrição do problema deve ter pelo menos 20 caracteres' 
            });
        }

        try {
            // Use AI to enhance the request context
            let enhanced = null;
            try {
                enhanced = await enhanceKBRequest(problem_description, context);
            } catch (err) {
                fastify.log.warn('Failed to enhance KB request:', err);
            }

            const kbRequest = {
                tenant_id: request.tenantId,
                requested_by: request.currentUser._id,
                requester_name: request.currentUser.name,
                requester_email: request.currentUser.email,
                title: title || enhanced?.suggested_title || 'Nova solicitação de KB',
                original_description: problem_description,
                enhanced_description: enhanced?.enhanced_description || null,
                suggested_title: enhanced?.suggested_title || null,
                suggested_tags: enhanced?.suggested_tags || tags,
                suggested_category: enhanced?.suggested_category || null,
                key_points: enhanced?.key_points || [],
                search_query: search_query || null,
                urgency,
                context: context || null,
                status: 'pending', // pending, in_progress, completed, rejected
                assigned_to: null,
                assigned_at: null,
                completed_kb_id: null,
                rejection_reason: null,
                created_at: new Date(),
                updated_at: new Date()
            };

            const result = await db().collection('kb_requests').insertOne(kbRequest);

            // Notify admins/senior analysts
            await notifyKBRequestCreated(db(), request.tenantId, {
                ...kbRequest,
                _id: result.insertedId
            });

            return {
                success: true,
                request_id: result.insertedId,
                message: 'Solicitação criada com sucesso. Um analista sênior irá avaliar.',
                enhanced: enhanced ? {
                    title: enhanced.suggested_title,
                    tags: enhanced.suggested_tags,
                    category: enhanced.suggested_category
                } : null
            };

        } catch (error) {
            fastify.log.error('KB request creation error:', error);
            return reply.status(500).send({ error: 'Erro ao criar solicitação' });
        }
    });

    /**
     * List KB requests (for senior analysts/admins)
     */
    fastify.get('/kb-requests', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async (request, reply) => {
        const { 
            status, 
            urgency,
            assigned_to,
            page = 1, 
            limit = 20,
            sort = 'created_at',
            order = 'desc'
        } = request.query;

        // Only allow senior roles to see all requests
        const isSenior = ['admin', 'owner', 'senior'].includes(request.currentUser.role);
        
        const filter = { tenant_id: request.tenantId };
        
        if (!isSenior) {
            // Regular users can only see their own requests
            filter.requested_by = request.currentUser._id;
        }

        if (status) filter.status = status;
        if (urgency) filter.urgency = urgency;
        if (assigned_to) filter.assigned_to = toObjectId(assigned_to);

        const sortOrder = order === 'asc' ? 1 : -1;
        const sortField = { [sort]: sortOrder };

        // Add urgency priority for pending requests
        if (!status || status === 'pending') {
            sortField['urgency_order'] = 1;
        }

        const pipeline = [
            { $match: filter },
            { $addFields: {
                urgency_order: {
                    $switch: {
                        branches: [
                            { case: { $eq: ['$urgency', 'critical'] }, then: 1 },
                            { case: { $eq: ['$urgency', 'high'] }, then: 2 },
                            { case: { $eq: ['$urgency', 'normal'] }, then: 3 },
                            { case: { $eq: ['$urgency', 'low'] }, then: 4 }
                        ],
                        default: 5
                    }
                }
            }},
            { $sort: sortField },
            { $skip: (parseInt(page) - 1) * parseInt(limit) },
            { $limit: parseInt(limit) },
            { $lookup: {
                from: 'users',
                localField: 'assigned_to',
                foreignField: '_id',
                as: 'assignee'
            }},
            { $unwind: { path: '$assignee', preserveNullAndEmptyArrays: true } },
            { $project: {
                'assignee.password': 0,
                'assignee.magic_link_token': 0
            }}
        ];

        const [requests, totalResult] = await Promise.all([
            db().collection('kb_requests').aggregate(pipeline).toArray(),
            db().collection('kb_requests').countDocuments(filter)
        ]);

        // Get stats
        const stats = await db().collection('kb_requests').aggregate([
            { $match: { tenant_id: request.tenantId } },
            { $group: {
                _id: '$status',
                count: { $sum: 1 }
            }}
        ]).toArray();

        return {
            requests,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: totalResult,
                pages: Math.ceil(totalResult / parseInt(limit))
            },
            stats: stats.reduce((acc, s) => {
                acc[s._id] = s.count;
                return acc;
            }, {})
        };
    });

    /**
     * Get a single KB request
     */
    fastify.get('/kb-requests/:requestId', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async (request, reply) => {
        const { requestId } = request.params;
        const objectId = toObjectId(requestId);

        if (!objectId) {
            return reply.status(400).send({ error: 'ID inválido' });
        }

        const kbRequest = await db().collection('kb_requests').findOne({
            _id: objectId,
            tenant_id: request.tenantId
        });

        if (!kbRequest) {
            return reply.status(404).send({ error: 'Solicitação não encontrada' });
        }

        // Get related searches (similar requests)
        const relatedRequests = await db().collection('kb_requests')
            .find({
                tenant_id: request.tenantId,
                _id: { $ne: objectId },
                status: { $in: ['pending', 'in_progress'] },
                $text: { $search: kbRequest.original_description }
            })
            .limit(5)
            .toArray();

        return {
            request: kbRequest,
            related_requests: relatedRequests
        };
    });

    /**
     * Update KB request status
     */
    fastify.put('/kb-requests/:requestId', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async (request, reply) => {
        const { requestId } = request.params;
        const { 
            status, 
            assigned_to, 
            rejection_reason,
            completed_kb_id,
            notes
        } = request.body;

        const objectId = toObjectId(requestId);

        if (!objectId) {
            return reply.status(400).send({ error: 'ID inválido' });
        }

        // Only senior roles can update requests
        if (!['admin', 'owner', 'senior'].includes(request.currentUser.role)) {
            return reply.status(403).send({ error: 'Acesso negado' });
        }

        const updateDoc = {
            updated_at: new Date()
        };

        if (status) {
            updateDoc.status = status;
            if (status === 'in_progress' && !updateDoc.assigned_to) {
                updateDoc.assigned_to = request.currentUser._id;
                updateDoc.assigned_at = new Date();
            }
        }
        if (assigned_to) {
            updateDoc.assigned_to = toObjectId(assigned_to);
            updateDoc.assigned_at = new Date();
        }
        if (rejection_reason) {
            updateDoc.rejection_reason = rejection_reason;
        }
        if (completed_kb_id) {
            updateDoc.completed_kb_id = toObjectId(completed_kb_id);
            updateDoc.completed_at = new Date();
        }
        if (notes) {
            updateDoc.notes = notes;
        }

        const result = await db().collection('kb_requests').findOneAndUpdate(
            { _id: objectId, tenant_id: request.tenantId },
            { $set: updateDoc },
            { returnDocument: 'after' }
        );

        if (!result) {
            return reply.status(404).send({ error: 'Solicitação não encontrada' });
        }

        // Notify requester of status change
        if (status && status !== 'pending') {
            await notifyKBRequestUpdated(db(), request.tenantId, result, status);
        }

        return { success: true, request: result };
    });

    /**
     * Assign request to self (quick action)
     */
    fastify.post('/kb-requests/:requestId/assign', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async (request, reply) => {
        const { requestId } = request.params;
        const objectId = toObjectId(requestId);

        if (!['admin', 'owner', 'senior'].includes(request.currentUser.role)) {
            return reply.status(403).send({ error: 'Acesso negado' });
        }

        const result = await db().collection('kb_requests').findOneAndUpdate(
            { 
                _id: objectId, 
                tenant_id: request.tenantId,
                status: 'pending'
            },
            { 
                $set: {
                    status: 'in_progress',
                    assigned_to: request.currentUser._id,
                    assigned_at: new Date(),
                    updated_at: new Date()
                }
            },
            { returnDocument: 'after' }
        );

        if (!result) {
            return reply.status(404).send({ 
                error: 'Solicitação não encontrada ou já em progresso' 
            });
        }

        return { success: true, request: result };
    });

    /**
     * Create KB from request (completes the request)
     */
    fastify.post('/kb-requests/:requestId/create-kb', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async (request, reply) => {
        const { requestId } = request.params;
        const { title, content, category_id, tags } = request.body;
        const objectId = toObjectId(requestId);

        if (!['admin', 'owner', 'senior', 'editor'].includes(request.currentUser.role)) {
            return reply.status(403).send({ error: 'Acesso negado' });
        }

        const kbRequest = await db().collection('kb_requests').findOne({
            _id: objectId,
            tenant_id: request.tenantId
        });

        if (!kbRequest) {
            return reply.status(404).send({ error: 'Solicitação não encontrada' });
        }

        // Create the KB
        const kb = {
            tenant_id: request.tenantId,
            title: title || kbRequest.suggested_title || kbRequest.title,
            content_md: content,
            status: 'draft',
            category_id: category_id ? toObjectId(category_id) : null,
            tags: tags || kbRequest.suggested_tags || [],
            created_by: request.currentUser._id,
            created_from_request: objectId,
            original_request: {
                description: kbRequest.original_description,
                requester: kbRequest.requester_name,
                requested_at: kbRequest.created_at
            },
            version: 1,
            created_at: new Date(),
            updated_at: new Date()
        };

        const kbResult = await db().collection('records').insertOne(kb);

        // Update the request
        await db().collection('kb_requests').updateOne(
            { _id: objectId },
            {
                $set: {
                    status: 'completed',
                    completed_kb_id: kbResult.insertedId,
                    completed_at: new Date(),
                    completed_by: request.currentUser._id,
                    updated_at: new Date()
                }
            }
        );

        // Notify requester
        await notifyKBRequestCompleted(db(), request.tenantId, kbRequest, kbResult.insertedId);

        return {
            success: true,
            kb_id: kbResult.insertedId,
            message: 'KB criado com sucesso a partir da solicitação'
        };
    });

    /**
     * Get KB request statistics
     */
    fastify.get('/kb-requests/stats', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async (request, reply) => {
        const { period = '30d' } = request.query;

        const now = new Date();
        let startDate;
        switch (period) {
            case '7d': startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); break;
            case '30d': startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); break;
            case '90d': startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000); break;
            default: startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        }

        const [byStatus, byUrgency, byDay, topRequesters, avgResolutionTime] = await Promise.all([
            // By status
            db().collection('kb_requests').aggregate([
                { $match: { tenant_id: request.tenantId } },
                { $group: { _id: '$status', count: { $sum: 1 } } }
            ]).toArray(),

            // By urgency
            db().collection('kb_requests').aggregate([
                { $match: { tenant_id: request.tenantId, created_at: { $gte: startDate } } },
                { $group: { _id: '$urgency', count: { $sum: 1 } } }
            ]).toArray(),

            // By day
            db().collection('kb_requests').aggregate([
                { $match: { tenant_id: request.tenantId, created_at: { $gte: startDate } } },
                { $group: {
                    _id: {
                        year: { $year: '$created_at' },
                        month: { $month: '$created_at' },
                        day: { $dayOfMonth: '$created_at' }
                    },
                    count: { $sum: 1 }
                }},
                { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
            ]).toArray(),

            // Top requesters
            db().collection('kb_requests').aggregate([
                { $match: { tenant_id: request.tenantId, created_at: { $gte: startDate } } },
                { $group: {
                    _id: '$requested_by',
                    name: { $first: '$requester_name' },
                    count: { $sum: 1 }
                }},
                { $sort: { count: -1 } },
                { $limit: 10 }
            ]).toArray(),

            // Average resolution time
            db().collection('kb_requests').aggregate([
                { $match: { 
                    tenant_id: request.tenantId, 
                    status: 'completed',
                    completed_at: { $exists: true }
                }},
                { $project: {
                    resolution_time: {
                        $divide: [
                            { $subtract: ['$completed_at', '$created_at'] },
                            1000 * 60 * 60 // Convert to hours
                        ]
                    }
                }},
                { $group: {
                    _id: null,
                    avg_hours: { $avg: '$resolution_time' }
                }}
            ]).toArray()
        ]);

        return {
            by_status: byStatus.reduce((acc, s) => { acc[s._id] = s.count; return acc; }, {}),
            by_urgency: byUrgency.reduce((acc, s) => { acc[s._id] = s.count; return acc; }, {}),
            by_day: byDay.map(d => ({
                date: `${d._id.year}-${String(d._id.month).padStart(2, '0')}-${String(d._id.day).padStart(2, '0')}`,
                count: d.count
            })),
            top_requesters: topRequesters,
            avg_resolution_hours: avgResolutionTime[0]?.avg_hours || null
        };
    });
}

// ==================== HELPER FUNCTIONS ====================

async function performTextSearch(db, tenantId, query, statusFilter, limit) {
    const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const safe = escapeRegExp(query.trim());

    return await db.collection('records')
        .find({
            tenant_id: tenantId,
            deleted_at: null,
            status: statusFilter,
            $or: [
                { title: { $regex: safe, $options: 'i' } },
                { content_md: { $regex: safe, $options: 'i' } }
            ]
        })
        .sort({ updated_at: -1 })
        .limit(parseInt(limit))
        .toArray();
}

async function performSemanticSearch(db, tenantId, query, statusFilter, limit, minSimilarity) {
    // Check if embeddings exist
    const embeddingsCount = await db.collection('ai_embeddings')
        .countDocuments({ tenant_id: tenantId });

    if (embeddingsCount === 0) {
        return { results: [], enhanced_query: null };
    }

    try {
        const openai = await getOpenAI();
        
        // Generate query embedding
        const response = await openai.embeddings.create({
            model: 'text-embedding-3-small',
            input: query
        });

        const queryEmbedding = response.data[0].embedding;

        // Find similar embeddings
        const allEmbeddings = await db.collection('ai_embeddings')
            .find({ tenant_id: tenantId })
            .toArray();

        const results = allEmbeddings
            .map(doc => ({
                record_id: doc.record_id,
                similarity: cosineSimilarity(queryEmbedding, doc.embedding)
            }))
            .filter(r => r.similarity >= minSimilarity)
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, parseInt(limit));

        if (results.length === 0) {
            return { results: [], enhanced_query: null };
        }

        // Get record details
        const recordIds = results.map(r => r.record_id);
        const records = await db.collection('records')
            .find({
                _id: { $in: recordIds },
                tenant_id: tenantId,
                deleted_at: null,
                status: statusFilter
            })
            .toArray();

        const enrichedResults = results
            .map(r => {
                const record = records.find(rec => rec._id.equals(r.record_id));
                if (!record) return null;
                return {
                    ...record,
                    similarity: r.similarity
                };
            })
            .filter(r => r !== null);

        return { results: enrichedResults, enhanced_query: null };

    } catch (error) {
        console.error('Semantic search error:', error);
        return { results: [], enhanced_query: null };
    }
}

async function performProblemSearch(db, tenantId, query, statusFilter, limit) {
    // Search for KBs that describe similar problems
    // Look in problem description, symptoms, error messages sections
    const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    // Extract key error patterns from query
    const errorPatterns = extractErrorPatterns(query);
    const keywords = extractKeywords(query);

    const searchConditions = [
        { content_md: { $regex: escapeRegExp(query.substring(0, 100)), $options: 'i' } }
    ];

    // Add error pattern conditions
    for (const pattern of errorPatterns) {
        searchConditions.push({ content_md: { $regex: escapeRegExp(pattern), $options: 'i' } });
    }

    // Add keyword conditions
    for (const keyword of keywords.slice(0, 5)) {
        if (keyword.length > 3) {
            searchConditions.push({ content_md: { $regex: escapeRegExp(keyword), $options: 'i' } });
        }
    }

    return await db.collection('records')
        .find({
            tenant_id: tenantId,
            deleted_at: null,
            status: statusFilter,
            $or: searchConditions
        })
        .sort({ updated_at: -1 })
        .limit(parseInt(limit))
        .toArray();
}

async function detectProblemQuery(query) {
    // Detect if query looks like a problem description
    const problemIndicators = [
        /error/i, /erro/i, /falha/i, /fail/i, /não funciona/i,
        /doesn't work/i, /problem/i, /issue/i, /bug/i,
        /exception/i, /exceção/i, /timeout/i, /conexão/i,
        /connection/i, /refused/i, /denied/i, /crash/i,
        /não consegue/i, /cannot/i, /can't/i, /won't/i
    ];

    return problemIndicators.some(pattern => pattern.test(query));
}

function extractErrorPatterns(text) {
    const patterns = [];
    
    // Common error patterns
    const errorRegexes = [
        /(?:error|erro|exception|exceção):\s*[^\n]+/gi,
        /(?:at\s+)?[\w.]+(?:Exception|Error):\s*[^\n]*/gi,
        /\[ERROR\][^\n]+/gi,
        /HTTP\s+\d{3}/gi,
        /status\s*(?:code)?:?\s*\d{3}/gi
    ];

    for (const regex of errorRegexes) {
        const matches = text.match(regex);
        if (matches) {
            patterns.push(...matches.slice(0, 3));
        }
    }

    return [...new Set(patterns)].slice(0, 5);
}

function extractKeywords(text) {
    // Remove common words and extract meaningful keywords
    const stopWords = new Set([
        'o', 'a', 'os', 'as', 'um', 'uma', 'de', 'da', 'do', 'em', 'no', 'na',
        'para', 'por', 'com', 'que', 'se', 'não', 'é', 'está', 'foi', 'são',
        'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
        'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
        'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare',
        'ought', 'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by',
        'from', 'as', 'into', 'through', 'during', 'before', 'after', 'above',
        'below', 'between', 'under', 'again', 'further', 'then', 'once'
    ]);

    const words = text
        .toLowerCase()
        .replace(/[^\w\sáàâãéèêíìîóòôõúùû]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 2 && !stopWords.has(word));

    return [...new Set(words)];
}

function calculateRelevanceScore(item, query) {
    let score = 0;

    // Base score from match type
    if (item.match_type === 'exact') score += 100;
    if (item.match_type === 'problem') score += 80;
    if (item.match_type === 'semantic') score += 60;

    // Add similarity score if available
    if (item.similarity) {
        score += item.similarity * 50;
    }

    // Boost if title contains query
    if (item.title && item.title.toLowerCase().includes(query.toLowerCase())) {
        score += 30;
    }

    // Boost published over approved
    if (item.status === 'published') score += 10;

    // Recent items get slight boost
    const ageInDays = (Date.now() - new Date(item.updated_at).getTime()) / (1000 * 60 * 60 * 24);
    if (ageInDays < 30) score += 5;
    if (ageInDays < 7) score += 5;

    return score;
}

async function generateSearchSuggestions(db, tenantId, query) {
    // Get related tags
    const keywords = extractKeywords(query);
    
    const suggestions = await db.collection('tags')
        .find({
            tenant_id: tenantId,
            name: { $regex: keywords.slice(0, 3).join('|'), $options: 'i' }
        })
        .limit(5)
        .toArray();

    // Get popular categories
    const categories = await db.collection('categories')
        .find({ tenant_id: tenantId, deleted_at: null })
        .limit(5)
        .toArray();

    return {
        tags: suggestions.map(t => t.name),
        categories: categories.map(c => ({ id: c._id, name: c.name })),
        tips: [
            'Tente usar termos mais específicos',
            'Verifique a ortografia',
            'Use palavras-chave do erro exato',
            'Tente buscar pelo nome do serviço ou tecnologia'
        ]
    };
}

async function enhanceKBRequest(description, context) {
    try {
        const openai = await getOpenAI();
        
        const completion = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: [
                {
                    role: 'system',
                    content: `Você é um especialista em documentação técnica. Analise a descrição do problema e:
1. Sugira um título claro e objetivo
2. Melhore a descrição com estrutura técnica
3. Extraia pontos-chave
4. Sugira tags relevantes
5. Sugira uma categoria

Responda em JSON com o formato:
{
  "suggested_title": "string",
  "enhanced_description": "string",
  "key_points": ["string"],
  "suggested_tags": ["string"],
  "suggested_category": "string"
}`
                },
                {
                    role: 'user',
                    content: `Descrição do problema: ${description}\n\nContexto adicional: ${context || 'Nenhum'}`
                }
            ],
            temperature: 0.5,
            response_format: { type: 'json_object' }
        });

        return JSON.parse(completion.choices[0].message.content);
    } catch (error) {
        console.error('Failed to enhance KB request:', error);
        return null;
    }
}

async function notifyKBRequestCreated(db, tenantId, kbRequest) {
    // Get admins and senior analysts
    const recipients = await db.collection('users')
        .find({
            tenant_id: tenantId,
            role: { $in: ['admin', 'owner', 'senior'] },
            active: true
        })
        .toArray();

    const notifications = recipients.map(user => ({
        tenant_id: tenantId,
        user_id: user._id,
        type: 'kb_request_created',
        title: 'Nova solicitação de KB',
        message: `${kbRequest.requester_name} solicitou um novo KB: ${kbRequest.title}`,
        data: {
            request_id: kbRequest._id,
            urgency: kbRequest.urgency
        },
        read: false,
        created_at: new Date()
    }));

    if (notifications.length > 0) {
        await db.collection('notifications').insertMany(notifications);
    }
}

async function notifyKBRequestUpdated(db, tenantId, kbRequest, newStatus) {
    const notification = {
        tenant_id: tenantId,
        user_id: kbRequest.requested_by,
        type: 'kb_request_updated',
        title: `Solicitação de KB ${newStatus === 'in_progress' ? 'em andamento' : newStatus === 'completed' ? 'concluída' : newStatus === 'rejected' ? 'rejeitada' : 'atualizada'}`,
        message: `Sua solicitação "${kbRequest.title}" foi atualizada para: ${newStatus}`,
        data: {
            request_id: kbRequest._id,
            status: newStatus
        },
        read: false,
        created_at: new Date()
    };

    await db.collection('notifications').insertOne(notification);
}

async function notifyKBRequestCompleted(db, tenantId, kbRequest, kbId) {
    const notification = {
        tenant_id: tenantId,
        user_id: kbRequest.requested_by,
        type: 'kb_request_completed',
        title: 'KB criado a partir da sua solicitação!',
        message: `O KB "${kbRequest.title}" foi criado com base na sua solicitação.`,
        data: {
            request_id: kbRequest._id,
            kb_id: kbId
        },
        read: false,
        created_at: new Date()
    };

    await db.collection('notifications').insertOne(notification);
}

function cosineSimilarity(vecA, vecB) {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
