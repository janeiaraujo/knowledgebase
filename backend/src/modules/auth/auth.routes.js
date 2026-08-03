import Joi from 'joi';
import * as authService from './auth.service.js';
import { sendWelcomeEmail } from './email.service.js';

// Rate limit por IP nas rotas de autenticacao. O limite global do server.js
// (100 req/min) e permissivo demais aqui: permitiria ~6.000 tentativas de
// senha por hora vindas de uma unica origem.
//
// Complementa - nao substitui - o bloqueio por conta em auth.service.js:
// este barra volume de um IP, aquele barra tentativa distribuida contra um
// usuario especifico.
const authRateLimit = (max, timeWindow) => ({
  config: { rateLimit: { max, timeWindow } }
});

export default async function authRoutes(fastify, options) {

  // Register new user
  fastify.post('/register', authRateLimit(5, '1 hour'), async (request, reply) => {
    try {
      const db = fastify.db();
      const { email, password, name, organizationName } = request.body;
      
      const { user, tenantId } = await authService.registerUser(db, {
        email,
        password,
        name,
        organizationName
      });
      
      // Generate tokens
      const { accessToken, refreshToken } = await authService.generateTokens(
        fastify,
        user._id,
        tenantId
      );
      
      // Send welcome email (async, don't wait)
      sendWelcomeEmail(user.email, user.name).catch(err => {
        fastify.log.error('Failed to send welcome email:', err);
      });
      
      // Log audit
      await db.collection('audit_logs').insertOne({
        tenant_id: tenantId,
        user_id: user._id,
        action: 'user.registered',
        resource: 'user',
        resource_id: user._id,
        timestamp: new Date()
      });
      
      return {
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          role: user.role,
          tenant_id: tenantId
        },
        accessToken,
        refreshToken
      };
      
    } catch (error) {
      fastify.log.error(error);
      return reply.status(400).send({ 
        error: error.message || 'Registration failed' 
      });
    }
  });
  
  // Login with password
  fastify.post('/login', authRateLimit(10, '15 minutes'), async (request, reply) => {
    try {
      const db = fastify.db();
      const { email, password } = request.body;
      
      const user = await authService.loginWithPassword(db, { email, password });
      
      const { accessToken, refreshToken } = await authService.generateTokens(
        fastify,
        user._id,
        user.tenant_id
      );
      
      // Log audit
      await db.collection('audit_logs').insertOne({
        tenant_id: user.tenant_id,
        user_id: user._id,
        action: 'user.login',
        resource: 'user',
        resource_id: user._id,
        timestamp: new Date(),
        metadata: { method: 'password' }
      });
      
      // Record login for activity tracking
      await db.collection('activity_logs').insertOne({
        tenant_id: user.tenant_id,
        user_id: user._id,
        user_name: user.name,
        user_email: user.email,
        action: 'login',
        entity_type: 'auth',
        ip_address: request.headers['x-forwarded-for']?.split(',')[0] || request.ip,
        user_agent: request.headers['user-agent'] || '',
        created_at: new Date()
      });
      
      // Update user's last activity
      await db.collection('users').updateOne(
        { _id: user._id },
        { 
          $set: { 
            last_login: new Date(),
            last_activity: new Date(),
            last_activity_type: 'login'
          }
        }
      );
      
      return {
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          role: user.role,
          tenant_id: user.tenant_id,
          // Permite ao frontend aplicar o idioma/tema do perfil ja no login,
          // sem esperar um novo GET /me.
          avatar_url: user.avatar?.url || null,
          preferences: {
            language: user.preferences?.language || 'pt',
            theme: user.preferences?.theme || 'system'
          }
        },
        accessToken,
        refreshToken
      };

    } catch (error) {
      fastify.log.error(error);
      // Conta bloqueada por excesso de tentativas vem com 429; o resto e 401.
      return reply.status(error.statusCode || 401).send({
        error: error.message || 'Login failed'
      });
    }
  });

  // Request magic link
  fastify.post('/magic-link', authRateLimit(5, '15 minutes'), async (request, reply) => {
    try {
      const db = fastify.db();
      const { email } = request.body;
      
      await authService.sendMagicLink(db, fastify, { email });
      
      return { 
        success: true,
        message: 'If an account exists, a magic link has been sent.'
      };
      
    } catch (error) {
      fastify.log.error(error);
      
      // Check for specific email errors
      if (error.message === 'SMTP_NOT_CONFIGURED') {
        return reply.status(503).send({ 
          error: 'Serviço de email não configurado. Entre em contato com o administrador.',
          code: 'SMTP_NOT_CONFIGURED'
        });
      }
      
      if (error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        return reply.status(503).send({ 
          error: 'Falha ao conectar com servidor de email. Tente novamente mais tarde.',
          code: 'SMTP_CONNECTION_ERROR'
        });
      }
      
      // Generic response to prevent email enumeration
      return { 
        success: true,
        message: 'If an account exists, a magic link has been sent.'
      };
    }
  });
  
  // ==================== RECUPERACAO DE SENHA ====================

  // Solicitar link de redefinicao.
  // Responde sempre igual, exista o e-mail ou nao, para nao virar um
  // verificador de contas cadastradas.
  fastify.post('/forgot-password', authRateLimit(5, '15 minutes'), async (request, reply) => {
    const genericResponse = {
      success: true,
      message: 'Se existir uma conta com esse e-mail, enviamos um link de redefinição.'
    };

    try {
      const { email } = request.body || {};

      if (!email) {
        return reply.status(400).send({ error: 'E-mail é obrigatório' });
      }

      await authService.requestPasswordReset(fastify.db(), { email });
      return genericResponse;

    } catch (error) {
      fastify.log.error(error);

      // SMTP indisponivel precisa ser explicito: sem isso a pessoa fica
      // esperando um e-mail que nunca vai chegar.
      if (error.message === 'SMTP_NOT_CONFIGURED') {
        return reply.status(503).send({
          error: 'Serviço de e-mail não configurado. Peça ao administrador para redefinir sua senha.',
          code: 'SMTP_NOT_CONFIGURED'
        });
      }

      if (['ETIMEDOUT', 'ECONNREFUSED', 'ENOTFOUND'].includes(error.code)) {
        return reply.status(503).send({
          error: 'Falha ao conectar com o servidor de e-mail. Tente novamente mais tarde.',
          code: 'SMTP_CONNECTION_ERROR'
        });
      }

      // Qualquer outro erro nao pode vazar se a conta existe
      return genericResponse;
    }
  });

  // Concluir a redefinicao com o token recebido por e-mail
  fastify.post('/reset-password', authRateLimit(10, '15 minutes'), async (request, reply) => {
    try {
      const { token, password } = request.body || {};

      const user = await authService.resetPassword(fastify.db(), { token, password });

      await fastify.db().collection('audit_logs').insertOne({
        tenant_id: user.tenant_id,
        user_id: user._id,
        action: 'user.password_reset',
        resource: 'user',
        resource_id: user._id,
        timestamp: new Date()
      });

      return {
        success: true,
        message: 'Senha redefinida com sucesso. Faça login com a nova senha.'
      };

    } catch (error) {
      fastify.log.error(error);
      return reply.status(400).send({ error: error.message || 'Falha ao redefinir a senha' });
    }
  });

  // Verify magic link token
  fastify.post('/magic-verify', authRateLimit(10, '15 minutes'), async (request, reply) => {
    try {
      const db = fastify.db();
      const { token } = request.body;
      
      const user = await authService.verifyMagicToken(db, { token });
      
      const { accessToken, refreshToken } = await authService.generateTokens(
        fastify,
        user._id,
        user.tenant_id
      );
      
      // Log audit
      await db.collection('audit_logs').insertOne({
        tenant_id: user.tenant_id,
        user_id: user._id,
        action: 'user.login',
        resource: 'user',
        resource_id: user._id,
        timestamp: new Date(),
        metadata: { method: 'magic_link' }
      });
      
      // Record login for activity tracking
      await db.collection('activity_logs').insertOne({
        tenant_id: user.tenant_id,
        user_id: user._id,
        user_name: user.name,
        user_email: user.email,
        action: 'login',
        entity_type: 'auth',
        metadata: { method: 'magic_link' },
        ip_address: request.headers['x-forwarded-for']?.split(',')[0] || request.ip,
        user_agent: request.headers['user-agent'] || '',
        created_at: new Date()
      });
      
      // Update user's last activity
      await db.collection('users').updateOne(
        { _id: user._id },
        { 
          $set: { 
            last_login: new Date(),
            last_activity: new Date(),
            last_activity_type: 'login'
          }
        }
      );
      
      return {
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          role: user.role,
          tenant_id: user.tenant_id,
          // Permite ao frontend aplicar o idioma/tema do perfil ja no login,
          // sem esperar um novo GET /me.
          avatar_url: user.avatar?.url || null,
          preferences: {
            language: user.preferences?.language || 'pt',
            theme: user.preferences?.theme || 'system'
          }
        },
        accessToken,
        refreshToken
      };

    } catch (error) {
      fastify.log.error(error);
      return reply.status(401).send({ 
        error: error.message || 'Invalid magic link' 
      });
    }
  });
  
  // Refresh token
  fastify.post('/refresh', async (request, reply) => {
    try {
      const db = fastify.db();
      const { refreshToken } = request.body;
      
      const { accessToken } = await authService.refreshAccessToken(
        fastify,
        db,
        refreshToken
      );
      
      return { accessToken };
      
    } catch (error) {
      fastify.log.error(error);
      return reply.status(401).send({ 
        error: 'Invalid refresh token' 
      });
    }
  });
  
  // Get current user
  fastify.get('/me', {
    preHandler: [
      async (request, reply) => {
        const { authMiddleware } = await import('../../middlewares/auth.middleware.js');
        await authMiddleware(request, reply);
      }
    ]
  }, async (request, reply) => {
    const user = request.currentUser;
    
    return {
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenant_id: user.tenant_id,
        email_verified: user.email_verified,
        created_at: user.created_at,
        last_login: user.last_login,
        avatar_url: user.avatar?.url || null,
        // Usado pelo frontend para aplicar idioma/tema salvos no perfil
        preferences: {
          language: user.preferences?.language || 'pt',
          theme: user.preferences?.theme || 'system'
        }
      }
    };
  });
}
