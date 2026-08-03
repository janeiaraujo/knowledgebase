import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { nanoid } from 'nanoid';
import { sendMagicLinkEmail, sendPasswordResetEmail } from './email.service.js';

/**
 * Generate JWT tokens (access + refresh)
 */
export async function generateTokens(fastify, userId, tenantId) {
  // Ensure IDs are strings for JWT payload
  const userIdStr = userId.toString();
  const tenantIdStr = tenantId.toString();
  
  const accessToken = await fastify.jwt.sign(
    { id: userIdStr, tenant_id: tenantIdStr },
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
  );
  
  const refreshToken = await fastify.jwt.sign(
    { id: userIdStr, tenant_id: tenantIdStr, type: 'refresh' },
    { 
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
      secret: process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET
    }
  );
  
  return { accessToken, refreshToken };
}

/**
 * Hash password
 */
export async function hashPassword(password) {
  return await bcrypt.hash(password, 10);
}

/**
 * Compare password
 */
export async function comparePassword(password, hash) {
  return await bcrypt.compare(password, hash);
}

/**
 * Generate magic link token
 */
export function generateMagicToken() {
  return nanoid(32);
}

/**
 * Register new user
 */
export async function registerUser(db, { email, password, name, organizationName }) {
  // Check if user already exists
  const existingUser = await db.collection('users').findOne({ email });
  if (existingUser) {
    throw new Error('Email already registered');
  }
  
  // Create tenant
  const tenant = {
    name: organizationName || `${name}'s Organization`,
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
  
  // Create organization
  const organization = {
    tenant_id: tenantId,
    name: organizationName || `${name}'s Organization`,
    created_at: new Date()
  };
  
  await db.collection('organizations').insertOne(organization);
  
  // Create user
  const user = {
    tenant_id: tenantId,
    email,
    password: password ? await hashPassword(password) : null,
    name,
    role: 'owner', // First user is always owner
    active: true,
    email_verified: false,
    created_at: new Date(),
    last_login: null
  };
  
  const userResult = await db.collection('users').insertOne(user);
  user._id = userResult.insertedId;
  
  // Create initial subscription
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
  
  return { user, tenantId };
}

/**
 * Login with email and password
 */
// Bloqueio temporario por conta. Complementa o rate limit por IP da rota:
// aquele barra muitas tentativas de uma origem, este barra tentativas
// distribuidas (varios IPs) contra um unico usuario.
export const MAX_FAILED_LOGIN_ATTEMPTS = 5;
export const LOGIN_LOCK_MINUTES = 15;

export async function loginWithPassword(db, { email, password }) {
  const user = await db.collection('users').findOne({ email });

  if (!user) {
    throw new Error('Invalid credentials');
  }

  if (!user.password) {
    throw new Error('Password not set. Please use magic link.');
  }

  // Conta bloqueada: nao gasta bcrypt e nao permite continuar tentando
  if (user.locked_until && user.locked_until > new Date()) {
    const minutesLeft = Math.ceil((user.locked_until - new Date()) / 60000);
    const error = new Error(
      `Muitas tentativas de login. Tente novamente em ${minutesLeft} minuto(s).`
    );
    error.statusCode = 429;
    throw error;
  }

  const isValid = await comparePassword(password, user.password);
  if (!isValid) {
    await registerFailedLogin(db, user);
    throw new Error('Invalid credentials');
  }

  if (!user.active) {
    throw new Error('Account is inactive');
  }

  // Login valido zera o contador junto com o last_login
  await db.collection('users').updateOne(
    { _id: user._id },
    {
      $set: { last_login: new Date() },
      $unset: { failed_login_attempts: '', locked_until: '' }
    }
  );

  return user;
}

/**
 * Incrementa o contador de falhas e bloqueia a conta ao atingir o limite.
 * O bloqueio e por tempo (nao permanente) para nao virar um vetor de
 * negacao de servico: qualquer um poderia travar a conta de outra pessoa
 * so errando a senha de proposito.
 */
async function registerFailedLogin(db, user) {
  const attempts = (user.failed_login_attempts || 0) + 1;
  const updates = { failed_login_attempts: attempts };

  if (attempts >= MAX_FAILED_LOGIN_ATTEMPTS) {
    updates.locked_until = new Date(Date.now() + LOGIN_LOCK_MINUTES * 60 * 1000);
    updates.failed_login_attempts = 0;
  }

  await db.collection('users').updateOne({ _id: user._id }, { $set: updates });
}

/**
 * Send magic link
 */
export async function sendMagicLink(db, fastify, { email }) {
  const user = await db.collection('users').findOne({ email });
  
  if (!user) {
    // Don't reveal if user exists or not
    return { success: true };
  }
  
  if (!user.active) {
    throw new Error('Account is inactive');
  }
  
  // Generate magic token
  const token = generateMagicToken();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
  
  // Store magic token
  await db.collection('magic_tokens').insertOne({
    user_id: user._id,
    tenant_id: user.tenant_id,
    token,
    expires_at: expiresAt,
    used: false,
    created_at: new Date()
  });
  
  // Send email
  const magicLink = `${process.env.FRONTEND_URL}/auth/magic?token=${token}`;
  await sendMagicLinkEmail(user.email, user.name, magicLink);
  
  return { success: true };
}

/**
 * Verify magic link token
 */
export async function verifyMagicToken(db, { token }) {
  const magicToken = await db.collection('magic_tokens').findOne({ 
    token,
    used: false,
    expires_at: { $gt: new Date() }
  });
  
  if (!magicToken) {
    throw new Error('Invalid or expired magic link');
  }
  
  // Mark token as used
  await db.collection('magic_tokens').updateOne(
    { _id: magicToken._id },
    { $set: { used: true, used_at: new Date() } }
  );
  
  // Get user
  const user = await db.collection('users').findOne({ 
    _id: magicToken.user_id 
  });
  
  if (!user || !user.active) {
    throw new Error('User not found or inactive');
  }
  
  // Update last login
  await db.collection('users').updateOne(
    { _id: user._id },
    { 
      $set: { 
        last_login: new Date(),
        email_verified: true 
      } 
    }
  );
  
  return user;
}

/**
 * Refresh access token
 */
export async function refreshAccessToken(fastify, db, refreshToken) {
  try {
    const decoded = await fastify.jwt.verify(refreshToken, {
      secret: process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET
    });
    
    if (decoded.type !== 'refresh') {
      throw new Error('Invalid token type');
    }
    
    const user = await db.collection('users').findOne({ 
      _id: decoded.id,
      active: true
    });
    
    if (!user) {
      throw new Error('User not found');
    }
    
    // Generate new access token
    const accessToken = await fastify.jwt.sign(
      { id: user._id, tenant_id: user.tenant_id },
      { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
    );
    
    return { accessToken };
    
  } catch (error) {
    throw new Error('Invalid refresh token');
  }
}

// ==================== RECUPERACAO DE SENHA ====================

export const PASSWORD_RESET_EXPIRES_MINUTES = 60;
const MIN_PASSWORD_LENGTH = 8;

/**
 * Inicia a recuperacao de senha.
 *
 * Nunca revela se o e-mail existe: quem chama sempre recebe a mesma
 * resposta. Isso vale mesmo para conta inativa ou sem senha definida -
 * caso contrario o endpoint viraria um verificador de e-mails cadastrados.
 *
 * O token e guardado como hash. Se o banco vazar, os tokens em transito
 * nao servem para tomar contas (mesmo raciocinio de nao guardar senha em
 * texto puro).
 */
export async function requestPasswordReset(db, { email }) {
  const user = await db.collection('users').findOne({ email });

  if (!user || !user.active) {
    return { sent: false };
  }

  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashResetToken(token);
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_EXPIRES_MINUTES * 60 * 1000);

  // Invalida pedidos anteriores: so o link mais recente deve funcionar
  await db.collection('password_reset_tokens').updateMany(
    { user_id: user._id, used: false },
    { $set: { used: true, invalidated_at: new Date() } }
  );

  await db.collection('password_reset_tokens').insertOne({
    user_id: user._id,
    tenant_id: user.tenant_id,
    token_hash: tokenHash,
    expires_at: expiresAt,
    used: false,
    created_at: new Date()
  });

  const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
  await sendPasswordResetEmail(user.email, user.name, resetLink, PASSWORD_RESET_EXPIRES_MINUTES);

  return { sent: true };
}

/**
 * Conclui a recuperacao: valida o token e grava a nova senha.
 */
export async function resetPassword(db, { token, password }) {
  if (!token || !password) {
    throw new Error('Token e nova senha são obrigatórios');
  }

  if (String(password).length < MIN_PASSWORD_LENGTH) {
    throw new Error(`A senha deve ter no mínimo ${MIN_PASSWORD_LENGTH} caracteres`);
  }

  const record = await db.collection('password_reset_tokens').findOne({
    token_hash: hashResetToken(token),
    used: false,
    expires_at: { $gt: new Date() }
  });

  if (!record) {
    throw new Error('Link inválido ou expirado. Solicite um novo.');
  }

  const claim = await db.collection('password_reset_tokens').updateOne(
    { _id: record._id, used: false },
    { $set: { used: true, used_at: new Date() } }
  );

  if (claim.modifiedCount !== 1) {
    throw new Error('Link inválido ou expirado. Solicite um novo.');
  }

  const user = await db.collection('users').findOne({ _id: record.user_id });
  if (!user || !user.active) {
    throw new Error('Link inválido ou expirado. Solicite um novo.');
  }

  await db.collection('users').updateOne(
    { _id: user._id },
    {
      $set: { password: await hashPassword(password), updated_at: new Date() },
      // Redefinir a senha destrava a conta: quem esqueceu a senha e errou
      // ate bloquear nao pode ficar preso esperando o tempo passar.
      $unset: { failed_login_attempts: '', locked_until: '' }
    }
  );

  return user;
}

// SHA-256 basta aqui: o token e aleatorio de 256 bits, entao nao ha o que
// forcar por dicionario (diferente de senha escolhida por pessoa).
function hashResetToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}
