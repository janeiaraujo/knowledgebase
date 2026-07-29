# Estrutura Organizacional e Controle de Acesso

## Visão Geral

Este documento descreve a implementação da estrutura organizacional hierárquica com controle de acesso granular baseado em RBAC + Scope e auditoria completa.

## Modelo de Dados

### 1. Departamentos (`departments`)
```javascript
{
  _id: ObjectId,
  tenant_id: ObjectId,           // Isolamento por tenant
  name: String,                  // Nome do departamento
  description: String,           // Descrição opcional
  parent_department_id: ObjectId | null, // Hierarquia
  created_at: Date,
  updated_at: Date
}
```

**Índices:**
- `{ tenant_id: 1, name: 1 }`
- `{ tenant_id: 1, parent_department_id: 1 }`

**Exemplo de hierarquia:**
```
Financeiro
├── Contabilidade
└── Tesouraria

NOC
├── Monitoramento 24x7
└── Suporte N1

SRE
├── Infraestrutura
└── Performance
```

### 2. Grupos (`groups`)
```javascript
{
  _id: ObjectId,
  tenant_id: ObjectId,
  name: String,                  // Nome do grupo
  description: String,
  department_id: ObjectId,       // Departamento pai (obrigatório)
  parent_group_id: ObjectId | null, // Subgrupos
  created_at: Date,
  updated_at: Date
}
```

**Índices:**
- `{ tenant_id: 1, department_id: 1 }`
- `{ tenant_id: 1, parent_group_id: 1 }`

**Exemplo:**
```
Departamento: NOC
├── Grupo: Analistas
│   ├── Subgrupo: Turno Manhã
│   └── Subgrupo: Turno Noite
└── Grupo: Supervisores
```

### 3. Associação Usuário-Grupo (`user_groups`)
```javascript
{
  _id: ObjectId,
  tenant_id: ObjectId,
  user_id: ObjectId,
  group_id: ObjectId,
  role_in_group: String | null,  // Role específico do grupo (opcional)
  created_at: Date
}
```

**Índices:**
- `{ tenant_id: 1, user_id: 1 }`
- `{ tenant_id: 1, group_id: 1 }`
- `{ tenant_id: 1, user_id: 1, group_id: 1 }` (unique)

**Observação:** Um usuário pode pertencer a múltiplos grupos/departamentos.

### 4. Controle de Acesso a KB (`kb_access`)
```javascript
{
  _id: ObjectId,
  tenant_id: ObjectId,
  kb_id: ObjectId,               // Referência ao KB (record)
  visibility: String,            // 'global' | 'restricted'
  allowed_departments: [ObjectId], // Departamentos com acesso
  allowed_groups: [ObjectId],    // Grupos com acesso
  created_at: Date,
  updated_at: Date,
  updated_by: ObjectId           // Quem alterou por último
}
```

**Índices:**
- `{ tenant_id: 1, kb_id: 1 }` (unique)
- `{ tenant_id: 1, visibility: 1 }`
- `{ tenant_id: 1, allowed_departments: 1 }`
- `{ tenant_id: 1, allowed_groups: 1 }`

**Tipos de Visibilidade:**
- **`global`**: Visível para todos os usuários do tenant
- **`restricted`**: Visível apenas para departamentos/grupos especificados

**Padrão Seguro:** Se não houver registro em `kb_access`, o KB é considerado **`restricted`** sem acesso.

### 5. Logs de Auditoria (`audit_logs`)
```javascript
{
  _id: ObjectId,
  tenant_id: ObjectId | null,    // null para eventos de sistema
  user_id: ObjectId | null,      // null para eventos automáticos
  action: String,                // Ação executada
  entity_type: String,           // Tipo de entidade (kb, user, department, etc)
  entity_id: String | null,      // ID da entidade afetada
  metadata: Object,              // Dados adicionais da ação
  ip: String,                    // IP do cliente
  user_agent: String,            // User agent do browser
  created_at: Date               // Timestamp UTC (imutável)
}
```

**Índices:**
- `{ tenant_id: 1, created_at: -1 }`
- `{ tenant_id: 1, user_id: 1, created_at: -1 }`
- `{ tenant_id: 1, action: 1, created_at: -1 }`
- `{ tenant_id: 1, entity_type: 1, entity_id: 1 }`

**Ações Auditadas:**
- `login` / `logout` / `login_failed`
- `kb_created` / `kb_updated` / `kb_deleted`
- `kb_viewed` (apenas uma vez por hora por usuário)
- `kb_status_changed` (draft → review → published)
- `kb_approved` / `kb_rejected`
- `kb_access_updated` / `kb_access_deleted`
- `department_created` / `department_updated` / `department_deleted`
- `group_created` / `group_updated` / `group_deleted`
- `user_added_to_group` / `user_removed_from_group`
- `file_uploaded` / `file_downloaded`
- `permission_changed`

**Características:**
- ✅ Registros **imutáveis** (não podem ser editados após criação)
- ✅ Auditoria **automática** via middleware
- ✅ Captura IP e User Agent
- ✅ Metadata flexível para dados específicos
- ✅ Timestamps em **UTC**

## APIs Implementadas

### Departamentos (`/api/departments`)

#### `GET /api/departments`
Lista todos os departamentos do tenant (com hierarquia).

**Auth:** Requerido  
**Response:**
```json
{
  "departments": [
    {
      "_id": "...",
      "name": "Financeiro",
      "description": "...",
      "parent_department_id": null
    }
  ]
}
```

#### `POST /api/departments`
Cria novo departamento (admin only).

**Auth:** Admin  
**Audit:** `department_created`  
**Body:**
```json
{
  "name": "NOC",
  "description": "Network Operations Center",
  "parent_department_id": null
}
```

#### `PUT /api/departments/:id`
Atualiza departamento (admin only).

**Auth:** Admin  
**Audit:** `department_updated`

#### `DELETE /api/departments/:id`
Remove departamento (admin only).

**Auth:** Admin  
**Audit:** `department_deleted`  
**Restrições:**
- Não pode ter subdepartamentos
- Não pode ter grupos associados

### Grupos (`/api/groups`)

#### `GET /api/groups`
Lista todos os grupos (pode filtrar por `department_id`).

**Auth:** Requerido  
**Query:** `?department_id=...`

#### `POST /api/groups`
Cria novo grupo (admin only).

**Auth:** Admin  
**Audit:** `group_created`  
**Body:**
```json
{
  "name": "Analistas",
  "description": "Analistas de NOC",
  "department_id": "...",
  "parent_group_id": null
}
```

#### `POST /api/groups/:id/users`
Adiciona usuário ao grupo (admin only).

**Auth:** Admin  
**Audit:** `user_added_to_group`  
**Body:**
```json
{
  "user_id": "...",
  "role_in_group": "analyst"
}
```

#### `DELETE /api/groups/:id/users/:user_id`
Remove usuário do grupo (admin only).

**Auth:** Admin  
**Audit:** `user_removed_from_group`

#### `GET /api/groups/:id/users`
Lista usuários do grupo.

**Auth:** Requerido

### Controle de Acesso a KB (`/api/kb-access`)

#### `GET /api/kb-access/:kb_id`
Obtém configuração de acesso do KB.

**Auth:** Requerido

#### `POST /api/kb-access/:kb_id`
Define controle de acesso do KB (admin/reviewer only).

**Auth:** Admin ou Reviewer  
**Audit:** `kb_access_updated`  
**Body:**
```json
{
  "visibility": "restricted",
  "allowed_departments": ["dept_id_1", "dept_id_2"],
  "allowed_groups": ["group_id_1", "group_id_2"]
}
```

**Para KB Global:**
```json
{
  "visibility": "global"
}
```

#### `POST /api/kb-access/bulk`
Atualiza acesso de múltiplos KBs de uma vez (admin only).

**Auth:** Admin  
**Audit:** `kb_access_bulk_updated`  
**Body:**
```json
{
  "kb_ids": ["kb1", "kb2", "kb3"],
  "visibility": "restricted",
  "allowed_departments": ["dept_id"],
  "allowed_groups": []
}
```

### Auditoria (`/api/audit`)

#### `GET /api/audit`
Lista logs de auditoria com filtros (admin only).

**Auth:** Admin  
**Query:**
- `action`: Filtrar por ação
- `entity_type`: Filtrar por tipo de entidade
- `user_id`: Filtrar por usuário
- `start_date`: Data início (ISO)
- `end_date`: Data fim (ISO)
- `limit`: Limite de resultados (default: 100)
- `skip`: Paginação

**Response:**
```json
{
  "logs": [...],
  "total": 1234,
  "limit": 100,
  "skip": 0
}
```

#### `GET /api/audit/stats/summary`
Estatísticas agregadas de auditoria (admin only).

**Auth:** Admin  
**Response:**
```json
{
  "total": 10000,
  "by_action": [
    { "_id": "kb_viewed", "count": 5000 },
    { "_id": "login", "count": 300 }
  ],
  "by_entity_type": [...],
  "top_users": [...]
}
```

#### `GET /api/audit/users/:user_id`
Atividade de um usuário específico (admin only).

**Auth:** Admin

#### `GET /api/audit/kb/:kb_id`
Histórico de um KB específico (admin/reviewer).

**Auth:** Admin ou Reviewer

## Middlewares

### 1. Audit Middleware (`audit.middleware.js`)

**Uso:**
```javascript
fastify.post('/', {
  preHandler: [authMiddleware, tenantMiddleware, auditMiddleware('kb_created')]
}, async (request, reply) => {
  // ... lógica da rota
  
  // Opcional: adicionar metadata customizada
  request.auditMetadata = {
    kb_id: newKB._id.toString(),
    title: newKB.title
  };
  
  return { success: true };
});
```

**Funcionalidades:**
- Intercepta resposta da rota
- Registra auditoria automaticamente em caso de sucesso (status < 400)
- Captura IP, user agent, tenant_id, user_id
- Usa metadata definido em `request.auditMetadata`
- **Assíncrono** - não bloqueia resposta

### 2. KB Access Middleware (`kbAccess.middleware.js`)

#### `checkKBAccess`
Verifica se usuário pode **visualizar** o KB.

**Uso:**
```javascript
fastify.get('/:id', {
  preHandler: [authMiddleware, tenantMiddleware, checkKBAccess]
}, async (request) => {
  const kb = request.kb; // KB já carregado pelo middleware
  const kbAccess = request.kbAccess; // Config de acesso
  // ...
});
```

**Lógica:**
1. Admin → Acesso total
2. KB global → Todos podem ver
3. KB restricted → Verifica departamento/grupo do usuário
4. Sem acesso → HTTP 403

#### `checkKBEditAccess`
Verifica se usuário pode **editar** o KB.

**Regras:**
- Admin → Pode editar tudo
- Reviewer → Pode editar tudo que pode ver
- Editor → Pode editar apenas seus próprios KBs
- Viewer → Não pode editar

#### `checkKBApproveAccess`
Verifica se usuário pode **aprovar** o KB.

**Regras:**
- Apenas Admin e Reviewer podem aprovar

#### `filterKBsByAccess`
Retorna query filter para listar apenas KBs acessíveis ao usuário.

**Uso:**
```javascript
const filter = await filterKBsByAccess(tenantId, userId, userRole);
const kbs = await db.collection('records').find(filter).toArray();
```

## Regras de Segurança

### 1. Isolamento de Tenant
✅ **TODAS** as queries incluem `tenant_id`  
✅ Impossível acessar dados de outro tenant  
✅ Validado em middlewares `authMiddleware` + `tenantMiddleware`

### 2. Controle de Acesso (RBAC + Scope)

**Roles:**
- **Admin**: Acesso total ao tenant
- **Reviewer**: Pode ver, editar e aprovar KBs autorizados
- **Editor**: Pode criar e editar seus próprios KBs
- **Viewer**: Apenas visualização de KBs autorizados

**Scope (Departamento/Grupo):**
- Usuário pertence a um ou mais grupos
- Cada grupo pertence a um departamento
- KBs têm lista de departamentos/grupos autorizados
- Acesso é calculado dinamicamente

**Matriz de Permissões:**

| Ação | Admin | Reviewer | Editor | Viewer |
|------|-------|----------|--------|--------|
| Ver KB global | ✅ | ✅ | ✅ | ✅ |
| Ver KB restrito (com acesso) | ✅ | ✅ | ✅ | ✅ |
| Ver KB restrito (sem acesso) | ✅ | ❌ | ❌ | ❌ |
| Criar KB | ✅ | ✅ | ✅ | ❌ |
| Editar próprio KB | ✅ | ✅ | ✅ | ❌ |
| Editar KB de outros | ✅ | ✅ | ❌ | ❌ |
| Aprovar/Publicar KB | ✅ | ✅ | ❌ | ❌ |
| Configurar acesso KB | ✅ | ✅ | ❌ | ❌ |
| Gerenciar dept/grupos | ✅ | ❌ | ❌ | ❌ |
| Ver auditoria | ✅ | ❌ | ❌ | ❌ |

### 3. Auditoria Obrigatória

✅ **NÃO pode** ser desativada  
✅ Registros são **imutáveis**  
✅ Captura automática via middleware  
✅ Timestamp em **UTC**  
✅ Inclui IP e User Agent  

**Eventos Obrigatórios:**
- Login/Logout (incluindo falhas)
- Visualização de KB (primeira vez por hora)
- CRUD de KB
- Mudanças de status/aprovação
- Alterações de permissão
- Gestão de dept/grupos

### 4. Padrão Seguro (Secure by Default)

✅ KB sem configuração → **restricted** (ninguém acessa exceto admin)  
✅ Departamento sem usuários → não afeta acesso  
✅ Grupo vazio → não afeta acesso  
✅ Usuário sem grupos → vê apenas KBs globais  
✅ Erro de permissão → **403 Forbidden** (não 404)

## Decisões Técnicas

### 1. Por que ObjectId para relacionamentos?
- Performance: Joins no MongoDB são custosos
- Flexibilidade: Facilita hierarquias e múltiplos vínculos
- Escalabilidade: Permite sharding futuro

### 2. Por que auditoria em coleção separada?
- Imutabilidade: Não pode ser alterada
- Performance: Não afeta queries de negócio
- Retenção: Pode ter política de retenção diferente
- Compliance: Facilita relatórios e auditorias externas

### 3. Por que middleware de auditoria?
- DRY: Não duplicar código em cada rota
- Consistência: Garante formato uniforme
- Automático: Impossível esquecer de auditar
- Assíncrono: Não impacta performance

### 4. Por que cache de sessão para KB views?
- Performance: Evita múltiplos inserts na mesma sessão
- Precisão: Uma view = uma visualização real
- Cleanup: Registros antigos expiram (1 hora)

## Próximos Passos

### Backend Prioritário
- [ ] Implementar cache Redis para permissões
- [ ] Adicionar rate limiting por tenant
- [ ] Exportar logs de auditoria (CSV/JSON)
- [ ] Webhooks para eventos de auditoria

### Frontend Futuro
- [ ] Tela de gestão de departamentos/grupos
- [ ] Seletor de visibilidade ao criar/editar KB
- [ ] Visualizador de logs de auditoria
- [ ] Dashboard de atividades por departamento

### Melhorias Possíveis
- [ ] Permissões granulares (create, read, update, delete)
- [ ] Herança de permissões em hierarquias
- [ ] Delegação de aprovação por departamento
- [ ] Políticas de retenção de auditoria por tipo
- [ ] Alertas de atividades suspeitas

## Testando a Implementação

### 1. Criar Estrutura Organizacional

```bash
# Criar departamento
POST /api/departments
{
  "name": "NOC",
  "description": "Network Operations Center"
}

# Criar grupo no departamento
POST /api/groups
{
  "name": "Analistas N1",
  "department_id": "<dept_id>",
  "description": "Analistas de primeiro nível"
}

# Adicionar usuário ao grupo
POST /api/groups/<group_id>/users
{
  "user_id": "<user_id>"
}
```

### 2. Configurar Acesso a KB

```bash
# KB restrito para departamento NOC
POST /api/kb-access/<kb_id>
{
  "visibility": "restricted",
  "allowed_departments": ["<noc_dept_id>"]
}

# KB global
POST /api/kb-access/<kb_id>
{
  "visibility": "global"
}
```

### 3. Verificar Auditoria

```bash
# Ver logs de um KB
GET /api/audit/kb/<kb_id>

# Ver atividade de um usuário
GET /api/audit/users/<user_id>

# Estatísticas gerais
GET /api/audit/stats/summary
```

## Documentação Adicional

- [AUTHENTICATION.md](./AUTHENTICATION.md) - Sistema de autenticação
- [README.md](./README.md) - Visão geral do projeto
- Ver código inline para detalhes de implementação

---

**Última atualização:** 21/12/2025  
**Implementado por:** GitHub Copilot  
**Status:** ✅ Backend funcional e seguro
