# Política de Segurança

*(English version below)*

## Como reportar uma vulnerabilidade

**Não abra uma issue pública.** Uma issue de segurança fica visível para todos
antes de existir correção, e isso expõe quem já está usando a plataforma.

Use um destes canais, nesta ordem de preferência:

1. **[Security Advisories](https://github.com/janeiaraujo/knowledgebase/security/advisories/new)**
   do próprio GitHub — é o canal preferido: fica privado, permite discutir a
   correção junto e vira o CVE/advisory quando publicado.
2. **jaraujo.php@gmail.com**, com `[SECURITY]` no assunto.

Inclua o que conseguir: passos para reproduzir, versão afetada, e o impacto que
você enxerga. Um proof of concept ajuda, mas relato bem descrito já é suficiente
para começarmos.

## O que esperar

Este é um projeto mantido por uma pessoa, então prometo o que consigo cumprir:

| | |
|---|---|
| Confirmação de que recebi | até **3 dias úteis** |
| Avaliação inicial (é vulnerabilidade? qual severidade?) | até **7 dias** |
| Correção de severidade alta ou crítica | prioridade sobre qualquer outro trabalho |

Se eu não responder no prazo, insista — pode ter caído em spam.

Correções de segurança saem em release própria, marcadas na seção **Segurança**
do [CHANGELOG](CHANGELOG.md), com o identificador do advisory quando houver.

## Versões cobertas

Apenas a **última versão publicada** recebe correção. O projeto ainda não tem
linha de manutenção de versões antigas — se você usa uma versão anterior,
atualize antes de reportar.

## Escopo

**Conta como vulnerabilidade:**

- Vazamento de dados entre organizações (o isolamento multi-tenant é o ponto
  mais sensível do projeto)
- Escalonamento de privilégio — um `viewer` fazendo o que só `admin` deveria
- Autenticação ou autorização contornável
- Injeção (NoSQL, XSS, SSRF), especialmente pela rota pública de ingestão
- Exposição de token, senha ou segredo em log, resposta de API ou repositório

**Não conta:**

- Ausência de rate limit em rota já autenticada, sem impacto demonstrado
- Resultado de scanner sem prova de exploração
- Configuração insegura que o próprio operador escolheu (`.env` com
  `JWT_SECRET` fraco, por exemplo)
- Engenharia social ou ataque físico

## Ao operar esta plataforma

Alguns pontos que dependem de você, não do código:

- **Troque `JWT_SECRET` e `JWT_REFRESH_SECRET`** — os valores de exemplo estão
  no repositório e servem só para desenvolvimento
- **Não exponha o MongoDB** para fora da rede da aplicação
- **Trate os tokens de ingestão como segredo**: eles abrem incidentes sem
  sessão. Revogue pela tela de Integrações assim que um vazar
- **Acompanhe o Dependabot** — ele está ligado neste repositório

---

# Security Policy

## Reporting a vulnerability

**Please do not open a public issue.** A public security issue is visible to
everyone before a fix exists, which puts current users at risk.

Use one of these, in order of preference:

1. **[GitHub Security Advisories](https://github.com/janeiaraujo/knowledgebase/security/advisories/new)**
   — preferred: private, lets us work on the fix together, and becomes the
   published advisory.
2. **jaraujo.php@gmail.com**, with `[SECURITY]` in the subject.

Include whatever you have: reproduction steps, affected version, and the impact
you see. A proof of concept helps, but a clear description is enough to start.

## What to expect

This is a project maintained by one person, so these are commitments I can
actually keep:

| | |
|---|---|
| Acknowledgement of your report | within **3 business days** |
| Initial assessment (is it a vulnerability? how severe?) | within **7 days** |
| Fix for high or critical severity | takes priority over other work |

If you don't hear back in time, please follow up — it may have hit spam.

Security fixes ship in their own release, listed under the **Segurança** section
of the [CHANGELOG](CHANGELOG.md), with the advisory identifier when there is one.

## Supported versions

Only the **latest published release** receives fixes. There is no maintenance
branch for older versions yet — if you run an older one, upgrade before
reporting.

## Scope

**In scope:**

- Data leaking between organizations (multi-tenant isolation is the most
  sensitive part of this project)
- Privilege escalation — a `viewer` doing what only an `admin` should
- Bypassable authentication or authorization
- Injection (NoSQL, XSS, SSRF), especially through the public ingestion route
- Tokens, passwords or secrets exposed in logs, API responses or the repository

**Out of scope:**

- Missing rate limit on an already-authenticated route, with no demonstrated
  impact
- Scanner output without proof of exploitation
- Insecure configuration chosen by the operator (a weak `JWT_SECRET` in `.env`,
  for instance)
- Social engineering or physical attacks

## When you operate this platform

A few things that are on you, not on the code:

- **Change `JWT_SECRET` and `JWT_REFRESH_SECRET`** — the sample values live in
  the repository and are for development only
- **Do not expose MongoDB** outside the application network
- **Treat ingestion tokens as secrets**: they open incidents without a session.
  Revoke them from the Integrations screen as soon as one leaks
- **Watch Dependabot** — it is enabled on this repository
