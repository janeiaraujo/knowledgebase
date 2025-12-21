import { ObjectId } from 'mongodb';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { tenantMiddleware } from '../../middlewares/tenant.middleware.js';
import { requireRole } from '../../middlewares/rbac.middleware.js';
import auditMiddleware from '../../middlewares/audit.middleware.js';

export default async function groupRoutes(fastify) {
  const toObjectId = (id) => {
    try {
      return new ObjectId(id);
    } catch {
      return null;
    }
  };

  // List all groups
  fastify.get('/', {
    preHandler: [authMiddleware, tenantMiddleware]
  }, async (request) => {
    const db = fastify.db();
    const { department_id } = request.query;
    
    const query = { tenant_id: request.tenantId };
    
    if (department_id) {
      const deptId = toObjectId(department_id);
      if (deptId) {
        query.department_id = deptId;
      }
    }

    const groups = await db.collection('groups')
      .find(query)
      .sort({ name: 1 })
      .toArray();
    
    return { groups };
  });

  // Get single group
  fastify.get('/:id', {
    preHandler: [authMiddleware, tenantMiddleware]
  }, async (request, reply) => {
    const db = fastify.db();
    const id = toObjectId(request.params.id);
    
    if (!id) {
      return reply.code(400).send({ error: 'Invalid group ID' });
    }

    const group = await db.collection('groups').findOne({
      _id: id,
      tenant_id: request.tenantId
    });

    if (!group) {
      return reply.code(404).send({ error: 'Group not found' });
    }

    return group;
  });

  // Create group (admin only)
  fastify.post('/', {
    preHandler: [authMiddleware, tenantMiddleware, requireRole(['admin']), auditMiddleware('group_created')]
  }, async (request, reply) => {
    const db = fastify.db();
    const { name, description, department_id, parent_group_id } = request.body;

    if (!name || !department_id) {
      return reply.code(400).send({ error: 'Name and department_id are required' });
    }

    // Validate department
    const deptId = toObjectId(department_id);
    if (!deptId) {
      return reply.code(400).send({ error: 'Invalid department ID' });
    }

    const department = await db.collection('departments').findOne({
      _id: deptId,
      tenant_id: request.tenantId
    });

    if (!department) {
      return reply.code(404).send({ error: 'Department not found' });
    }

    // Validate parent if provided
    if (parent_group_id) {
      const parentId = toObjectId(parent_group_id);
      if (!parentId) {
        return reply.code(400).send({ error: 'Invalid parent group ID' });
      }

      const parent = await db.collection('groups').findOne({
        _id: parentId,
        tenant_id: request.tenantId
      });

      if (!parent) {
        return reply.code(404).send({ error: 'Parent group not found' });
      }
    }

    const group = {
      tenant_id: request.tenantId,
      name,
      description: description || '',
      department_id: deptId,
      parent_group_id: parent_group_id ? toObjectId(parent_group_id) : null,
      created_at: new Date(),
      updated_at: new Date()
    };

    const result = await db.collection('groups').insertOne(group);
    
    // Set audit metadata
    request.auditMetadata = {
      group_id: result.insertedId.toString(),
      name,
      department_id: department_id
    };

    return { 
      id: result.insertedId,
      ...group 
    };
  });

  // Update group (admin only)
  fastify.put('/:id', {
    preHandler: [authMiddleware, tenantMiddleware, requireRole(['admin']), auditMiddleware('group_updated')]
  }, async (request, reply) => {
    const db = fastify.db();
    const id = toObjectId(request.params.id);
    const { name, description, department_id, parent_group_id } = request.body;

    if (!id) {
      return reply.code(400).send({ error: 'Invalid group ID' });
    }

    // Check if group exists
    const existing = await db.collection('groups').findOne({
      _id: id,
      tenant_id: request.tenantId
    });

    if (!existing) {
      return reply.code(404).send({ error: 'Group not found' });
    }

    const updateData = { updated_at: new Date() };

    if (name) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    
    if (department_id) {
      const deptId = toObjectId(department_id);
      if (!deptId) {
        return reply.code(400).send({ error: 'Invalid department ID' });
      }
      updateData.department_id = deptId;
    }

    if (parent_group_id !== undefined) {
      if (parent_group_id) {
        const parentId = toObjectId(parent_group_id);
        if (!parentId) {
          return reply.code(400).send({ error: 'Invalid parent group ID' });
        }
        if (parentId.equals(id)) {
          return reply.code(400).send({ error: 'Group cannot be its own parent' });
        }
        updateData.parent_group_id = parentId;
      } else {
        updateData.parent_group_id = null;
      }
    }

    await db.collection('groups').updateOne(
      { _id: id, tenant_id: request.tenantId },
      { $set: updateData }
    );

    // Set audit metadata
    request.auditMetadata = {
      group_id: id.toString(),
      changes: updateData
    };

    return { message: 'Group updated successfully' };
  });

  // Delete group (admin only)
  fastify.delete('/:id', {
    preHandler: [authMiddleware, tenantMiddleware, requireRole(['admin']), auditMiddleware('group_deleted')]
  }, async (request, reply) => {
    const db = fastify.db();
    const id = toObjectId(request.params.id);

    if (!id) {
      return reply.code(400).send({ error: 'Invalid group ID' });
    }

    const existing = await db.collection('groups').findOne({
      _id: id,
      tenant_id: request.tenantId
    });

    if (!existing) {
      return reply.code(404).send({ error: 'Group not found' });
    }

    // Check if group has children
    const hasChildren = await db.collection('groups').findOne({
      parent_group_id: id,
      tenant_id: request.tenantId
    });

    if (hasChildren) {
      return reply.code(400).send({ error: 'Cannot delete group with sub-groups' });
    }

    // Remove all user associations
    await db.collection('user_groups').deleteMany({
      group_id: id,
      tenant_id: request.tenantId
    });

    await db.collection('groups').deleteOne({
      _id: id,
      tenant_id: request.tenantId
    });

    // Set audit metadata
    request.auditMetadata = {
      group_id: id.toString(),
      name: existing.name
    };

    return { message: 'Group deleted successfully' };
  });

  // Add user to group (admin only)
  fastify.post('/:id/users', {
    preHandler: [authMiddleware, tenantMiddleware, requireRole(['admin']), auditMiddleware('user_added_to_group')]
  }, async (request, reply) => {
    const db = fastify.db();
    const groupId = toObjectId(request.params.id);
    const { user_id, role_in_group } = request.body;

    if (!groupId || !user_id) {
      return reply.code(400).send({ error: 'Group ID and user ID are required' });
    }

    const userId = toObjectId(user_id);
    if (!userId) {
      return reply.code(400).send({ error: 'Invalid user ID' });
    }

    // Verify group exists
    const group = await db.collection('groups').findOne({
      _id: groupId,
      tenant_id: request.tenantId
    });

    if (!group) {
      return reply.code(404).send({ error: 'Group not found' });
    }

    // Verify user exists
    const user = await db.collection('users').findOne({
      _id: userId,
      tenant_id: request.tenantId
    });

    if (!user) {
      return reply.code(404).send({ error: 'User not found' });
    }

    // Check if already exists
    const existing = await db.collection('user_groups').findOne({
      tenant_id: request.tenantId,
      user_id: userId,
      group_id: groupId
    });

    if (existing) {
      return reply.code(400).send({ error: 'User already in group' });
    }

    await db.collection('user_groups').insertOne({
      tenant_id: request.tenantId,
      user_id: userId,
      group_id: groupId,
      role_in_group: role_in_group || null,
      created_at: new Date()
    });

    // Set audit metadata
    request.auditMetadata = {
      group_id: groupId.toString(),
      user_id: user_id,
      role_in_group
    };

    return { message: 'User added to group successfully' };
  });

  // Remove user from group (admin only)
  fastify.delete('/:id/users/:user_id', {
    preHandler: [authMiddleware, tenantMiddleware, requireRole(['admin']), auditMiddleware('user_removed_from_group')]
  }, async (request, reply) => {
    const db = fastify.db();
    const groupId = toObjectId(request.params.id);
    const userId = toObjectId(request.params.user_id);

    if (!groupId || !userId) {
      return reply.code(400).send({ error: 'Invalid IDs' });
    }

    const result = await db.collection('user_groups').deleteOne({
      tenant_id: request.tenantId,
      user_id: userId,
      group_id: groupId
    });

    if (result.deletedCount === 0) {
      return reply.code(404).send({ error: 'User not in group' });
    }

    // Set audit metadata
    request.auditMetadata = {
      group_id: groupId.toString(),
      user_id: userId.toString()
    };

    return { message: 'User removed from group successfully' };
  });

  // List users in group
  fastify.get('/:id/users', {
    preHandler: [authMiddleware, tenantMiddleware]
  }, async (request, reply) => {
    const db = fastify.db();
    const groupId = toObjectId(request.params.id);

    if (!groupId) {
      return reply.code(400).send({ error: 'Invalid group ID' });
    }

    const userGroups = await db.collection('user_groups')
      .find({ group_id: groupId, tenant_id: request.tenantId })
      .toArray();

    const userIds = userGroups.map(ug => ug.user_id);
    
    const users = await db.collection('users')
      .find({ _id: { $in: userIds }, tenant_id: request.tenantId })
      .project({ password: 0 })
      .toArray();

    return { users };
  });
}


