-- Migration: 015_integrity_and_indexes
-- Description: Integridade e indices (MySQL 8.0.16+, que aplica CHECK).
--   * purchase_request_lots.lot_id passa a ON DELETE RESTRICT: lote com historico de reserva nao
--     e apagado (nem em cascata, ao excluir quadra ou mapa) enquanto existir a linha da reserva.
--     As rotas de exclusao removem essas linhas (so quando todas as reservas do lote estao
--     encerradas: cancelled ou rejected) na mesma transacao; a reserva em purchase_requests fica.
--   * purchase_requests.lot_id e map_id (legados, nunca preenchidos, FK CASCADE) sao removidos:
--     com CASCADE, excluir lote ou mapa apagaria a reserva inteira.
--   * lots.block_key (coluna gerada VIRTUAL, 0 quando o lote nao tem quadra) + UNIQUE
--     (map_id, block_key, lot_number): o UNIQUE antigo nao barrava duplicatas de lote sem quadra,
--     porque NULL nunca e igual a NULL. A coluna e VIRTUAL porque block_id tem FK com CASCADE e o
--     MySQL nao aceita isso na base de coluna STORED.
--   * lots.price e purchase_request_lots.first_payment em DECIMAL(15,2); CHECKs de valores.
--   * Indices de paginacao de purchase_requests e remocao de indices redundantes.
-- Rollback (executar na ordem inversa; os CHECKs e a FK nova saem junto):
--   ALTER TABLE `purchase_requests` ADD KEY `idx_status` (`status`), ADD KEY `idx_pr_user_id` (`user_id`),
--     DROP KEY `idx_pr_status_created`, DROP KEY `idx_pr_user_created`;
--   ALTER TABLE `purchase_requests` ADD COLUMN `lot_id` BIGINT UNSIGNED NULL DEFAULT NULL AFTER `id`,
--     ADD COLUMN `map_id` BIGINT UNSIGNED NULL DEFAULT NULL AFTER `lot_id`, ADD KEY `idx_lot_id` (`lot_id`),
--     ADD KEY `idx_map_id` (`map_id`),
--     ADD CONSTRAINT `purchase_requests_ibfk_1` FOREIGN KEY (`lot_id`) REFERENCES `lots` (`id`) ON DELETE CASCADE,
--     ADD CONSTRAINT `purchase_requests_ibfk_2` FOREIGN KEY (`map_id`) REFERENCES `maps` (`id`) ON DELETE CASCADE;
--   ALTER TABLE `purchase_request_lots` DROP CHECK `prl_chk_agreed_price`, DROP CHECK `prl_chk_first_payment`,
--     DROP CHECK `prl_chk_installments`, MODIFY COLUMN `first_payment` DECIMAL(10,2) DEFAULT NULL,
--     DROP FOREIGN KEY `purchase_request_lots_lot_fk`,
--     ADD CONSTRAINT `purchase_request_lots_ibfk_2` FOREIGN KEY (`lot_id`) REFERENCES `lots` (`id`) ON DELETE CASCADE;
--   ALTER TABLE `lots` DROP CHECK `lots_chk_price`, MODIFY COLUMN `price` DECIMAL(10,2) NOT NULL,
--     DROP KEY `unique_lot_per_block`, DROP COLUMN `block_key`,
--     ADD UNIQUE KEY `unique_lot_per_block` (`map_id`, `block_id`, `lot_number`);
--   Recriar os indices removidos (secao INDICES REDUNDANTES) se necessario.
--   As views vw_map_statistics e vw_lot_details nao existem mais (removidas na 001).
-- Antes de aplicar em banco com dados, procurar violacoes:
--   SELECT map_id, IFNULL(block_id, 0), lot_number, COUNT(*) FROM lots GROUP BY 1, 2, 3 HAVING COUNT(*) > 1;
--   SELECT COUNT(*) FROM lots WHERE price < 0;
--   SELECT COUNT(*) FROM purchase_request_lots WHERE agreed_price < 0 OR first_payment < 0 OR installments <= 0;

-- ==========================================
-- FK de purchase_request_lots.lot_id
-- ==========================================
ALTER TABLE `purchase_request_lots`
  DROP FOREIGN KEY `purchase_request_lots_ibfk_2`,
  ADD CONSTRAINT `purchase_request_lots_lot_fk` FOREIGN KEY (`lot_id`) REFERENCES `lots` (`id`) ON DELETE RESTRICT;

-- ==========================================
-- Colunas legadas purchase_requests.lot_id / map_id (FK CASCADE): nenhum codigo as le ou grava.
-- Os indices idx_lot_id e idx_map_id (so dessas colunas) saem junto com elas.
-- ==========================================
ALTER TABLE `purchase_requests`
  DROP FOREIGN KEY `purchase_requests_ibfk_1`,
  DROP FOREIGN KEY `purchase_requests_ibfk_2`,
  DROP COLUMN `lot_id`,
  DROP COLUMN `map_id`;

-- ==========================================
-- Unicidade de lote com ou sem quadra, precos e CHECKs
-- ==========================================
ALTER TABLE `lots`
  ADD COLUMN `block_key` INT GENERATED ALWAYS AS (IFNULL(`block_id`, 0)) VIRTUAL NOT NULL AFTER `block_id`,
  DROP KEY `unique_lot_per_block`,
  ADD UNIQUE KEY `unique_lot_per_block` (`map_id`, `block_key`, `lot_number`),
  MODIFY COLUMN `price` DECIMAL(15,2) NOT NULL,
  ADD CONSTRAINT `lots_chk_price` CHECK (`price` >= 0);

ALTER TABLE `purchase_request_lots`
  MODIFY COLUMN `first_payment` DECIMAL(15,2) NULL DEFAULT NULL COMMENT 'Valor de entrada especifico para este lote',
  ADD CONSTRAINT `prl_chk_agreed_price` CHECK (`agreed_price` IS NULL OR `agreed_price` >= 0),
  ADD CONSTRAINT `prl_chk_first_payment` CHECK (`first_payment` IS NULL OR `first_payment` >= 0),
  ADD CONSTRAINT `prl_chk_installments` CHECK (`installments` IS NULL OR `installments` > 0);

-- ==========================================
-- Indices de paginacao de purchase_requests: (filtro, created_at, id) atende
-- WHERE status/user_id = ? ORDER BY created_at DESC, id DESC
-- ==========================================
ALTER TABLE `purchase_requests`
  ADD KEY `idx_pr_status_created` (`status`, `created_at`, `id`),
  ADD KEY `idx_pr_user_created` (`user_id`, `created_at`, `id`);

-- ==========================================
-- INDICES REDUNDANTES (cada um e prefixo de outro indice ou nunca e usado em WHERE/ORDER BY)
-- purchase_request_lots.idx_purchase_request_id : prefixo de unique_request_lot
-- users.idx_role : coluna nunca filtrada (idx_theme_preference, idx_first_payment e idx_installments
--   deixaram de ser criados nas migrations 006 e 007)
-- lots.idx_map_id : prefixo de idx_map_status e do UNIQUE; lots.idx_lot_number : lot_number so e filtrado com map_id
-- blocks.idx_mapId : prefixo de unique_block_per_map; blocks.idx_name : ordenacao usa unique_block_per_map
-- purchase_requests.idx_status : prefixo de idx_pr_status_created; idx_pr_user_id : prefixo de idx_pr_user_created
-- ==========================================
ALTER TABLE `purchase_request_lots`
  DROP KEY `idx_purchase_request_id`;

ALTER TABLE `users`
  DROP KEY `idx_role`;

ALTER TABLE `lots`
  DROP KEY `idx_map_id`,
  DROP KEY `idx_lot_number`;

ALTER TABLE `blocks`
  DROP KEY `idx_mapId`,
  DROP KEY `idx_name`;

ALTER TABLE `purchase_requests`
  DROP KEY `idx_status`,
  DROP KEY `idx_pr_user_id`;
