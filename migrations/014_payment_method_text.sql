-- Migration: 014_payment_method_text
-- Description: O formulario de reserva envia varias formas de pagamento separadas por virgula
--   (ex.: "cash, financing"), que nao cabem no ENUM de purchase_requests.payment_method
-- Rollback: ALTER TABLE `purchase_requests`
--   MODIFY COLUMN `payment_method` ENUM('cash', 'financing', 'installments') DEFAULT 'cash';
--   (falha se houver valores com mais de uma forma)

ALTER TABLE `purchase_requests`
  MODIFY COLUMN `payment_method` VARCHAR(255) NULL DEFAULT 'cash' COMMENT 'Formas de pagamento, separadas por virgula';
