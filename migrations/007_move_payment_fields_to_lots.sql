-- Migration: Move payment fields to lots
-- Description: Entrada e parcelas passam a ser por lote (purchase_request_lots) e saem de
--   purchase_requests. Sem indices em first_payment/installments: nunca sao filtradas.
-- Rollback:
--   ALTER TABLE `purchase_requests` ADD COLUMN `installments` INT NULL DEFAULT NULL;
--   ALTER TABLE `purchase_request_lots` DROP COLUMN `first_payment`, DROP COLUMN `installments`;
--   (perde os valores por lote)

ALTER TABLE `purchase_request_lots`
  ADD COLUMN `first_payment` DECIMAL(10,2) DEFAULT NULL COMMENT 'Valor de entrada especifico para este lote',
  ADD COLUMN `installments` INT DEFAULT NULL COMMENT 'Numero de parcelas especifico para este lote';

UPDATE `purchase_request_lots` prl
INNER JOIN `purchase_requests` pr ON prl.purchase_request_id = pr.id
SET prl.installments = pr.installments
WHERE pr.installments IS NOT NULL;

ALTER TABLE `purchase_requests`
  DROP COLUMN `installments`;
