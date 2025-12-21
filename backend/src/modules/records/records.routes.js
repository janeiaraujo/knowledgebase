import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { tenantMiddleware } from '../../middlewares/tenant.middleware.js';
import { requirePermission, canApproveKB } from '../../middlewares/rbac.middleware.js';
import { toObjectId } from '../../utils/mongodb.js';
import { filterKBsByAccess, checkKBAccess, checkKBEditAccess, checkKBApproveAccess } from '../../middlewares/kbAccess.middleware.js';
import auditMiddleware, { logKBView } from '../../middlewares/audit.middleware.js';
import Joi from 'joi';

export default async function recordRoutes(fastify, options) {
  
  // List records (with access control)
  fastify.get('/', {
    preHandler: [authMiddleware, tenantMiddleware]
  }, async (request, reply) => {
    const db = fastify.db();
    const { database_id, status, search, page = 1, limit = 50 } = request.query;
    
    // Get accessible KB filter based on user permissions
    const accessFilter = await filterKBsByAccess(
      request.tenantId, 
      request.userId, 
      request.userRole
    );
    
    const filter = { ...accessFilter };
    if (database_id) filter.database_id = database_id;
    if (status) filter.status = status;
    
    // Text search
    if (search) {
      filter.$text = { $search: search };
    }
    
    const records = await db.collection('records')
      .find(filter)
      .sort({ created_at: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
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
  }, async (request, reply) => {
    const db = fastify.db();
    const { database_id, title, content_md, properties, custom_properties, status } = request.body;
    
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
    await db.collection('subscriptions').updateOne(
      { tenant_id: request.tenantId },
      { $inc: { 'usage.records': 1 } }
    );
    
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
  }, async (request, reply) => {
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
  }, async (request, reply) => {
    const db = fastify.db();
    const { recordId } = request.params;
    const updates = request.body;
    
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
    
    // Update record
    const newVersion = record.version + 1;
    await db.collection('records').updateOne(
      { _id: objectId, tenant_id: request.tenantId },
      { 
        $set: {
          ...updates,
          version: newVersion,
          updated_at: new Date()
        }
      }
    );
    
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
  }, async (request, reply) => {
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
    
    await db.collection('records').updateOne(
      { _id: objectId, tenant_id: request.tenantId },
      { 
        $set: {
          status: 'approved',
          approved_by: request.currentUser._id,
          approved_at: new Date(),
          updated_at: new Date()
        }
      }
    );
    
    // Audit log
    await db.collection('audit_logs').insertOne({
      tenant_id: request.tenantId,
      user_id: request.currentUser._id,
      action: 'record.approved',
      resource: 'record',
      resource_id: objectId,
      timestamp: new Date()
    });
    
    return { success: true };
  });
  
  // Publish record
  fastify.post('/:recordId/publish', {
    preHandler: [authMiddleware, tenantMiddleware, requirePermission('kb:publish')]
  }, async (request, reply) => {
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
    
    await db.collection('records').updateOne(
      { _id: objectId, tenant_id: request.tenantId },
      { 
        $set: {
          status: 'published',
          published_at: new Date(),
          updated_at: new Date()
        }
      }
    );
    
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
  }, async (request, reply) => {
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
    
    return { versions };
  });
  
  // Delete record
  fastify.delete('/:recordId', {
    preHandler: [authMiddleware, tenantMiddleware, requirePermission('kb:delete')]
  }, async (request, reply) => {
    const db = fastify.db();
    const { recordId } = request.params;
    
    const objectId = toObjectId(recordId);
    if (!objectId) {
      return reply.status(400).send({ error: 'Invalid record ID' });
    }
    
    await db.collection('records').deleteOne({
      _id: objectId,
      tenant_id: request.tenantId
    });
    
    // Delete versions
    await db.collection('record_versions').deleteMany({
      record_id: objectId,
      tenant_id: request.tenantId
    });
    
    // Update subscription usage
    await db.collection('subscriptions').updateOne(
      { tenant_id: request.tenantId },
      { $inc: { 'usage.records': -1 } }
    );
    
    return { success: true };
  });
}
