// Empty routes file - roles are fixed in RBAC middleware
export default async function roleRoutes(fastify, options) {
  // Roles are fixed: owner, admin, member, viewer
  // Managed through RBAC middleware
  fastify.get('/', async (request, reply) => {
    return { 
      roles: [
        { id: 'owner', name: 'Owner', description: 'Full access' },
        { id: 'admin', name: 'Admin', description: 'Administrative access' },
        { id: 'member', name: 'Member', description: 'Can create and edit' },
        { id: 'viewer', name: 'Viewer', description: 'Read-only access' }
      ]
    };
  });
}
