-- Migration: 013_reconcile_schema_with_code
-- Description: Alinha o schema ao que o codigo da aplicacao usa (ver docs/specs/007-reconciliacao-schema.md)
-- Requer MariaDB (usa IF EXISTS / IF NOT EXISTS em ALTER TABLE)

-- ==========================================
-- USERS
-- ==========================================
ALTER TABLE `users`
  MODIFY COLUMN `username` VARCHAR(50) NULL DEFAULT NULL,
  MODIFY COLUMN `role` ENUM('dev', 'admin', 'vendedor', 'user') NOT NULL DEFAULT 'vendedor',
  ADD COLUMN IF NOT EXISTS `cpf` VARCHAR(11) NULL DEFAULT NULL AFTER `email`,
  ADD COLUMN IF NOT EXISTS `name` VARCHAR(255) NULL DEFAULT NULL AFTER `cpf`,
  ADD COLUMN IF NOT EXISTS `phone` VARCHAR(20) NULL DEFAULT NULL AFTER `name`,
  ADD COLUMN IF NOT EXISTS `creci` VARCHAR(50) NULL DEFAULT NULL AFTER `phone`,
  ADD COLUMN IF NOT EXISTS `status` ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'approved' AFTER `role`;

-- Usuarios que ja existiam continuam aprovados; novos cadastros nascem pendentes
ALTER TABLE `users` ALTER COLUMN `status` SET DEFAULT 'pending';

UPDATE `users` SET `role` = 'vendedor' WHERE `role` = 'user';
UPDATE `users` SET `name` = TRIM(CONCAT_WS(' ', `first_name`, `last_name`)) WHERE `name` IS NULL;

ALTER TABLE `users` MODIFY COLUMN `role` ENUM('dev', 'admin', 'vendedor') NOT NULL DEFAULT 'vendedor';

CREATE UNIQUE INDEX IF NOT EXISTS `unique_cpf` ON `users` (`cpf`);
CREATE INDEX IF NOT EXISTS `idx_users_status` ON `users` (`status`);

-- ==========================================
-- MAPS (id passa a BIGINT: a aplicacao grava Date.now())
-- ==========================================
ALTER TABLE `blocks` DROP FOREIGN KEY IF EXISTS `blocks_ibfk_1`;
ALTER TABLE `lots` DROP FOREIGN KEY IF EXISTS `lots_ibfk_1`;
ALTER TABLE `purchase_requests` DROP FOREIGN KEY IF EXISTS `purchase_requests_ibfk_2`;

ALTER TABLE `maps`
  MODIFY COLUMN `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  ADD COLUMN IF NOT EXISTS `address` VARCHAR(255) NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `width` INT NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `height` INT NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `overlay_config` JSON NULL DEFAULT NULL;

-- ==========================================
-- BLOCKS
-- ==========================================
ALTER TABLE `blocks`
  MODIFY COLUMN `mapId` BIGINT UNSIGNED NOT NULL,
  MODIFY COLUMN `identifier` VARCHAR(50) NULL DEFAULT NULL;

-- ==========================================
-- LOTS
-- ==========================================
ALTER TABLE `lots`
  MODIFY COLUMN `map_id` BIGINT UNSIGNED NOT NULL,
  MODIFY COLUMN `block_id` INT NULL DEFAULT NULL,
  MODIFY COLUMN `status` ENUM('available', 'reserved', 'sold', 'unavailable', 'blocked') DEFAULT 'available';

-- ==========================================
-- PURCHASE_REQUESTS
-- ==========================================
ALTER TABLE `purchase_requests`
  MODIFY COLUMN `lot_id` BIGINT UNSIGNED NULL DEFAULT NULL,
  MODIFY COLUMN `map_id` BIGINT UNSIGNED NULL DEFAULT NULL,
  MODIFY COLUMN `customer_email` VARCHAR(255) NULL DEFAULT NULL,
  MODIFY COLUMN `customer_phone` VARCHAR(50) NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `user_id` INT NULL DEFAULT NULL AFTER `map_id`,
  ADD COLUMN IF NOT EXISTS `message` TEXT NULL AFTER `notes`,
  ADD COLUMN IF NOT EXISTS `seller_name` VARCHAR(255) NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `seller_email` VARCHAR(255) NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `seller_phone` VARCHAR(50) NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `seller_cpf` VARCHAR(14) NULL DEFAULT NULL;

CREATE INDEX IF NOT EXISTS `idx_pr_user_id` ON `purchase_requests` (`user_id`);

-- ==========================================
-- PURCHASE_REQUEST_LOTS
-- ==========================================
ALTER TABLE `purchase_request_lots`
  ADD COLUMN IF NOT EXISTS `payment_method` VARCHAR(100) NULL DEFAULT NULL COMMENT 'Formas de pagamento do lote, separadas por virgula';

-- ==========================================
-- FOREIGN KEYS
-- ==========================================
ALTER TABLE `blocks`
  ADD CONSTRAINT `blocks_ibfk_1` FOREIGN KEY (`mapId`) REFERENCES `maps` (`id`) ON DELETE CASCADE;
ALTER TABLE `lots`
  ADD CONSTRAINT `lots_ibfk_1` FOREIGN KEY (`map_id`) REFERENCES `maps` (`id`) ON DELETE CASCADE;
ALTER TABLE `purchase_requests`
  ADD CONSTRAINT `purchase_requests_ibfk_2` FOREIGN KEY (`map_id`) REFERENCES `maps` (`id`) ON DELETE CASCADE;

ALTER TABLE `purchase_requests` DROP FOREIGN KEY IF EXISTS `purchase_requests_user_fk`;
ALTER TABLE `purchase_requests`
  ADD CONSTRAINT `purchase_requests_user_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;
