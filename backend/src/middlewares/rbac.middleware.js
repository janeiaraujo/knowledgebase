/**
 * Role-Based Access Control Middleware
 * Enforces permissions based on user roles
 */

const PERMISSIONS = {
  // Organization management
  'org:manage': ['owner', 'admin'],
  'org:read': ['owner', 'admin', 'member', 'viewer'],
  
  // User management
  'user:manage': ['owner', 'admin'],
  'user:invite': ['owner', 'admin', 'member'],
  'user:read': ['owner', 'admin', 'member', 'viewer'],
  
  // KB management
  'kb:create': ['owner', 'admin', 'member'],
  'kb:edit': ['owner', 'admin', 'member'],
  'kb:delete': ['owner', 'admin'],
  'kb:approve': ['owner', 'admin'], // Cannot approve own KBs
  'kb:publish': ['owner', 'admin'],
  'kb:read': ['owner', 'admin', 'member', 'viewer'],
  
  // Incident management
  'incident:create': ['owner', 'admin', 'member'],
  'incident:edit': ['owner', 'admin', 'member'],
  'incident:delete': ['owner', 'admin'],
  'incident:read': ['owner', 'admin', 'member', 'viewer'],
  
  // Event ingestion
  'event:ingest': ['owner', 'admin', 'member'],
  'event:read': ['owner', 'admin', 'member', 'viewer'],
  
  // Files
  'file:upload': ['owner', 'admin', 'member'],
  'file:delete': ['owner', 'admin', 'member'],
  'file:read': ['owner', 'admin', 'member', 'viewer'],
  
  // Billing
  'billing:manage': ['owner'],
  'billing:read': ['owner', 'admin'],
  
  // AI features
  'ai:use': ['owner', 'admin', 'member']
};

/**
 * Check if user has required permission
 */
export function hasPermission(userRole, permission) {
  const allowedRoles = PERMISSIONS[permission];
  if (!allowedRoles) {
    return false;
  }
  return allowedRoles.includes(userRole);
}

/**
 * RBAC Middleware Factory
 * Creates middleware that checks for specific permission
 */
export function requirePermission(permission) {
  return async (request, reply) => {
    const user = request.currentUser;
    
    if (!user) {
      return reply.status(401).send({ error: 'Authentication required' });
    }
    
    if (!user.role) {
      return reply.status(403).send({ error: 'User has no role assigned' });
    }
    
    if (!hasPermission(user.role, permission)) {
      return reply.status(403).send({ 
        error: 'Insufficient permissions',
        required: permission,
        current_role: user.role
      });
    }
  };
}

/**
 * Check if user can approve KB (cannot approve own KB)
 */
export async function canApproveKB(request, kbId) {
  const db = request.server.db();
  const kb = await db.collection('records').findOne({ 
    _id: kbId,
    tenant_id: request.tenantId
  });
  
  if (!kb) {
    return false;
  }
  
  // User cannot approve their own KB
  if (kb.created_by.toString() === request.currentUser._id.toString()) {
    return false;
  }
  
  return hasPermission(request.currentUser.role, 'kb:approve');
}

/**
 * Owner-only middleware
 */
export async function requireOwner(request, reply) {
  if (request.currentUser.role !== 'owner') {
    return reply.status(403).send({ error: 'Owner access required' });
  }
}

/**
 * Admin or higher middleware
 */
export async function requireAdmin(request, reply) {
  const role = request.currentUser.role;
  if (role !== 'owner' && role !== 'admin') {
    return reply.status(403).send({ error: 'Admin access required' });
  }
}
