# Incident Intelligence Platform

🌐 [English version](README.en.md) · Português (padrão)

**Base de conhecimento operacional orientada a incidentes.** Um "Notion para operações": registre incidentes durante a emergência, transforme-os em KBs revisadas e encontre soluções rapidamente na próxima ocorrência.

<!-- Badges dinâmicos: os valores são lidos do repositório em tempo real. -->
[![CI](https://img.shields.io/github/actions/workflow/status/janeiaraujo/knowledgebase/ci.yml?branch=main&style=flat-square&color=0aa344&label=build)](https://github.com/janeiaraujo/knowledgebase/actions/workflows/ci.yml)
[![Versão](https://img.shields.io/github/package-json/v/janeiaraujo/knowledgebase?filename=backend%2Fpackage.json&style=flat-square&color=0aa344&label=vers%C3%A3o)](backend/package.json)
[![Última release](https://img.shields.io/github/v/release/janeiaraujo/knowledgebase?style=flat-square&color=0aa344&label=release)](https://github.com/janeiaraujo/knowledgebase/releases)
[![Licença](https://img.shields.io/github/license/janeiaraujo/knowledgebase?style=flat-square&color=0aa344)](LICENSE)
[![Estrelas](https://img.shields.io/github/stars/janeiaraujo/knowledgebase?style=flat-square&color=0aa344&label=estrelas)](https://github.com/janeiaraujo/knowledgebase/stargazers)
[![Issues](https://img.shields.io/github/issues/janeiaraujo/knowledgebase?style=flat-square&color=0aa344)](https://github.com/janeiaraujo/knowledgebase/issues)
[![Contribuidores](https://img.shields.io/github/contributors/janeiaraujo/knowledgebase?style=flat-square&color=0aa344&label=contribuidores)](https://github.com/janeiaraujo/knowledgebase/graphs/contributors)
[![Último commit](https://img.shields.io/github/last-commit/janeiaraujo/knowledgebase?style=flat-square&color=0aa344&label=%C3%BAltimo%20commit)](https://github.com/janeiaraujo/knowledgebase/commits/main)

[![Stack](https://img.shields.io/badge/stack-Node.js%20%7C%20React%20%7C%20MongoDB-informational?style=flat-square)](#stack)
[![Autor](https://img.shields.io/badge/autor-Janei%20Araujo-0aa344?style=flat-square)](https://github.com/janeiaraujo)

> **Status:** projeto em desenvolvimento ativo. A API pode sofrer mudanças incompatíveis entre versões.

---

## Screenshots

<table>
<tr>
<td width="50%">

**Captura Rápida** — texto, voz, logs e imagens; a IA gera o artigo
<img src="docs/screenshots/quick-capture.png" alt="Tela de Captura Rápida, com campos de problema, solução, logs e upload de imagens">

</td>
<td width="50%">

**Incidentes** — lifecycle completo: aberto → reconhecido → resolvido
<img src="docs/screenshots/incidents.png" alt="Lista de incidentes com severidade, status e origem (manual ou automática)">

</td>
</tr>
<tr>
<td width="50%">

**Knowledge Base** — biblioteca de artigos com workflow de revisão
<img src="docs/screenshots/kb-list.png" alt="Lista de KBs com status de rascunho, revisão e publicado">

</td>
<td width="50%">

**Artigo de KB** — gerado a partir de um incidente, pronto para revisão
<img src="docs/screenshots/kb-view.png" alt="Visualização de um artigo de KB em revisão">

</td>
</tr>
<tr>
<td width="50%">

**Busca Inteligente** — combina texto, busca semântica (IA) e análise de problema
<img src="docs/screenshots/smart-search.png" alt="Tela de busca inteligente">

</td>
<td width="50%">

**Post-Mortem** — templates Google SRE, Netflix e AWS Well-Architected
<img src="docs/screenshots/postmortem.png" alt="Modal de criação de post-mortem com templates">

</td>
</tr>
</table>

---

## Índice

- [Screenshots](#screenshots)
- [Principais recursos](#principais-recursos)
- [Stack](#stack)
- [Começando](#começando)
- [Configuração](#configuração)
- [Integrações opcionais](#integrações-opcionais)
- [Scripts disponíveis](#scripts-disponíveis)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Como contribuir](#como-contribuir)
- [Versionamento](#versionamento)
- [Contribuidores](#contribuidores)
- [Autor](#autor)
- [Licença](#licença)

---

## Principais recursos

- **Registro rápido de incidentes** — captura durante a emergência, estruturação depois.
- **Busca textual e semântica** — índice full-text do MongoDB, com busca por similaridade quando a IA está habilitada.
- **Workflow de revisão** — quem cria não aprova; rascunho → revisão → publicado.
- **Multi-tenant** — isolamento de dados por organização em todas as consultas.
- **Controle de acesso** — papéis, departamentos, grupos e permissões por base.
- **Post-mortem e RCA** — templates estruturados, timeline e 5 Whys.
- **Ingestão de eventos** — endpoint para Zabbix, Grafana e afins via token de API.
- **Versionamento e auditoria** — histórico de alterações e trilha de auditoria.
- **Upload de arquivos** — disco local por padrão, ou Cloudflare R2 quando configurado.

## Stack

| Camada | Tecnologias |
|---|---|
| Backend | Node.js 18+, Fastify 4, MongoDB 7, JWT |
| Frontend | React 18, Vite 5, Bootstrap 5, React Router 6 |
| Infra local | Docker Compose (MongoDB) |
| Opcionais | OpenAI, Cloudflare R2, SMTP |

---

## Começando

### Pré-requisitos

- **Node.js 22+** ([nodejs.org](https://nodejs.org)) — o backend roda em 18+, mas o Vite 8 do frontend exige `^20.19.0` ou `>=22.12.0`
- **Docker** ([docs.docker.com](https://docs.docker.com/get-docker/)) — para o MongoDB local
- **Git**

> Prefere não usar Docker? Veja [Usando MongoDB Atlas](#usando-mongodb-atlas-alternativa).

### Instalação

```bash
# 1. Clone o repositório
git clone https://github.com/janeiaraujo/knowledgebase.git
cd knowledgebase

# 2. Suba o MongoDB
docker compose up -d

# 3. Configure e prepare o backend
cd backend
cp .env.example .env
npm install
npm run migrate   # cria os índices do banco
npm run seed      # popula dados de demonstração
npm start

# 4. Em outro terminal, o frontend
cd frontend
cp .env.example .env
npm install
npm run dev
```

Acesse **http://localhost:5173**.

### Credenciais de demonstração

O `npm run seed` cria uma organização de exemplo com 3 KBs:

```
E-mail: demo@incidentkb.com
Senha:  demo123
```

> ⚠️ São credenciais de desenvolvimento. **Nunca** use este seed em produção.

### Verificando a instalação

```bash
curl http://localhost:3000/health
```

---

## Configuração

Toda a configuração fica em `backend/.env` (veja `backend/.env.example`). Apenas quatro variáveis são obrigatórias:

| Variável | Descrição |
|---|---|
| `MONGODB_URI` | Conexão com o MongoDB. Padrão: `mongodb://localhost:27017/incident_intelligence` |
| `JWT_SECRET` | Segredo de assinatura do access token |
| `JWT_REFRESH_SECRET` | Segredo de assinatura do refresh token |
| `FRONTEND_URL` | Origem do frontend, usada no CORS |

Gere segredos seguros com:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

> 🔒 O arquivo `.env` está no `.gitignore`. **Nunca** faça commit de credenciais reais — inclusive em arquivos de documentação.

### Usando MongoDB Atlas (alternativa)

Crie um cluster gratuito, libere seu IP em **Network Access** e ajuste:

```env
MONGODB_URI=mongodb+srv://usuario:senha@cluster.mongodb.net/incident_intelligence?retryWrites=true&w=majority
```

---

## Integrações opcionais

O sistema sobe e funciona **sem nenhuma** delas. Cada uma habilita um recurso específico:

| Integração | Sem configurar | Variáveis |
|---|---|---|
| **OpenAI** | Rotas de IA respondem `503`; o restante funciona | `OPENAI_API_KEY` |
| **Cloudflare R2** | Uploads vão para `backend/uploads/` | `R2_*` |
| **SMTP** | Magic link indisponível; login por senha funciona | `SMTP_*` |
| **Asaas** | Recursos de billing desabilitados | `ASAAS_*` |

---

## Scripts disponíveis

### Backend (`cd backend`)

| Comando | Descrição |
|---|---|
| `npm start` | Inicia a API em `http://localhost:3000` |
| `npm run dev` | Inicia com hot reload (`node --watch`) |
| `npm run migrate` | Cria/atualiza os índices do MongoDB (idempotente) |
| `npm run seed` | Popula dados de demonstração |
| `node scripts/seed-sample-data.js` | Popula KBs, incidentes e eventos de exemplo extras (idempotente por tipo de dado) |
| `npm test` | Smoke test: sobe a API real e valida boot, `/health`, login e uma rota protegida |

> ⚠️ O `seed` é **aditivo**: executá-lo novamente duplica os dados de exemplo. Rode-o apenas em bancos vazios.
> Já `scripts/seed-sample-data.js` verifica antes de inserir (pula KBs/incidentes se já existirem para o tenant), então pode rodar quantas vezes quiser.

### Frontend (`cd frontend`)

| Comando | Descrição |
|---|---|
| `npm run dev` | Servidor de desenvolvimento em `http://localhost:5173` |
| `npm run build` | Build de produção em `dist/` |
| `npm run preview` | Serve o build localmente |

### Docker

| Comando | Descrição |
|---|---|
| `docker compose up -d` | Sobe o MongoDB |
| `docker compose --profile tools up -d` | Sobe também o Mongo Express (`http://localhost:8081`) |
| `docker compose down` | Para os containers (preserva os dados) |
| `docker compose down -v` | Para e **apaga** os dados do banco |

---

## Estrutura do projeto

```
.
├── backend/
│   └── src/
│       ├── db/indexes.js     # Definição dos índices (usada no boot e no migrate)
│       ├── middlewares/      # Autenticação, tenant, RBAC
│       ├── modules/          # Um diretório por domínio (auth, records, kb, ai, ...)
│       ├── seeds/            # Scripts de migrate e seed
│       ├── utils/            # Helpers compartilhados
│       └── server.js         # Bootstrap do Fastify
├── frontend/
│   └── src/
│       ├── components/       # Componentes reutilizáveis
│       ├── contexts/         # Estado global (Context API)
│       ├── pages/            # Telas da aplicação
│       └── services/         # Cliente HTTP
└── docker-compose.yml
```

Cada módulo do backend segue o padrão `<dominio>.routes.js` e, quando há regra de negócio relevante, `<dominio>.service.js`.

---

## Como contribuir

Contribuições são bem-vindas. Veja o [CONTRIBUTING.md](CONTRIBUTING.md) para o fluxo de trabalho, padrões de código e como reportar bugs.

Se este projeto te ajudou, considere deixar uma ⭐ — é o que aumenta o alcance dele.

[![Estrelas ao longo do tempo](https://img.shields.io/github/stars/janeiaraujo/knowledgebase?style=social)](https://github.com/janeiaraujo/knowledgebase/stargazers)

## Versionamento

Segue [SemVer](https://semver.org/lang/pt-BR/). A versão vive em dois lugares que precisam estar sempre iguais: `backend/package.json` e `frontend/package.json` — o CI falha o build se eles divergirem.

Tag e [release](https://github.com/janeiaraujo/knowledgebase/releases) são automáticas: ao mergear um PR que muda a versão, o workflow `.github/workflows/release.yml` cria a tag `vX.Y.Z` e publica a release usando a seção correspondente do [CHANGELOG.md](CHANGELOG.md) como corpo — não precisa criar nada manualmente. Se o CHANGELOG ainda não tiver a seção da versão, o workflow avisa e cai para as notas geradas a partir dos commits. O badge de "versão" no topo deste README lê `backend/package.json` em tempo real; o de "release" lê a última tag publicada.

Para lançar uma nova versão: bump os dois `package.json` no mesmo PR, seguindo o tipo de mudança (`patch` para correção, `minor` para funcionalidade nova compatível, `major` para quebra de compatibilidade), e mergeie — o resto é automático.

### Proteção da branch `main`

Não é possível dar push direto na `main`. Toda mudança passa por pull request com: 1 aprovação, os 3 checks do CI verdes, branch atualizado com a `main` e conversas resolvidas. Force push e exclusão da branch estão bloqueados.

### Dívida técnica conhecida: React Router

O alerta [GHSA-qwww-vcr4-c8h2](https://github.com/advisories/GHSA-qwww-vcr4-c8h2) (CSRF em RSC mode) aparece para o `react-router` 7.x e só tem correção na 8.3.0. **Não se aplica a este projeto**: a advisory afirma que afeta apenas quem usa as APIs instáveis de RSC, e este app é uma SPA client-side que não usa nenhuma delas.

Aplicá-lo não é atualizar uma dependência — `react-router@8` exige React >= 19.2.7, e o projeto está no React 18. Seria uma migração de framework completa. Reavaliar quando migrarmos para o React 19; até lá o alerta está dispensado no Dependabot como "código vulnerável não é usado".

## Contribuidores

Obrigado a todas as pessoas que já contribuíram com este projeto:

<!-- Atualizado automaticamente a partir dos contribuidores do repositório. -->
[![Contribuidores](https://contrib.rocks/image?repo=janeiaraujo/knowledgebase)](https://github.com/janeiaraujo/knowledgebase/graphs/contributors)

## Autor

**Janei Araujo** — [@janeiaraujo](https://github.com/janeiaraujo)

## Licença

Distribuído sob a licença **GNU AGPL-3.0-or-later**. Veja [LICENSE](LICENSE).

Encontrou uma falha de segurança? Não abra issue pública — veja [SECURITY.md](SECURITY.md). Este projeto adota o [Código de Conduta](CODE_OF_CONDUCT.md) do Contributor Covenant.

Em resumo: você pode usar, modificar e redistribuir o projeto, inclusive comercialmente. Porém, **se você o executar como serviço acessível pela rede**, precisa disponibilizar o código-fonte da sua versão modificada aos usuários desse serviço.
