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

> **Nota de atualização (2026-10-13, decisões do dono; código ainda não alterado):**
>
> 1. **Edição, confirmação e cancelamento de reservas passam a ser só de admin e dev.** O vendedor continua criando reservas e vendo as suas, mas **deixa de editar** a reserva `pending`. Isso **contradiz a RN5** abaixo (no código atual o vendedor edita `pending`) e a tabela de permissões acima (linha do vendedor); ambas ficam **substituídas, quando implementadas**, pela RN9 e pela RN10 abaixo. Origem: [010](010-autenticacao-autorizacao-servidor.md) (Q6 resolvida, depende da premissa P-A confirmar o alcance da decisão). Aplicada no servidor pela spec 010 (RN-22, CA-32, CA-35).
> 2. **Exclusão de lote/quadra/mapa** passa a depender do estado das reservas (RN8 abaixo), conforme [003](003-quadras-lotes.md) RN-N1..N6.

Regras novas (RN8, RN9 e RN10 continuam a numeração da lista de regras acima; a RN7 é a última original):

9. **RN9 (nova, 2026-10-13) – Quem altera reservas.** `PUT /api/reservas/atualizar` e `PUT /api/reserva/confirmacao` aceitam somente admin e dev. Vendedor recebe 403 em ambas. Vendedor continua criando reserva (RN1..3) e listando só as próprias (RN6). O estado atual da reserva usado nas regras vem do banco, não do corpo.
10. **RN10 (nova, 2026-10-13) – Edição pelo admin/dev.** Admin/dev editam qualquer reserva; o que cada status permite editar (ex.: reserva `completed`) segue o comportamento atual até nova spec. [PENDENTE: confirmar com o dono se admin/dev podem editar reserva já `completed`/`cancelled`; hoje podem.]
11. **RN8 (nova, 2026-10-13) – Reserva como histórico.** Reservas `cancelled` e `rejected` são "encerradas"; `pending`, `approved` e `completed` são "ativas". Lote com qualquer reserva ativa não pode ser excluído; quando todas estão encerradas, o lote pode ser excluído, o vínculo com a reserva é removido e a reserva permanece como histórico sem o lote (detalhes: [003](003-quadras-lotes.md) RN-N1..N6). Quem abrir o lote por uma reserva cancelada vê "Este lote não existe mais."

**Critérios de aceite novos (2026-10-13):**

- [ ] CA-R1 – Vendedor chamando `reservas/atualizar` (inclusive em reserva própria `pending`) → 403 e nada muda; admin/dev → comportamento atual.
- [ ] CA-R2 – Vendedor chamando `reserva/confirmacao` → 403 (já é o comportamento atual; passa a vir da sessão, não do corpo).
- [ ] CA-R3 – Reserva cuja totalidade de lotes foi excluída (RN8) aparece na listagem e nos detalhes com a lista de lotes vazia ou com o aviso "Este lote não existe mais.", sem erro 500.
- [ ] CA-R4 – `reservas/atualizar` e `reserva/confirmacao` sobre reserva cujo lote foi excluído: não falham com 500; o comportamento esperado (recusar mudança de status que dependa do lote, ou aplicar só ao que existe) está em [PENDENTE: dono; padrão proposto: recusar com 409 e mensagem clara, pois reserva encerrada não deve ser reaberta].

## Fluxos

`/maps` → seleciona lotes → `PurchaseModal` → reserva. `/reservations` → listar, editar, confirmar ou cancelar.

## Critérios de aceite (comportamento atual)

- [ ] Reservar lote que não está `available` retorna 409 e não altera nada.
- [ ] Confirmar marca os lotes como `sold`; cancelar volta para `available`.
- [ ] Vendedor não confirma nem cancela.

## Impacto no banco

`purchase_requests`, `purchase_request_lots`, `lots.status`; colunas `user_id`, `message` e `seller_*` criadas pela migration 013.

## Impacto em telas e no design system

`PurchaseModal`, `usePurchaseForm`, `LotSelector`, `/reservations`.

## Riscos e dúvidas em aberto

- O papel (`userRole`) vem do corpo da requisição, sem verificação no servidor.
- Enum de status da reserva diverge entre banco (`approved`, `rejected`), tipo TS (`contacted`) e código (`pending`, `completed`, `cancelled`).
