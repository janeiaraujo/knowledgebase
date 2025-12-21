# 🚀 Incident Intelligence Platform - Knowledge Base SaaS

**Plataforma operacional multi-tenant para gerenciamento inteligente de Knowledge Bases orientada a incidentes.**

[![Status](https://img.shields.io/badge/status-MVP%20Completo-success)]()
[![Stack](https://img.shields.io/badge/stack-Node.js%20%7C%20React%20%7C%20MongoDB-blue)]()

---

## 📋 Visão Geral

Sistema SaaS completo que funciona como um "Notion operacional" focado em:
- ✅ Registro rápido de incidentes durante emergências
- ✅ Busca inteligente de KBs (textual + semântica com IA)
- ✅ Workflow de revisão e aprovação (quem cria não aprova)
- ✅ Ingestão de eventos externos (Zabbix, Grafana, etc.) via API
- ✅ Multi-tenant com isolamento total de dados por organização
- ✅ IA para sugestões e rascunhos (NUNCA publica automaticamente)
- ✅ Upload de arquivos com Cloudflare R2
- ✅ Versionamento completo de KBs
- ✅ Auditoria completa de ações
- ✅ Sistema de billing e métricas de uso
- ✅ Autenticação JWT + Magic Link

---

## 🏗️ Arquitetura

```
Frontend (React + Vite)  ←→  Backend API (Fastify)
                                  ↓
        ┌─────────────────────────┼─────────────────────────┐
        │                         │                         │
   MongoDB Atlas          OpenAI Embeddings        Cloudflare R2
  (Multi-tenant DB)     (Busca Semântica)       (File Storage)
```

### Stack Tecnológica

**Backend:**
- Node.js 18+ com **JavaScript ES Modules**
- Fastify (framework web de alta performance)
- MongoDB Atlas (Free Tier, schema dinâmico)
- JWT para autenticação (access + refresh tokens)
- Magic Link via email (nodemailer)
- OpenAI API (embeddings GPT-4)
- Cloudflare R2 (S3-compatible storage)
- Rate limiting e CORS
- Auditoria completa

**Frontend:**
- React 18 + Vite
- Bootstrap 5 + Bootstrap Icons
- React Router v6
- Axios (API client)
- React Markdown (preview)
- Context API para state management

---

## 🚀 Quick Start

### Pré-requisitos

- Node.js 18+ instalado
- MongoDB Atlas (conta gratuita)
- Git

### 1. Clonar o repositório

```bash
git clone https://github.com/janeiaraujo/knowledgebase.git
cd knowledgebase
```

### 2. Configurar Backend

```bash
cd backend
npm install
```

Crie o arquivo `.env` baseado em `.env.example`:

```bash
cp .env.example .env
```

Edite o `.env` com suas credenciais:

```env
# MongoDB Atlas (OBRIGATÓRIO)
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/incident-kb

# JWT (OBRIGATÓRIO - gere secrets fortes)
JWT_SECRET=your-secret-key-min-32-chars
JWT_REFRESH_SECRET=your-refresh-secret-key-min-32-chars

# OpenAI (OBRIGATÓRIO para IA)
OPENAI_API_KEY=sk-...

# Cloudflare R2 (OBRIGATÓRIO para upload de arquivos)
R2_ACCOUNT_ID=your-account-id
R2_ACCESS_KEY_ID=your-access-key
R2_SECRET_ACCESS_KEY=your-secret-key
R2_BUCKET_NAME=incident-kb-files

# Email (OPCIONAL - para magic link)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

### 3. Popular banco com dados demo

```bash
npm run seed
```

Isso criará:
- ✅ Tenant de demonstração
- ✅ Usuário demo: `demo@incidentkb.com` / `demo123`
- ✅ 3 KBs de exemplo
- ✅ API Token para ingestão de eventos
- ✅ Subscription gratuita ativa

### 4. Iniciar Backend

```bash
npm run dev
```

Backend rodando em: `http://localhost:3000`

### 5. Configurar e Iniciar Frontend

Em outro terminal:

```bash
cd frontend
npm install
npm run dev
```

Frontend rodando em: `http://localhost:5173`

### 6. Acessar a Aplicação

Abra `http://localhost:5173` e faça login com:
- **Email:** `demo@incidentkb.com`
- **Senha:** `demo123`

---

## 📁 Estrutura do Projeto

```
/backend
  /src
    /modules
      /auth          # Autenticação JWT + Magic Link
      /organizations # Gestão de organizações
      /users         # Gestão de usuários e convites
      /databases     # Database Builder (Notion-like)
      /records       # KBs com versionamento
      /incidents     # Gestão de incidentes
      /events        # Ingestão de eventos externos
      /files         # Upload para Cloudflare R2
      /ai            # OpenAI: embeddings, busca semântica, rascunhos
      /billing       # Planos, uso e métricas
    /middlewares
      auth.middleware.js      # Validação JWT
      tenant.middleware.js    # Isolamento multi-tenant
      rbac.middleware.js      # Controle de permissões
    /seeds           # Dados de demonstração
    server.js        # Entry point

/frontend
  /src
    /components      # Componentes reutilizáveis
    /contexts        # AuthContext (Context API)
    /pages          # Páginas da aplicação
      /auth         # Login, Register, Magic Link
      /kb           # Lista, View, Create, Edit de KBs
      /incidents    # Gestão de incidentes
      /events       # Visualização de eventos
    /services       # API client (axios)
    App.jsx         # Rotas e layout
```

---

## 🔐 Autenticação e Multi-tenant

### Fluxo de Autenticação

1. **Registro**: Cria usuário + tenant + organização automaticamente
2. **Login com senha**: JWT access token (15min) + refresh token (7d)
3. **Magic Link**: Token único enviado por email, válido por 15min
4. **Refresh**: Renovação automática do access token

### Multi-tenant

- Cada documento tem `tenant_id` obrigatório
- Todas as queries filtram por `tenant_id`
- Middleware valida tenant em toda requisição autenticada
- Embeddings e uploads segregados por tenant

### RBAC (Role-Based Access Control)

Roles disponíveis:
- **owner**: Acesso total, gerencia billing
- **admin**: Gerencia usuários, aprova KBs
- **member**: Cria e edita KBs e incidents
- **viewer**: Apenas visualiza

---

## 📚 API Endpoints

### Autenticação
```
POST /api/auth/register      # Criar conta
POST /api/auth/login          # Login com senha
POST /api/auth/magic-link     # Solicitar magic link
POST /api/auth/magic-verify   # Verificar magic link
POST /api/auth/refresh        # Renovar access token
GET  /api/auth/me             # Usuário atual
```

### Knowledge Base
```
GET    /api/kb/search         # Busca textual + semântica
POST   /api/kb/capture        # Captura rápida durante incidente
GET    /api/kb/:id/related    # KBs relacionados

GET    /api/records           # Listar KBs
POST   /api/records           # Criar KB
GET    /api/records/:id       # Visualizar KB
PATCH  /api/records/:id       # Editar KB
DELETE /api/records/:id       # Deletar KB
POST   /api/records/:id/approve   # Aprovar KB (não pode aprovar próprio)
POST   /api/records/:id/publish   # Publicar KB
GET    /api/records/:id/versions  # Histórico de versões
```

### Incidents
```
GET    /api/incidents         # Listar incidentes
POST   /api/incidents         # Criar incidente
GET    /api/incidents/:id     # Ver incidente
PATCH  /api/incidents/:id     # Atualizar incidente
POST   /api/incidents/:id/notes  # Adicionar nota
```

### Event Ingestion
```
POST /api/events/ingest       # Ingerir evento externo (requer API token)
Headers: { "x-api-token": "your-token" }

Body:
{
  "source": "zabbix|grafana|prometheus",
  "event_type": "alert|warning|error",
  "severity": "info|warning|error|critical",
  "title": "Event title",
  "description": "Event description",
  "metadata": {}
}
```

### Files
```
POST   /api/files/upload      # Upload de arquivo
GET    /api/files/:id         # Metadata do arquivo
GET    /api/files/:id/signed-url  # URL assinada (privada)
DELETE /api/files/:id         # Deletar arquivo
```

### IA
```
POST /api/ai/generate-draft   # Gerar rascunho de KB/RCA/Postmortem
POST /api/ai/summarize        # Resumir texto
POST /api/ai/suggest-properties  # Sugerir categorias e tags
POST /api/ai/semantic-search  # Busca semântica via embeddings
```

### Billing
```
GET  /api/billing/subscription   # Subscription atual
GET  /api/billing/usage          # Uso de recursos
GET  /api/billing/plans          # Planos disponíveis
POST /api/billing/change-plan    # Mudar plano
```

---

## 🤖 IA - Regras e Limitações

### O que a IA PODE fazer:
✅ Resumir textos de incidentes
✅ Sugerir propriedades (categoria, prioridade, tags)
✅ Gerar rascunhos de KB, RCA e post-mortem
✅ Criar embeddings para busca semântica
✅ Sugerir relações entre KBs

### O que a IA NÃO PODE fazer:
❌ Publicar KBs automaticamente
❌ Alterar conteúdo aprovado
❌ Acessar dados de outro tenant
❌ Exceder limites de créditos do plano

### Créditos de IA
- Plano Free: 1,000 créditos/mês
- Plano Starter: 10,000 créditos/mês
- Plano Professional: 50,000 créditos/mês
- Plano Enterprise: Ilimitado

---

## 🔄 Workflow de KB

### Estados do KB:
1. **captured**: Captura rápida durante incidente
2. **draft**: Rascunho em edição
3. **in_review**: Enviado para revisão
4. **approved**: Aprovado (quem cria não pode aprovar)
5. **published**: Publicado e disponível
6. **deprecated**: Obsoleto

### Regras:
- ✅ Versionamento completo (cada alteração = nova versão)
- ✅ Quem cria NÃO pode aprovar (RBAC)
- ✅ Auditoria completa (quem, quando, o quê)
- ✅ KBs aprovados/publicados não podem ser editados (criar nova versão)

---

## 🎯 Planos e Limites

### Free
- 5 usuários
- 1,000 KBs
- 10,000 eventos/mês
- 1,000 créditos IA/mês
- **Preço:** Grátis

### Starter
- 20 usuários
- 10,000 KBs
- 100,000 eventos/mês
- 10,000 créditos IA/mês
- **Preço:** R$ 99/mês

### Professional
- 100 usuários
- 50,000 KBs
- 500,000 eventos/mês
- 50,000 créditos IA/mês
- **Preço:** R$ 299/mês

### Enterprise
- Ilimitado
- **Preço:** Sob consulta

---

## 🛡️ Segurança

- ✅ JWT com refresh tokens
- ✅ RBAC por role
- ✅ Rate limiting (100 req/min)
- ✅ Validação de payloads (Joi)
- ✅ Auditoria de ações sensíveis
- ✅ Isolamento multi-tenant
- ✅ Secrets em variáveis de ambiente (nunca no código)

---

## 📊 Monitoring e Logs

- Logs estruturados com Pino
- Auditoria completa em `audit_logs`
- Métricas de uso em `usage_metrics`
- Health check: `GET /health`

---

## 🚧 Roadmap Futuro

- [ ] Editor Rich Text TipTap integrado
- [ ] Workflow visual de incidentes
- [ ] Dashboard de analytics
- [ ] Integração Slack/Teams
- [ ] Webhooks customizáveis
- [ ] SSO (SAML, OAuth)
- [ ] Mobile app
- [ ] On-premise deployment

---

## 🤝 Contribuindo

1. Fork o projeto
2. Crie uma branch (`git checkout -b feature/nova-feature`)
3. Commit suas mudanças (`git commit -m 'Add nova feature'`)
4. Push para a branch (`git push origin feature/nova-feature`)
5. Abra um Pull Request

---

## 📝 Decisões Técnicas

### Por que JavaScript (não TypeScript)?
- Especificado no contexto
- ES Modules nativos (`"type": "module"`)
- Desenvolvimento mais rápido para MVP
- TypeScript pode ser adicionado posteriormente

### Por que Fastify (não Express)?
- Performance superior (até 2x mais rápido)
- Validação de schema nativa (Joi)
- Plugins robustos (@fastify/jwt, @fastify/cors)
- Async/await por padrão

### Por que MongoDB?
- Schema flexível (ideal para properties dinâmicas estilo Notion)
- Multi-tenant natural (filtro por tenant_id)
- Text search nativo
- Atlas Free Tier generoso

### Por que Cloudflare R2?
- S3-compatible (fácil migração)
- Sem custos de egress
- Performance global
- Mais barato que S3

---

## 📄 Licença

MIT

---

## 👤 Autor

**Janei Araujo**  
GitHub: [@janeiaraujo](https://github.com/janeiaraujo)

---

## 🎉 MVP Completo!

Este projeto foi desenvolvido como MVP funcional em 24 horas, incluindo:
- ✅ Backend completo com 11 módulos
- ✅ Frontend React responsivo
- ✅ Autenticação multi-tenant
- ✅ RBAC implementado
- ✅ IA integrada
- ✅ Upload de arquivos
- ✅ Billing e métricas
- ✅ Seed com dados demo
- ✅ Documentação completa

**Pronto para produção após configuração de credenciais reais!**

## ⚙️ Setup Rápido

### 1. Pré-requisitos
- Node.js 18+
- MongoDB Atlas (conta gratuita)
- OpenAI API Key
- Cloudflare R2 (já configurado)

### 2. Backend

```bash
cd backend

# Instalar dependências
npm install

# Configurar variáveis de ambiente
cp .env.example .env
# Editar .env com suas credenciais

# Iniciar servidor em desenvolvimento
npm run dev
```

O servidor estará rodando em `http://localhost:3000`

### 3. Configuração do .env

Edite o arquivo `backend/.env`:

```env
# MongoDB Atlas
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/incident_intelligence

# JWT Secrets (MUDE EM PRODUÇÃO!)
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-in-production

# OpenAI
OPENAI_API_KEY=sk-...

# Cloudflare R2 (já configurado)
R2_ACCOUNT_ID=REDACTED_R2_ACCOUNT_ID
R2_ACCESS_KEY_ID=REDACTED_R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY=REDACTED_R2_SECRET_ACCESS_KEY
R2_BUCKET_NAME=knowledge-base-media
R2_PUBLIC_URL=https://REDACTED_R2_PUBLIC_BUCKET.r2.dev
R2_ENDPOINT=https://REDACTED_R2_ACCOUNT_ID.r2.cloudflarestorage.com
```

---

## 🔑 API Endpoints Implementados

### Autenticação

```bash
# Registrar novo usuário + organização
POST /api/auth/register
Content-Type: application/json
{
  "email": "admin@company.com",
  "password": "strongpassword",
  "name": "Admin User",
  "organizationName": "My Company"
}

# Login
POST /api/auth/login
{
  "email": "admin@company.com",
  "password": "strongpassword"
}

# Refresh token
POST /api/auth/refresh

# Logout
POST /api/auth/logout

# Get user info
GET /api/auth/me
```

### Files (Upload)

```bash
# Upload de arquivo
POST /api/files/upload
Content-Type: multipart/form-data

# Listar arquivos
GET /api/files?page=1&limit=50

# Deletar arquivo
DELETE /api/files/:id
```

---

## 🎯 Funcionalidades Implementadas

### ✅ Core (Semana 1)
- [x] **Autenticação completa**: JWT + Refresh Token
- [x] **Multi-tenant**: Isolamento total por `tenant_id`
- [x] **RBAC**: Role-Based Access Control
- [x] **Rate Limiting**: Diferentes limites para login, API, eventos e IA
- [x] **Auditoria**: Logs estruturados
- [x] **Files Module**: Upload para R2
- [x] **Records Service**: CRUD de KBs com versionamento
- [x] **AI Integration**: OpenAI embeddings + busca semântica

### 🚧 Próximos Passos (Semana 2-4)

**Semana 2**: Database Builder + Frontend  
**Semana 3**: Workflow + Events + Incident Chat  
**Semana 4**: IA + Billing + Hardening + Deploy

---

## 📊 Modelo de Dados

### Coleções MongoDB

1. **tenants** - Organizações multi-tenant
2. **users** - Usuários do sistema
3. **roles** - Roles com permissões
4. **records** - KBs, Incidents, Events (núcleo)
5. **record_versions** - Versionamento completo
6. **files** - Metadados de arquivos
7. **ai_embeddings** - Vetores para busca semântica
8. **audit_logs** - Auditoria de ações
9. **usage_metrics** - Métricas de uso
10. **subscriptions** - Planos e billing

---

## 🔄 Workflow de Knowledge Base

```
CAPTURED → DRAFT → IN_REVIEW → APPROVED → PUBLISHED → DEPRECATED
```

### Regras

- ✅ Quem cria **NÃO** pode aprovar
- ✅ Todas as mudanças geram versão
- ✅ Auditoria completa
- ✅ IA gera apenas rascunhos (nunca publica)

---

## 🔐 Segurança

- ✅ Multi-tenant isolation (todas queries com `tenant_id`)
- ✅ JWT + Refresh Token (HttpOnly cookies)
- ✅ Bcrypt para senhas (10 rounds)
- ✅ Rate limiting configurado
- ✅ RBAC com cache de permissões
- ✅ Auditoria completa

---

## 📚 Documentação

- [PLANO_TECNICO.md](./PLANO_TECNICO.md) - Plano completo de 30 dias
- Backend: `backend/src/` - Código TypeScript documentado

---

## 🎯 Status do MVP

**Prazo**: 30 dias  
**Progresso**: ~35% (Semana 1 completa)  
**Próximo marco**: Database Builder + Frontend Setup

---

## 📄 Licença

MIT License

---

**Desenvolvido com ❤️ para resolver problemas operacionais reais.**