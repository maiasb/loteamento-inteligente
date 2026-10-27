import type { PurchaseRequestLot } from './PurchaseRequestLot';

export type PurchaseRequest = {
  id: string;
  lotId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerCPF?: string;
  message?: string;
  contract?: string;
  status: 'pending' | 'approved' | 'rejected' | 'completed' | 'cancelled';
  createdAt: Date;
  lots?: PurchaseRequestLot[]; // Lotes associados com suas informações específicas
};
