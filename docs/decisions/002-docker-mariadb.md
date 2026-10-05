# 002 – Docker e MariaDB como banco de referência

**Status:** aceita
**Data:** 2026-10-05

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
