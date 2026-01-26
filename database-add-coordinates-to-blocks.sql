-- Script para adicionar coluna coordinates na tabela blocks
-- Esta coluna armazena as coordenadas geográficas da área de cada quadra

-- Verificar se a coluna já existe antes de adicionar
SET @dbname = DATABASE();
SET @tablename = 'blocks';
SET @columnname = 'coordinates';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      TABLE_SCHEMA = @dbname
      AND TABLE_NAME = @tablename
      AND COLUMN_NAME = @columnname
  ) > 0,
  'SELECT ''Coluna coordinates já existe na tabela blocks'' AS status;',
  'ALTER TABLE blocks ADD COLUMN coordinates JSON NULL COMMENT ''Coordenadas geográficas da área da quadra (array de {lat, lng})'' AFTER description;'
));

PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Verificar estrutura da tabela blocks após a alteração
DESCRIBE blocks;

-- Informações adicionais
SELECT 
    'A coluna coordinates foi adicionada/verificada com sucesso!' AS Mensagem,
    'Essa coluna armazena um array JSON de coordenadas geográficas' AS Descricao,
    'Formato: [{"lat": -6.064831, "lng": -50.045556}, ...]' AS Formato,
    'A área da quadra deve estar contida dentro da área do loteamento' AS Validacao;
