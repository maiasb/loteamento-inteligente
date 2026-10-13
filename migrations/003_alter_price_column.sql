-- Migration: Alter price column precision
-- Description: Reduz lots.price de DECIMAL(15,2) para DECIMAL(10,2). A 015 volta a DECIMAL(15,2).
-- Rollback: ALTER TABLE `lots` MODIFY COLUMN `price` DECIMAL(15,2) NOT NULL DEFAULT 0.00;

ALTER TABLE `lots`
  MODIFY COLUMN `price` DECIMAL(10,2) NOT NULL;
