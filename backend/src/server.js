import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import { createIndexes } from './db/indexes.js';

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
        await createIndexes(db);
        fastify.log.info('✅ Database indexes created');
    } catch (error) {
        fastify.log.error('❌ MongoDB connection error:');
        fastify.log.error(error.message);
        fastify.log.error(error.stack);
        process.exit(1);
    }
}

// Make DB available to routes
fastify.decorate('db', () => db);

// Getter for mongo.db compatibility - will be set after connection
fastify.decorate('mongo', {
    get db() { return db; }
});

// Authentication decorator
fastify.decorate('authenticate', async function(request, reply) {
    try {
        await request.jwtVerify();

        if (!request.user || !request.user.id) {
            return reply.status(401).send({ error: 'Invalid token' });
        }

        // Fetch user from database
        const dbInstance = db;
        const { ObjectId } = await
        import ('mongodb');

        // Convert string ID to ObjectId if needed
        let userId = request.user.id;
        if (typeof userId === 'string') {
            try {
                userId = new ObjectId(userId);
            } catch (err) {
                return reply.status(401).send({ error: 'Invalid user ID format' });
            }
        }

        const user = await dbInstance.collection('users').findOne({
            _id: userId
        });

        if (!user || !user.active) {
            return reply.status(401).send({ error: 'User not found or inactive' });
        }

        // Attach full user to request - supporting both naming patterns
        request.currentUser = user;
        request.user = {
            ...request.user,
            _id: user._id,
            id: user._id.toString(),
            name: user.name,
            email: user.email,
            role: user.role,
            tenantId: user.tenant_id
        };
        request.userId = user._id;
        request.userRole = user.role;

    } catch (error) {
        request.log.error('Auth error:', error);
        return reply.status(401).send({ error: 'Authentication required' });
    }
});

// Register plugins
const configuredFrontendUrl = process.env.FRONTEND_URL;
const allowedOrigins = new Set(
    [
        configuredFrontendUrl,
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'http://localhost:5174',
        'http://127.0.0.1:5174'
    ].filter(Boolean)
);

await fastify.register(cors, {
    origin: (origin, cb) => {
        // Allow non-browser clients (curl, server-to-server)
        if (!origin) return cb(null, true);

        // Always allow explicitly configured frontend URL
        if (configuredFrontendUrl && origin === configuredFrontendUrl) {
            return cb(null, true);
        }

        // Allow known local dev origins
        if (allowedOrigins.has(origin)) return cb(null, true);

        // In dev, allow any localhost/127.0.0.1 port (Vite can change ports if busy)
        if (process.env.NODE_ENV !== 'production') {
            const isLocalDevOrigin = /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);
            if (isLocalDevOrigin) return cb(null, true);

            // Tuneis de demonstracao (ngrok): o proxy do Vite repassa o Origin publico
            const isTunnelOrigin = /^https:\/\/[a-z0-9-]+\.(ngrok-free\.(dev|app)|ngrok\.io|trycloudflare\.com)$/.test(origin);
            if (isTunnelOrigin) return cb(null, true);
        }

        return cb(new Error('Not allowed by CORS'), false);
    },
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
fastify.get('/health', async(request, reply) => {
    return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        mongodb: db ? 'connected' : 'disconnected'
    };
});

// Connect to database BEFORE importing routes
await connectDB();

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
import departmentRoutes from './modules/departments/departments.routes.js';
import groupRoutes from './modules/groups/groups.routes.js';
import kbAccessRoutes from './modules/kb-access/kb-access.routes.js';
import auditRoutes from './modules/audit/audit.routes.js';
import notificationRoutes from './modules/notifications/notifications.routes.js';
import exportRoutes from './modules/export/export.routes.js';
import commentsRoutes from './modules/comments/comments.routes.js';
import tagsRoutes from './modules/tags/tags.routes.js';
import favoritesRoutes from './modules/favorites/favorites.routes.js';
import relationsRoutes from './modules/relations/relations.routes.js';
import templatesRoutes from './modules/templates/templates.routes.js';
import analyticsRoutes from './modules/analytics/analytics.routes.js';
import websocketRoutes from './modules/websocket/websocket.routes.js';
import importRoutes from './modules/import/import.routes.js';
import reviewRoutes from './modules/review/review.routes.js';
import dashboardRoutes from './modules/dashboard/dashboard.routes.js';
import gpsRoutes from './modules/gps/gps.routes.js';
import webhooksRoutes from './modules/webhooks/webhooks.routes.js';
import activityRoutes from './modules/activity/activity.routes.js';
import smartSearchRoutes from './modules/smart-search/smart-search.routes.js';
import postMortemRoutes from './modules/postmortem/postmortem.routes.js';
import reportsRoutes from './modules/reports/reports.routes.js';
import integrationsRoutes from './modules/integrations/integrations.routes.js';
import gamificationRoutes from './modules/gamification/gamification.routes.js';
import helpCenterRoutes from './modules/help-center/help-center.routes.js';

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
await fastify.register(departmentRoutes, { prefix: '/api/departments' });
await fastify.register(groupRoutes, { prefix: '/api/groups' });
await fastify.register(kbAccessRoutes, { prefix: '/api/kb-access' });
await fastify.register(auditRoutes, { prefix: '/api/audit' });
await fastify.register(notificationRoutes, { prefix: '/api/notifications' });
await fastify.register(exportRoutes, { prefix: '/api/export' });
await fastify.register(commentsRoutes, { prefix: '/api' });
await fastify.register(tagsRoutes, { prefix: '/api' });
await fastify.register(favoritesRoutes, { prefix: '/api' });
await fastify.register(relationsRoutes, { prefix: '/api' });
await fastify.register(templatesRoutes, { prefix: '/api/templates' });
await fastify.register(analyticsRoutes, { prefix: '/api/analytics' });
await fastify.register(websocketRoutes, { prefix: '/api' });
await fastify.register(importRoutes, { prefix: '/api/import' });
await fastify.register(reviewRoutes, { prefix: '/api/review' });
await fastify.register(dashboardRoutes, { prefix: '/api/dashboard' });
await fastify.register(gpsRoutes, { prefix: '/api/gps' });
await fastify.register(webhooksRoutes, { prefix: '/api/webhooks' });
await fastify.register(activityRoutes, { prefix: '/api/activity' });
await fastify.register(smartSearchRoutes, { prefix: '/api/smart-search' });
await fastify.register(postMortemRoutes, { prefix: '/api/postmortem' });
await fastify.register(reportsRoutes, { prefix: '/api/reports' });
await fastify.register(integrationsRoutes, { prefix: '/api/integrations' });
await fastify.register(gamificationRoutes, { prefix: '/api/gamification' });
await fastify.register(helpCenterRoutes, { prefix: '/api/help-center' });

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
const start = async() => {
    try {
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
const gracefulShutdown = async() => {
    fastify.log.info('Shutting down gracefully...');
    await fastify.close();
    await mongoClient.close();
    process.exit(0);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

start();