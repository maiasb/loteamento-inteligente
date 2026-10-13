-- Migration: Add active column to users
-- Description: Ativa/desativa usuarios sem exclui-los
-- Rollback: ALTER TABLE `users` DROP COLUMN `active`;

ALTER TABLE `users`
  ADD COLUMN `active` TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'Usuario ativo (1) ou inativo (0)';
