import { ObjectId } from 'mongodb';

/**
 * Authentication Middleware
 * Validates JWT token and attaches user info to request
 */
export async function authMiddleware(request, reply) {
  try {
    await request.jwtVerify();
    
    if (!request.user || !request.user.id) {
      return reply.status(401).send({ error: 'Invalid token' });
    }
    
    // Fetch user from database
    const db = request.server.db();
    
    // Convert string ID to ObjectId if needed
    let userId = request.user.id;
    if (typeof userId === 'string') {
      try {
        userId = new ObjectId(userId);
      } catch (err) {
        return reply.status(401).send({ error: 'Invalid user ID format' });
      }
    }
    
    const user = await db.collection('users').findOne({ 
      _id: userId 
    });
    
    if (!user || !user.active) {
      return reply.status(401).send({ error: 'User not found or inactive' });
    }
    
    // Attach full user to request
    request.currentUser = user;
    
  } catch (error) {
    request.log.error('Auth middleware error:', error);
    return reply.status(401).send({ error: 'Authentication required' });
  }
}

/**
 * Optional authentication middleware
 * Validates JWT but doesn't fail if not present
 */
export async function optionalAuthMiddleware(request, reply) {
  try {
    await request.jwtVerify();
    
    if (request.user && request.user.id) {
      const db = request.server.db();
      
      // Convert string ID to ObjectId if needed
      let userId = request.user.id;
      if (typeof userId === 'string') {
        try {
          userId = new ObjectId(userId);
        } catch (err) {
          return; // Silent fail
        }
      }
      
      const user = await db.collection('users').findOne({ 
        _id: userId 
      });
      
      if (user && user.active) {
        request.currentUser = user;
      }
    }
  } catch (error) {
    // Silent fail - user not authenticated
  }
}
