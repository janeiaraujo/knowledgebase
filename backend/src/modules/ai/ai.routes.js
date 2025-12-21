import OpenAI from 'openai';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { tenantMiddleware } from '../../middlewares/tenant.middleware.js';
import { requirePermission } from '../../middlewares/rbac.middleware.js';
import Joi from 'joi';

// Lazy load OpenAI instance to ensure env vars are loaded
let openai;
function getOpenAI() {
  if (!openai) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }
  return openai;
}

export default async function aiRoutes(fastify, options) {
  
  // Generate KB draft from text
  fastify.post('/generate-draft', {
    preHandler: [authMiddleware, tenantMiddleware, requirePermission('ai:use')]
  }, async (request, reply) => {
    const db = fastify.db();
    const { content, type, context } = request.body;
    
    // Check AI credits
    const canUse = await checkAICredits(db, request.tenantId);
    if (!canUse) {
      return reply.status(429).send({ 
        error: 'AI credits exhausted. Please upgrade your plan.' 
      });
    }
    
    try {
      const prompt = buildPrompt(type, content, context);
      
      const completion = await getOpenAI().chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are a technical documentation expert specializing in incident response and knowledge base creation. Generate clear, structured, and actionable documentation in Markdown format.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 2000
      });
      
      const generatedContent = completion.choices[0].message.content;
      
      // Track AI usage
      await trackAIUsage(db, request.tenantId, request.currentUser._id, {
        action: 'generate_draft',
        type,
        tokens: completion.usage.total_tokens,
        cost_credits: Math.ceil(completion.usage.total_tokens / 100)
      });
      
      return {
        success: true,
        content: generatedContent,
        metadata: {
          type,
          tokens_used: completion.usage.total_tokens
        }
      };
      
    } catch (error) {
      fastify.log.error('AI generation error:', error);
      return reply.status(500).send({ 
        error: 'Failed to generate content' 
      });
    }
  });
  
  // Summarize text
  fastify.post('/summarize', {
    preHandler: [authMiddleware, tenantMiddleware, requirePermission('ai:use')]
  }, async (request, reply) => {
    const db = fastify.db();
    const { content, max_length } = request.body;
    
    const canUse = await checkAICredits(db, request.tenantId);
    if (!canUse) {
      return reply.status(429).send({ error: 'AI credits exhausted' });
    }
    
    try {
      const completion = await getOpenAI().chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: `Summarize the following text in approximately ${max_length} words. Be concise and focus on key points.`
          },
          {
            role: 'user',
            content
          }
        ],
        temperature: 0.5,
        max_tokens: Math.ceil(max_length * 1.5)
      });
      
      const summary = completion.choices[0].message.content;
      
      await trackAIUsage(db, request.tenantId, request.currentUser._id, {
        action: 'summarize',
        tokens: completion.usage.total_tokens,
        cost_credits: Math.ceil(completion.usage.total_tokens / 100)
      });
      
      return { success: true, summary };
      
    } catch (error) {
      fastify.log.error('AI summarization error:', error);
      return reply.status(500).send({ error: 'Summarization failed' });
    }
  });
  
  // Generate embeddings for semantic search
  fastify.post('/generate-embeddings', {
    preHandler: [authMiddleware, tenantMiddleware, requirePermission('ai:use')]
  }, async (request, reply) => {
    const db = fastify.db();
    const { record_id, text } = request.body;
    
    const canUse = await checkAICredits(db, request.tenantId);
    if (!canUse) {
      return reply.status(429).send({ error: 'AI credits exhausted' });
    }
    
    try {
      const response = await getOpenAI().embeddings.create({
        model: 'text-embedding-3-small',
        input: text
      });
      
      const embedding = response.data[0].embedding;
      
      // Store embedding
      await db.collection('ai_embeddings').updateOne(
        { 
          tenant_id: request.tenantId,
          record_id 
        },
        {
          $set: {
            tenant_id: request.tenantId,
            record_id,
            embedding,
            text_length: text.length,
            created_at: new Date(),
            updated_at: new Date()
          }
        },
        { upsert: true }
      );
      
      await trackAIUsage(db, request.tenantId, request.currentUser._id, {
        action: 'generate_embeddings',
        tokens: response.usage.total_tokens,
        cost_credits: 1
      });
      
      return { success: true };
      
    } catch (error) {
      fastify.log.error('Embedding generation error:', error);
      return reply.status(500).send({ error: 'Embedding generation failed' });
    }
  });
  
  // Semantic search
  fastify.post('/semantic-search', {
    preHandler: [authMiddleware, tenantMiddleware, requirePermission('ai:use')]
  }, async (request, reply) => {
    const db = fastify.db();
    const { query, limit } = request.body;
    
    const canUse = await checkAICredits(db, request.tenantId);
    if (!canUse) {
      return reply.status(429).send({ error: 'AI credits exhausted' });
    }
    
    try {
      // Generate query embedding
      const response = await getOpenAI().embeddings.create({
        model: 'text-embedding-3-small',
        input: query
      });
      
      const queryEmbedding = response.data[0].embedding;
      
      // Find similar embeddings (using cosine similarity)
      // Note: For production, use vector database like Pinecone or MongoDB Atlas Vector Search
      const allEmbeddings = await db.collection('ai_embeddings')
        .find({ tenant_id: request.tenantId })
        .toArray();
      
      const results = allEmbeddings
        .map(doc => ({
          record_id: doc.record_id,
          similarity: cosineSimilarity(queryEmbedding, doc.embedding)
        }))
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, parseInt(limit));
      
      // Get record details
      const recordIds = results.map(r => r.record_id);
      const records = await db.collection('records')
        .find({
          _id: { $in: recordIds },
          tenant_id: request.tenantId,
          status: { $in: ['approved', 'published'] }
        })
        .toArray();
      
      const enrichedResults = results.map(r => ({
        ...records.find(rec => rec._id.equals(r.record_id)),
        similarity: r.similarity
      })).filter(r => r._id); // Filter out null records
      
      await trackAIUsage(db, request.tenantId, request.currentUser._id, {
        action: 'semantic_search',
        tokens: response.usage.total_tokens,
        cost_credits: 1
      });
      
      return { 
        success: true, 
        results: enrichedResults 
      };
      
    } catch (error) {
      fastify.log.error('Semantic search error:', error);
      return reply.status(500).send({ error: 'Semantic search failed' });
    }
  });
  
  // Suggest properties for KB
  fastify.post('/suggest-properties', {
    preHandler: [authMiddleware, tenantMiddleware, requirePermission('ai:use')]
  }, async (request, reply) => {
    const db = fastify.db();
    const { title, content } = request.body;
    
    const canUse = await checkAICredits(db, request.tenantId);
    if (!canUse) {
      return reply.status(429).send({ error: 'AI credits exhausted' });
    }
    
    try {
      const completion = await getOpenAI().chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are an expert at categorizing incident documentation. Suggest appropriate properties (category, priority, tags) based on the content. Respond in JSON format only.'
          },
          {
            role: 'user',
            content: `Title: ${title}\n\nContent: ${content.substring(0, 1000)}`
          }
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' }
      });
      
      const suggestions = JSON.parse(completion.choices[0].message.content);
      
      await trackAIUsage(db, request.tenantId, request.currentUser._id, {
        action: 'suggest_properties',
        tokens: completion.usage.total_tokens,
        cost_credits: 1
      });
      
      return { success: true, suggestions };
      
    } catch (error) {
      fastify.log.error('Property suggestion error:', error);
      return reply.status(500).send({ error: 'Failed to suggest properties' });
    }
  });
}

// Helper functions
function buildPrompt(type, content, context) {
  const prompts = {
    kb: `Create a comprehensive Knowledge Base article from this incident information. Include:
    - Clear title
    - Problem description
    - Root cause (if identifiable)
    - Solution/Resolution steps
    - Prevention measures
    
    Content: ${content}
    ${context ? `\nAdditional Context: ${context}` : ''}
    
    Format as Markdown.`,
    
    rca: `Perform a Root Cause Analysis (RCA) on this incident. Include:
    - Incident summary
    - Timeline of events
    - Root cause identification
    - Contributing factors
    - Action items
    
    Content: ${content}
    ${context ? `\nAdditional Context: ${context}` : ''}
    
    Format as Markdown.`,
    
    postmortem: `Create a detailed post-mortem document. Include:
    - Executive summary
    - What happened
    - Impact assessment
    - Root causes
    - Lessons learned
    - Action items with owners
    
    Content: ${content}
    ${context ? `\nAdditional Context: ${context}` : ''}
    
    Format as Markdown.`
  };
  
  return prompts[type] || prompts.kb;
}

async function checkAICredits(db, tenantId) {
  const subscription = await db.collection('subscriptions').findOne({
    tenant_id: tenantId,
    status: 'active'
  });
  
  if (!subscription) return false;
  
  return subscription.usage.ai_credits_used < subscription.limits.ai_credits_per_month;
}

async function trackAIUsage(db, tenantId, userId, data) {
  await db.collection('usage_metrics').insertOne({
    tenant_id: tenantId,
    user_id: userId,
    resource_type: 'ai',
    ...data,
    timestamp: new Date()
  });
  
  await db.collection('subscriptions').updateOne(
    { tenant_id: tenantId },
    { $inc: { 'usage.ai_credits_used': data.cost_credits } }
  );
}

function cosineSimilarity(vecA, vecB) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
