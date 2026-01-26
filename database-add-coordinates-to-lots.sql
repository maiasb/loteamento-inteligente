-- Script para adicionar coluna coordinates na tabela lots
-- Esta coluna armazena as coordenadas geográficas da área de cada lote

-- Verificar se a coluna já existe antes de adicionar
SET @dbname = DATABASE();
SET @tablename = 'lots';
SET @columnname = 'coordinates';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      TABLE_SCHEMA = @dbname
      AND TABLE_NAME = @tablename
      AND COLUMN_NAME = @columnname
  ) > 0,
  'SELECT ''Coluna coordinates já existe na tabela lots'' AS status;',
  'ALTER TABLE lots ADD COLUMN coordinates JSON NULL COMMENT ''Coordenadas geográficas da área do lote (array de {lat, lng})'' AFTER features;'
));

PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Verificar estrutura da tabela lots após a alteração
DESCRIBE lots;

-- Informações adicionais
SELECT 
    'A coluna coordinates foi adicionada/verificada com sucesso!' AS Mensagem,
    'Essa coluna armazena um array JSON de coordenadas geográficas' AS Descricao,
    'Formato: [{"lat": -6.064831, "lng": -50.045556}, ...]' AS Formato,
    'A área do lote deve estar contida dentro da área da quadra ou do loteamento' AS Validacao;

-- Exemplo de query para verificar lotes com coordenadas
SELECT 
    id,
    lot_number,
    block_id,
    CASE 
        WHEN coordinates IS NOT NULL THEN 'Sim'
        ELSE 'Não'
    END AS tem_coordenadas,
    JSON_LENGTH(coordinates) AS quantidade_pontos
FROM lots
LIMIT 10;
