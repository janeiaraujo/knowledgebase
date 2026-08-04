Meu projeto não tinha linter. Nenhum — nem no backend (Fastify), nem no frontend (React + Vite). Sempre adiei porque associava linter a briga sobre aspas simples e ponto e vírgula, e isso me parecia a menor das prioridades.

Semana passada configurei. Não para padronizar estilo: liguei só as regras que apontam **bug**. Variável fora de escopo, hook chamado condicionalmente, `catch` vazio, declaração vazando entre `case`.

A configuração encontrou cinco bugs que já estavam em produção. Nenhum deles quebrava o build.

## 1. `request` fora do ciclo da requisição

```js
async function deliverWithRetry(db, webhook, payload, attempt = 1) {
  // ... entrega o webhook, com retry agendado por setTimeout

  await db.collection('webhooks').updateOne(
    { _id: webhook._id, tenant_id: request.tenantId },  // request não existe aqui
    { $inc: statsUpdate }
  );
}
```

Essa função roda **fora** do ciclo da requisição — é entrega assíncrona, com retry por `setTimeout`. Não existe `request` no escopo dela. Toda atualização de estatística de webhook estourava `ReferenceError`.

O detalhe que dói: fui eu que introduzi, semanas antes, num PR que adicionava filtro por tenant em várias consultas. Busquei o padrão, apliquei em todas as ocorrências, e não notei que uma delas estava num escopo diferente.

## 2. Variável que nunca foi declarada

```js
fastify.get('/:databaseId', { ... }, async (request, reply) => {
  const { databaseId } = request.params;

  const database = await db.collection('databases').findOne({
    _id: objectId,        // objectId não é declarado em lugar nenhum
    tenant_id: request.tenantId
  });
```

Duas rotas assim. `GET` e `PATCH` quebravam em **toda** chamada. Estavam ali havia meses — são rotas de um recurso pouco usado, e ninguém tinha reclamado.

## 3, 4 e 5: componentes que estouravam ao renderizar

O frontend tinha passado por uma internacionalização recente, boa parte feita com script. Três resquícios:

- Uma tela **importava** `useTranslation` e nunca chamava o hook. Eram 57 usos de `t()` sem escopo — a página inteira quebrada.
- Outra chamava `useTranslation` **sem importar**.
- Numa terceira, uma função auxiliar no escopo de módulo chamava `t()`. Ironia: era justamente a função criada para melhorar mensagem de erro, e ela quebrava exatamente quando havia erro.

Todos os três: `vite build` passava sem um aviso sequer.

## A parte que me incomodou mais

Antes do linter, eu tinha escrito um verificador próprio para achar exatamente esse problema de escopo. Ele acusou uma dessas telas. Eu **descartei como falso positivo**, porque o mesmo verificador errava em outros arquivos e eu concluí que errava em todos.

Ele estava certo. Minha heurística com regex não sabia equilibrar chaves — strings, comentários e a própria sintaxe de regex contêm `{` e `}`. O ESLint tem um analisador de escopo de verdade e não erra nisso.

A lição não é "use linter". É que **eu construí uma ferramenta ruim, ela me deu a resposta certa, e eu não acreditei nela** porque não confiava na ferramenta.

## De brinde: duas armadilhas do Fastify

Enquanto documentava a API com OpenAPI, esbarrei em duas coisas que não são óbvias e que valem um post sozinhas.

### `setErrorHandler` depois das rotas não funciona

```js
await fastify.register(authRoutes, { prefix: '/api/auth' });
await fastify.register(recordRoutes, { prefix: '/api/records' });
// ... mais 30 registros

fastify.setErrorHandler((error, request, reply) => { ... });  // tarde demais
```

No Fastify, cada `register` cria um contexto encapsulado que herda o tratador de erro existente **naquele momento**. Definido depois, ele não alcança nenhuma rota já registrada. Não há aviso, não há erro: o padrão do framework simplesmente responde no lugar.

Comprovei com duas instâncias idênticas, mudando só a ordem:

```
tratador definido ANTES  -> {"error":"causa real","deQuem":"projeto"}
tratador definido DEPOIS -> {"statusCode":500,"error":"Internal Server Error","message":"causa real"}
```

No meu caso isso significava que uma correção feita meses antes — colocar a mensagem real no campo `error`, que é o que o frontend lê — **esteve inerte desde o dia em que foi feita**. As rotas devolviam `"Bad Request"` no campo que importava, com a causa escondida em `message`.

### Schema de `response` não é só documentação

Achei que declarar o schema de resposta fosse enfeite para o OpenAPI. Não é: ele controla a serialização, e o `fast-json-stringify` **descarta o que o schema não declara**. Medi antes de sair documentando:

```
sem schema                        -> { records: [...], pagination: {...} }
response estrito                  -> { records: [...] }          <- pagination sumiu
response + additionalProperties   -> { records: [...], pagination: {...} }
```

Documentar uma rota podia quebrar os clientes dela **em silêncio**. Pior: ao declarar schema para status de erro (400, 401), o corpo passou a chegar vazio — `{}` no lugar da mensagem.

Virou teste no projeto. E eu conferi que o teste **falha** quando introduzo um schema perigoso, não só que passa com os atuais — teste que nunca acusa nada dá falsa sensação de segurança.

## Sobre as regras que deixei de fora

Duas, com o motivo escrito no próprio arquivo de configuração:

- **`require-atomic-updates`** gerava 22 acusações, todas do mesmo padrão (`request.currentUser = await ...` nos middlewares). O `request` do Fastify é por requisição e os middlewares rodam em sequência — a corrida que a regra descreve não existe ali.
- **Import de `React` não usado**, em 66 arquivos. É dispensável com o JSX runtime automático do Vite, mas remover de todos é faxina de outro PR.

Conviver com falso positivo é como se ensina alguém a ignorar o linter. Se a regra acusa 22 coisas que não são problema, a 23ª — que é — passa batida.

Pelo mesmo motivo, `react-hooks/exhaustive-deps` ficou como **aviso**, não erro: são 46 ocorrências que precisam de análise caso a caso, e transformá-las em erro travaria qualquer PR no primeiro dia.

## O que eu faria diferente

Colocaria o linter no primeiro dia. Não pelo estilo — pela classe de bug que ele pega e que teste unitário não pega, porque exigiria renderizar cada componente e chamar cada rota.

E confiaria mais em ferramenta com analisador de verdade do que na minha própria regex.

---

Se quiser ver a configuração, é um projeto open source (AGPL) de base de conhecimento para incidentes: <https://github.com/janeiaraujo/knowledgebase>

Os arquivos são `backend/eslint.config.js` e `frontend/eslint.config.js`.
