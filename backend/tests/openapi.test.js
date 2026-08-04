/**
 * Guarda da documentacao da API.
 *
 * O risco aqui nao e obvio: no Fastify, schema de rota NAO e so documentacao.
 * `body` valida a entrada e `response` controla a serializacao - um campo que
 * o schema nao declara simplesmente some do corpo da resposta. Documentar uma
 * rota pode, portanto, quebrar os clientes dela em silencio.
 *
 * Medido antes de escrever qualquer schema neste projeto:
 *
 *   sem schema          -> { records: [...], pagination: {...} }
 *   response estrito    -> { records: [...] }              <- pagination sumiu
 *   additionalProperties-> { records: [...], pagination: {...} }
 *
 * Por isso todo schema de resposta aqui precisa trazer
 * `additionalProperties: true`, e e isso que o teste principal cobra.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { grupoDaRota, ROTAS_PUBLICAS } from '../src/plugins/openapi.js';

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');

const collectFiles = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return collectFiles(full);
    return full.endsWith('.js') ? [full] : [];
});

/** Blocos `response: { ... }` declarados nas rotas, com o arquivo de origem. */
function blocosDeResposta() {
    const encontrados = [];

    for (const file of collectFiles(path.join(SRC, 'modules'))) {
        const code = fs.readFileSync(file, 'utf8');
        const relativo = path.relative(SRC, file).replace(/\\/g, '/');

        const marcador = /\bresponse\s*:\s*\{/g;
        let match;
        while ((match = marcador.exec(code)) !== null) {
            // Recorta o bloco equilibrando chaves a partir do `{` do response
            let i = code.indexOf('{', match.index + match[0].length - 1);
            let profundidade = 0;
            const inicio = i;
            while (i < code.length) {
                if (code[i] === '{') profundidade++;
                else if (code[i] === '}') {
                    profundidade--;
                    if (profundidade === 0) break;
                }
                i++;
            }
            const linha = code.slice(0, match.index).split('\n').length;
            encontrados.push({ file: relativo, linha, bloco: code.slice(inicio, i + 1) });
        }
    }
    return encontrados;
}

describe('documentacao da API', () => {
    test('nenhum schema de resposta cobre status de erro', () => {
        // Medido nesta aplicacao: declarar `response` para 4xx/5xx faz o corpo
        // chegar vazio ao cliente - `{}` no lugar da mensagem. A causa e a
        // combinacao do serializador com o tratador de erro; documentar o erro
        // no texto da rota da a mesma informacao sem esse risco.
        const comErro = blocosDeResposta()
            .filter(({ bloco }) => /\b[45]\d\d\s*:/.test(bloco))
            .map(({ file, linha }) => `${file}:${linha}`);

        assert.deepEqual(
            comErro,
            [],
            'Schema de resposta para status de erro esvazia o corpo em producao.\n' +
            'Descreva o erro no `description` da rota.'
        );
    });

    test('todo schema de resposta preserva campos nao declarados', () => {
        // Cada status declarado dentro de `response` precisa da flag, senao a
        // serializacao do Fastify descarta o que o schema nao listar.
        const semFlag = blocosDeResposta()
            .filter(({ bloco }) => {
                // Conta os status declarados (200:, 400:, ...) e as flags
                const status = (bloco.match(/\b[1-5]\d\d\s*:/g) || []).length;
                const flags = (bloco.match(/additionalProperties\s*:\s*true/g) || []).length;
                return status > 0 && flags < status;
            })
            .map(({ file, linha }) => `${file}:${linha}`);

        assert.deepEqual(
            semFlag,
            [],
            'Schema de resposta sem `additionalProperties: true` descarta em silencio\n' +
            'os campos que ele nao declara - a rota para de devolver dados que\n' +
            'devolvia antes, sem erro nenhum.'
        );
    });

    test('a lista de rotas publicas so tem rota que realmente dispensa sessao', () => {
        // Documentacao que diz "esta rota e publica" sobre uma rota protegida
        // e pior do que nao dizer nada: alguem vai tentar chamar sem token e
        // culpar a plataforma. A lista fica travada aqui de proposito.
        const esperadas = [
            'POST /api/auth/register',
            'POST /api/auth/login',
            'POST /api/auth/magic-link',
            'POST /api/auth/magic-verify',
            'POST /api/auth/forgot-password',
            'POST /api/auth/reset-password',
            'POST /api/auth/refresh',
            'GET /api/files/public/:tenantId/:fileName'
        ];

        assert.deepEqual(
            [...ROTAS_PUBLICAS].sort(),
            esperadas.sort(),
            'Mudou a lista de rotas publicas da documentacao. Confirme que a rota\n' +
            'nova de fato dispensa sessao antes de deixar o teste passar.'
        );
    });

    describe('agrupamento por caminho', () => {
        test('usa o grupo mapeado quando existe', () => {
            assert.equal(grupoDaRota('/api/records/:id'), 'Base de Conhecimento');
            assert.equal(grupoDaRota('/api/events/ingest'), 'Eventos e Ingestão');
            assert.equal(grupoDaRota('/api/kb-access/:id'), 'Base de Conhecimento');
        });

        test('modulo novo, sem mapeamento, cai no proprio segmento', () => {
            // O importante e nao ficar sem grupo: quem registrar um modulo novo
            // nao precisa lembrar de vir aqui para ele aparecer na documentacao.
            assert.equal(grupoDaRota('/api/modulo-novo/algo'), 'modulo-novo');
        });

        test('caminho fora do padrao nao quebra', () => {
            assert.equal(grupoDaRota('/'), 'Outros');
            assert.equal(grupoDaRota('/api/'), 'Outros');
        });
    });
});
