/**
 * Documentacao da API (OpenAPI 3.1) em /docs.
 *
 * Duas decisoes que valem explicacao:
 *
 * 1. As rotas ganham `tags` por um hook onRoute, derivado do proprio caminho,
 *    em vez de uma edicao em cada uma das ~200 rotas. Alem do diff enorme, um
 *    grupo novo passaria a aparecer sozinho quando alguem registrasse um
 *    modulo novo - sem depender de lembrar de taguear.
 *
 * 2. Onde ha schema de `response`, ele SEMPRE traz `additionalProperties: true`.
 *    No Fastify o schema de resposta nao e so documentacao: ele controla a
 *    serializacao, e um campo nao declarado simplesmente some do corpo. Sem
 *    essa flag, documentar uma rota quebraria os clientes dela em silencio.
 */

import fp from 'fastify-plugin';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Le do package.json em vez de npm_package_version: essa variavel so
// existe quando o processo sobe por um script do npm, e em producao o
// CMD chama `node src/server.js` direto.
const versao = JSON.parse(
    readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../package.json'), 'utf8')
).version;

// Prefixo da rota -> grupo na documentacao. O que nao casar aqui cai no
// proprio segmento do caminho, entao modulo novo nunca fica sem grupo.
const GRUPOS = {
    auth: 'Autenticação',
    users: 'Usuários',
    organizations: 'Organizações',
    records: 'Base de Conhecimento',
    kb: 'Base de Conhecimento',
    'kb-access': 'Base de Conhecimento',
    incidents: 'Incidentes',
    events: 'Eventos e Ingestão',
    webhooks: 'Integrações',
    integrations: 'Integrações',
    import: 'Integrações',
    export: 'Integrações',
    gps: 'Diagnóstico Guiado (GPS)',
    postmortem: 'Post-Mortem',
    review: 'Revisões',
    reports: 'Relatórios',
    analytics: 'Analytics',
    activity: 'Analytics',
    dashboard: 'Analytics',
    gamification: 'Gamificação',
    files: 'Arquivos',
    ai: 'IA',
    'smart-search': 'Busca',
    search: 'Busca',
    tags: 'Tags e Categorias',
    categories: 'Tags e Categorias',
    properties: 'Tags e Categorias',
    departments: 'Administração',
    groups: 'Administração',
    roles: 'Administração',
    audit: 'Administração',
    notifications: 'Notificações',
    comments: 'Comentários',
    relations: 'Relações',
    templates: 'Templates',
    favorites: 'Favoritos',
    billing: 'Assinatura',
    'help-center': 'Central de Ajuda',
    databases: 'Bases'
};

/**
 * Rotas que nao exigem sessao. Lista explicita, e nao deducao automatica.
 *
 * A primeira versao inferia isso lendo os preHandler pela funcao chamada, e
 * errou feio: os modulos usam `preHandler: [authMiddleware]`,
 * `onRequest: [fastify.authenticate]` e ate handler anonimo inline. O
 * resultado marcou 41 rotas como publicas - entre elas tags, favoritos e
 * gamificacao, todas autenticadas. Documentacao que afirma que uma rota
 * protegida e publica e pior do que documentacao que nao afirma nada.
 */
export const ROTAS_PUBLICAS = new Set([
    'POST /api/auth/register',
    'POST /api/auth/login',
    'POST /api/auth/magic-link',
    'POST /api/auth/magic-verify',
    'POST /api/auth/forgot-password',
    'POST /api/auth/reset-password',
    'POST /api/auth/refresh',
    'GET /api/files/public/:tenantId/:fileName'
]);

/** Deriva o grupo a partir do caminho: /api/records/:id -> Base de Conhecimento */
export function grupoDaRota(url) {
    const segmento = url.replace(/^\/api\//, '').split('/')[0];
    if (!segmento) return 'Outros';
    return GRUPOS[segmento] || segmento;
}

const DESCRICAO = `
API da **Incident Intelligence Platform**.

## Autenticação

A maior parte das rotas exige um JWT no cabeçalho \`Authorization\`:

\`\`\`
Authorization: Bearer <accessToken>
\`\`\`

O token vem de \`POST /api/auth/login\`. Cada token carrega a organização
(*tenant*) do usuário — não existe forma de acessar dados de outra organização
com ele.

## Ingestão de eventos

\`POST /api/events/ingest\` é a **única rota pública de escrita**. Ela não usa
sessão: autentica por um token próprio no cabeçalho \`x-api-token\`, criado na
tela de Integrações. É por ela que Zabbix, Grafana, Datadog, Sentry e PagerDuty
abrem eventos — e, se o token estiver configurado para isso, incidentes.

O limite é de 120 requisições por minuto **por token** (não por IP), para que
várias ferramentas atrás do mesmo endereço não se penalizem entre si.

## Idioma das respostas

As mensagens de erro saem no idioma da preferência do usuário autenticado ou,
na falta dela, do cabeçalho \`Accept-Language\` (\`pt\` ou \`en\`).
`.trim();

async function openapiPlugin(fastify) {
    await fastify.register(swagger, {
        openapi: {
            openapi: '3.1.0',
            info: {
                title: 'Incident Intelligence Platform',
                description: DESCRICAO,
                version: versao,
                license: { name: 'AGPL-3.0-or-later', url: 'https://www.gnu.org/licenses/agpl-3.0.html' },
                contact: { name: 'Repositório', url: 'https://github.com/janeiaraujo/knowledgebase' }
            },
            servers: [
                { url: '/', description: 'Esta instância' }
            ],
            components: {
                securitySchemes: {
                    bearerAuth: {
                        type: 'http',
                        scheme: 'bearer',
                        bearerFormat: 'JWT',
                        description: 'Token de acesso devolvido por POST /api/auth/login'
                    },
                    apiToken: {
                        type: 'apiKey',
                        in: 'header',
                        name: 'x-api-token',
                        description: 'Token de ingestão, criado na tela de Integrações'
                    }
                }
            },
            // Padrao para toda rota; quem e publica sobrescreve com `security: []`
            security: [{ bearerAuth: [] }]
        }
    });

    await fastify.register(swaggerUi, {
        routePrefix: '/docs',
        uiConfig: {
            docExpansion: 'list',
            deepLinking: true,
            // Agrupa e ordena por tag, senao 200 rotas viram uma lista unica
            tagsSorter: 'alpha',
            operationsSorter: 'alpha'
        },
        staticCSP: true
    });

    // Taguear pelo caminho evita editar ~200 rotas - e faz modulo novo entrar
    // na documentacao ja agrupado, sem ninguem precisar lembrar.
    fastify.addHook('onRoute', (route) => {
        if (route.url === '/docs' || route.url.startsWith('/docs/')) return;

        // Rotas internas e de infraestrutura nao interessam a quem integra.
        if (route.url === '/health' || route.url.startsWith('/api/ws')) {
            route.schema = { ...route.schema, hide: true };
            return;
        }

        const schema = { ...route.schema };

        if (!schema.tags) schema.tags = [grupoDaRota(route.url)];

        // Sem isto, login e registro herdariam o `security` global e a
        // documentacao diria que eles exigem o token que eles proprios emitem.
        const assinatura = `${[route.method].flat()[0]} ${route.url}`;
        if (schema.security === undefined && ROTAS_PUBLICAS.has(assinatura)) {
            schema.security = [];
        }

        route.schema = schema;
    });
}

// fp() para nao encapsular: registrado como plugin comum, o @fastify/swagger
// so enxergaria as rotas declaradas DENTRO deste escopo - e as rotas da
// aplicacao sao registradas na instancia raiz, depois. O resultado era uma
// especificacao valida e vazia, com zero caminhos.
export default fp(openapiPlugin, { name: 'openapi' });
