# 002 – Mapas e importação (as-built)

**Status:** implementada
**Origem:** descrição do comportamento atual a partir do código em 2026-10-05; não é pedido de mudança.

## Contexto e problema

A imobiliária cadastra loteamentos como mapas (imagem, PDF ou overlay SVG sobre o Google Maps).

## Objetivo

Criar, editar, excluir e configurar mapas, e importar um loteamento completo (mapa, quadras e lotes) de uma vez.

## Fora de escopo

Edição de polígonos de lote (ver spec 003), reservas (spec 004).

## Usuários e permissões

Admin e dev gerenciam (telas `/map-details`, `/import-map`). A restrição é feita apenas na interface.

## Regras de negócio

1. Mapa tem nome, descrição, URL da imagem, largura e altura; o `id` é gerado pela aplicação (`Date.now()`).
2. Imagens e SVG de overlay vão para o Cloudinary (`/api/mapas/upload-svg`, `atualizar-imagem`, `migrar-overlay-cloudinary`).
3. `overlay_config` (JSON) guarda URL, limites (norte, sul, leste, oeste), opacidade e rotação do overlay (`configurar-overlay`).
4. Importação (`POST /api/mapas/importar`) exige `name` e ao menos uma quadra; cada lote tem número, preço, área e, opcionalmente, reserva.
5. Excluir mapa remove em cascata quadras, lotes e reservas ligadas (`DELETE /api/mapas/deletar`).
6. Consultas: lista (`/api/mapas`), completo, estatísticas, visualização pública, imagem.

## Fluxos

- **Criar:** `/map-details` → upload da imagem → `POST /api/mapas/criar`.
- **Importar:** `/import-map` → JSON ou planilha (`xlsx`) convertida para JSON → `POST /api/mapas/importar`.

## Critérios de aceite (comportamento atual)

- [ ] Importação sem nome ou sem quadras retorna 400.
- [ ] Excluir mapa remove seus lotes.

## Impacto no banco

`maps`, `blocks`, `lots`, `purchase_requests`; `maps.overlay_config`, `width`, `height`, `address` e `id BIGINT` criados pela migration 013.

## Impacto em telas e no design system

`MapManagement`, `MapDetails`, `SVGOverlayEditor`, `/import-map`.

## Riscos e dúvidas em aberto

Excluir mapa com lotes reservados ou vendidos não é bloqueado pela rota; confirmar a regra desejada.
