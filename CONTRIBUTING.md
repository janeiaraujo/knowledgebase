# Contribuindo

Obrigado pelo interesse em contribuir! Este documento descreve o fluxo de trabalho do projeto.

## Antes de começar

- Para **bugs** e **novas funcionalidades**, abra uma issue antes de escrever código. Isso evita trabalho duplicado e alinha a abordagem. Há [templates](https://github.com/janeiaraujo/knowledgebase/issues/new/choose) para os dois casos.
- Para correções pequenas (typos, ajustes de documentação), vá direto ao pull request.
- **Primeira vez aqui?** As issues marcadas com [`good first issue`](https://github.com/janeiaraujo/knowledgebase/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22) são pontos de entrada com escopo pequeno e contexto já escrito.
- **Encontrou uma falha de segurança?** Não abra issue pública — [reporte de forma privada](https://github.com/janeiaraujo/knowledgebase/security/advisories/new).

## Ambiente de desenvolvimento

Siga o [Começando](README.md#começando) do README. Em resumo:

```bash
docker compose up -d
cd backend && cp .env.example .env && npm install && npm run migrate && npm run seed && npm run dev
cd frontend && cp .env.example .env && npm install && npm run dev
```

## Fluxo de trabalho

1. Faça um fork e crie um branch a partir da `main`:
   ```bash
   git checkout -b feat/minha-funcionalidade
   ```
2. Faça suas alterações.
3. Verifique que a aplicação sobe sem erros e que o fluxo afetado funciona de ponta a ponta. No backend, rode `npm test` (testes de unidade) e, com o banco no ar, `npm run smoke-test` — os dois rodam no CI.
4. Abra o pull request descrevendo **o que** mudou e **por quê**.

### Nomes de branch

| Prefixo | Uso |
|---|---|
| `feat/` | Nova funcionalidade |
| `fix/` | Correção de bug |
| `docs/` | Apenas documentação |
| `refactor/` | Refatoração sem mudança de comportamento |
| `chore/` | Build, dependências, configuração |

### Mensagens de commit

Seguimos [Conventional Commits](https://www.conventionalcommits.org/pt-br/):

```
feat: adicionar filtro por severidade na busca
fix: corrigir paginacao na listagem de incidentes
docs: documentar variaveis de ambiente opcionais
```

Se o PR merece uma nova versão (`feat`/`fix` relevantes), bump `backend/package.json` **e** `frontend/package.json` juntos, no mesmo PR — use `npm version <x.y.z> --no-git-tag-version` em cada um, para os `package-lock.json` acompanharem (senão o `npm ci` do CI falha). Adicione também a seção da versão no [CHANGELOG.md](CHANGELOG.md): é ela que vira o corpo da release. Veja [Versionamento](README.md#versionamento) no README. A tag e a release são criadas automaticamente ao mergear.

## Padrões de código

- **JavaScript ES Modules** (`import`/`export`) — o projeto usa `"type": "module"`.
- Indentação de **4 espaços** no backend e **2 espaços** no frontend, seguindo o código existente.
- Escreva código que se pareça com o que está ao redor: mesma densidade de comentários, nomes e idiomas do arquivo.
- Um módulo por domínio, no padrão `<dominio>.routes.js` / `<dominio>.service.js`.

### Multi-tenant

Este é o ponto mais sensível do projeto. **Toda** consulta ao banco deve filtrar por `tenant_id`. Um vazamento entre tenants é considerado bug crítico de segurança.

```js
// Correto
await db.collection('records').find({ tenant_id: request.tenantId, status: 'published' });

// Errado — vaza dados entre organizações
await db.collection('records').find({ status: 'published' });
```

### Testes

`npm test` roda os testes de unidade (`backend/tests/`), que não precisam de banco: matriz de permissões, bloqueio de login, recuperação de senha, armazenamento de arquivos e a varredura de isolamento multi-tenant.

Essa varredura merece atenção: ela falha se um PR introduzir consulta a coleção de tenant **sem** `tenant_id` no filtro. Os casos que já existiam estão congelados numa lista (`KNOWN_GAPS`) — corrija-os aos poucos, removendo da lista, em vez de adicionar novos.

### Índices

Novos índices devem ser adicionados em `backend/src/db/indexes.js`. Esse arquivo é a fonte única, usada tanto no boot do servidor quanto pelo `npm run migrate`.

### Integrações externas

Integrações (IA, storage, e-mail, pagamento) são **opcionais por princípio**. Ao adicionar uma nova:

- verifique a configuração antes de instanciar o cliente;
- degrade suavemente — a aplicação deve subir sem a credencial;
- retorne um erro claro (`503`) em vez de estourar `500`.

Use `backend/src/utils/ai.js` como referência.

## Segurança

**Nunca** faça commit de credenciais — nem em código, nem em arquivos de documentação. O `.gitignore` cobre `.env`, mas ele não protege chaves coladas em Markdown.

Antes de commitar, confira o que está sendo enviado:

```bash
git diff --staged
```

Encontrou uma vulnerabilidade? Não abra issue pública — envie um e-mail ao mantenedor descrevendo o problema.

### Autenticação

As rotas de `/api/auth` têm limites de requisição próprios, definidos em código (não em variável de ambiente), e o login bloqueia a conta por 15 minutos após 5 senhas erradas. Ao mexer nesse módulo, preserve as duas camadas: o limite por IP barra volume de uma origem, o bloqueio por conta barra tentativa distribuída contra um usuário específico.

O `POST /api/events/ingest` é a única rota pública de escrita e tem limite **por token**, não por IP — várias fontes de monitoramento costumam sair do mesmo IP de saída, e limitar por IP faria uma ferramenta ruidosa derrubar a ingestão das outras.

## Reportando bugs

Inclua na issue:

- o que você esperava que acontecesse e o que aconteceu;
- passos para reproduzir;
- versão do Node (`node -v`) e sistema operacional;
- logs relevantes — **sem credenciais**.

## Licença

Ao contribuir, você concorda que sua contribuição será licenciada sob a [AGPL-3.0](LICENSE).
