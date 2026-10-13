import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST as importar } from '@/app/api/mapas/importar/route';
import { jsonRequest, sqlOf, useFakeConnection, type FakeConnection } from '../helpers/db';

vi.mock('mysql2/promise', () => ({ default: { createConnection: vi.fn() } }));

const reservation = {
  customer_name: 'Cliente',
  customer_email: 'cliente@exemplo.com',
  customer_phone: '11999999999',
};

const payload = (lot: Record<string, unknown>) => ({
  name: 'Mapa',
  blocks: [{ name: 'Q1', lots: [{ lotNumber: '1', price: 1000, size: 200, ...lot }] }],
});

const importarMapa = (body: unknown) => importar(jsonRequest('/api/mapas/importar', 'POST', body));

describe('POST /api/mapas/importar', () => {
  let conn: FakeConnection;
  beforeEach(() => {
    conn = useFakeConnection();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('rejeita status de lote fora do ENUM', async () => {
    conn.execute.mockResolvedValue([{ insertId: 1 }]);
    const res = await importarMapa(payload({ status: 'contacted' }));
    expect(res.status).toBe(400);
    expect(conn.rollback).toHaveBeenCalled();
  });

  it('rejeita lote reservado ou vendido sem reservation', async () => {
    conn.execute.mockResolvedValue([{ insertId: 1 }]);
    expect((await importarMapa(payload({ status: 'reserved' }))).status).toBe(400);
    expect((await importarMapa(payload({ status: 'sold' }))).status).toBe(400);
  });

  it('aceita preço 0 e rejeita preço ausente', async () => {
    conn.execute.mockResolvedValue([{ insertId: 1 }]);
    expect((await importarMapa(payload({ price: 0 }))).status).toBe(201);
    expect((await importarMapa(payload({ price: undefined }))).status).toBe(400);
  });

  it("grava 'pending' para reserva 'contacted' e copia o preço para agreed_price", async () => {
    conn.execute.mockResolvedValue([{ insertId: 7 }]);
    const res = await importarMapa(
      payload({ status: 'reserved', reservation: { ...reservation, status: 'contacted' } })
    );
    expect(res.status).toBe(201);

    const calls = conn.execute.mock.calls;
    const purchase = calls.find((c) => sqlOf(c).includes('INSERT INTO purchase_requests'))!;
    expect(purchase[1]).toContain('pending');
    const link = calls.find((c) => sqlOf(c).includes('INSERT INTO purchase_request_lots'))!;
    expect(sqlOf(link)).toContain('agreed_price');
    expect(link[1]).toEqual([7, 7, 1000]);
  });

  it('não vaza a mensagem do banco no 500', async () => {
    conn.execute.mockRejectedValue(new Error('segredo do banco'));
    const res = await importarMapa(payload({}));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain('segredo');
  });
});
