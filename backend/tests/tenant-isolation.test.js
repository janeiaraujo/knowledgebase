/**
 * Guarda de isolamento multi-tenant.
 *
 * O CONTRIBUTING chama isso de "ponto mais sensivel do projeto": toda
 * consulta precisa filtrar por tenant_id, e um vazamento entre
 * organizacoes e bug critico de seguranca.
 *
 * Testar de verdade exigiria subir o app com dois tenants e conferir cada
 * rota. Enquanto isso nao existe, esta varredura estatica pega a versao
 * mais comum do erro: leitura/escrita numa colecao com dado de tenant
 * cujo filtro nao menciona tenant_id.
 *
 * Nao substitui teste de integracao - e uma rede barata que roda em
 * qualquer ambiente, inclusive sem banco.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MODULES_DIR = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../src/modules'
);

// Colecoes que guardam dado de UMA organizacao.
const TENANT_SCOPED = [
    'records', 'incidents', 'events', 'comments', 'tags', 'categories',
    'favorites', 'templates', 'postmortems', 'webhooks', 'gps_flows',
    'record_versions', 'record_relations', 'kb_requests', 'notifications'
];

const QUERY_METHODS = ['find', 'findOne', 'updateOne', 'updateMany', 'deleteOne', 'deleteMany', 'countDocuments'];

// Excecoes conscientes, com o motivo. Sem isso a varredura vira ruido e
// alguem acaba desligando ela inteira.
const ALLOWED_EXCEPTIONS = [
    {
        file: 'events/events.routes.js',
        reason: 'ingest resolve o tenant a partir do token, antes de haver request.tenantId'
    },
    {
        file: 'export/export.routes.js',
        reason: 'categoria/tags sao lidas por _id vindo de um record ja filtrado por tenant'
    }
];


/**
 * Gaps conhecidos, no padrao "catraca": o teste passa com os listados e
 * falha em QUALQUER novo.
 *
 * A lista nasceu com 19 entradas e hoje esta vazia - todas foram
 * corrigidas. Se um caso legitimo aparecer (id que comprovadamente ja vem
 * de documento filtrado por tenant), prefira ALLOWED_EXCEPTIONS com o
 * motivo, em vez de reabrir esta lista.
 */
const KNOWN_GAPS = new Set([]);

const gapKey = (p) => `${p.file}:${p.line} ${p.collection}.${p.method}`;

const collectFiles = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? collectFiles(full) : (full.endsWith('.js') ? [full] : []);
});

/** Extrai o primeiro argumento da chamada, equilibrando chaves e colchetes. */
function extractFirstArgument(source, startIndex) {
    let i = startIndex;
    while (i < source.length && /\s/.test(source[i])) i++;

    let depth = 0;
    let arg = '';
    while (i < source.length) {
        const ch = source[i];
        if ('{[('.includes(ch)) depth++;
        else if ('}])'.includes(ch)) {
            // Fecha o parentese da propria chamada -> argumento acabou
            if (depth === 0) break;
            depth--;
        } else if (ch === ',' && depth === 0) break;

        arg += ch;
        i++;
    }
    return arg.trim();
}

/**
 * Variaveis de filtro montadas antes da consulta (`const baseMatch = {
 * tenant_id: ... }`) sao um padrao legitimo e comum neste projeto. Aqui
 * levantamos quais delas ja carregam tenant_id.
 */
function tenantScopedVariables(source) {
    const scoped = new Set();

    const literal = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*\{([^;]*?)\}\s*;/gs;
    let match;
    while ((match = literal.exec(source)) !== null) {
        if (/tenant_id/.test(match[2])) scoped.add(match[1]);
    }

    // filterKBsByAccess() ja devolve { tenant_id, ... } - um filtro montado
    // a partir dele esta escopado, mesmo sem citar tenant_id literalmente.
    const fromAccessFilter = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*await\s+filterKBsByAccess\(/g;
    while ((match = fromAccessFilter.exec(source)) !== null) scoped.add(match[1]);

    // ...e um filtro que faz spread de uma variavel ja escopada herda o escopo
    const spread = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*\{\s*\.\.\.([A-Za-z_$][\w$]*)/g;
    let changed = true;
    while (changed) {
        changed = false;
        spread.lastIndex = 0;
        while ((match = spread.exec(source)) !== null) {
            if (scoped.has(match[2]) && !scoped.has(match[1])) { scoped.add(match[1]); changed = true; }
        }
    }

    return scoped;
}

export function findUnscopedQueries(source, relativePath = 'inline') {
    const problems = [];
    const scopedVars = tenantScopedVariables(source);
    const pattern = new RegExp(
        `collection\\(['"\`](${TENANT_SCOPED.join('|')})['"\`]\\)\\s*\\.\\s*(${QUERY_METHODS.join('|')})\\s*\\(`,
        'g'
    );

    let match;
    while ((match = pattern.exec(source)) !== null) {
        const [, collection, method] = match;
        const arg = extractFirstArgument(source, pattern.lastIndex);

        // Filtro literal com tenant_id, ou variavel/spread de filtro que ja o carrega
        const mentionsTenant = /tenant_id/.test(arg);
        const usesScopedVar = [...scopedVars].some(v => new RegExp(`\\b${v}\\b`).test(arg));

        if (!mentionsTenant && !usesScopedVar) {
            const line = source.slice(0, match.index).split('\n').length;
            problems.push({ collection, method, line, file: relativePath, arg: arg.slice(0, 60) });
        }
    }
    return problems;
}

describe('isolamento multi-tenant', () => {
    test('consultas em colecoes por tenant filtram por tenant_id', () => {
        const problems = [];

        for (const file of collectFiles(MODULES_DIR)) {
            const relative = path.relative(MODULES_DIR, file).replace(/\\/g, '/');
            if (ALLOWED_EXCEPTIONS.some(e => e.file === relative)) continue;

            problems.push(...findUnscopedQueries(fs.readFileSync(file, 'utf8'), relative));
        }

        const novos = problems.filter(p => !KNOWN_GAPS.has(gapKey(p)));

        const report = novos
            .map(p => `  ${p.file}:${p.line} -> ${p.collection}.${p.method}(${p.arg}...)`)
            .join('\n');

        assert.equal(
            novos.length,
            0,
            `Consulta(s) NOVA(S) sem filtro de tenant - risco de vazamento entre organizacoes:\n${report}\n\n` +
            'Adicione tenant_id ao filtro. Se for intencional, documente em ALLOWED_EXCEPTIONS com o motivo.'
        );
    });

    describe('a propria varredura (senao ela passa por acidente)', () => {
        test('acusa filtro literal sem tenant_id', () => {
            const code = `await db.collection('records').find({ status: 'published' });`;
            assert.equal(findUnscopedQueries(code).length, 1);
        });

        test('aceita filtro literal com tenant_id', () => {
            const code = `await db.collection('records').find({ tenant_id: request.tenantId, status: 'x' });`;
            assert.equal(findUnscopedQueries(code).length, 0);
        });

        test('aceita filtro multi-linha (tenant_id em outra linha)', () => {
            const code = `await db.collection('records').find({
                _id: { $in: ids },
                tenant_id: request.tenantId,
                deleted_at: null
            });`;
            assert.equal(findUnscopedQueries(code).length, 0);
        });

        test('aceita variavel de filtro que ja carrega tenant_id', () => {
            const code = `const baseMatch = { tenant_id: request.tenantId };
                await db.collection('records').countDocuments(baseMatch);`;
            assert.equal(findUnscopedQueries(code).length, 0);
        });

        test('aceita spread de variavel com tenant_id', () => {
            const code = `const baseMatch = { tenant_id: request.tenantId };
                await db.collection('records').countDocuments({ ...baseMatch, status: 'draft' });`;
            assert.equal(findUnscopedQueries(code).length, 0);
        });

        test('acusa variavel de filtro SEM tenant_id', () => {
            const code = `const filtro = { status: 'published' };
                await db.collection('records').find(filtro);`;
            assert.equal(findUnscopedQueries(code).length, 1);
        });

        test('acusa consulta sem filtro nenhum', () => {
            const code = `await db.collection('incidents').find();`;
            assert.equal(findUnscopedQueries(code).length, 1);
        });
    });
});
