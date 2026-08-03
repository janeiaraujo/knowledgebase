import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { toObjectId } from '../../utils/mongodb.js';
import { tenantMiddleware } from '../../middlewares/tenant.middleware.js';
import { requirePermission } from '../../middlewares/rbac.middleware.js';
import crypto from 'crypto';

// Ordem de severidade usada tanto para o threshold de auto-criacao de
// incidente quanto para decidir a severidade do incidente gerado.
const SEVERITY_RANK = { info: 0, low: 1, medium: 2, high: 3, critical: 4 };

const buildIncidentFromEvent = (event, tenantId, { userId = null, createdVia }) => ({
  tenant_id: tenantId,
  title: event.title,
  description: event.description || `Criado automaticamente a partir de evento de ${event.source}`,
  severity: event.severity in SEVERITY_RANK ? event.severity : 'high',
  affected_services: [],
  status: 'open',
  created_by: userId,
  created_via: createdVia, // 'manual_conversion' | 'auto_ingest'
  created_at: new Date(),
  updated_at: new Date(),
  acknowledged_at: null,
  acknowledged_by: null,
  resolved_at: null,
  source_event_id: event._id,
  timeline: [{
    action: 'created_from_event',
    user_id: userId,
    timestamp: new Date(),
    note: createdVia === 'auto_ingest'
      ? `Aberto automaticamente a partir de evento de ${event.source} (severidade ${event.severity})`
      : `Criado a partir de evento de ${event.source}`
  }]
});

// Mascara um token para exibicao (nunca reenviamos o valor completo depois
// da criacao - mesma pratica de GitHub PATs / chaves de API em geral).
const maskToken = (token) => `${token.slice(0, 8)}...${token.slice(-4)}`;

export default async function eventRoutes(fastify, options) {

  // ==================== INGESTAO DE EVENTOS (publico, autenticado por token) ====================

  // Ingest external events - Zabbix, Grafana, Datadog, Sentry, etc.
  fastify.post('/ingest', async (request, reply) => {
    const db = fastify.db();
    const apiToken = request.headers['x-api-token'];

    if (!apiToken) {
      return reply.status(401).send({ error: 'Cabeçalho x-api-token é obrigatório' });
    }

    // Validate API token
    const tokenDoc = await db.collection('api_tokens').findOne({
      token: apiToken,
      active: true
    });

    if (!tokenDoc) {
      return reply.status(401).send({ error: 'Invalid API token' });
    }

    const tenantId = tokenDoc.tenant_id;

    // Check subscription limits - se nao ha assinatura ativa (comum em
    // instancias self-hosted sem billing configurado), nao bloqueia a
    // ingestao; o limite so vale quando ha um plano de fato limitando.
    const subscription = await db.collection('subscriptions').findOne({
      tenant_id: tenantId,
      status: 'active'
    });

    if (subscription?.limits?.max_events_per_month) {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const eventCount = await db.collection('events').countDocuments({
        tenant_id: tenantId,
        created_at: { $gte: startOfMonth }
      });

      if (eventCount >= subscription.limits.max_events_per_month) {
        return reply.status(429).send({
          error: 'Event limit reached for this month.'
        });
      }
    }

    const { source, event_type, severity, title, description, timestamp, metadata } = request.body || {};

    if (!source || !title) {
      return reply.status(400).send({ error: 'source e title são obrigatórios' });
    }

    const normalizedSeverity = severity && severity in SEVERITY_RANK ? severity : 'info';

    // Generate event hash for deduplication
    const eventHash = crypto
      .createHash('md5')
      .update(`${source}:${event_type}:${title}`)
      .digest('hex');

    // Check for duplicates in last 5 minutes
    const recentDuplicate = await db.collection('events').findOne({
      tenant_id: tenantId,
      event_hash: eventHash,
      created_at: { $gte: new Date(Date.now() - 5 * 60 * 1000) }
    });

    db.collection('api_tokens').updateOne(
      { _id: tokenDoc._id },
      { $set: { last_used_at: new Date() } }
    ).catch(() => {});

    if (recentDuplicate) {
      // Update occurrence count
      await db.collection('events').updateOne(
        { _id: recentDuplicate._id },
        {
          $inc: { occurrence_count: 1 },
          $set: { last_occurrence: new Date() }
        }
      );

      return {
        success: true,
        deduplicated: true,
        eventId: recentDuplicate._id,
        incidentId: recentDuplicate.related_incidents?.[0] || null
      };
    }

    // Create new event
    const event = {
      tenant_id: tenantId,
      event_hash: eventHash,
      source,
      event_type,
      severity: normalizedSeverity,
      title,
      description: description || '',
      timestamp: timestamp ? new Date(timestamp) : new Date(),
      metadata: metadata || {},
      occurrence_count: 1,
      last_occurrence: new Date(),
      created_at: new Date(),
      related_incidents: [],
      related_kbs: []
    };

    const result = await db.collection('events').insertOne(event);
    event._id = result.insertedId;

    // Update subscription usage
    if (subscription) {
      await db.collection('subscriptions').updateOne(
        { tenant_id: tenantId },
        { $inc: { 'usage.events': 1 } }
      );
    }

    // Try to auto-relate with existing KBs (async, nao bloqueia a resposta)
    findRelatedKBs(db, event._id, tenantId, title, description).catch(err => {
      fastify.log.error('Failed to find related KBs:', err);
    });

    // Abertura automatica de incidente: opt-in por token/fonte, com um piso
    // de severidade configuravel (evita fadiga de alerta abrindo incidente
    // pra todo evento de baixa severidade por padrao).
    let incidentId = null;
    if (tokenDoc.auto_create_incident) {
      const threshold = tokenDoc.auto_create_severity_threshold || 'high';
      const meetsThreshold = SEVERITY_RANK[normalizedSeverity] >= (SEVERITY_RANK[threshold] ?? SEVERITY_RANK.high);

      if (meetsThreshold) {
        const incidentDoc = buildIncidentFromEvent(event, tenantId, { createdVia: 'auto_ingest' });
        const incidentResult = await db.collection('incidents').insertOne(incidentDoc);
        incidentId = incidentResult.insertedId;

        await db.collection('events').updateOne(
          { _id: event._id },
          { $push: { related_incidents: incidentId } }
        );
      }
    }

    return {
      success: true,
      eventId: event._id,
      incidentId
    };
  });

  // ==================== FONTES DE EVENTOS (tokens de ingestão) ====================
  // Gerenciamento dos tokens usados pelo /ingest acima. Cada token representa
  // uma fonte (Zabbix, Grafana, Datadog, Sentry, custom) e pode opcionalmente
  // abrir incidentes automaticamente a partir de um piso de severidade.

  fastify.get('/tokens', {
    preHandler: [authMiddleware, tenantMiddleware, requirePermission('org:manage')]
  }, async (request, reply) => {
    const db = fastify.db();
    const tokens = await db.collection('api_tokens')
      .find({ tenant_id: request.tenantId })
      .sort({ created_at: -1 })
      .toArray();

    return {
      tokens: tokens.map(t => ({
        _id: t._id,
        label: t.label,
        source: t.source,
        token_preview: maskToken(t.token),
        active: t.active,
        auto_create_incident: Boolean(t.auto_create_incident),
        auto_create_severity_threshold: t.auto_create_severity_threshold || null,
        created_at: t.created_at,
        last_used_at: t.last_used_at || null
      }))
    };
  });

  fastify.post('/tokens', {
    preHandler: [authMiddleware, tenantMiddleware, requirePermission('org:manage')]
  }, async (request, reply) => {
    const db = fastify.db();
    const { label, source, auto_create_incident, auto_create_severity_threshold } = request.body || {};

    if (!label || !source) {
      return reply.status(400).send({ error: 'label e source são obrigatórios' });
    }

    if (auto_create_severity_threshold && !(auto_create_severity_threshold in SEVERITY_RANK)) {
      return reply.status(400).send({ error: 'auto_create_severity_threshold inválido' });
    }

    const token = crypto.randomBytes(24).toString('hex');

    const tokenDoc = {
      tenant_id: request.tenantId,
      token,
      label,
      source,
      active: true,
      auto_create_incident: Boolean(auto_create_incident),
      auto_create_severity_threshold: auto_create_severity_threshold || 'high',
      created_by: request.currentUser._id,
      created_at: new Date(),
      last_used_at: null
    };

    const result = await db.collection('api_tokens').insertOne(tokenDoc);

    await db.collection('audit_logs').insertOne({
      tenant_id: request.tenantId,
      user_id: request.currentUser._id,
      action: 'event_token.created',
      resource: 'api_token',
      resource_id: result.insertedId,
      details: { label, source },
      timestamp: new Date()
    });

    // O valor bruto do token so e retornado aqui, na criacao - a partir daqui
    // so a versao mascarada fica disponivel (GET /tokens).
    return reply.status(201).send({
      success: true,
      token, // copie agora - nao sera mostrado novamente
      tokenId: result.insertedId,
      ingest_url: `${process.env.BACKEND_PUBLIC_URL || 'http://localhost:3000'}/api/events/ingest`
    });
  });

  fastify.delete('/tokens/:tokenId', {
    preHandler: [authMiddleware, tenantMiddleware, requirePermission('org:manage')]
  }, async (request, reply) => {
    const db = fastify.db();
    const objectId = toObjectId(request.params.tokenId);
    if (!objectId) {
      return reply.status(400).send({ error: 'ID de token inválido' });
    }

    const result = await db.collection('api_tokens').updateOne(
      { _id: objectId, tenant_id: request.tenantId },
      { $set: { active: false, revoked_at: new Date(), revoked_by: request.currentUser._id } }
    );

    if (result.matchedCount === 0) {
      return reply.status(404).send({ error: 'Token não encontrado' });
    }

    await db.collection('audit_logs').insertOne({
      tenant_id: request.tenantId,
      user_id: request.currentUser._id,
      action: 'event_token.revoked',
      resource: 'api_token',
      resource_id: objectId,
      timestamp: new Date()
    });

    return { success: true };
  });

  // ==================== EVENTOS ====================

  // List events
  fastify.get('/', {
    preHandler: [authMiddleware, tenantMiddleware, requirePermission('event:read')]
  }, async (request, reply) => {
    const db = fastify.db();
    const { source, severity, page = 1, limit = 50 } = request.query;

    const filter = { tenant_id: request.tenantId };
    if (source) filter.source = source;
    if (severity) filter.severity = severity;

    const events = await db.collection('events')
      .find(filter)
      .sort({ created_at: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .toArray();

    const total = await db.collection('events').countDocuments(filter);

    return { events, pagination: { page: parseInt(page), limit: parseInt(limit), total } };
  });

  // Convert event to incident
  fastify.post('/:eventId/convert-to-incident', {
    preHandler: [authMiddleware, tenantMiddleware, requirePermission('incident:create')]
  }, async (request, reply) => {
    const db = fastify.db();
    const objectId = toObjectId(request.params.eventId);
    if (!objectId) {
      return reply.status(400).send({ error: 'ID de evento inválido' });
    }

    const event = await db.collection('events').findOne({
      _id: objectId,
      tenant_id: request.tenantId
    });

    if (!event) {
      return reply.status(404).send({ error: 'Event not found' });
    }

    if (event.related_incidents?.length) {
      return reply.status(400).send({
        error: 'Este evento já foi convertido em incidente',
        incidentId: event.related_incidents[0]
      });
    }

    const incidentDoc = buildIncidentFromEvent(event, request.tenantId, {
      userId: request.currentUser._id,
      createdVia: 'manual_conversion'
    });

    const result = await db.collection('incidents').insertOne(incidentDoc);

    // Link event to incident
    await db.collection('events').updateOne(
      { _id: objectId },
      { $push: { related_incidents: result.insertedId } }
    );

    return { success: true, incidentId: result.insertedId };
  });
}

// Helper function to find related KBs
async function findRelatedKBs(db, eventId, tenantId, title, description) {
  const searchText = `${title} ${description}`.toLowerCase().trim();
  if (!searchText) return;

  const relatedKBs = await db.collection('records')
    .find({
      tenant_id: tenantId,
      status: { $in: ['approved', 'published'] },
      $text: { $search: searchText }
    })
    .limit(3)
    .toArray();

  if (relatedKBs.length > 0) {
    await db.collection('events').updateOne(
      { _id: eventId },
      { $set: { related_kbs: relatedKBs.map(kb => kb._id) } }
    );
  }
}
