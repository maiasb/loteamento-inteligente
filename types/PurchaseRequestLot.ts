export type PurchaseRequestLot = {
  id: string;
  lotId: string;
  purchaseRequestId: string;
  agreedPrice?: number;
  firstPayment?: number; // Valor de entrada específico para este lote
  installments?: number; // Número de parcelas específico para este lote
  createdAt: Date;
};
