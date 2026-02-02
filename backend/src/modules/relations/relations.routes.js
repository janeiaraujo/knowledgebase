import { ObjectId } from 'mongodb';

export default async function relationsRoutes(fastify, options) {
    const db = fastify.mongo.db;
    const relations = db.collection('record_relations');
    const records = db.collection('records');

    // Relation types
    const RELATION_TYPES = {
        RELATED: 'related', // General relation
        REFERENCES: 'references', // One KB references another
        PARENT_OF: 'parent_of', // Hierarchical relation
        CHILD_OF: 'child_of', // Hierarchical relation (reverse)
        SUPERSEDES: 'supersedes', // This KB replaces another
        SUPERSEDED_BY: 'superseded_by' // This KB was replaced (reverse)
    };

    // Get reverse relation type
    const getReverseType = (type) => {
        const reverseMap = {
            [RELATION_TYPES.RELATED]: RELATION_TYPES.RELATED,
            [RELATION_TYPES.REFERENCES]: null, // One-way
            [RELATION_TYPES.PARENT_OF]: RELATION_TYPES.CHILD_OF,
            [RELATION_TYPES.CHILD_OF]: RELATION_TYPES.PARENT_OF,
            [RELATION_TYPES.SUPERSEDES]: RELATION_TYPES.SUPERSEDED_BY,
            [RELATION_TYPES.SUPERSEDED_BY]: RELATION_TYPES.SUPERSEDES
        };
        return reverseMap[type];
    };

    // Get relations for a record
    fastify.get('/records/:recordId/relations', {
        onRequest: [fastify.authenticate]
    }, async(request, reply) => {
        const { recordId } = request.params;
        const tenantId = request.user.tenantId;

        // Get relations where this record is source or target
        const relationsList = await relations.aggregate([{
                $match: {
                    tenant_id: tenantId,
                    $or: [
                        { source_id: new ObjectId(recordId) },
                        { target_id: new ObjectId(recordId) }
                    ],
                    deleted_at: null
                }
            },
            {
                $lookup: {
                    from: 'records',
                    localField: 'source_id',
                    foreignField: '_id',
                    as: 'source'
                }
            },
            {
                $lookup: {
                    from: 'records',
                    localField: 'target_id',
                    foreignField: '_id',
                    as: 'target'
                }
            },
            { $unwind: '$source' },
            { $unwind: '$target' },
            {
                $project: {
                    _id: 1,
                    relation_type: 1,
                    created_at: 1,
                    'source._id': 1,
                    'source.title': 1,
                    'source.status': 1,
                    'target._id': 1,
                    'target.title': 1,
                    'target.status': 1
                }
            }
        ]).toArray();

        // Organize relations by direction
        const outgoing = [];
        const incoming = [];

        relationsList.forEach(rel => {
            if (rel.source._id.toString() === recordId) {
                outgoing.push({
                    _id: rel._id,
                    type: rel.relation_type,
                    record: rel.target,
                    created_at: rel.created_at
                });
            } else {
                // For incoming, use reverse type for display
                const reverseType = getReverseType(rel.relation_type) || rel.relation_type;
                incoming.push({
                    _id: rel._id,
                    type: reverseType,
                    originalType: rel.relation_type,
                    record: rel.source,
                    created_at: rel.created_at
                });
            }
        });

        return {
            outgoing,
            incoming,
            relationTypes: Object.values(RELATION_TYPES)
        };
    });

    // Create a relation
    fastify.post('/records/:recordId/relations', {
        onRequest: [fastify.authenticate],
        schema: {
            body: {
                type: 'object',
                required: ['targetId', 'type'],
                properties: {
                    targetId: { type: 'string' },
                    type: {
                        type: 'string',
                        enum: Object.values(RELATION_TYPES)
                    }
                }
            }
        }
    }, async(request, reply) => {
        const { recordId } = request.params;
        const { targetId, type } = request.body;
        const tenantId = request.user.tenantId;
        const userId = new ObjectId(request.user._id);

        // Can't relate to self
        if (recordId === targetId) {
            return reply.status(400).send({ error: 'Cannot relate a record to itself' });
        }

        // Verify both records exist and belong to tenant
        const [sourceRecord, targetRecord] = await Promise.all([
            records.findOne({ _id: new ObjectId(recordId), tenant_id: tenantId, deleted_at: null }),
            records.findOne({ _id: new ObjectId(targetId), tenant_id: tenantId, deleted_at: null })
        ]);

        if (!sourceRecord) {
            return reply.status(404).send({ error: 'Source record not found' });
        }
        if (!targetRecord) {
            return reply.status(404).send({ error: 'Target record not found' });
        }

        // Check if relation already exists
        const existing = await relations.findOne({
            tenant_id: tenantId,
            source_id: new ObjectId(recordId),
            target_id: new ObjectId(targetId),
            relation_type: type,
            deleted_at: null
        });

        if (existing) {
            return reply.status(400).send({ error: 'Relation already exists' });
        }

        const newRelation = {
            tenant_id: tenantId,
            source_id: new ObjectId(recordId),
            target_id: new ObjectId(targetId),
            relation_type: type,
            created_by: userId,
            created_at: new Date(),
            deleted_at: null
        };

        const result = await relations.insertOne(newRelation);

        // Prepare response with record details
        const createdRelation = {
            _id: result.insertedId,
            type,
            record: {
                _id: targetRecord._id,
                title: targetRecord.title,
                status: targetRecord.status
            },
            created_at: newRelation.created_at
        };

        return reply.status(201).send({
            relation: createdRelation,
            message: 'Relation created successfully'
        });
    });

    // Delete a relation
    fastify.delete('/relations/:relationId', {
        onRequest: [fastify.authenticate]
    }, async(request, reply) => {
        const { relationId } = request.params;
        const tenantId = request.user.tenantId;
        const userId = new ObjectId(request.user._id);

        const relation = await relations.findOne({
            _id: new ObjectId(relationId),
            tenant_id: tenantId,
            deleted_at: null
        });

        if (!relation) {
            return reply.status(404).send({ error: 'Relation not found' });
        }

        await relations.updateOne({ _id: new ObjectId(relationId) }, {
            $set: {
                deleted_at: new Date(),
                deleted_by: userId
            }
        });

        return { message: 'Relation deleted successfully' };
    });

    // Search records for relating (excludes current record and already related)
    fastify.get('/records/:recordId/relations/search', {
        onRequest: [fastify.authenticate]
    }, async(request, reply) => {
        const { recordId } = request.params;
        const { q, limit = 10 } = request.query;
        const tenantId = request.user.tenantId;

        if (!q || q.length < 2) {
            return { records: [] };
        }

        // Get existing related record IDs
        const existingRelations = await relations.find({
            tenant_id: tenantId,
            $or: [
                { source_id: new ObjectId(recordId) },
                { target_id: new ObjectId(recordId) }
            ],
            deleted_at: null
        }).toArray();

        const relatedIds = new Set();
        relatedIds.add(recordId); // Exclude self
        existingRelations.forEach(rel => {
            relatedIds.add(rel.source_id.toString());
            relatedIds.add(rel.target_id.toString());
        });

        const excludeIds = Array.from(relatedIds).map(id => new ObjectId(id));

        // Search for records
        const searchResults = await records.find({
                tenant_id: tenantId,
                _id: { $nin: excludeIds },
                deleted_at: null,
                $or: [
                    { title: { $regex: q, $options: 'i' } },
                    { content_md: { $regex: q, $options: 'i' } }
                ]
            })
            .project({ _id: 1, title: 1, status: 1 })
            .limit(parseInt(limit))
            .toArray();

        return { records: searchResults };
    });

    // Get relation type labels (for UI)
    fastify.get('/relations/types', {
        onRequest: [fastify.authenticate]
    }, async(request, reply) => {
        const types = [
            { value: RELATION_TYPES.RELATED, label: 'Relacionado', icon: 'bi-link-45deg' },
            { value: RELATION_TYPES.REFERENCES, label: 'Referencia', icon: 'bi-arrow-right' },
            { value: RELATION_TYPES.PARENT_OF, label: 'Pai de', icon: 'bi-diagram-2' },
            { value: RELATION_TYPES.CHILD_OF, label: 'Filho de', icon: 'bi-diagram-3' },
            { value: RELATION_TYPES.SUPERSEDES, label: 'Substitui', icon: 'bi-arrow-up-circle' },
            { value: RELATION_TYPES.SUPERSEDED_BY, label: 'Substituído por', icon: 'bi-arrow-down-circle' }
        ];

        return { types };
    });
}