const { getDb } = require('../utils/mongodb');

/**
 * Audit middleware - Automatically logs actions to audit_logs collection
 * Usage: auditMiddleware('action_name')
 * 
 * The action will be logged with:
 * - tenant_id
 * - user_id
 * - action
 * - entity_type (extracted from route)
 * - entity_id (if available in params)
 * - metadata (set via request.auditMetadata in route handler)
 * - ip
 * - user_agent
 * - created_at (UTC)
 */
function auditMiddleware(action) {
  return async (request, reply) => {
    // Store original send to intercept response
    const originalSend = reply.send.bind(reply);
    
    reply.send = function(payload) {
      // Only log on success (status < 400)
      if (reply.statusCode < 400) {
        // Log audit asynchronously (don't block response)
        setImmediate(async () => {
          try {
            const db = getDb();
            
            // Extract entity type from route path
            const pathParts = request.routerPath.split('/');
            const entityType = pathParts[2] || 'unknown'; // /api/kb -> 'kb'
            
            // Extract entity ID from params if available
            const entityId = request.params.id || request.auditMetadata?.entity_id || null;
            
            const auditLog = {
              tenant_id: request.tenantId || null,
              user_id: request.userId || null,
              action,
              entity_type: entityType,
              entity_id: entityId,
              metadata: request.auditMetadata || {},
              ip: request.ip || request.headers['x-forwarded-for'] || request.socket.remoteAddress,
              user_agent: request.headers['user-agent'] || null,
              created_at: new Date()
            };
            
            await db.collection('audit_logs').insertOne(auditLog);
          } catch (error) {
            // Log error but don't fail the request
            console.error('Audit log failed:', error);
          }
        });
      }
      
      return originalSend(payload);
    };
  };
}

/**
 * Log auth events (login, logout, login failures)
 */
async function logAuthEvent(action, data = {}) {
  try {
    const db = getDb();
    
    const auditLog = {
      tenant_id: data.tenant_id || null,
      user_id: data.user_id || null,
      action,
      entity_type: 'auth',
      entity_id: null,
      metadata: {
        email: data.email || null,
        success: data.success || false,
        reason: data.reason || null,
        ...data.metadata
      },
      ip: data.ip || null,
      user_agent: data.user_agent || null,
      created_at: new Date()
    };
    
    await db.collection('audit_logs').insertOne(auditLog);
  } catch (error) {
    console.error('Auth audit log failed:', error);
  }
}

/**
 * Log KB view (only once per session)
 */
async function logKBView(tenantId, userId, kbId, metadata = {}) {
  try {
    const db = getDb();
    
    // Check if already viewed in last hour (session-based)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentView = await db.collection('audit_logs').findOne({
      tenant_id: tenantId,
      user_id: userId,
      action: 'kb_viewed',
      entity_id: kbId,
      created_at: { $gte: oneHourAgo }
    });
    
    if (recentView) {
      return; // Already logged recently
    }
    
    const auditLog = {
      tenant_id: tenantId,
      user_id: userId,
      action: 'kb_viewed',
      entity_type: 'kb',
      entity_id: kbId,
      metadata,
      ip: metadata.ip || null,
      user_agent: metadata.user_agent || null,
      created_at: new Date()
    };
    
    await db.collection('audit_logs').insertOne(auditLog);
  } catch (error) {
    console.error('KB view audit log failed:', error);
  }
}

module.exports = auditMiddleware;
module.exports.logAuthEvent = logAuthEvent;
module.exports.logKBView = logKBView;
