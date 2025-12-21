import { toObjectId } from '../../utils/mongodb.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { tenantMiddleware } from '../../middlewares/tenant.middleware.js';

/**
 * Property Management Routes
 * Manages custom properties for knowledge base records (like Notion)
 */
export default async function propertyRoutes(fastify, options) {
  
  // Get all properties for tenant
  fastify.get('/', {
    preHandler: [authMiddleware, tenantMiddleware]
  }, async (request, reply) => {
    const db = fastify.db();
    
    const properties = await db.collection('properties')
      .find({ tenant_id: request.tenantId })
      .sort({ order: 1 })
      .toArray();
    
    return { properties };
  });
  
  // Create new property
  fastify.post('/', {
    preHandler: [authMiddleware, tenantMiddleware]
  }, async (request, reply) => {
    const db = fastify.db();
    const { name, type, options, required, defaultValue } = request.body;
    
    // Get max order
    const maxOrderProp = await db.collection('properties')
      .findOne(
        { tenant_id: request.tenantId },
        { sort: { order: -1 } }
      );
    
    const property = {
      tenant_id: request.tenantId,
      name,
      type, // text, number, select, multiselect, date, url, email, phone, checkbox, file
      options: options || [], // For select/multiselect
      required: required || false,
      defaultValue: defaultValue || null,
      order: maxOrderProp ? maxOrderProp.order + 1 : 0,
      created_at: new Date(),
      created_by: request.currentUser._id
    };
    
    const result = await db.collection('properties').insertOne(property);
    property._id = result.insertedId;
    
    return { property };
  });
  
  // Update property
  fastify.put('/:id', {
    preHandler: [authMiddleware, tenantMiddleware]
  }, async (request, reply) => {
    const db = fastify.db();
    const propertyId = toObjectId(request.params.id);
    const { name, type, options, required, defaultValue } = request.body;
    
    const result = await db.collection('properties').findOneAndUpdate(
      { 
        _id: propertyId,
        tenant_id: request.tenantId 
      },
      {
        $set: {
          name,
          type,
          options: options || [],
          required: required || false,
          defaultValue: defaultValue || null,
          updated_at: new Date()
        }
      },
      { returnDocument: 'after' }
    );
    
    if (!result) {
      return reply.status(404).send({ error: 'Property not found' });
    }
    
    return { property: result };
  });
  
  // Delete property
  fastify.delete('/:id', {
    preHandler: [authMiddleware, tenantMiddleware]
  }, async (request, reply) => {
    const db = fastify.db();
    const propertyId = toObjectId(request.params.id);
    
    // Check if property exists
    const property = await db.collection('properties').findOne({
      _id: propertyId,
      tenant_id: request.tenantId
    });
    
    if (!property) {
      return reply.status(404).send({ error: 'Property not found' });
    }
    
    // Delete property
    await db.collection('properties').deleteOne({ _id: propertyId });
    
    // Remove property values from all records
    await db.collection('records').updateMany(
      { tenant_id: request.tenantId },
      { $unset: { [`custom_properties.${propertyId.toString()}`]: "" } }
    );
    
    return { success: true };
  });
  
  // Reorder properties
  fastify.post('/reorder', {
    preHandler: [authMiddleware, tenantMiddleware]
  }, async (request, reply) => {
    const db = fastify.db();
    const { propertyIds } = request.body; // Array of property IDs in new order
    
    // Update order for each property
    const updates = propertyIds.map((id, index) => ({
      updateOne: {
        filter: { 
          _id: toObjectId(id),
          tenant_id: request.tenantId 
        },
        update: { $set: { order: index } }
      }
    }));
    
    await db.collection('properties').bulkWrite(updates);
    
    return { success: true };
  });
}
