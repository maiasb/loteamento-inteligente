# 005 – Dashboard e visualização pública (as-built)

**Status:** implementada
**Origem:** descrição do comportamento atual a partir do código em 2026-10-05; não é pedido de mudança.

## Contexto e problema

A equipe precisa de uma visão geral das vendas; clientes veem o mapa sem login.

## Objetivo

Mostrar totais agregados e oferecer mapa somente leitura por link.

## Fora de escopo

Relatórios exportáveis.

## Usuários e permissões

`/dashboard`: usuários autenticados. `/view/[mapId]`: público, sem login.

## Regras de negócio

1. `GET /api/dashboard/stats` devolve contagem de mapas, estatísticas de lotes, de reservas e por mapa, calculadas em paralelo.
2. `/view/[mapId]` usa `ViewOnlyLotMap` e `GET /api/mapas/visualizacao`, sem ações de edição ou reserva.
3. `/maps/[id]` e `PublicMapViewer` exibem mapa e lotes; a atualização é por polling (`useRealtimeUpdates`).

## Fluxos

Login → `/dashboard`. Link público `/view/<id>` abre o mapa direto.

## Critérios de aceite (comportamento atual)

- [ ] `/view/[mapId]` abre sem sessão e não permite editar.
- [ ] O dashboard carrega os totais em uma chamada.

## Impacto no banco

Leitura de `maps`, `lots`, `purchase_requests`.

## Impacto em telas e no design system

`/dashboard`, `ViewOnlyLotMap`, `PublicMapViewer`, `InteractiveMap`.

## Riscos e dúvidas em aberto

A API de visualização pública é acessível sem autenticação, assim como todas as outras rotas `/api`.
