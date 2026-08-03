import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { toObjectId } from '../../utils/mongodb.js';
import { tenantMiddleware } from '../../middlewares/tenant.middleware.js';
import { requireAdmin } from '../../middlewares/rbac.middleware.js';
import Joi from 'joi';

// Idiomas suportados pela interface (mesma lista do frontend/src/i18n).
const SUPPORTED_LANGUAGES = ['pt', 'en'];

// Valores devolvidos quando a organizacao ainda nao tem settings gravados.
const defaultSettings = (settings = {}) => ({
    default_language: SUPPORTED_LANGUAGES.includes(settings.default_language)
        ? settings.default_language
        : 'pt'
});

export default async function organizationRoutes(fastify, options) {

  // Get current organization
  fastify.get('/', {
    preHandler: [authMiddleware, tenantMiddleware]
  }, async (request, reply) => {
    const db = fastify.db();

    const org = await db.collection('organizations').findOne({
      tenant_id: request.tenantId
    });

    if (!org) {
      return reply.status(404).send({ error: 'Organization not found' });
    }

    return { organization: { ...org, settings: defaultSettings(org.settings) } };
  });

  // Update organization
  fastify.patch('/', {
    preHandler: [authMiddleware, tenantMiddleware, requireAdmin]
  }, async (request, reply) => {
    const db = fastify.db();
    const { name, settings } = request.body || {};

    const updateData = {
      updated_at: new Date()
    };

    if (name !== undefined) {
      const trimmed = String(name).trim();
      if (!trimmed) {
        return reply.status(400).send({ error: 'Nome da organização não pode ficar vazio' });
      }
      updateData.name = trimmed;
    }

    // Whitelist explicita: antes o `settings` do corpo era gravado inteiro,
    // sem validacao, o que permitia guardar qualquer estrutura no documento.
    if (settings) {
      if (settings.default_language !== undefined) {
        if (!SUPPORTED_LANGUAGES.includes(settings.default_language)) {
          return reply.status(400).send({
            error: `Idioma inválido. Use: ${SUPPORTED_LANGUAGES.join(', ')}`
          });
        }
        updateData['settings.default_language'] = settings.default_language;
      }
    }

    await db.collection('organizations').updateOne(
      { tenant_id: request.tenantId },
      { $set: updateData }
    );
    
    // Audit log
    await db.collection('audit_logs').insertOne({
      tenant_id: request.tenantId,
      user_id: request.currentUser._id,
      action: 'organization.updated',
      resource: 'organization',
      timestamp: new Date(),
      metadata: updateData
    });

    const org = await db.collection('organizations').findOne({ tenant_id: request.tenantId });
    return {
      success: true,
      organization: { ...org, settings: defaultSettings(org?.settings) }
    };
  });
}
