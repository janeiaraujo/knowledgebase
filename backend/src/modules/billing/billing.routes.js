import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { tenantMiddleware } from '../../middlewares/tenant.middleware.js';
import { requireOwner } from '../../middlewares/rbac.middleware.js';
import axios from 'axios';

const ASAAS_API_URL = process.env.ASAAS_ENVIRONMENT === 'production' 
  ? 'https://www.asaas.com/api/v3'
  : 'https://sandbox.asaas.com/api/v3';

// Integracao com o Asaas ainda nao ligada: a chamada real esta comentada
// mais abaixo. Mantido como andaime, e nao removido, para quem for
// concluir nao precisar reescrever do zero.
// eslint-disable-next-line no-unused-vars
const asaasClient = axios.create({
  baseURL: ASAAS_API_URL,
  headers: {
    'access_token': process.env.ASAAS_API_KEY,
    'Content-Type': 'application/json'
  }
});

export default async function billingRoutes(fastify, options) {
  
  // Get current subscription
  fastify.get('/subscription', {
    preHandler: [authMiddleware, tenantMiddleware]
  }, async (request, reply) => {
    const db = fastify.db();
    
    const subscription = await db.collection('subscriptions').findOne({
      tenant_id: request.tenantId
    });
    
    if (!subscription) {
      return reply.status(404).send({ error: 'Subscription not found' });
    }
    
    return { subscription };
  });
  
  // Get usage metrics
  fastify.get('/usage', {
    preHandler: [authMiddleware, tenantMiddleware]
  }, async (request, reply) => {
    const db = fastify.db();
    
    const subscription = await db.collection('subscriptions').findOne({
      tenant_id: request.tenantId
    });
    
    if (!subscription) {
      return reply.status(404).send({ error: 'Subscription not found' });
    }
    
    // Calculate usage percentages
    const usage = {
      users: {
        used: subscription.usage.users,
        limit: subscription.limits.max_users,
        percentage: (subscription.usage.users / subscription.limits.max_users) * 100
      },
      records: {
        used: subscription.usage.records,
        limit: subscription.limits.max_records,
        percentage: (subscription.usage.records / subscription.limits.max_records) * 100
      },
      events: {
        used: subscription.usage.events,
        limit: subscription.limits.max_events_per_month,
        percentage: (subscription.usage.events / subscription.limits.max_events_per_month) * 100
      },
      ai_credits: {
        used: subscription.usage.ai_credits_used,
        limit: subscription.limits.ai_credits_per_month,
        percentage: (subscription.usage.ai_credits_used / subscription.limits.ai_credits_per_month) * 100
      }
    };
    
    return { usage };
  });
  
  // Available plans
  fastify.get('/plans', {
    preHandler: [authMiddleware, tenantMiddleware]
  }, async (request, reply) => {
    const plans = [
      {
        id: 'free',
        name: 'Free',
        price: 0,
        currency: 'BRL',
        billing_period: 'monthly',
        limits: {
          max_users: 5,
          max_records: 1000,
          max_events_per_month: 10000,
          ai_credits_per_month: 1000
        },
        features: [
          'Up to 5 users',
          'Up to 1,000 KB records',
          'Up to 10,000 events/month',
          '1,000 AI credits/month',
          'Basic support'
        ]
      },
      {
        id: 'starter',
        name: 'Starter',
        price: 99,
        currency: 'BRL',
        billing_period: 'monthly',
        limits: {
          max_users: 20,
          max_records: 10000,
          max_events_per_month: 100000,
          ai_credits_per_month: 10000
        },
        features: [
          'Up to 20 users',
          'Up to 10,000 KB records',
          'Up to 100,000 events/month',
          '10,000 AI credits/month',
          'Priority support',
          'Advanced analytics'
        ]
      },
      {
        id: 'professional',
        name: 'Professional',
        price: 299,
        currency: 'BRL',
        billing_period: 'monthly',
        limits: {
          max_users: 100,
          max_records: 50000,
          max_events_per_month: 500000,
          ai_credits_per_month: 50000
        },
        features: [
          'Up to 100 users',
          'Up to 50,000 KB records',
          'Up to 500,000 events/month',
          '50,000 AI credits/month',
          '24/7 support',
          'Advanced analytics',
          'Custom integrations',
          'SLA guarantee'
        ]
      },
      {
        id: 'enterprise',
        name: 'Enterprise',
        price: null, // Custom pricing
        currency: 'BRL',
        billing_period: 'custom',
        limits: {
          max_users: -1, // Unlimited
          max_records: -1,
          max_events_per_month: -1,
          ai_credits_per_month: -1
        },
        features: [
          'Unlimited users',
          'Unlimited KB records',
          'Unlimited events',
          'Unlimited AI credits',
          'Dedicated support',
          'Custom features',
          'On-premise deployment option',
          'Custom SLA'
        ]
      }
    ];
    
    return { plans };
  });
  
  // Upgrade/change plan
  fastify.post('/change-plan', {
    preHandler: [authMiddleware, tenantMiddleware, requireOwner]
  }, async (request, reply) => {
    const db = fastify.db();
    const { plan_id } = request.body;
    
    const plans = {
      free: {
        max_users: 5,
        max_records: 1000,
        max_events_per_month: 10000,
        ai_credits_per_month: 1000,
        price: 0
      },
      starter: {
        max_users: 20,
        max_records: 10000,
        max_events_per_month: 100000,
        ai_credits_per_month: 10000,
        price: 99
      },
      professional: {
        max_users: 100,
        max_records: 50000,
        max_events_per_month: 500000,
        ai_credits_per_month: 50000,
        price: 299
      }
    };
    
    const newPlan = plans[plan_id];
    if (!newPlan) {
      return reply.status(400).send({ error: 'Invalid plan' });
    }
    
    // Update subscription
    await db.collection('subscriptions').updateOne(
      { tenant_id: request.tenantId },
      { 
        $set: {
          plan: plan_id,
          limits: newPlan,
          updated_at: new Date()
        }
      }
    );
    
    // If paid plan, create Asaas subscription (mock for MVP)
    if (newPlan.price > 0) {
      try {
        // Create customer in Asaas
        const tenant = await db.collection('tenants').findOne({ _id: request.tenantId });
        const user = request.currentUser;
        
        // eslint-disable-next-line no-unused-vars
        const customerData = {
          name: tenant.name,
          email: user.email,
          cpfCnpj: '00000000000', // TODO: Collect from user
          notificationDisabled: false
        };
        
        // TODO: Implement actual Asaas integration
        // const customerResponse = await asaasClient.post('/customers', customerData);
        
        fastify.log.info('Asaas integration pending - MVP mode');
        
      } catch (error) {
        fastify.log.error('Asaas integration error:', error);
        // Don't fail the plan change in MVP
      }
    }
    
    // Audit log
    await db.collection('audit_logs').insertOne({
      tenant_id: request.tenantId,
      user_id: request.currentUser._id,
      action: 'subscription.plan_changed',
      resource: 'subscription',
      timestamp: new Date(),
      metadata: { new_plan: plan_id }
    });
    
    return { success: true, plan: plan_id };
  });
  
  // Get billing history
  fastify.get('/history', {
    preHandler: [authMiddleware, tenantMiddleware, requireOwner]
  }, async (request, reply) => {
    const db = fastify.db();
    
    const history = await db.collection('billing_history')
      .find({ tenant_id: request.tenantId })
      .sort({ created_at: -1 })
      .limit(50)
      .toArray();
    
    return { history };
  });
  
  // Get detailed usage metrics
  fastify.get('/metrics', {
    preHandler: [authMiddleware, tenantMiddleware]
  }, async (request, reply) => {
    const db = fastify.db();
    const { start_date, end_date } = request.query;
    
    const filter = { tenant_id: request.tenantId };
    
    if (start_date && end_date) {
      filter.timestamp = {
        $gte: new Date(start_date),
        $lte: new Date(end_date)
      };
    }
    
    const metrics = await db.collection('usage_metrics')
      .find(filter)
      .sort({ timestamp: -1 })
      .limit(1000)
      .toArray();
    
    // Aggregate by resource type
    const aggregated = metrics.reduce((acc, metric) => {
      const type = metric.resource_type;
      if (!acc[type]) {
        acc[type] = { count: 0, total_credits: 0 };
      }
      acc[type].count++;
      acc[type].total_credits += metric.cost_credits || 0;
      return acc;
    }, {});
    
    return { metrics: aggregated, detailed: metrics };
  });
}
