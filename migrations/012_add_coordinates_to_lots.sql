-- Migration: 012_add_coordinates_to_lots
-- Adiciona campo para armazenar as coordenadas do polígono de cada lote no Google Maps

ALTER TABLE lots 
ADD COLUMN coordinates JSON COMMENT 'Coordenadas do polígono que delimita o lote no mapa' AFTER status;

-- Exemplo de estrutura:
-- coordinates: [{"lat": -6.064831, "lng": -50.045556}, {"lat": -6.064931, "lng": -50.045656}, ...]
