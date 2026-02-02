import { ObjectId } from 'mongodb';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { tenantMiddleware } from '../../middlewares/tenant.middleware.js';
import { requireRole } from '../../middlewares/rbac.middleware.js';
import auditMiddleware from '../../middlewares/audit.middleware.js';

export default async function departmentRoutes(fastify) {
    const toObjectId = (id) => {
        try {
            return new ObjectId(id);
        } catch {
            return null;
        }
    };

    // List all departments (hierarchical)
    fastify.get('/', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async(request) => {
        const db = fastify.db();
        const departments = await db.collection('departments')
            .find({ tenant_id: request.tenantId })
            .sort({ name: 1 })
            .toArray();

        return { departments };
    });

    // Get single department
    fastify.get('/:id', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async(request, reply) => {
        const db = fastify.db();
        const id = toObjectId(request.params.id);

        if (!id) {
            return reply.code(400).send({ error: 'Invalid department ID' });
        }

        const department = await db.collection('departments').findOne({
            _id: id,
            tenant_id: request.tenantId
        });

        if (!department) {
            return reply.code(404).send({ error: 'Department not found' });
        }

        return department;
    });

    // Create department (admin/owner only)
    fastify.post('/', {
        preHandler: [authMiddleware, tenantMiddleware, requireRole(['admin', 'owner']), auditMiddleware('department_created')]
    }, async(request, reply) => {
        const db = fastify.db();
        const { name, description, parent_department_id } = request.body;

        if (!name) {
            return reply.code(400).send({ error: 'Department name is required' });
        }

        // Validate parent if provided
        if (parent_department_id) {
            const parentId = toObjectId(parent_department_id);
            if (!parentId) {
                return reply.code(400).send({ error: 'Invalid parent department ID' });
            }

            const parent = await db.collection('departments').findOne({
                _id: parentId,
                tenant_id: request.tenantId
            });

            if (!parent) {
                return reply.code(404).send({ error: 'Parent department not found' });
            }
        }

        const department = {
            tenant_id: request.tenantId,
            name,
            description: description || '',
            parent_department_id: parent_department_id ? toObjectId(parent_department_id) : null,
            created_at: new Date(),
            updated_at: new Date()
        };

        const result = await db.collection('departments').insertOne(department);

        // Set audit metadata
        request.auditMetadata = {
            department_id: result.insertedId.toString(),
            name
        };

        return {
            id: result.insertedId,
            ...department
        };
    });

    // Update department (admin/owner only)
    fastify.put('/:id', {
        preHandler: [authMiddleware, tenantMiddleware, requireRole(['admin', 'owner']), auditMiddleware('department_updated')]
    }, async(request, reply) => {
        const db = fastify.db();
        const id = toObjectId(request.params.id);
        const { name, description, parent_department_id } = request.body;

        if (!id) {
            return reply.code(400).send({ error: 'Invalid department ID' });
        }

        // Check if department exists
        const existing = await db.collection('departments').findOne({
            _id: id,
            tenant_id: request.tenantId
        });

        if (!existing) {
            return reply.code(404).send({ error: 'Department not found' });
        }

        // Validate parent if provided
        if (parent_department_id) {
            const parentId = toObjectId(parent_department_id);
            if (!parentId) {
                return reply.code(400).send({ error: 'Invalid parent department ID' });
            }

            // Prevent setting itself as parent
            if (parentId.equals(id)) {
                return reply.code(400).send({ error: 'Department cannot be its own parent' });
            }

            const parent = await db.collection('departments').findOne({
                _id: parentId,
                tenant_id: request.tenantId
            });

            if (!parent) {
                return reply.code(404).send({ error: 'Parent department not found' });
            }
        }

        const updateData = {
            updated_at: new Date()
        };

        if (name) updateData.name = name;
        if (description !== undefined) updateData.description = description;
        if (parent_department_id !== undefined) {
            updateData.parent_department_id = parent_department_id ? toObjectId(parent_department_id) : null;
        }

        await db.collection('departments').updateOne({ _id: id, tenant_id: request.tenantId }, { $set: updateData });

        // Set audit metadata
        request.auditMetadata = {
            department_id: id.toString(),
            changes: updateData
        };

        return { message: 'Department updated successfully' };
    });

    // Delete department (admin/owner only)
    fastify.delete('/:id', {
        preHandler: [authMiddleware, tenantMiddleware, requireRole(['admin', 'owner']), auditMiddleware('department_deleted')]
    }, async(request, reply) => {
        const db = fastify.db();
        const id = toObjectId(request.params.id);

        if (!id) {
            return reply.code(400).send({ error: 'Invalid department ID' });
        }

        // Check if department exists
        const existing = await db.collection('departments').findOne({
            _id: id,
            tenant_id: request.tenantId
        });

        if (!existing) {
            return reply.code(404).send({ error: 'Department not found' });
        }

        // Check if department has children
        const hasChildren = await db.collection('departments').findOne({
            parent_department_id: id,
            tenant_id: request.tenantId
        });

        if (hasChildren) {
            return reply.code(400).send({ error: 'Cannot delete department with sub-departments' });
        }

        // Check if department has groups
        const hasGroups = await db.collection('groups').findOne({
            department_id: id,
            tenant_id: request.tenantId
        });

        if (hasGroups) {
            return reply.code(400).send({ error: 'Cannot delete department with groups' });
        }

        await db.collection('departments').deleteOne({
            _id: id,
            tenant_id: request.tenantId
        });

        // Set audit metadata
        request.auditMetadata = {
            department_id: id.toString(),
            name: existing.name
        };

        return { message: 'Department deleted successfully' };
    });
}