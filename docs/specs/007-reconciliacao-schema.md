# 007 – Reconciliação do schema com o código

**Status:** implementada
**Autor / data:** Caio Maia / 2026-10-05

> **Nota (2026-10-13):** o banco passou a ser MySQL 8.4 (`mysql:8.4`), conforme [ADR 001](../decisions/001-stack.md); o ADR 002 está superado. As migrations 001–015 foram reescritas para MySQL 8 e há o runner `yarn migrate` / `yarn migrate status`. O texto abaixo é o registro da época.

## Contexto e problema

O banco original foi perdido e não há dump. As migrations 001–012 não criam várias colunas que o código usa (ver `docs/database.md`), e a 007 falha em banco novo (`Unknown column 'pr.first_payment'`), o que impediria o runner de chegar a qualquer migration seguinte.

## Objetivo

Um banco criado só com as migrations deve funcionar com o código atual, sem alterar o código.

## Fora de escopo

Mudar a lógica da aplicação, trocar MD5, criar usuário inicial no SQL, scripts `migrate`.

## Usuários e permissões

Quem opera o banco.

## Regras de negócio

1. A migration 007 deixa de referenciar `purchase_requests.first_payment` (nunca existiu); o comportamento de copiar `installments` para os lotes é mantido. É a única alteração em migration existente, justificada porque ela nunca concluiu num banco novo.
2. A migration 013 só adiciona ou relaxa; nenhum dado é apagado. Usa sintaxe MySQL 8 (originalmente MariaDB).
3. `users`: adiciona `cpf` (único), `name`, `phone`, `creci`, `status`; `role` passa a `dev|admin|vendedor` (`user` vira `vendedor`); `username` fica opcional. Usuários já existentes ficam `approved`; novos nascem `pending`.
4. `maps.id` passa a `BIGINT UNSIGNED` (o código grava `Date.now()`); `blocks.mapId`, `lots.map_id` e `purchase_requests.map_id` acompanham, e as FKs são recriadas. Adiciona `address`, `width`, `height`, `overlay_config`.
5. `blocks.identifier` e `lots.block_id` ficam opcionais; `lots.status` aceita também `blocked`.
6. `purchase_requests`: `lot_id`, `map_id`, `customer_email`, `customer_phone` ficam opcionais; adiciona `user_id` (FK com `ON DELETE SET NULL`), `message` e `seller_*`.
7. `purchase_request_lots` ganha `payment_method`.
8. Migration 014: `purchase_requests.payment_method` vira `VARCHAR(255)`. O formulário envia várias formas separadas por vírgula e o ENUM da 001 as recusava (erro 500 ao reservar). Descoberto ao testar o fluxo real contra o banco do Docker.

## Fluxos

`docker compose up --build` (spec 006) num volume vazio executa 001 → 014.

## Critérios de aceite

- [x] Todas as migrations rodam em ordem num MySQL 8 vazio sem erro.
- [x] Cadastro, login, criar mapa, quadra e lote, e reservar lote (inclusive com `paymentMethod` de várias formas) funcionam contra esse banco.
- [x] Re-executar a 013 não falha (idempotente).

## Impacto no banco

Ver regras 3 a 7.

## Impacto em telas e no design system

Nenhum.

## Riscos e dúvidas em aberto

- O schema real do banco perdido pode ter sido diferente; a 013 segue o que o código consulta.
- Num banco que já tenha dados, `maps.id` e as FKs são recriados: fazer backup antes.
- `lots.status`: `unavailable` e `blocked` coexistem; unificar exige spec.
- Não existe usuário inicial: ver `docs/database.md` para o procedimento manual.
