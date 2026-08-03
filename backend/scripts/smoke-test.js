/**
 * Smoke test — sobe a API real contra um MongoDB e valida o caminho crítico:
 * boot -> /health -> login -> rota protegida (com e sem token).
 *
 * Não substitui testes unitários/integração; serve como rede de segurança
 * de "a aplicação sobe e responde" para rodar no CI a cada push/PR.
 *
 * Uso:
 *   MONGODB_URI=mongodb://localhost:27017/incident_intelligence_smoke \
 *   node scripts/smoke-test.js
 */

import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const PORT = process.env.PORT || 3000;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const BOOT_TIMEOUT_MS = 30_000;
const DEMO_EMAIL = 'demo@incidentkb.com';
const DEMO_PASSWORD = 'demo123';

let serverProcess;
let exitCode = 0;

function log(step, ok, detail = '') {
    const icon = ok ? '✅' : '❌';
    console.log(`${icon} ${step}${detail ? ` — ${detail}` : ''}`);
    if (!ok) exitCode = 1;
}

function startServer() {
    serverProcess = spawn(process.execPath, ['src/server.js'], {
        env: process.env,
        stdio: ['ignore', 'pipe', 'pipe']
    });

    serverProcess.stdout.on('data', (chunk) => {
        if (process.env.SMOKE_VERBOSE) process.stdout.write(`[server] ${chunk}`);
    });
    serverProcess.stderr.on('data', (chunk) => {
        process.stderr.write(`[server] ${chunk}`);
    });
}

async function waitForHealth() {
    const deadline = Date.now() + BOOT_TIMEOUT_MS;

    while (Date.now() < deadline) {
        if (serverProcess.exitCode !== null) {
            throw new Error(`processo do servidor encerrou prematuramente (code ${serverProcess.exitCode})`);
        }

        try {
            const res = await fetch(`${BASE_URL}/health`);
            if (res.ok) {
                const body = await res.json();
                if (body.mongodb === 'connected') {
                    return body;
                }
            }
        } catch {
            // servidor ainda não está aceitando conexões — tenta de novo
        }

        await sleep(500);
    }

    throw new Error(`timeout esperando /health responder em ${BOOT_TIMEOUT_MS}ms`);
}

async function checkAuthFlow() {
    // Rota protegida sem token deve recusar
    const unauthorized = await fetch(`${BASE_URL}/api/dashboard/analytics`);
    log('Rota protegida sem token retorna 401', unauthorized.status === 401, `status ${unauthorized.status}`);

    // Login com usuário de demonstração (criado por `npm run seed`)
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: DEMO_EMAIL, password: DEMO_PASSWORD })
    });

    if (loginRes.status !== 200) {
        log(
            'Login com usuário demo',
            false,
            `status ${loginRes.status} — rode "npm run seed" antes do smoke test`
        );
        return;
    }

    const { accessToken } = await loginRes.json();
    log('Login com usuário demo', Boolean(accessToken), 'token recebido');

    const authorized = await fetch(`${BASE_URL}/api/dashboard/analytics`, {
        headers: { Authorization: `Bearer ${accessToken}` }
    });
    log('Rota protegida com token válido responde 200', authorized.status === 200, `status ${authorized.status}`);
}

async function main() {
    console.log(`Smoke test — subindo API em ${BASE_URL}\n`);

    startServer();

    try {
        const health = await waitForHealth();
        log('Servidor sobe e /health responde', true, `mongodb: ${health.mongodb}`);

        await checkAuthFlow();
    } catch (error) {
        log('Smoke test', false, error.message);
    } finally {
        if (serverProcess && serverProcess.exitCode === null) {
            serverProcess.kill('SIGTERM');
            await sleep(300);
            if (serverProcess.exitCode === null) serverProcess.kill('SIGKILL');
        }
    }

    console.log(exitCode === 0 ? '\nSmoke test passou.' : '\nSmoke test falhou.');
    process.exit(exitCode);
}

main();
