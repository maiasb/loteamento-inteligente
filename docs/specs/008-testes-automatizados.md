# 008 – Testes automatizados

**Status:** implementada
**Autor / data:** Caio Maia / 2026-10-05

> **Nota (2026-10-13):** o banco passou a ser MySQL 8.4 (`mysql:8.4`), conforme [ADR 001](../decisions/001-stack.md); o ADR 002 está superado. As migrations 001–015 foram reescritas para MySQL 8 e há o runner `yarn migrate` / `yarn migrate status`. O texto abaixo é o registro da época.

## Contexto e problema

O projeto não tinha testes. Qualquer refatoração (inclusive a limpeza do ESLint, spec 009) corria sem rede de segurança.

## Objetivo

Ter testes rápidos que protejam as regras de negócio descritas nas specs 001 a 004, rodando localmente e no pre-push.

## Fora de escopo

Testes de componentes React e de ponta a ponta; testes contra banco real; cobertura mínima obrigatória; CI.

## Usuários e permissões

Quem desenvolve.

## Regras de negócio

1. Framework: **Vitest 3** (a v5 exige Node ≥ 22; o CI e a imagem Docker usam Node 20). Nenhuma outra dependência.
2. Testes em `tests/`, espelhando o que testam: `tests/api/*.test.ts` (rotas), `tests/utils/*.test.ts`. Helpers em `tests/helpers/`.
3. Rotas de API são testadas chamando o handler (`GET`, `POST`…) com `NextRequest` e `mysql2/promise` mockado (`useFakeConnection`). Não dependem de banco.
4. Cada teste de rota verifica status HTTP, o que foi (ou não) gravado e commit/rollback.
5. Todo bug corrigido e toda regra nova ganha teste.
6. `yarn test` roda tudo; `yarn test:watch` para desenvolvimento. O `pre-push` roda `yarn typecheck` e `yarn test`.

## Fluxos

Escrever o teste → ver falhar → implementar → ver passar.

## Critérios de aceite

- [x] `yarn test` passa (40 testes em 8 arquivos).
- [x] Alterar de propósito uma regra coberta (reservar lote indisponível, excluir lote vendido, permissão de confirmação) faz teste falhar.
- [x] `yarn typecheck` e `yarn lint` cobrem os arquivos de teste.

## Impacto no banco

Nenhum.

## Impacto em telas e no design system

Nenhum.

## Riscos e dúvidas em aberto

- Com `mysql2` mockado, os testes não validam o SQL em si; uma consulta com coluna errada passa. Testes de integração contra o MySQL 8 do Docker são o próximo passo, em spec própria.
- Hooks e componentes (`useInteractiveMap`, `MapDetails`…) continuam sem testes.
- Cobertura atual: login, cadastro, reserva, confirmação/cancelamento, edição de reserva, exclusão de quadra e lote, validações de importação, aprovação e papel, formatadores.
