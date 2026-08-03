<!--
Obrigado por contribuir! Descreva o QUE mudou e, principalmente, POR QUÊ.
Se o PR fecha uma issue, escreva "Closes #123" em algum lugar da descrição.
-->

## O que muda

<!-- Uma ou duas frases. Se corrige um bug, diga qual era o comportamento errado. -->

## Por quê

<!-- O problema que motivou a mudança. Ajuda quem revisa a julgar a abordagem, não só o código. -->

## Como testar

<!-- Passos para verificar na prática. -->

- [ ] `cd backend && npm test` (smoke test)
- [ ] `cd frontend && npm run build`
- [ ]

## Checklist

- [ ] Se mudou funcionalidade, atualizei o README/CONTRIBUTING quando fazia sentido
- [ ] Se merece uma nova versão, bumpei `backend/package.json` **e** `frontend/package.json` juntos ([Versionamento](../README.md#versionamento))
- [ ] Não incluí segredos, `.env` ou dados reais
- [ ] Consultas novas ao MongoDB filtram por `tenant_id` ([Multi-tenant](../CONTRIBUTING.md#multi-tenant))
