# Changelog

Todas as mudanças relevantes deste projeto são registradas aqui.

O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/)
e o versionamento segue [SemVer](https://semver.org/lang/pt-BR/).

A seção de cada versão vira o corpo da GitHub Release automaticamente —
veja [Versionamento](README.md#versionamento).

> **Sobre a lacuna entre 1.0.0 e 2.1.0.** Não existe tag `v2.0.0`, e isso é
> intencional. A versão 2.0.0 chegou a existir nos `package.json` por cerca de
> uma hora, num commit que apenas alinhou os números do backend e do frontend
> (a sidebar mostrava `v2.0` como texto fixo, dessincronizado). Ela foi
> substituída pela 2.1.0 no mesmo dia e **nunca foi publicada**. Criar a tag
> depois apontaria para um estado que ninguém instalou nem testou como release,
> o que engana mais do que a lacuna.

## [2.7.0] - 2026-08-04

### Corrigido

- O tratador global de erros **nunca alcançou nenhuma rota**. No Fastify, cada
  `register` cria um contexto encapsulado que herda o tratador existente naquele
  momento — e ele era definido depois de todos os registros. Na prática, a
  correção do "Erro desconhecido" esteve inerte desde que foi feita: as rotas
  devolviam `"error": "Bad Request"` no campo que o frontend lê, com a causa real
  escondida em `message` (#58).
- Dez callbacks memoizados usavam `t()` sem declarar `t` nas dependências,
  ficando presos ao idioma ativo no momento em que foram criados. O usuário
  trocava de idioma e aquelas mensagens — quase todas de erro — continuavam na
  língua anterior até recarregar a página. Dois deles tinham um `eslint-disable`
  que escondia o aviso (#62).

### Adicionado

- Documentação OpenAPI 3.1 em `/docs`: 209 caminhos, 267 operações, agrupadas
  automaticamente pelo caminho da rota. A rota pública de ingestão tem schema
  completo, com exemplos, deduplicação e abertura automática de incidente.
  Desligue com `DOCS_ENABLED=false` (#57).
- Teste que monta **todas as 43 telas** e falha se alguma estourar ao renderizar.
  Os três bugs de frontend encontrados na versão anterior eram todos dessa
  família, e nenhum derrubava o build (#63).

### Alterado

- READMEs corrigidos: a tabela de Stack dizia Fastify 4, Vite 5 e React Router 6,
  quando o projeto está em Fastify 5, Vite 8 e react-router-dom 7. Os
  pré-requisitos ainda diziam que o Docker servia só para o MongoDB (#60).

## [2.6.0] - 2026-08-03

### Corrigido

Cinco bugs que já estavam em produção, todos encontrados ao introduzir o
ESLint (#50) — nenhum deles quebrava o build, todos quebravam na tela ou na
requisição:

- `deliverWithRetry` usava `request.tenantId`, mas roda fora do ciclo da
  requisição (entrega assíncrona, com retry agendado por `setTimeout`). Toda
  atualização de estatística de webhook estourava `ReferenceError`. O tenant
  agora sai do próprio webhook.
- `GET` e `PATCH /databases/:id` referenciavam um `objectId` que nunca foi
  declarado — quebravam em toda chamada.
- A tela de Revisões estava inteiramente quebrada: importava `useTranslation`
  e nunca chamava o hook, com 57 usos de `t()` sem escopo.
- A tela de Atividade dos Usuários chamava `useTranslation` sem importar.
- Em KBView, `getErrorMessage` vivia no escopo de módulo e chamava `t()` — a
  função criada para consertar o "Erro desconhecido" quebrava justamente
  quando havia erro. Agora recebe `t` por parâmetro.
- O editor de texto tinha violação de `rules-of-hooks`: um retorno antecipado
  antes de um `useCallback` mudava a ordem dos hooks entre renders.
- A URL do WebSocket era montada com a porta 3000 fixa, o que quebra atrás de
  qualquer proxy reverso. Passa a derivar da origem atual (#54).

### Adicionado

- `docker compose up -d` sobe a plataforma inteira — banco, API e interface —
  respondendo em `http://localhost:8080`. A interface é servida por nginx, que
  faz o proxy de `/api` e do WebSocket, então só uma porta precisa existir no
  host. Os dados de demonstração ficam sob demanda
  (`docker compose --profile demo run --rm seed`), porque o seed não é
  idempotente (#54).
- ESLint no backend e no frontend, rodando no CI antes dos testes. As regras
  apontam bug, não estilo: variável fora de escopo, hook condicional, `catch`
  vazio, declaração vazando entre `case` (#50).
- `SECURITY.md` com canais privados de reporte, prazos e escopo, e
  `CODE_OF_CONDUCT.md` (Contributor Covenant 2.1). O projeto já havia publicado
  três correções de segurança sem ter canal privado (#52).
- Guarda contra release esquecida: o CI avisa quando um PR muda código de
  produto sem bumpar a versão, e um workflow mantém uma issue aberta enquanto a
  `main` estiver à frente da última tag, fechando-a sozinho quando a release
  sair (#49).

### Alterado

- Logs de depuração saíram do console de produção: o ciclo de vida do WebSocket
  passa por um helper guardado por `import.meta.env.DEV` (some do bundle em
  produção) e as mensagens do backend viraram `fastify.log.info` (#53).
- Removidos 94 imports mortos e 18 trechos de código morto (#50).

## [2.5.0] - 2026-08-03

### Segurança

- `fast-uri` 3.1.4/4.1.1 → 3.1.5/4.1.2 (GHSA-7p8r-x3mc-p8w7, severidade alta):
  confusão de host quando a autoridade da URL vem introduzida por barra
  invertida. Chega transitivamente pelo Fastify — roteador e serializador — e a
  correção é só de lock, sem mudança de `package.json` (#35).

### Adicionado

- A API passou a responder as mensagens de erro no idioma do usuário. Das 255
  mensagens, 182 estavam em inglês e 73 em português, sem critério: quem usava
  a plataforma em inglês recebia "Notificação não encontrada". A tradução
  acontece na borda, num hook de serialização, e o idioma sai da preferência
  salva no Perfil ou do `Accept-Language` (#36).
- Interface completa nos dois idiomas: as 43 telas restantes traduzidas. São
  73 arquivos traduzindo e nenhum com texto fixo em português (#37).
- Testes de integração contra um MongoDB de verdade: duas organizações criadas
  pelo endpoint de registro, verificando que uma não enxerga nem altera nada da
  outra — leitura por id, listagem, `PATCH` e `DELETE` cruzados (conferindo
  depois que o dado sobreviveu), comentários, incidentes e contadores. A
  varredura estática que já existia prova que o filtro está *escrito*; isto
  prova que ele funciona (#39).

### Desempenho

- Bundle dividido por rota. O frontend saía num chunk único de 2,0 MB: quem
  abria a tela de login baixava a aplicação inteira — editor, gráficos, telas
  de admin — para ver um formulário com dois campos. Carga inicial passou de
  2400 kB para 969 kB (649 kB → 256 kB gzip). Login e Register ficam estáticos
  de propósito, para não trocar o bundle grande por um flash de spinner na
  abertura (#38, trazido para a `main` pelo #47).

### Corrigido

- O CI não rodava em PR cujo destino não fosse a `main`, então um PR empilhado
  sobre outra branch não recebia check nenhum — a proteção da `main` cobria só
  o PR de baixo da pilha (#47).

## [2.4.0] - 2026-08-03

### Segurança

- A rota pública de ingestão (`POST /api/events/ingest`) passou a ter limite
  por token: 120 requisições por minuto. Era a única rota de escrita sem
  autenticação de sessão, então uma fonte de monitoramento ruidosa — ou um
  token vazado — podia encher a base de eventos sem qualquer freio. O limite
  é por token, não por IP: várias ferramentas atrás do mesmo IP não se
  penalizam entre si (#30).
- Fechados 19 pontos em que uma consulta não filtrava por `tenant_id`
  (contador de views, agendamento de revisão, post-mortem, busca inteligente,
  estatísticas de webhook, fluxos GPS e as dez consultas de gamificação).
  Nenhum vazava leitura entre organizações no fluxo normal, porque o id vinha
  de um documento já filtrado — mas não havia defesa em profundidade: um id de
  outra organização chegando pela URL seria aceito (#31).

### Adicionado

- Interface completa em português e inglês. Doze telas passaram a atender os
  dois idiomas: KBView, Configurações, Revisões, Favoritos, Notificações,
  Busca Avançada, Busca Inteligente, Integrações (entrada e saída),
  Relatórios, Atividade dos Usuários e os editores de fluxo GPS e post-mortem
  (#32).
- Testes de i18n rodando no CI antes do build: paridade de chaves entre os
  dois idiomas, existência real de cada chave citada no código, igualdade dos
  placeholders de interpolação e uma catraca que impede telas já traduzidas de
  voltarem a ter texto fixo (#32).

### Corrigido

- Datas passaram a seguir o idioma ativo. Antes o locale era `pt-BR` fixo em
  toda a aplicação, inclusive com o idioma em inglês (#32).
- Rótulos de prioridade, tipo de etapa, período e dia da semana viviam em
  constantes de módulo, avaliadas uma única vez na carga: não mudavam ao
  trocar de idioma sem recarregar a página (#32).
- Plural de zero em português. A regra CLDR classifica 0 como singular, o que
  produzia "0 resultado encontrado" na tela de busca (#32).
- `sourceTokens.map(t => ...)` sombreava a função de tradução em
  `InboundEventSources`: a aba Entrada quebraria com `t is not a function` ao
  renderizar, mas só quando já existisse um token cadastrado — o build passava
  normalmente (#32).

## [2.3.0] - 2026-08-03

### Segurança

- Bloqueio de conta após 5 tentativas de login malsucedidas, por 15 minutos.
  A resposta é 429, não 401, para a interface não dizer "senha inválida" a
  quem está apenas bloqueado (#23).
- Fluxo de recuperação de senha com token de uso único, guardado como hash
  SHA-256 e expirando em 1 hora. E-mail inexistente e conta inativa recebem a
  mesma resposta, para não permitir enumeração de contas (#25).

### Adicionado

- Página de Perfil com preferências de idioma, tema e troca de senha (#18).
- Foto de perfil com recorte no navegador, salva no Cloudflare R2 (#20).
- Internacionalização (PT/EN) da navegação e das telas do caminho principal
  (#17, #27).
- Testes automatizados das rotas críticas: matriz de permissões RBAC, regras
  de login e recuperação de senha, e varredura de isolamento multi-tenant
  (#28).
- Templates de issue e PR, CODEOWNERS e caminho de entrada para contribuir
  (#22).

### Corrigido

- O índice de texto do MongoDB usava stemming em inglês sobre conteúdo em
  português, o que degradava a busca (#24).
- "Configurações Gerais" tinha um botão Salvar que não persistia nada (#26).
- Cópia local do avatar passou a ser apenas fallback do R2, e o gradiente de
  fundo deixou de vazar por cima da imagem (#21).

## [2.2.0] - 2026-08-03

### Adicionado

- Screenshots reais da aplicação nos READMEs em português e inglês (#16).
- Infraestrutura de internacionalização com detecção de idioma e persistência
  da escolha (#17).

### Corrigido

- CI do frontend estava vermelho desde os merges anteriores: o Node 18 fixado
  no workflow é incompatível com o Vite 8 (#15).

## [2.1.0] - 2026-08-03

### Adicionado

- Captura Rápida multimodal: colar logs, anexar imagens de erro, ditado por
  voz e criação rápida de tags e categorias (#11).
- Abertura automática de incidentes a partir de ferramentas de monitoramento
  (Zabbix, Grafana, Datadog, Sentry, PagerDuty) via endpoint público
  autenticado por token (#11).
- Tag e GitHub Release automáticas a partir da versão em
  `backend/package.json` (#14).

### Corrigido

- O tratador global de erros devolvia `error: true` — um booleano onde 53
  pontos do frontend esperavam texto. Qualquer falha virava
  "Erro desconhecido" na tela (#13).
- `react-router-dom` 6.30.4 → 7.18.2, resolvendo 3 alertas do Dependabot
  (#12).

## [1.0.0] - 2026-07-29

Primeira versão pública.

### Segurança

- Eliminadas as vulnerabilidades críticas do inventário de dependências e
  atualizada a stack (#9).

[2.7.0]: https://github.com/janeiaraujo/knowledgebase/releases/tag/v2.7.0
[2.6.0]: https://github.com/janeiaraujo/knowledgebase/releases/tag/v2.6.0
[2.5.0]: https://github.com/janeiaraujo/knowledgebase/releases/tag/v2.5.0
[2.4.0]: https://github.com/janeiaraujo/knowledgebase/releases/tag/v2.4.0
[2.3.0]: https://github.com/janeiaraujo/knowledgebase/releases/tag/v2.3.0
[2.2.0]: https://github.com/janeiaraujo/knowledgebase/releases/tag/v2.2.0
[2.1.0]: https://github.com/janeiaraujo/knowledgebase/releases/tag/v2.1.0
[1.0.0]: https://github.com/janeiaraujo/knowledgebase/releases/tag/v1.0.0
