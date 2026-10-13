-- Migration: Add agreed price and installments
-- Description: Preco acordado por lote na reserva e numero de parcelas na reserva
--   (as parcelas passam para purchase_request_lots na 007)
-- Rollback:
--   ALTER TABLE `purchase_requests` DROP COLUMN `installments`;
--   ALTER TABLE `purchase_request_lots` DROP COLUMN `agreed_price`;

ALTER TABLE `purchase_request_lots`
  ADD COLUMN `agreed_price` DECIMAL(15,2) NULL COMMENT 'Preco acordado para este lote na reserva';

ALTER TABLE `purchase_requests`
  ADD COLUMN `installments` INT NULL DEFAULT NULL COMMENT 'Numero de parcelas para pagamento';
