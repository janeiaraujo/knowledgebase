/**
 * Tenant Middleware
 * Ensures all requests have tenant context and enforces isolation
 */
export async function tenantMiddleware(request, reply) {
  const user = request.currentUser;
  
  if (!user) {
    return reply.status(401).send({ error: 'Authentication required' });
  }
  
  if (!user.tenant_id) {
    return reply.status(403).send({ error: 'User has no tenant association' });
  }
  
  // Verify tenant exists and is active
  const db = request.server.db();
  const tenant = await db.collection('tenants').findOne({ 
    _id: user.tenant_id,
    active: true
  });
  
  if (!tenant) {
    return reply.status(403).send({ error: 'Tenant not found or inactive' });
  }
  
  // Attach tenant to request for easy access
  request.tenant = tenant;
  request.tenantId = tenant._id;
}

/**
 * Creates a tenant-aware query filter
 */
export function createTenantFilter(request, additionalFilters = {}) {
  return {
    tenant_id: request.tenantId,
    ...additionalFilters
  };
}
