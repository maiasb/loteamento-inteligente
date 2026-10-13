-- Migration: 012_add_coordinates_to_lots
-- Description: Posicao de cada lote no Google Maps. A coluna guarda um ponto, nao um poligono:
--   {"lat": -6.064831, "lng": -50.045556}
-- Rollback: ALTER TABLE `lots` DROP COLUMN `coordinates`;

ALTER TABLE `lots`
  ADD COLUMN `coordinates` JSON NULL COMMENT 'Ponto do lote no mapa: {"lat": number, "lng": number}' AFTER `status`;
