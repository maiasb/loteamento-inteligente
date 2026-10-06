# 001 – Stack da aplicação

**Status:** aceita (decisão já tomada, registrada retroativamente)
**Data:** 2026-10-05

## Contexto

Plataforma para uma imobiliária gerenciar loteamentos, mapas e reservas, hospedada numa VPS própria
com recursos limitados (na época: PM2, uma instância, limite de memória de 1 GB).

## Decisão

- Next.js 16 com App Router e React 19, em TypeScript estrito; front e API no mesmo projeto
  (`app/api`).
- MariaDB (compatível com MySQL) acessado por `mysql2` com SQL cru e migrations `.sql` próprias.
  A escolha do MariaDB como referência está no [ADR 002](002-docker-mariadb.md).
- Tailwind v4 com tokens em variáveis CSS e tema claro/escuro.
- Estado por Context API e hooks; chamadas à API com axios.
- Cloudinary para imagens, Google Maps para overlay de lotes, `xlsx` para importação.
- Autenticação própria por CPF e senha, com sessão em `localStorage`.
- yarn como gerenciador de pacotes.
- Ambiente local com Docker Compose (ADR 002). O deploy anterior (GitHub Actions + SSH + PM2) foi
  removido em 2026-10-06 e não há deploy configurado.

## Alternativas consideradas

Não registradas na época. Por ora não há ORM, biblioteca de validação, de componentes ou de dados
no cliente.

## Consequências

- Simples de operar numa VPS, mas validação, regras e SQL ficam misturados nas rotas.
- Sem ORM, o schema depende de migrations manuais; hoje elas divergem do que o código usa
  (ver `docs/database.md`).
- A autenticação atual é fraca (MD5, sessão no cliente, rotas sem checagem de papel) e deve ser
  reavaliada em spec própria.
- Mudanças de stack (por exemplo introduzir ORM, validação ou testes) exigem novo ADR.
