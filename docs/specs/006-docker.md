# 006 – Ambiente com Docker

**Status:** implementada
**Autor / data:** Caio Maia / 2026-10-05

## Contexto e problema

O banco original foi perdido e o ambiente depende de um MariaDB instalado na máquina. Não há forma reproduzível de subir app e banco.

## Objetivo

Subir banco e aplicação com um comando, em qualquer máquina, sem alterar o código da aplicação.

## Fora de escopo

Substituir o deploy atual (GitHub Actions + SSH + PM2); `output: 'standalone'`; modo de desenvolvimento com hot reload dentro do container; testes.

## Usuários e permissões

Quem desenvolve ou opera o projeto.

## Regras de negócio

1. O banco é **MariaDB** (as migrations usam `ADD COLUMN IF NOT EXISTS`, sintaxe que o MySQL 8 não aceita).
2. As credenciais vêm de variáveis de ambiente (`.env`, nunca versionado); nenhum valor fica nos arquivos Docker.
3. Na primeira subida (volume vazio), `docker/db-init.sh` executa os `.sql` de `migrations/` em ordem (erro interrompe a subida) e cria o usuário dev a partir de `DEV_CPF`, `DEV_NAME`, `DEV_EMAIL` e `DEV_PASSWORD` (a senha é obrigatória e vem do `.env`; hash MD5, como o login atual).
4. O banco persiste em volume nomeado; `docker compose down -v` apaga os dados.
5. O app só inicia depois do banco ficar saudável.
6. A imagem usa Node 20, a mesma versão do CI, e `yarn install --frozen-lockfile`.

## Fluxos

- **Tudo em container (só Docker):** `cp .env.example .env`, preencher `DB_PASSWORD` e `DEV_PASSWORD`, `docker compose up --build` → app em http://localhost:3000, login com o CPF dev.
- **Dev com hot reload:** `docker compose up -d db` e `yarn dev` na máquina, com `DB_HOST=127.0.0.1` e `DB_PORT` igual a `DB_HOST_PORT`.

## Critérios de aceite

- [x] `docker build .` conclui sem erro.
- [x] `docker compose up --build` sobe `db` saudável e `app` respondendo em `/login/`.
- [x] Banco novo contém as tabelas criadas pelas migrations.
- [x] O usuário dev consegue entrar com o CPF e a senha do `.env`; senha errada é recusada.
- [x] Nenhum segredo em arquivos versionados.

## Impacto no banco

Nenhum. Só executa as migrations existentes num banco novo.

## Impacto em telas e no design system

Nenhum.

## Riscos e dúvidas em aberto

- Variáveis `NEXT_PUBLIC_*` são gravadas no build; mudar o valor exige rebuild (`--build`).
- Os `.sql` rodam fora do runner `lib/migrations.ts`, então a tabela `migrations` não é preenchida.
- A imagem copia `node_modules` completo (sem `standalone`), então fica grande.
