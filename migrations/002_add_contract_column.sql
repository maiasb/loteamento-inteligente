-- Migration: Add contract column to purchase_requests
-- Description: Adiciona coluna para armazenar informacoes do contrato
-- Rollback: ALTER TABLE `purchase_requests` DROP COLUMN `contract`;

ALTER TABLE `purchase_requests`
  ADD COLUMN `contract` TEXT AFTER `notes`;
