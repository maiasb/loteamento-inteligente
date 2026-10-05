# 004 – Reservas (as-built)

**Status:** implementada
**Origem:** descrição do comportamento atual a partir do código em 2026-10-05; não é pedido de mudança.

## Contexto e problema

Vendedores reservam lotes para clientes; admin e dev confirmam a venda ou cancelam.

## Objetivo

Registrar a reserva de um ou mais lotes com valores por lote e acompanhar o ciclo até venda ou cancelamento.

## Fora de escopo

Pagamento e emissão de contrato (só há texto de contrato).

## Usuários e permissões

| Papel       | Pode                                                            |
| ----------- | --------------------------------------------------------------- |
| vendedor    | criar reservas; vê as próprias; edita apenas reservas `pending` |
| admin / dev | vê todas; edita qualquer reserva; confirma venda ou cancela     |

## Regras de negócio

1. Reserva exige `lotIds` (array não vazio), nome do cliente e nome do vendedor (`POST /api/mapas/lotes/reservar`).
2. Todos os lotes precisam estar `available`; senão 409 com a lista de indisponíveis.
3. Operação em transação: cria `purchase_requests` (status `pending`), liga cada lote em `purchase_request_lots` com preço acordado, entrada e parcelas, e marca os lotes como `reserved`.
4. Confirmar (`PUT /api/reserva/confirmacao`) aceita status `completed` (lote `sold`) ou `cancelled` (lote `available`); restrito a admin e dev.
5. Editar (`PUT /api/reservas/atualizar`): vendedor não edita reservas já confirmadas ou canceladas (403).
6. Listagem com filtro de status e paginação, filtrada por `user_id` para vendedor (`GET /api/reservas`), mais estatísticas e `find-page`.
7. CPF e telefone do cliente são gravados só com dígitos.

## Fluxos

`/maps` → seleciona lotes → `PurchaseModal` → reserva. `/reservations` → listar, editar, confirmar ou cancelar.

## Critérios de aceite (comportamento atual)

- [ ] Reservar lote que não está `available` retorna 409 e não altera nada.
- [ ] Confirmar marca os lotes como `sold`; cancelar volta para `available`.
- [ ] Vendedor não confirma nem cancela.

## Impacto no banco

`purchase_requests`, `purchase_request_lots`, `lots.status`; colunas `user_id`, `message` e `seller_*` só no código.

## Impacto em telas e no design system

`PurchaseModal`, `usePurchaseForm`, `LotSelector`, `/reservations`.

## Riscos e dúvidas em aberto

- O papel (`userRole`) vem do corpo da requisição, sem verificação no servidor.
- `INSERT` não preenche `lot_id` e `map_id`, que são NOT NULL na migration 001.
- Enum de status da reserva diverge entre banco (`approved`, `rejected`), tipo TS (`contacted`) e código (`pending`, `completed`, `cancelled`).
