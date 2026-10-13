-- Migration: 013_reconcile_schema_with_code
-- Description: Alinha o schema ao que o codigo da aplicacao usa (ver docs/specs/007-reconciliacao-schema.md).
--   Escrita para um banco recriado do zero (001 a 012 sem dados): nao converte linhas existentes.
-- Rollback: irreversivel de forma segura (tipos de chave e colunas mudam). Em desenvolvimento,
--   recriar o banco (docker compose down -v). Em producao, restaurar o backup anterior a esta migration.

-- ==========================================
-- USERS
-- ==========================================
ALTER TABLE `users`
  MODIFY COLUMN `username` VARCHAR(50) NULL DEFAULT NULL,
  MODIFY COLUMN `role` ENUM('dev', 'admin', 'vendedor') NOT NULL DEFAULT 'vendedor',
  ADD COLUMN `cpf` VARCHAR(11) NULL DEFAULT NULL AFTER `email`,
  ADD COLUMN `name` VARCHAR(255) NULL DEFAULT NULL AFTER `cpf`,
  ADD COLUMN `phone` VARCHAR(20) NULL DEFAULT NULL AFTER `name`,
  ADD COLUMN `creci` VARCHAR(50) NULL DEFAULT NULL AFTER `phone`,
  ADD COLUMN `status` ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending' AFTER `role`,
  ADD UNIQUE KEY `unique_cpf` (`cpf`),
  ADD KEY `idx_users_status` (`status`);

-- ==========================================
-- MAPS (id passa a BIGINT: a aplicacao grava Date.now())
-- As FKs que apontam para maps.id saem e voltam no fim, porque o MySQL nao altera o tipo
-- de uma coluna referenciada enquanto a FK existe.
-- ==========================================
ALTER TABLE `blocks` DROP FOREIGN KEY `blocks_ibfk_1`;
ALTER TABLE `lots` DROP FOREIGN KEY `lots_ibfk_1`;
ALTER TABLE `purchase_requests` DROP FOREIGN KEY `purchase_requests_ibfk_2`;

ALTER TABLE `maps`
  MODIFY COLUMN `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  ADD COLUMN `address` VARCHAR(255) NULL DEFAULT NULL,
  ADD COLUMN `width` INT NULL DEFAULT NULL,
  ADD COLUMN `height` INT NULL DEFAULT NULL,
  ADD COLUMN `overlay_config` JSON NULL DEFAULT NULL;

-- ==========================================
-- BLOCKS
-- ==========================================
ALTER TABLE `blocks`
  MODIFY COLUMN `mapId` BIGINT UNSIGNED NOT NULL,
  MODIFY COLUMN `identifier` VARCHAR(50) NULL DEFAULT NULL,
  ADD COLUMN `coordinates` JSON NULL DEFAULT NULL AFTER `description`;

-- ==========================================
-- LOTS
-- ==========================================
ALTER TABLE `lots`
  MODIFY COLUMN `map_id` BIGINT UNSIGNED NOT NULL,
  MODIFY COLUMN `block_id` INT NULL DEFAULT NULL,
  MODIFY COLUMN `status` ENUM('available', 'reserved', 'sold', 'unavailable', 'blocked') NOT NULL DEFAULT 'available';

-- ==========================================
-- PURCHASE_REQUESTS
-- ==========================================
ALTER TABLE `purchase_requests`
  MODIFY COLUMN `lot_id` BIGINT UNSIGNED NULL DEFAULT NULL,
  MODIFY COLUMN `map_id` BIGINT UNSIGNED NULL DEFAULT NULL,
  MODIFY COLUMN `customer_email` VARCHAR(255) NULL DEFAULT NULL,
  MODIFY COLUMN `customer_phone` VARCHAR(50) NULL DEFAULT NULL,
  ADD COLUMN `user_id` INT NULL DEFAULT NULL AFTER `map_id`,
  ADD COLUMN `message` TEXT NULL AFTER `notes`,
  ADD COLUMN `seller_name` VARCHAR(255) NULL DEFAULT NULL,
  ADD COLUMN `seller_email` VARCHAR(255) NULL DEFAULT NULL,
  ADD COLUMN `seller_phone` VARCHAR(50) NULL DEFAULT NULL,
  ADD COLUMN `seller_cpf` VARCHAR(14) NULL DEFAULT NULL,
  ADD KEY `idx_pr_user_id` (`user_id`);

-- ==========================================
-- PURCHASE_REQUEST_LOTS
-- ==========================================
ALTER TABLE `purchase_request_lots`
  ADD COLUMN `payment_method` VARCHAR(100) NULL DEFAULT NULL COMMENT 'Formas de pagamento do lote, separadas por virgula';

-- ==========================================
-- FOREIGN KEYS
-- ==========================================
ALTER TABLE `blocks`
  ADD CONSTRAINT `blocks_ibfk_1` FOREIGN KEY (`mapId`) REFERENCES `maps` (`id`) ON DELETE CASCADE;
ALTER TABLE `lots`
  ADD CONSTRAINT `lots_ibfk_1` FOREIGN KEY (`map_id`) REFERENCES `maps` (`id`) ON DELETE CASCADE;
ALTER TABLE `purchase_requests`
  ADD CONSTRAINT `purchase_requests_ibfk_2` FOREIGN KEY (`map_id`) REFERENCES `maps` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `purchase_requests_user_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;
