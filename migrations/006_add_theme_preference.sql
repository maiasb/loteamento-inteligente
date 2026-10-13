-- Migration: Add theme preference to users
-- Description: Preferencia de tema (light/dark) do usuario. Sem indice: a coluna nunca e filtrada.
-- Rollback: ALTER TABLE `users` DROP COLUMN `theme_preference`;

ALTER TABLE `users`
  ADD COLUMN `theme_preference` ENUM('light', 'dark') NOT NULL DEFAULT 'light' AFTER `active`;
