import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/mapas/lotes/reservar/route';
import { jsonRequest, sqlOf, useFakeConnection, type FakeConnection } from '../helpers/db';

vi.mock('mysql2/promise', () => ({ default: { createConnection: vi.fn() } }));

const body = {
  lotIds: [1],
  lotDetails: [
    { lotId: 1, price: 1000, firstPayment: 100, installments: 10, paymentMethod: 'cash' },
  ],
  customerName: 'Cliente',
  customerCPF: '529.982.247-25',
  sellerName: 'Vendedor',
  userId: 3,
};

const reservar = (payload: unknown) =>
  POST(jsonRequest('/api/mapas/lotes/reservar', 'POST', payload));

describe('POST /api/mapas/lotes/reservar', () => {
  let conn: FakeConnection;
  beforeEach(() => {
    conn = useFakeConnection();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('valida lotIds, cliente e vendedor', async () => {
    expect((await reservar({ ...body, lotIds: [] })).status).toBe(400);
    expect((await reservar({ ...body, lotIds: undefined })).status).toBe(400);
    expect((await reservar({ ...body, customerName: '' })).status).toBe(400);
    expect((await reservar({ ...body, sellerName: '' })).status).toBe(400);
    expect(conn.beginTransaction).not.toHaveBeenCalled();
  });

  it('exige lotDetails como array com um item para cada lote', async () => {
    expect((await reservar({ ...body, lotDetails: undefined })).status).toBe(400);
    expect((await reservar({ ...body, lotDetails: 'x' })).status).toBe(400);
    expect((await reservar({ ...body, lotDetails: [{ lotId: 2, price: 1 }] })).status).toBe(400);
    expect((await reservar({ ...body, lotIds: [1, 2] })).status).toBe(400);
    expect(conn.beginTransaction).not.toHaveBeenCalled();
  });

  it('retorna 404 quando algum lote não existe', async () => {
    const dois = {
      ...body,
      lotIds: [2, 1],
      lotDetails: [
        { lotId: 1, price: 1 },
        { lotId: 2, price: 1 },
      ],
    };
    conn.execute.mockResolvedValueOnce([[{ id: 1, status: 'available', map_id: 5, block_id: 2 }]]);
    expect((await reservar(dois)).status).toBe(404);
    expect(conn.rollback).toHaveBeenCalled();
  });

  it('trava os lotes deduplicados e ordenados com FOR UPDATE', async () => {
    const dois = {
      ...body,
      lotIds: [2, 1, 2],
      lotDetails: [
        { lotId: 1, price: 1 },
        { lotId: 2, price: 1 },
      ],
    };
    conn.execute.mockResolvedValueOnce([[]]);
    await reservar(dois);
    expect(sqlOf(conn.execute.mock.calls[0])).toContain('ORDER BY id FOR UPDATE');
    expect(conn.execute.mock.calls[0][1]).toEqual([1, 2]);
  });

  it('retorna 409 e desfaz quando o UPDATE não afeta todos os lotes', async () => {
    conn.execute
      .mockResolvedValueOnce([[{ id: 1, status: 'available', map_id: 5, block_id: 2 }]])
      .mockResolvedValueOnce([{ insertId: 9 }])
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([{ affectedRows: 0 }]);
    const res = await reservar(body);
    expect(res.status).toBe(409);
    expect(conn.rollback).toHaveBeenCalled();
    expect(conn.commit).not.toHaveBeenCalled();
  });

  it('preserva preço 0 e não vaza detalhes do erro no 500', async () => {
    conn.execute
      .mockResolvedValueOnce([[{ id: 1, status: 'available', map_id: 5, block_id: 2 }]])
      .mockResolvedValueOnce([{ insertId: 9 }])
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);
    const zero = { ...body, lotDetails: [{ lotId: 1, price: 0, firstPayment: 0 }] };
    expect((await reservar(zero)).status).toBe(201);
    expect(conn.execute.mock.calls[2][1]).toEqual([9, 1, 0, 0, null, null]);

    conn.execute.mockReset();
    conn.execute
      .mockResolvedValueOnce([[{ id: 1, status: 'available', map_id: 5, block_id: 2 }]])
      .mockRejectedValueOnce(new Error('segredo do banco'));
    const res = await reservar(body);
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain('segredo');
  });

  it('retorna 404 quando nenhum lote existe', async () => {
    conn.execute.mockResolvedValueOnce([[]]);
    expect((await reservar(body)).status).toBe(404);
    expect(conn.rollback).toHaveBeenCalled();
  });

  it('retorna 409 e não grava nada quando algum lote não está disponível', async () => {
    conn.execute.mockResolvedValueOnce([[{ id: 1, status: 'reserved', map_id: 5, block_id: 2 }]]);
    const res = await reservar(body);
    const json = await res.json();
    expect(res.status).toBe(409);
    expect(json.unavailableLots).toHaveLength(1);
    expect(conn.execute).toHaveBeenCalledTimes(1);
    expect(conn.rollback).toHaveBeenCalled();
    expect(conn.commit).not.toHaveBeenCalled();
  });

  it('cria a reserva, liga os lotes e marca como reservados em uma transação', async () => {
    conn.execute
      .mockResolvedValueOnce([[{ id: 1, status: 'available', map_id: 5, block_id: 2 }]])
      .mockResolvedValueOnce([{ insertId: 9 }])
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);
    const res = await reservar(body);
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json).toMatchObject({ purchaseRequestId: 9, lotIds: [1] });
    expect(conn.commit).toHaveBeenCalledTimes(1);
    expect(conn.rollback).not.toHaveBeenCalled();

    const calls = conn.execute.mock.calls;
    expect(sqlOf(calls[1])).toContain('INSERT INTO purchase_requests');
    expect(calls[1][1]).toContain('52998224725');
    expect(sqlOf(calls[2])).toContain('INSERT INTO purchase_request_lots');
    expect(calls[2][1]).toEqual([9, 1, 1000, 100, 10, 'cash']);
    expect(sqlOf(calls[3])).toContain("SET status = 'reserved'");
  });

  it('desfaz a transação e responde 500 quando uma query falha', async () => {
    conn.execute
      .mockResolvedValueOnce([[{ id: 1, status: 'available', map_id: 5, block_id: 2 }]])
      .mockRejectedValueOnce(new Error('falha'));
    const res = await reservar(body);
    expect(res.status).toBe(500);
    expect(conn.rollback).toHaveBeenCalled();
    expect(conn.commit).not.toHaveBeenCalled();
    expect(conn.end).toHaveBeenCalled();
  });
});
