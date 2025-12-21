const { ObjectId } = require('mongodb');
const { getDb } = require('../../utils/mongodb');
const authMiddleware = require('../../middlewares/auth.middleware');
const tenantMiddleware = require('../../middlewares/tenant.middleware');
const { requireRole } = require('../../middlewares/rbac.middleware');
const auditMiddleware = require('../../middlewares/audit.middleware');

async function kbAccessRoutes(fastify) {
  const toObjectId = (id) => {
    try {
      return new ObjectId(id);
    } catch {
      return null;
    }
  };

  // Get KB access control
  fastify.get('/:kb_id', {
    preHandler: [authMiddleware, tenantMiddleware]
  }, async (request, reply) => {
    const db = getDb();
    const kbId = toObjectId(request.params.kb_id);

    if (!kbId) {
      return reply.code(400).send({ error: 'Invalid KB ID' });
    }

    const kbAccess = await db.collection('kb_access').findOne({
      kb_id: kbId,
      tenant_id: request.tenantId
    });

    if (!kbAccess) {
      return reply.code(404).send({ error: 'KB access control not found' });
    }

    return kbAccess;
  });

  // Set KB access control (admin/reviewer only)
  fastify.post('/:kb_id', {
    preHandler: [authMiddleware, tenantMiddleware, requireRole(['admin', 'reviewer']), auditMiddleware('kb_access_updated')]
  }, async (request, reply) => {
    const db = getDb();
    const kbId = toObjectId(request.params.kb_id);
    const { visibility, allowed_departments, allowed_groups } = request.body;

    if (!kbId) {
      return reply.code(400).send({ error: 'Invalid KB ID' });
    }

    // Validate visibility
    if (visibility && !['global', 'restricted'].includes(visibility)) {
      return reply.code(400).send({ error: 'Visibility must be "global" or "restricted"' });
    }

    // Verify KB exists
    const kb = await db.collection('records').findOne({
      _id: kbId,
      tenant_id: request.tenantId
    });

    if (!kb) {
      return reply.code(404).send({ error: 'KB not found' });
    }

    // Convert department IDs
    const allowedDepts = (allowed_departments || [])
      .map(id => toObjectId(id))
      .filter(id => id !== null);

    // Convert group IDs
    const allowedGrps = (allowed_groups || [])
      .map(id => toObjectId(id))
      .filter(id => id !== null);

    const accessData = {
      kb_id: kbId,
      tenant_id: request.tenantId,
      visibility: visibility || 'restricted',
      allowed_departments: allowedDepts,
      allowed_groups: allowedGrps,
      updated_at: new Date(),
      updated_by: request.userId
    };

    // Upsert KB access control
    await db.collection('kb_access').updateOne(
      { kb_id: kbId, tenant_id: request.tenantId },
      { 
        $set: accessData,
        $setOnInsert: { created_at: new Date() }
      },
      { upsert: true }
    );

    // Set audit metadata
    request.auditMetadata = {
      kb_id: kbId.toString(),
      visibility: accessData.visibility,
      allowed_departments: allowed_departments,
      allowed_groups: allowed_groups
    };

    return { message: 'KB access control updated successfully' };
  });

  // Delete KB access control (admin only) - resets to default restricted
  fastify.delete('/:kb_id', {
    preHandler: [authMiddleware, tenantMiddleware, requireRole(['admin']), auditMiddleware('kb_access_deleted')]
  }, async (request, reply) => {
    const db = getDb();
    const kbId = toObjectId(request.params.kb_id);

    if (!kbId) {
      return reply.code(400).send({ error: 'Invalid KB ID' });
    }

    await db.collection('kb_access').deleteOne({
      kb_id: kbId,
      tenant_id: request.tenantId
    });

    // Set audit metadata
    request.auditMetadata = {
      kb_id: kbId.toString()
    };

    return { message: 'KB access control deleted (reset to default restricted)' };
  });

  // Bulk set access for multiple KBs (admin only)
  fastify.post('/bulk', {
    preHandler: [authMiddleware, tenantMiddleware, requireRole(['admin']), auditMiddleware('kb_access_bulk_updated')]
  }, async (request, reply) => {
    const db = getDb();
    const { kb_ids, visibility, allowed_departments, allowed_groups } = request.body;

    if (!kb_ids || !Array.isArray(kb_ids) || kb_ids.length === 0) {
      return reply.code(400).send({ error: 'kb_ids array is required' });
    }

    if (visibility && !['global', 'restricted'].includes(visibility)) {
      return reply.code(400).send({ error: 'Visibility must be "global" or "restricted"' });
    }

    const kbObjectIds = kb_ids.map(id => toObjectId(id)).filter(id => id !== null);

    if (kbObjectIds.length === 0) {
      return reply.code(400).send({ error: 'No valid KB IDs provided' });
    }

    // Convert department and group IDs
    const allowedDepts = (allowed_departments || [])
      .map(id => toObjectId(id))
      .filter(id => id !== null);

    const allowedGrps = (allowed_groups || [])
      .map(id => toObjectId(id))
      .filter(id => id !== null);

    const bulkOps = kbObjectIds.map(kbId => ({
      updateOne: {
        filter: { kb_id: kbId, tenant_id: request.tenantId },
        update: {
          $set: {
            kb_id: kbId,
            tenant_id: request.tenantId,
            visibility: visibility || 'restricted',
            allowed_departments: allowedDepts,
            allowed_groups: allowedGrps,
            updated_at: new Date(),
            updated_by: request.userId
          },
          $setOnInsert: { created_at: new Date() }
        },
        upsert: true
      }
    }));

    await db.collection('kb_access').bulkWrite(bulkOps);

    // Set audit metadata
    request.auditMetadata = {
      kb_count: kbObjectIds.length,
      kb_ids: kb_ids,
      visibility: visibility || 'restricted'
    };

    return { 
      message: `Access control updated for ${kbObjectIds.length} KBs`,
      count: kbObjectIds.length
    };
  });
}

module.exports = kbAccessRoutes;
