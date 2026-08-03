import { MongoClient } from 'mongodb';
import { hashPassword } from '../modules/auth/auth.service.js';
import { nanoid } from 'nanoid';
import dotenv from 'dotenv';

dotenv.config();

const mongoClient = new MongoClient(process.env.MONGODB_URI);

async function seed() {
  try {
    await mongoClient.connect();
    const db = mongoClient.db();
    
    console.log('🌱 Seeding database...');
    
    // Create demo tenant
    const tenant = {
      name: 'Demo Organization',
      created_at: new Date(),
      active: true,
      settings: {
        max_users: 5,
        max_records: 1000,
        max_events_per_month: 10000,
        ai_credits: 1000
      }
    };
    
    const tenantResult = await db.collection('tenants').insertOne(tenant);
    const tenantId = tenantResult.insertedId;
    console.log('✅ Tenant created:', tenantId);
    
    // Create organization
    await db.collection('organizations').insertOne({
      tenant_id: tenantId,
      name: 'Demo Organization',
      created_at: new Date()
    });
    
    // Create demo user
    const demoUser = {
      tenant_id: tenantId,
      email: 'demo@incidentkb.com',
      password: await hashPassword('demo123'),
      name: 'Demo User',
      role: 'owner',
      active: true,
      email_verified: true,
      created_at: new Date(),
      last_login: null
    };
    
    const userResult = await db.collection('users').insertOne(demoUser);
    console.log('✅ Demo user created: demo@incidentkb.com / demo123');
    
    // Create subscription
    await db.collection('subscriptions').insertOne({
      tenant_id: tenantId,
      plan: 'free',
      status: 'active',
      limits: {
        max_users: 5,
        max_records: 1000,
        max_events_per_month: 10000,
        ai_credits_per_month: 1000
      },
      usage: {
        users: 1,
        records: 0,
        events: 0,
        ai_credits_used: 0
      },
      created_at: new Date(),
      period_start: new Date(),
      period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    });
    
    // Create demo database
    const database = {
      tenant_id: tenantId,
      name: 'Production Incidents',
      description: 'Knowledge base for production incidents and troubleshooting',
      icon: '🚨',
      properties: [
        { name: 'Status', type: 'select', options: ['captured', 'draft', 'in_review', 'approved', 'published', 'deprecated'] },
        { name: 'Priority', type: 'select', options: ['low', 'medium', 'high', 'critical'] },
        { name: 'Category', type: 'select', options: ['incident', 'problem', 'change', 'howto', 'troubleshooting'] },
        { name: 'Tags', type: 'multi-select', options: ['database', 'api', 'network', 'frontend', 'backend', 'deployment'] },
        { name: 'Created By', type: 'text' },
        { name: 'Created At', type: 'date' },
        { name: 'Last Updated', type: 'date' }
      ],
      created_by: userResult.insertedId,
      created_at: new Date(),
      updated_at: new Date()
    };
    
    const dbResult = await db.collection('databases').insertOne(database);
    const databaseId = dbResult.insertedId;
    console.log('✅ Database created:', databaseId);
    
    // Create demo KB records
    const kbRecords = [
      {
        tenant_id: tenantId,
        database_id: databaseId,
        title: 'Database Connection Pool Exhaustion',
        content_md: `# Database Connection Pool Exhaustion

## Problem
Application experiencing timeouts when connecting to the database during peak hours.

## Root Cause
Connection pool was configured with a maximum of 10 connections, which was insufficient for the application load.

## Solution
1. Increased connection pool size to 50 connections
2. Implemented connection timeout handling
3. Added connection pool monitoring

## Configuration
\`\`\`yaml
database:
  pool:
    max: 50
    min: 10
    acquire: 30000
    idle: 10000
\`\`\`

## Prevention
- Monitor connection pool usage regularly
- Set up alerts when pool usage exceeds 80%
- Review and adjust pool size based on application load

## Related Issues
- Performance degradation during peak hours
- Increased response times
- User-reported timeouts
`,
        properties: {
          status: 'published',
          priority: 'high',
          category: 'troubleshooting',
          tags: ['database', 'backend', 'performance']
        },
        status: 'published',
        version: 1,
        created_by: userResult.insertedId,
        created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        updated_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        approved_by: userResult.insertedId,
        approved_at: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
        published_at: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000)
      },
      {
        tenant_id: tenantId,
        database_id: databaseId,
        title: 'API Rate Limiting Configuration',
        content_md: `# API Rate Limiting Configuration

## Overview
How to configure and manage API rate limiting for our services.

## Default Limits
- Authenticated users: 1000 requests/hour
- Anonymous users: 100 requests/hour
- Admin endpoints: 100 requests/hour

## Configuration
\`\`\`javascript
rateLimit: {
  max: 1000,
  timeWindow: '1 hour',
  cache: 10000,
  allowList: ['internal-service-ip'],
  skipOnError: false
}
\`\`\`

## Monitoring
Monitor rate limit violations in the dashboard:
- Go to Admin > API Monitoring
- Filter by status code 429
- Review violating IPs and patterns

## Adjustments
To adjust limits for specific clients:
1. Create an exception in the admin panel
2. Specify client IP or API key
3. Set custom limits

## Best Practices
- Always implement exponential backoff on clients
- Monitor 429 responses
- Communicate limits in API documentation
- Use Redis for distributed rate limiting
`,
        properties: {
          status: 'published',
          priority: 'medium',
          category: 'howto',
          tags: ['api', 'backend', 'configuration']
        },
        status: 'published',
        version: 1,
        created_by: userResult.insertedId,
        created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        updated_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        approved_by: userResult.insertedId,
        approved_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
        published_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000)
      },
      {
        tenant_id: tenantId,
        database_id: databaseId,
        title: 'Memory Leak in Background Job',
        content_md: `# Memory Leak in Background Job

## Incident Summary
Production worker experiencing progressive memory growth leading to OOM crashes every 6 hours.

## Timeline
- **14:00** - First OOM alert received
- **14:15** - Restarted worker service
- **14:30** - Memory profiling initiated
- **15:00** - Leak identified in image processing job
- **16:00** - Fix deployed and tested
- **18:00** - Monitoring confirmed issue resolved

## Root Cause
The image processing background job was not properly releasing sharp image buffers after processing, causing gradual memory accumulation.

## Fix Applied
\`\`\`javascript
// Before (leaked memory)
async function processImage(buffer) {
  const image = sharp(buffer);
  const result = await image.resize(800, 600).toBuffer();
  return result;
}

// After (properly releases memory)
async function processImage(buffer) {
  const image = sharp(buffer);
  const result = await image.resize(800, 600).toBuffer();
  image.destroy(); // Explicitly release resources
  return result;
}
\`\`\`

## Prevention
1. Added memory monitoring for all background jobs
2. Implemented automatic restart on memory threshold
3. Added unit tests for resource cleanup
4. Updated development guidelines

## Action Items
- [ ] Review all other background jobs for similar issues
- [x] Add memory profiling to CI/CD
- [x] Update monitoring dashboards
- [x] Document best practices
`,
        properties: {
          status: 'published',
          priority: 'critical',
          category: 'incident',
          tags: ['backend', 'memory', 'performance']
        },
        status: 'published',
        version: 1,
        created_by: userResult.insertedId,
        created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        updated_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        approved_by: userResult.insertedId,
        approved_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        published_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
      }
    ];
    
    await db.collection('records').insertMany(kbRecords);
    console.log('✅ Created 3 demo KB records');
    
    // Update subscription usage
    await db.collection('subscriptions').updateOne(
      { tenant_id: tenantId },
      { $set: { 'usage.records': 3 } }
    );
    
    // Create API token for event ingestion
    const apiToken = nanoid(32);
    await db.collection('api_tokens').insertOne({
      tenant_id: tenantId,
      token: apiToken,
      label: 'Token de demonstração',
      source: 'custom',
      active: true,
      auto_create_incident: false,
      auto_create_severity_threshold: 'high',
      created_by: userResult.insertedId,
      created_at: new Date(),
      last_used_at: null
    });
    console.log('✅ API token created:', apiToken);
    console.log('   Use this token for event ingestion (header: x-api-token)');
    
    console.log('\n🎉 Seed completed successfully!');
    console.log('\nDemo credentials:');
    console.log('  Email: demo@incidentkb.com');
    console.log('  Password: demo123');
    console.log(`\n  API Token: ${apiToken}`);
    
  } catch (error) {
    console.error('❌ Seed error:', error);
  } finally {
    await mongoClient.close();
  }
}

seed();
