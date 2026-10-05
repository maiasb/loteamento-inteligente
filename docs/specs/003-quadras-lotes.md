# 003 – Quadras e lotes (as-built)

**Status:** implementada
**Origem:** descrição do comportamento atual a partir do código em 2026-10-05; não é pedido de mudança.

## Contexto e problema

Cada mapa tem quadras e lotes com status, preço, área e polígono.

## Objetivo

Cadastrar e manter quadras e lotes, inclusive operações em lote (bloqueio e exclusão de várias quadras).

## Fora de escopo

Reservar lotes (spec 004).

## Usuários e permissões

Admin e dev (telas `/map-details`, `/lot-management`); vendedor só consulta.

## Regras de negócio

1. Quadra pertence a um mapa e tem nome único por mapa (`unique_block_per_map`).
2. Lote tem número, área, preço, descrição, características (JSON) e `coordinates` (JSON); número único por mapa e quadra.
3. Status do lote: `available`, `reserved`, `sold` e `blocked` (o ENUM aceita `blocked` desde a migration 013, mantendo `unavailable`).
4. Excluir quadra é recusado se houver lote `reserved` ou `sold` (`DELETE /api/mapas/quadras/deletar`).
5. Excluir lote é recusado se estiver `reserved` ou `sold`; a mensagem orienta cancelar na página de Reservas.
6. Criar, atualizar e listar: `/api/mapas/lotes/*` e `/api/mapas/quadras/*`; `lotes/valido` e `verificar-lotes-reservados` auxiliam validações.
7. Operações em lote de quadras (bloquear, desbloquear, excluir) usam `useBlockOperations`.

## Fluxos

Edição em `MapDetails`/`LotManagement`; seleção múltipla com barra flutuante (`animate-slide-up`).

## Critérios de aceite (comportamento atual)

- [ ] Quadra com lote reservado ou vendido não é excluída.
- [ ] Lote reservado ou vendido não é excluído.

## Impacto no banco

`blocks`, `lots` (`coordinates` na migration 012).

## Impacto em telas e no design system

`MapDetails` (3300+ linhas), `LotManagement`, `LotSelector`, `InteractiveMap`; cores de status definidas por componente.

## Riscos e dúvidas em aberto

- `unavailable` e `blocked` coexistem no ENUM; unificar exige spec.
- Regra recente de bloqueio e desbloqueio (último commit) sem spec; registrar os detalhes ao revisar esta spec.
