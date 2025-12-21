import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const fastify = Fastify({
  logger: {
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    transport: process.env.NODE_ENV !== 'production' ? {
      target: 'pino-pretty',
      options: { colorize: true }
    } : undefined
  }
});

// MongoDB Connection
let db;
const mongoClient = new MongoClient(process.env.MONGODB_URI);

async function connectDB() {
  try {
    await mongoClient.connect();
    db = mongoClient.db();
    fastify.log.info('✅ Connected to MongoDB Atlas');
    
    // Create indexes
    await createIndexes();
  } catch (error) {
    fastify.log.error('❌ MongoDB connection error:');
    fastify.log.error(error.message);
    fastify.log.error(error.stack);
    process.exit(1);
  }
}

async function createIndexes() {
  // Tenant-aware indexes
  await db.collection('users').createIndex({ tenant_id: 1, email: 1 }, { unique: true });
  await db.collection('organizations').createIndex({ tenant_id: 1 });
  await db.collection('records').createIndex({ tenant_id: 1, database_id: 1 });
  await db.collection('records').createIndex({ tenant_id: 1, status: 1 });
  await db.collection('ai_embeddings').createIndex({ tenant_id: 1, record_id: 1 });
  await db.collection('events').createIndex({ tenant_id: 1, created_at: -1 });
  await db.collection('audit_logs').createIndex({ tenant_id: 1, created_at: -1 });
  
  // Text search indexes
  await db.collection('records').createIndex({ 
    title: 'text', 
    content_md: 'text',
    'properties.tags': 'text' 
  });
  
  fastify.log.info('✅ Database indexes created');
}

// Make DB available to routes
fastify.decorate('db', () => db);

// Register plugins
await fastify.register(cors, {
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
});

await fastify.register(jwt, {
  secret: process.env.JWT_SECRET
});

await fastify.register(multipart, {
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  }
});

await fastify.register(rateLimit, {
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
  timeWindow: parseInt(process.env.RATE_LIMIT_TIME_WINDOW) || 60000
});

// Health check
fastify.get('/health', async (request, reply) => {
  return { 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    mongodb: db ? 'connected' : 'disconnected'
  };
});

// Import routes
import authRoutes from './modules/auth/auth.routes.js';
import organizationRoutes from './modules/organizations/organizations.routes.js';
import userRoutes from './modules/users/users.routes.js';
import databaseRoutes from './modules/databases/databases.routes.js';
import recordRoutes from './modules/records/records.routes.js';
import incidentRoutes from './modules/incidents/incidents.routes.js';
import kbRoutes from './modules/kb/kb.routes.js';
import fileRoutes from './modules/files/files.routes.js';
import eventRoutes from './modules/events/events.routes.js';
import aiRoutes from './modules/ai/ai.routes.js';
import billingRoutes from './modules/billing/billing.routes.js';
import propertyRoutes from './modules/properties/properties.routes.js';

// Register routes
await fastify.register(authRoutes, { prefix: '/api/auth' });
await fastify.register(organizationRoutes, { prefix: '/api/organizations' });
await fastify.register(userRoutes, { prefix: '/api/users' });
await fastify.register(databaseRoutes, { prefix: '/api/databases' });
await fastify.register(recordRoutes, { prefix: '/api/records' });
await fastify.register(incidentRoutes, { prefix: '/api/incidents' });
await fastify.register(kbRoutes, { prefix: '/api/kb' });
await fastify.register(fileRoutes, { prefix: '/api/files' });
await fastify.register(eventRoutes, { prefix: '/api/events' });
await fastify.register(aiRoutes, { prefix: '/api/ai' });
await fastify.register(billingRoutes, { prefix: '/api/billing' });
await fastify.register(propertyRoutes, { prefix: '/api/properties' });

// Error handler
fastify.setErrorHandler((error, request, reply) => {
  fastify.log.error(error);
  
  const statusCode = error.statusCode || 500;
  const message = error.message || 'Internal Server Error';
  
  reply.status(statusCode).send({
    error: true,
    message,
    statusCode
  });
});

// Start server
const start = async () => {
  try {
    await connectDB();
    
    const port = parseInt(process.env.PORT) || 3000;
    const host = process.env.HOST || '0.0.0.0';
    
    await fastify.listen({ port, host });
    fastify.log.info(`🚀 Server running at http://${host}:${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

// Graceful shutdown
const gracefulShutdown = async () => {
  fastify.log.info('Shutting down gracefully...');
  await fastify.close();
  await mongoClient.close();
  process.exit(0);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

start();
