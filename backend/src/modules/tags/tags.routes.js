import { ObjectId } from 'mongodb';

export default async function tagsRoutes(fastify, options) {
    const db = fastify.mongo.db;
    const tags = db.collection('tags');
    const categories = db.collection('categories');
    const records = db.collection('records');

    // ==================== TAGS ====================

    // List all tags for tenant
    fastify.get('/tags', {
        onRequest: [fastify.authenticate]
    }, async(request, reply) => {
        const tenantId = request.user.tenantId;
        const { search } = request.query;

        const query = {
            tenant_id: tenantId,
            deleted_at: null
        };

        if (search) {
            query.name = { $regex: search, $options: 'i' };
        }

        const tagList = await tags.aggregate([
            { $match: query },
            {
                $lookup: {
                    from: 'records',
                    let: { tagId: '$_id' },
                    pipeline: [{
                        $match: {
                            $expr: {
                                $and: [
                                    { $in: ['$$tagId', { $ifNull: ['$tags', []] }] },
                                    { $eq: ['$deleted_at', null] }
                                ]
                            }
                        }
                    }],
                    as: 'records'
                }
            },
            {
                $project: {
                    _id: 1,
                    name: 1,
                    color: 1,
                    description: 1,
                    created_at: 1,
                    record_count: { $size: '$records' }
                }
            },
            { $sort: { name: 1 } }
        ]).toArray();

        return { tags: tagList };
    });

    // Create tag
    fastify.post('/tags', {
        onRequest: [fastify.authenticate],
        schema: {
            body: {
                type: 'object',
                required: ['name'],
                properties: {
                    name: { type: 'string', minLength: 1, maxLength: 50 },
                    color: { type: 'string', pattern: '^#[0-9A-Fa-f]{6}$' },
                    description: { type: 'string', maxLength: 500 }
                }
            }
        }
    }, async(request, reply) => {
        const { name, color, description } = request.body;
        const tenantId = request.user.tenantId;

        // Check if tag already exists
        const existing = await tags.findOne({
            tenant_id: tenantId,
            name: { $regex: `^${name}$`, $options: 'i' },
            deleted_at: null
        });

        if (existing) {
            return reply.status(400).send({ error: 'Tag already exists' });
        }

        const newTag = {
            tenant_id: tenantId,
            name: name.trim(),
            color: color || '#6c757d',
            description: description || '',
            created_by: new ObjectId(request.user._id),
            created_at: new Date(),
            deleted_at: null
        };

        const result = await tags.insertOne(newTag);
        newTag._id = result.insertedId;

        return reply.status(201).send({ tag: newTag });
    });

    // Update tag
    fastify.patch('/tags/:tagId', {
        onRequest: [fastify.authenticate],
        schema: {
            body: {
                type: 'object',
                properties: {
                    name: { type: 'string', minLength: 1, maxLength: 50 },
                    color: { type: 'string', pattern: '^#[0-9A-Fa-f]{6}$' },
                    description: { type: 'string', maxLength: 500 }
                }
            }
        }
    }, async(request, reply) => {
        const { tagId } = request.params;
        const { name, color, description } = request.body;
        const tenantId = request.user.tenantId;

        const tag = await tags.findOne({
            _id: new ObjectId(tagId),
            tenant_id: tenantId,
            deleted_at: null
        });

        if (!tag) {
            return reply.status(404).send({ error: 'Tag not found' });
        }

        // Check for duplicate name
        if (name && name !== tag.name) {
            const existing = await tags.findOne({
                tenant_id: tenantId,
                name: { $regex: `^${name}$`, $options: 'i' },
                _id: { $ne: new ObjectId(tagId) },
                deleted_at: null
            });

            if (existing) {
                return reply.status(400).send({ error: 'Tag name already exists' });
            }
        }

        const update = {
            updated_at: new Date()
        };

        if (name) update.name = name.trim();
        if (color) update.color = color;
        if (description !== undefined) update.description = description;

        await tags.updateOne({ _id: new ObjectId(tagId) }, { $set: update });

        return { message: 'Tag updated successfully' };
    });

    // Delete tag
    fastify.delete('/tags/:tagId', {
        onRequest: [fastify.authenticate]
    }, async(request, reply) => {
        const { tagId } = request.params;
        const tenantId = request.user.tenantId;

        const tag = await tags.findOne({
            _id: new ObjectId(tagId),
            tenant_id: tenantId,
            deleted_at: null
        });

        if (!tag) {
            return reply.status(404).send({ error: 'Tag not found' });
        }

        // Soft delete
        await tags.updateOne({ _id: new ObjectId(tagId) }, {
            $set: {
                deleted_at: new Date(),
                deleted_by: new ObjectId(request.user._id)
            }
        });

        // Remove tag from all records
        await records.updateMany({ tenant_id: tenantId, tags: new ObjectId(tagId) }, { $pull: { tags: new ObjectId(tagId) } });

        return { message: 'Tag deleted successfully' };
    });

    // ==================== CATEGORIES ====================

    // List all categories for tenant (hierarchical)
    fastify.get('/categories', {
        onRequest: [fastify.authenticate]
    }, async(request, reply) => {
        const tenantId = request.user.tenantId;
        const { flat } = request.query;

        const categoryList = await categories.aggregate([{
                $match: {
                    tenant_id: tenantId,
                    deleted_at: null
                }
            },
            {
                $lookup: {
                    from: 'records',
                    let: { catId: '$_id' },
                    pipeline: [{
                        $match: {
                            $expr: {
                                $and: [
                                    { $eq: ['$category_id', '$$catId'] },
                                    { $eq: ['$deleted_at', null] }
                                ]
                            }
                        }
                    }],
                    as: 'records'
                }
            },
            {
                $project: {
                    _id: 1,
                    name: 1,
                    slug: 1,
                    description: 1,
                    icon: 1,
                    color: 1,
                    parent_id: 1,
                    order: 1,
                    created_at: 1,
                    record_count: { $size: '$records' }
                }
            },
            { $sort: { order: 1, name: 1 } }
        ]).toArray();

        // Return flat list if requested
        if (flat === 'true') {
            return { categories: categoryList };
        }

        // Build tree structure
        const categoriesMap = new Map();
        const rootCategories = [];

        categoryList.forEach(cat => {
            cat.children = [];
            categoriesMap.set(cat._id.toString(), cat);
        });

        categoryList.forEach(cat => {
            if (cat.parent_id) {
                const parent = categoriesMap.get(cat.parent_id.toString());
                if (parent) {
                    parent.children.push(cat);
                }
            } else {
                rootCategories.push(cat);
            }
        });

        return { categories: rootCategories };
    });

    // Create category
    fastify.post('/categories', {
        onRequest: [fastify.authenticate],
        schema: {
            body: {
                type: 'object',
                required: ['name'],
                properties: {
                    name: { type: 'string', minLength: 1, maxLength: 100 },
                    description: { type: 'string', maxLength: 500 },
                    icon: { type: 'string', maxLength: 50 },
                    color: { type: 'string', pattern: '^#[0-9A-Fa-f]{6}$' },
                    parent_id: { type: 'string' },
                    order: { type: 'number' }
                }
            }
        }
    }, async(request, reply) => {
        const { name, description, icon, color, parent_id, order } = request.body;
        const tenantId = request.user.tenantId;

        // Generate slug
        const slug = name.toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-');

        // Check if category exists with same slug
        const existing = await categories.findOne({
            tenant_id: tenantId,
            slug,
            deleted_at: null
        });

        if (existing) {
            return reply.status(400).send({ error: 'Category with this name already exists' });
        }

        // Verify parent exists if provided
        if (parent_id) {
            const parent = await categories.findOne({
                _id: new ObjectId(parent_id),
                tenant_id: tenantId,
                deleted_at: null
            });

            if (!parent) {
                return reply.status(400).send({ error: 'Parent category not found' });
            }
        }

        const newCategory = {
            tenant_id: tenantId,
            name: name.trim(),
            slug,
            description: description || '',
            icon: icon || 'bi-folder',
            color: color || '#6c757d',
            parent_id: parent_id ? new ObjectId(parent_id) : null,
            order: order || 0,
            created_by: new ObjectId(request.user._id),
            created_at: new Date(),
            deleted_at: null
        };

        const result = await categories.insertOne(newCategory);
        newCategory._id = result.insertedId;

        return reply.status(201).send({ category: newCategory });
    });

    // Update category
    fastify.patch('/categories/:categoryId', {
        onRequest: [fastify.authenticate],
        schema: {
            body: {
                type: 'object',
                properties: {
                    name: { type: 'string', minLength: 1, maxLength: 100 },
                    description: { type: 'string', maxLength: 500 },
                    icon: { type: 'string', maxLength: 50 },
                    color: { type: 'string', pattern: '^#[0-9A-Fa-f]{6}$' },
                    parent_id: { type: ['string', 'null'] },
                    order: { type: 'number' }
                }
            }
        }
    }, async(request, reply) => {
        const { categoryId } = request.params;
        const { name, description, icon, color, parent_id, order } = request.body;
        const tenantId = request.user.tenantId;

        const category = await categories.findOne({
            _id: new ObjectId(categoryId),
            tenant_id: tenantId,
            deleted_at: null
        });

        if (!category) {
            return reply.status(404).send({ error: 'Category not found' });
        }

        const update = {
            updated_at: new Date()
        };

        if (name) {
            update.name = name.trim();
            update.slug = name.toLowerCase()
                .replace(/[^a-z0-9\s-]/g, '')
                .replace(/\s+/g, '-');
        }
        if (description !== undefined) update.description = description;
        if (icon) update.icon = icon;
        if (color) update.color = color;
        if (order !== undefined) update.order = order;

        if (parent_id !== undefined) {
            // Prevent circular reference
            if (parent_id === categoryId) {
                return reply.status(400).send({ error: 'Category cannot be its own parent' });
            }
            update.parent_id = parent_id ? new ObjectId(parent_id) : null;
        }

        await categories.updateOne({ _id: new ObjectId(categoryId) }, { $set: update });

        return { message: 'Category updated successfully' };
    });

    // Delete category
    fastify.delete('/categories/:categoryId', {
        onRequest: [fastify.authenticate]
    }, async(request, reply) => {
        const { categoryId } = request.params;
        const tenantId = request.user.tenantId;

        const category = await categories.findOne({
            _id: new ObjectId(categoryId),
            tenant_id: tenantId,
            deleted_at: null
        });

        if (!category) {
            return reply.status(404).send({ error: 'Category not found' });
        }

        // Check for child categories
        const children = await categories.countDocuments({
            parent_id: new ObjectId(categoryId),
            deleted_at: null
        });

        if (children > 0) {
            return reply.status(400).send({ error: 'Cannot delete category with subcategories' });
        }

        // Check for records in category
        const recordCount = await records.countDocuments({
            category_id: new ObjectId(categoryId),
            deleted_at: null
        });

        if (recordCount > 0) {
            return reply.status(400).send({
                error: `Cannot delete category with ${recordCount} record(s). Move or delete records first.`
            });
        }

        // Soft delete
        await categories.updateOne({ _id: new ObjectId(categoryId) }, {
            $set: {
                deleted_at: new Date(),
                deleted_by: new ObjectId(request.user._id)
            }
        });

        return { message: 'Category deleted successfully' };
    });

    // ==================== RECORD TAGS ====================

    // Add tags to a record
    fastify.post('/records/:recordId/tags', {
        onRequest: [fastify.authenticate],
        schema: {
            body: {
                type: 'object',
                required: ['tagIds'],
                properties: {
                    tagIds: {
                        type: 'array',
                        items: { type: 'string' }
                    }
                }
            }
        }
    }, async(request, reply) => {
        const { recordId } = request.params;
        const { tagIds } = request.body;
        const tenantId = request.user.tenantId;

        const record = await records.findOne({
            _id: new ObjectId(recordId),
            tenant_id: tenantId,
            deleted_at: null
        });

        if (!record) {
            return reply.status(404).send({ error: 'Record not found' });
        }

        // Convert to ObjectIds and verify tags exist
        const tagObjectIds = tagIds.map(id => new ObjectId(id));
        const existingTags = await tags.find({
            _id: { $in: tagObjectIds },
            tenant_id: tenantId,
            deleted_at: null
        }).toArray();

        if (existingTags.length !== tagIds.length) {
            return reply.status(400).send({ error: 'Some tags not found' });
        }

        await records.updateOne({ _id: new ObjectId(recordId) }, { $set: { tags: tagObjectIds, updated_at: new Date() } });

        return { message: 'Tags updated successfully' };
    });

    // Set record category
    fastify.post('/records/:recordId/category', {
        onRequest: [fastify.authenticate],
        schema: {
            body: {
                type: 'object',
                properties: {
                    categoryId: { type: ['string', 'null'] }
                }
            }
        }
    }, async(request, reply) => {
        const { recordId } = request.params;
        const { categoryId } = request.body;
        const tenantId = request.user.tenantId;

        const record = await records.findOne({
            _id: new ObjectId(recordId),
            tenant_id: tenantId,
            deleted_at: null
        });

        if (!record) {
            return reply.status(404).send({ error: 'Record not found' });
        }

        if (categoryId) {
            const category = await categories.findOne({
                _id: new ObjectId(categoryId),
                tenant_id: tenantId,
                deleted_at: null
            });

            if (!category) {
                return reply.status(400).send({ error: 'Category not found' });
            }
        }

        await records.updateOne({ _id: new ObjectId(recordId) }, {
            $set: {
                category_id: categoryId ? new ObjectId(categoryId) : null,
                updated_at: new Date()
            }
        });

        return { message: 'Category updated successfully' };
    });

    // Get records by tag
    fastify.get('/tags/:tagId/records', {
        onRequest: [fastify.authenticate]
    }, async(request, reply) => {
        const { tagId } = request.params;
        const tenantId = request.user.tenantId;
        const { page = 1, limit = 20 } = request.query;

        const skip = (page - 1) * limit;

        const tag = await tags.findOne({
            _id: new ObjectId(tagId),
            tenant_id: tenantId,
            deleted_at: null
        });

        if (!tag) {
            return reply.status(404).send({ error: 'Tag not found' });
        }

        const recordList = await records.find({
                tenant_id: tenantId,
                tags: new ObjectId(tagId),
                deleted_at: null
            })
            .skip(skip)
            .limit(parseInt(limit))
            .sort({ created_at: -1 })
            .toArray();

        const total = await records.countDocuments({
            tenant_id: tenantId,
            tags: new ObjectId(tagId),
            deleted_at: null
        });

        return {
            tag,
            records: recordList,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        };
    });

    // Get records by category
    fastify.get('/categories/:categoryId/records', {
        onRequest: [fastify.authenticate]
    }, async(request, reply) => {
        const { categoryId } = request.params;
        const tenantId = request.user.tenantId;
        const { page = 1, limit = 20, includeChildren = 'false' } = request.query;

        const skip = (page - 1) * limit;

        const category = await categories.findOne({
            _id: new ObjectId(categoryId),
            tenant_id: tenantId,
            deleted_at: null
        });

        if (!category) {
            return reply.status(404).send({ error: 'Category not found' });
        }

        let categoryIds = [new ObjectId(categoryId)];

        // If includeChildren, get all descendant category IDs
        if (includeChildren === 'true') {
            const getAllChildren = async(parentIds) => {
                const children = await categories.find({
                    parent_id: { $in: parentIds },
                    deleted_at: null
                }).toArray();

                if (children.length === 0) return [];

                const childIds = children.map(c => c._id);
                const descendants = await getAllChildren(childIds);
                return [...childIds, ...descendants];
            };

            const childIds = await getAllChildren([new ObjectId(categoryId)]);
            categoryIds = [...categoryIds, ...childIds];
        }

        const recordList = await records.find({
                tenant_id: tenantId,
                category_id: { $in: categoryIds },
                deleted_at: null
            })
            .skip(skip)
            .limit(parseInt(limit))
            .sort({ created_at: -1 })
            .toArray();

        const total = await records.countDocuments({
            tenant_id: tenantId,
            category_id: { $in: categoryIds },
            deleted_at: null
        });

        return {
            category,
            records: recordList,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        };
    });
}