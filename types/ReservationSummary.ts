import type { ReservationLotSummary } from './ReservationLotSummary';

/** Reserva resumida, como devolvida por /api/reservas. */
export type ReservationSummary = {
  id: string | number;
  customer_name: string;
  seller_name: string;
  status: string;
  created_at: string;
  user_id?: number | string | null;
  lots?: ReservationLotSummary[];
};
