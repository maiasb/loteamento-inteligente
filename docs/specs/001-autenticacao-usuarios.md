# 001 – Autenticação e usuários (as-built)

**Status:** implementada
**Origem:** descrição do comportamento atual a partir do código em 2026-10-05; não é pedido de mudança.

## Contexto e problema

Acesso restrito à equipe da imobiliária: vendedores se cadastram e precisam de aprovação; admin e dev administram usuários.

## Objetivo

Identificar o usuário por CPF e senha, controlar aprovação, ativação e papel, e guardar preferência de tema.

## Fora de escopo

Autorização no servidor, tokens, recuperação por e-mail (não existem hoje).

## Usuários e permissões

| Papel    | Pode                                                                              |
| -------- | --------------------------------------------------------------------------------- |
| público  | cadastrar-se (`/register`), entrar (`/login`)                                     |
| vendedor | usar mapas, reservas próprias, trocar senha e tema                                |
| admin    | tudo do vendedor + `/users` (aprovar, ativar/desativar, excluir, redefinir senha) |
| dev      | acesso total (`hasRole` sempre verdadeiro)                                        |

## Regras de negócio

1. CPF é normalizado para dígitos; CPF ou e-mail duplicado retorna 409 (`POST /api/usuarios/criar`).
2. Cadastro novo: papel `vendedor`, status `pending`, `first_login = true`.
3. Login (`GET /api/usuarios/login`) compara CPF e hash MD5 da senha. Só entra quem tem `status = approved` e `active` verdadeiro; senão 403.
4. Aprovação (`PUT /api/usuarios/aprovar`) aceita `approved` ou `rejected`.
5. Papéis válidos: `dev`, `admin`, `vendedor` (`PUT /api/usuarios/role`).
6. Ativar/desativar sem excluir (`PUT /api/usuarios/toggle-active`); atualizar dados (`PUT /api/usuarios/atualizar/[id]`); excluir (`DELETE /api/usuarios/excluir`).
7. Troca de senha (`/password`) grava hash e zera `first_login`; redefinição por `/password-reset`, `/api/password/*` e `/api/usuarios/reset-password`.
8. Tema claro/escuro salvo em `theme_preference` (`PUT /api/usuarios/theme`).
9. Sessão: usuário em `localStorage['currentUser']`, revalidado a cada 30 s. `SharedLayout` redireciona para `/login` sem sessão.

## Fluxos

- **Login:** `/login` → `AuthContext.login` → API → grava localStorage → `/dashboard` (ou `/password` se `first_login`).
- **Cadastro:** `/register` → usuário `pending` → admin aprova em `/users` → pode entrar.

## Critérios de aceite (comportamento atual)

- [ ] Usuário `pending`, `rejected` ou inativo não consegue entrar (403).
- [ ] CPF repetido no cadastro retorna 409.
- [ ] Vendedor não vê o menu de usuários; admin e dev veem.

## Impacto no banco

`users`: ver `docs/database.md` (colunas usadas pelo código ausentes das migrations).

## Impacto em telas e no design system

`/login`, `/register`, `/password`, `/password-reset`, `/users`; `AuthContext`, `ThemeContext`.

## Riscos e dúvidas em aberto

- Senha na query string (GET) e MD5; `password/reset` usa SHA-256, então a senha redefinida por essa rota não confere no login (MD5). Confirmar o fluxo realmente em uso.
- Rotas de API sem checagem de papel; `userRole` vem do corpo da requisição.
- Aprovação, papel e exclusão não validam quem chama.
