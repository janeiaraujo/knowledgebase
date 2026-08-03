/**
 * Regras de seguranca do login e da recuperacao de senha.
 *
 * Usa um stub de Mongo em vez de banco real: sao regras de decisao (quando
 * bloquear, o que revelar, o que aceitar), nao de persistencia - e assim o
 * teste roda em qualquer ambiente, inclusive sem banco.
 */

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

// SMTP aponta pra porta fechada: o token e gravado ANTES do envio, entao a
// falha de e-mail nao atrapalha o que estamos verificando.
process.env.FRONTEND_URL = 'http://localhost:5173';
process.env.SMTP_HOST = '127.0.0.1';
process.env.SMTP_PORT = '1';
process.env.SMTP_USER = 'x';
process.env.SMTP_PASS = 'x';

const {
    loginWithPassword,
    requestPasswordReset,
    resetPassword,
    hashPassword,
    MAX_FAILED_LOGIN_ATTEMPTS
} = await import('../src/modules/auth/auth.service.js');

const sha256 = (t) => crypto.createHash('sha256').update(t).digest('hex');

function makeDb(users = []) {
    const store = { users, tokens: [] };
    const collection = (name) => ({
        findOne: async (q) => {
            if (name === 'users') {
                return store.users.find(u =>
                    (q.email !== undefined && u.email === q.email) ||
                    (q._id !== undefined && String(u._id) === String(q._id))) || null;
            }
            return store.tokens.find(t =>
                t.token_hash === q.token_hash && t.used === false && t.expires_at > new Date()) || null;
        },
        insertOne: async (doc) => { if (name !== 'users') store.tokens.push(doc); return { insertedId: 'x' }; },
        updateOne: async (q, u) => {
            // Modela modifiedCount porque o servico usa updateOne condicional
            // ({ _id, used: false }) para reivindicar o token de forma atomica -
            // sem isso duas requisicoes simultaneas usariam o mesmo link.
            const target = name === 'users'
                ? store.users.find(x => String(x._id) === String(q._id))
                : store.tokens.find(x => x._id === q._id &&
                    (q.used === undefined || x.used === q.used));
            if (!target) return { matchedCount: 0, modifiedCount: 0 };
            Object.assign(target, u.$set || {});
            for (const k of Object.keys(u.$unset || {})) delete target[k];
            return { matchedCount: 1, modifiedCount: 1 };
        },
        updateMany: async () => { store.tokens.forEach(t => { t.used = true; }); return {}; }
    });
    return { db: { collection }, store };
}

const makeUser = async (over = {}) => ({
    _id: 'u1', email: 'a@b.c', name: 'A', active: true, tenant_id: 't1',
    password: await hashPassword('senhaCorreta1'), ...over
});

describe('login: bloqueio por tentativas', () => {
    let user, ctx;
    beforeEach(async () => { user = await makeUser(); ctx = makeDb([user]); });

    test('senha correta entra e zera o contador de falhas', async () => {
        user.failed_login_attempts = 3;
        const result = await loginWithPassword(ctx.db, { email: 'a@b.c', password: 'senhaCorreta1' });

        assert.equal(String(result._id), 'u1');
        assert.equal(user.failed_login_attempts, undefined, 'contador deveria ser zerado no login valido');
    });

    test(`bloqueia a conta apos ${MAX_FAILED_LOGIN_ATTEMPTS} senhas erradas`, async () => {
        for (let i = 0; i < MAX_FAILED_LOGIN_ATTEMPTS; i++) {
            await assert.rejects(() => loginWithPassword(ctx.db, { email: 'a@b.c', password: 'errada' }));
        }
        assert.ok(user.locked_until instanceof Date, 'deveria ter marcado o bloqueio');
        assert.ok(user.locked_until > new Date(), 'o bloqueio deveria estar no futuro');
    });

    test('conta bloqueada recusa ate com a senha certa, e responde 429', async () => {
        user.locked_until = new Date(Date.now() + 10 * 60 * 1000);

        await assert.rejects(
            () => loginWithPassword(ctx.db, { email: 'a@b.c', password: 'senhaCorreta1' }),
            (err) => {
                assert.equal(err.statusCode, 429, 'bloqueio deve ser 429, nao 401 - senao a UI diz "senha invalida"');
                assert.match(err.message, /minuto/, 'a mensagem deve dizer quanto falta');
                return true;
            }
        );
    });

    test('bloqueio vencido volta a aceitar login', async () => {
        user.locked_until = new Date(Date.now() - 1000);
        const result = await loginWithPassword(ctx.db, { email: 'a@b.c', password: 'senhaCorreta1' });
        assert.equal(String(result._id), 'u1');
    });

    test('senha errada nao revela se a conta existe', async () => {
        const semConta = makeDb([]);
        let msgInexistente, msgSenhaErrada;

        await loginWithPassword(semConta.db, { email: 'x@y.z', password: 'q' }).catch(e => { msgInexistente = e.message; });
        await loginWithPassword(ctx.db, { email: 'a@b.c', password: 'errada' }).catch(e => { msgSenhaErrada = e.message; });

        assert.equal(msgInexistente, msgSenhaErrada, 'mensagens diferentes permitem enumerar contas');
    });
});

describe('recuperacao de senha', () => {
    test('e-mail inexistente nao gera token nem lanca erro', async () => {
        const ctx = makeDb([]);
        const result = await requestPasswordReset(ctx.db, { email: 'nao@existe.com' });

        assert.equal(result.sent, false);
        assert.equal(ctx.store.tokens.length, 0);
    });

    test('conta inativa recebe o mesmo tratamento', async () => {
        const ctx = makeDb([await makeUser({ active: false })]);
        const result = await requestPasswordReset(ctx.db, { email: 'a@b.c' });

        assert.equal(result.sent, false);
        assert.equal(ctx.store.tokens.length, 0);
    });

    test('token e guardado como hash, nunca em texto puro', async () => {
        const ctx = makeDb([await makeUser()]);
        await requestPasswordReset(ctx.db, { email: 'a@b.c' }).catch(() => {});

        const [record] = ctx.store.tokens;
        assert.ok(record?.token_hash, 'deveria guardar o hash');
        assert.equal(record.token, undefined, 'nao pode guardar o token em texto puro');
        assert.ok(record.expires_at > new Date(), 'token precisa expirar');
    });

    test('recusa senha curta, token invalido e token expirado', async () => {
        const user = await makeUser();
        const ctx = makeDb([user]);
        const raw = crypto.randomBytes(32).toString('hex');
        ctx.store.tokens.push({
            _id: 'k1', user_id: 'u1', token_hash: sha256(raw), used: false,
            expires_at: new Date(Date.now() + 600000)
        });
        ctx.store.tokens.push({
            _id: 'k2', user_id: 'u1', token_hash: sha256('vencido'), used: false,
            expires_at: new Date(Date.now() - 1000)
        });

        await assert.rejects(() => resetPassword(ctx.db, { token: raw, password: 'curta' }), /8 caracteres/);
        await assert.rejects(() => resetPassword(ctx.db, { token: 'f'.repeat(64), password: 'senhaNova123' }), /expirado/);
        await assert.rejects(() => resetPassword(ctx.db, { token: 'vencido', password: 'senhaNova123' }), /expirado/);
    });

    test('redefinir troca a senha, destrava a conta e invalida o token', async () => {
        const user = await makeUser({
            locked_until: new Date(Date.now() + 900000),
            failed_login_attempts: 4
        });
        const ctx = makeDb([user]);
        const raw = crypto.randomBytes(32).toString('hex');
        ctx.store.tokens.push({
            _id: 'k1', user_id: 'u1', token_hash: sha256(raw), used: false,
            expires_at: new Date(Date.now() + 600000)
        });

        await resetPassword(ctx.db, { token: raw, password: 'senhaNova123' });

        assert.ok(user.password.startsWith('$2'), 'senha precisa ficar com hash bcrypt');
        assert.equal(user.locked_until, undefined, 'quem esqueceu a senha nao pode ficar preso pelo bloqueio');
        assert.equal(user.failed_login_attempts, undefined);

        // Uso unico
        await assert.rejects(() => resetPassword(ctx.db, { token: raw, password: 'outraSenha123' }));
    });

    test('a nova senha realmente passa a valer no login', async () => {
        const user = await makeUser();
        const ctx = makeDb([user]);
        const raw = crypto.randomBytes(32).toString('hex');
        ctx.store.tokens.push({
            _id: 'k1', user_id: 'u1', token_hash: sha256(raw), used: false,
            expires_at: new Date(Date.now() + 600000)
        });

        await resetPassword(ctx.db, { token: raw, password: 'senhaNova123' });

        const logado = await loginWithPassword(ctx.db, { email: 'a@b.c', password: 'senhaNova123' });
        assert.equal(String(logado._id), 'u1');
        await assert.rejects(() => loginWithPassword(ctx.db, { email: 'a@b.c', password: 'senhaCorreta1' }));
    });
});
