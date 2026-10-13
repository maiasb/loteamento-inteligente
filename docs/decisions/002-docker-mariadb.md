# 002 – Docker e MariaDB como banco de referência

**Status:** Superado por [001-stack.md](001-stack.md) (2026-10-13)
**Data:** 2026-10-05

> **Nota (2026-10-13):** o banco de referência passou a ser **MySQL 8.4** (imagem `mysql:8.4`). A produção usa MySQL, e a sintaxe exclusiva do MariaDB (`ADD COLUMN IF NOT EXISTS` e similares) foi removida das migrations 001–015. O texto abaixo é o registro histórico da decisão original; vale o [ADR 001](001-stack.md).

## Contexto

O banco foi perdido e o ambiente não era reproduzível. As migrations usam `ADD COLUMN IF NOT EXISTS`, `DROP COLUMN IF EXISTS` e `CREATE INDEX IF NOT EXISTS`, que só o MariaDB aceita.

## Decisão

Usar `mariadb:11` como banco de referência e Docker Compose (`db` + `app`) para ambiente local. As migrations de `migrations/` são executadas pelo MariaDB na primeira subida. O deploy de produção não muda.

## Alternativas consideradas

- MySQL 8: exigiria reescrever as migrations existentes.
- Só `db` em container: mantido como fluxo de desenvolvimento (`docker compose up -d db` + `yarn dev`).
- `output: 'standalone'`: reduziria a imagem, mas altera `next.config.ts`; adiado.

## Consequências

- Ambiente reproduzível com um comando; scripts do código assumem MariaDB.
- Se a produção rodar MySQL, as migrations precisam de revisão antes do deploy.
- Imagem grande (copia `node_modules`).
