/** Lote dentro de uma reserva, como devolvido por /api/reservas. */
export type ReservationLotSummary = {
  id: string | number;
  lot_id?: string | number;
  agreed_price?: number | string | null;
  first_payment?: number | string | null;
  installments?: number | null;
  payment_method?: string | null;
};
