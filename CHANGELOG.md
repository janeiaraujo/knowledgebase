# Changelog

Todas as mudanças relevantes deste projeto são registradas aqui.

O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/)
e o versionamento segue [SemVer](https://semver.org/lang/pt-BR/).

A seção de cada versão vira o corpo da GitHub Release automaticamente —
veja [Versionamento](README.md#versionamento).

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

[2.4.0]: https://github.com/janeiaraujo/knowledgebase/releases/tag/v2.4.0
[2.3.0]: https://github.com/janeiaraujo/knowledgebase/releases/tag/v2.3.0
[2.2.0]: https://github.com/janeiaraujo/knowledgebase/releases/tag/v2.2.0
[2.1.0]: https://github.com/janeiaraujo/knowledgebase/releases/tag/v2.1.0
[1.0.0]: https://github.com/janeiaraujo/knowledgebase/releases/tag/v1.0.0
