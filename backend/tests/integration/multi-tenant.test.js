/**
 * Isolamento multi-tenant contra um MongoDB de verdade.
 *
 * O CONTRIBUTING chama isso de "ponto mais sensivel do projeto". Ate aqui
 * a unica rede era a varredura estatica de tests/tenant-isolation.test.js,
 * que prova que o filtro esta *escrito* - nao que ele funciona. Um filtro
 * escrito no lugar errado, um middleware que nao roda, uma rota que
 * esquece o preHandler: nada disso a varredura pega.
 *
 * Aqui sao duas organizacoes reais, criadas pelo endpoint de registro, e a
 * pergunta e sempre a mesma: a organizacao B consegue enxergar ou mexer em
 * alguma coisa da organizacao A?
 *
 * Precisa de Mongo. Roda no CI (que ja sobe um servico mongo:7) e
 * localmente com:
 *   MONGODB_URI=mongodb://127.0.0.1:27017/incident_kb_itest \
 *   npm run test:integration
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { MongoClient } from 'mongodb';

const PORT = process.env.ITEST_PORT || 3101;
const BASE = `http://127.0.0.1:${PORT}`;
/**
 * Banco proprio, sempre. O teste dropa a base no final, e no CI a
 * MONGODB_URI aponta para a base que o seed popula - reutiliza-la
 * apagaria os dados de demonstracao no meio do pipeline. Aproveita so o
 * host da variavel e troca o nome da base.
 */
const BANCO_DE_TESTE = 'incident_kb_itest';
const MONGODB_URI = (() => {
    const bruto = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
    const url = new URL(bruto);
    url.pathname = `/${BANCO_DE_TESTE}`;
    return url.toString();
})();
const BOOT_TIMEOUT_MS = 30_000;

let servidor;

/** Sobe a API real como processo filho e espera o /health responder. */
async function subirServidor() {
    servidor = spawn(process.execPath, ['src/server.js'], {
        env: {
            ...process.env,
            PORT: String(PORT),
            MONGODB_URI,
            NODE_ENV: 'test',
            JWT_SECRET: process.env.JWT_SECRET || 'itest-secret',
            JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'itest-refresh-secret'
        },
        stdio: ['ignore', 'pipe', 'pipe']
    });
    servidor.stderr.on('data', chunk => process.stderr.write(`[api] ${chunk}`));

    const limite = Date.now() + BOOT_TIMEOUT_MS;
    while (Date.now() < limite) {
        if (servidor.exitCode !== null) {
            throw new Error(`a API encerrou antes de subir (code ${servidor.exitCode})`);
        }
        try {
            const res = await fetch(`${BASE}/health`);
            if (res.ok && (await res.json()).mongodb === 'connected') return;
        } catch { /* ainda subindo */ }
        await sleep(300);
    }
    throw new Error('a API nao respondeu /health no tempo esperado');
}

const api = async (caminho, { token, method = 'GET', body } = {}) => {
    const res = await fetch(`${BASE}/api${caminho}`, {
        method,
        headers: {
            'content-type': 'application/json',
            ...(token ? { authorization: `Bearer ${token}` } : {})
        },
        ...(body ? { body: JSON.stringify(body) } : {})
    });
    const texto = await res.text();
    let json = null;
    try { json = texto ? JSON.parse(texto) : null; } catch { /* resposta nao-JSON */ }
    return { status: res.status, body: json, texto };
};

/** Cria uma organizacao nova e devolve o token do owner. */
async function criarOrganizacao(rotulo) {
    const email = `${rotulo}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@itest.local`;
    const { status, body } = await api('/auth/register', {
        method: 'POST',
        body: { email, password: 'senhaDeTeste123', name: `Owner ${rotulo}`, organizationName: `Org ${rotulo}` }
    });
    assert.equal(status, 200, `registro de ${rotulo} falhou: ${JSON.stringify(body)}`);
    return { email, token: body.accessToken, tenantId: body.user.tenant_id, userId: body.user.id };
}

let orgA, orgB, recordA, incidentA;

describe('isolamento entre organizacoes (com banco real)', () => {
    before(async () => {
        await subirServidor();
        orgA = await criarOrganizacao('alpha');
        orgB = await criarOrganizacao('beta');

        const criado = await api('/records', {
            token: orgA.token,
            method: 'POST',
            body: { title: 'Segredo da Alpha', content_md: 'conteudo confidencial da organizacao A' }
        });
        assert.equal(criado.status, 200, `criacao de KB falhou: ${JSON.stringify(criado.body)}`);
        recordA = { _id: criado.body.recordId };
        assert.ok(recordA._id, 'o KB criado precisa devolver recordId');

        const inc = await api('/incidents', {
            token: orgA.token,
            method: 'POST',
            body: { title: 'Incidente da Alpha', description: 'so a A deveria ver', severity: 'high' }
        });
        if (inc.status === 201) incidentA = inc.body.incident;
    });

    after(async () => {
        servidor?.kill('SIGTERM');
        // Limpa o banco do teste para a proxima execucao comecar limpa.
        const cliente = new MongoClient(MONGODB_URI);
        try {
            await cliente.connect();
            await cliente.db().dropDatabase();
        } finally {
            await cliente.close();
        }
    });

    test('as duas organizacoes sao mesmo distintas', () => {
        assert.notEqual(orgA.tenantId, orgB.tenantId, 'o registro deveria criar um tenant por organizacao');
    });

    describe('KB da organizacao A', () => {
        test('a A enxerga o proprio KB', async () => {
            const { status, body } = await api(`/records/${recordA._id}`, { token: orgA.token });
            assert.equal(status, 200);
            assert.equal(body.record.title, 'Segredo da Alpha');
        });

        test('a B nao enxerga o KB da A por id', async () => {
            const { status, body } = await api(`/records/${recordA._id}`, { token: orgB.token });
            assert.equal(status, 404, `vazamento de leitura entre organizacoes: ${JSON.stringify(body)}`);
        });

        test('o KB da A nao aparece na listagem da B', async () => {
            const { status, body } = await api('/records', { token: orgB.token });
            assert.equal(status, 200);
            const ids = (body.records || []).map(r => String(r._id));
            assert.ok(!ids.includes(String(recordA._id)), 'KB de outra organizacao apareceu na listagem');
        });

        test('a B nao consegue editar o KB da A', async () => {
            const { status } = await api(`/records/${recordA._id}`, {
                token: orgB.token, method: 'PATCH', body: { title: 'invadido' }
            });
            assert.ok([403, 404].includes(status), `PATCH cruzado devolveu ${status}`);

            // e o titulo original precisa continuar intacto
            const depois = await api(`/records/${recordA._id}`, { token: orgA.token });
            assert.equal(depois.body.record.title, 'Segredo da Alpha', 'o KB da A foi alterado pela B');
        });

        test('a B nao consegue excluir o KB da A', async () => {
            const { status } = await api(`/records/${recordA._id}`, { token: orgB.token, method: 'DELETE' });
            assert.ok([403, 404].includes(status), `DELETE cruzado devolveu ${status}`);

            const depois = await api(`/records/${recordA._id}`, { token: orgA.token });
            assert.equal(depois.status, 200, 'o KB da A sumiu depois de um DELETE da B');
        });

        test('a B nao le os comentarios do KB da A', async () => {
            const { status, body } = await api(`/records/${recordA._id}/comments`, { token: orgB.token });
            if (status === 200) {
                assert.deepEqual(body.comments || [], [], 'comentarios de outra organizacao foram devolvidos');
            } else {
                assert.ok([403, 404].includes(status), `GET de comentarios cruzado devolveu ${status}`);
            }
        });
    });

    describe('incidentes', () => {
        test('a B nao enxerga o incidente da A', async (t) => {
            if (!incidentA?._id) return t.skip('a rota de criacao de incidente nao devolveu um id');

            const { status } = await api(`/incidents/${incidentA._id}`, { token: orgB.token });
            assert.equal(status, 404, 'incidente de outra organizacao ficou visivel');
        });

        test('o incidente da A nao aparece na listagem da B', async (t) => {
            if (!incidentA?._id) return t.skip('a rota de criacao de incidente nao devolveu um id');

            const { body } = await api('/incidents', { token: orgB.token });
            const ids = (body.incidents || []).map(i => String(i._id));
            assert.ok(!ids.includes(String(incidentA._id)), 'incidente de outra organizacao apareceu na listagem');
        });
    });

    describe('contadores nao somam entre organizacoes', () => {
        test('a B ve zero KBs, mesmo com a A tendo um', async () => {
            const { status, body } = await api('/records', { token: orgB.token });
            assert.equal(status, 200);
            assert.equal((body.records || []).length, 0, 'a B esta contando registros da A');
        });
    });

    describe('sem token', () => {
        test('rota protegida recusa quem nao esta autenticado', async () => {
            const { status } = await api('/records');
            assert.equal(status, 401);
        });

        test('token de uma organizacao nao vira token da outra', async () => {
            // Sanidade: o token da B e valido (200 na propria listagem),
            // entao o 404 acima e isolamento, nao token quebrado.
            const { status } = await api('/records', { token: orgB.token });
            assert.equal(status, 200, 'o token da B deveria ser valido na propria organizacao');
        });
    });
});
