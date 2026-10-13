import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PUT } from '@/app/api/reserva/confirmacao/route';
import { jsonRequest, sqlOf, useFakeConnection, type FakeConnection } from '../helpers/db';

vi.mock('mysql2/promise', () => ({ default: { createConnection: vi.fn() } }));

const base = { reservationId: 4, status: 'completed', lotStatus: 'sold', userRole: 'admin' };
const confirmar = (payload: unknown) =>
  PUT(jsonRequest('/api/reserva/confirmacao', 'PUT', payload));

describe('PUT /api/reserva/confirmacao', () => {
  let conn: FakeConnection;
  beforeEach(() => {
    conn = useFakeConnection();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('exige reservationId, status e lotStatus', async () => {
    expect((await confirmar({ ...base, reservationId: undefined })).status).toBe(400);
    expect((await confirmar({ ...base, status: undefined })).status).toBe(400);
    expect((await confirmar({ ...base, lotStatus: undefined })).status).toBe(400);
  });

  it('só admin e dev confirmam ou cancelam', async () => {
    expect((await confirmar({ ...base, userRole: 'vendedor' })).status).toBe(403);
    expect((await confirmar({ ...base, userRole: undefined })).status).toBe(403);
    expect(conn.beginTransaction).not.toHaveBeenCalled();
  });

  it('valida os valores de status e lotStatus', async () => {
    expect((await confirmar({ ...base, status: 'pending' })).status).toBe(400);
    expect((await confirmar({ ...base, lotStatus: 'reserved' })).status).toBe(400);
  });

  it('retorna 404 quando a reserva não existe', async () => {
    conn.execute.mockResolvedValueOnce([[]]);
    expect((await confirmar(base)).status).toBe(404);
    expect(conn.rollback).toHaveBeenCalled();
  });

  it('retorna 409 quando a reserva já está finalizada', async () => {
    for (const atual of ['completed', 'cancelled']) {
      conn.execute.mockResolvedValueOnce([[{ status: atual }]]);
      expect((await confirmar(base)).status).toBe(409);
    }
    expect(conn.execute).toHaveBeenCalledTimes(2);
    expect(conn.commit).not.toHaveBeenCalled();
  });

  it('ignora o lotStatus do cliente e deriva do status', async () => {
    conn.execute
      .mockResolvedValueOnce([[{ status: 'pending' }]])
      .mockResolvedValueOnce([[{ lot_id: 10 }]])
      .mockResolvedValue([{}]);
    const res = await confirmar({ ...base, status: 'cancelled', lotStatus: 'sold' });
    expect(res.status).toBe(200);
    expect((await res.json()).lotStatus).toBe('available');
    expect(conn.execute.mock.calls[3][1]).toEqual(['available', 10]);
    expect(sqlOf(conn.execute.mock.calls[3])).toContain("AND status = 'reserved'");
  });

  it('informa só os lotes que realmente mudaram de status', async () => {
    conn.execute
      .mockResolvedValueOnce([[{ status: 'pending' }]])
      .mockResolvedValueOnce([[{ lot_id: 10 }, { lot_id: 11 }]])
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);
    const res = await confirmar({ ...base, status: 'cancelled', lotStatus: 'available' });
    expect((await res.json()).lotsUpdated).toBe(1);
  });

  it('retorna 404 e desfaz quando a reserva não tem lotes', async () => {
    conn.execute.mockResolvedValueOnce([[{ status: 'pending' }]]).mockResolvedValueOnce([[]]);
    expect((await confirmar(base)).status).toBe(404);
    expect(conn.rollback).toHaveBeenCalled();
  });

  it('confirmar marca a reserva como completed e os lotes como sold', async () => {
    conn.execute
      .mockResolvedValueOnce([[{ status: 'approved' }]])
      .mockResolvedValueOnce([[{ lot_id: 10 }, { lot_id: 11 }]])
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([{ affectedRows: 2 }]);
    const res = await confirmar(base);
    expect(res.status).toBe(200);
    expect((await res.json()).lotsUpdated).toBe(2);
    expect(conn.execute.mock.calls[2][1]).toEqual(['completed', 4]);
    expect(conn.execute.mock.calls[3][1]).toEqual(['sold', 10, 11]);
    expect(conn.commit).toHaveBeenCalled();
  });

  it('cancelar devolve os lotes para available (dev também pode)', async () => {
    conn.execute
      .mockResolvedValueOnce([[{ status: 'pending' }]])
      .mockResolvedValueOnce([[{ lot_id: 10 }]])
      .mockResolvedValue([{}]);
    const res = await confirmar({
      ...base,
      status: 'cancelled',
      lotStatus: 'available',
      userRole: 'dev',
    });
    expect(res.status).toBe(200);
    expect(sqlOf(conn.execute.mock.calls[3])).toContain('UPDATE lots SET status = ?');
    expect(conn.execute.mock.calls[3][1]).toEqual(['available', 10]);
  });

  it('ordena os lotes por id antes de atualizá-los', async () => {
    conn.execute
      .mockResolvedValueOnce([[{ status: 'pending' }]])
      .mockResolvedValueOnce([[{ lot_id: 12 }, { lot_id: 10 }, { lot_id: 11 }]])
      .mockResolvedValue([{ affectedRows: 3 }]);
    await confirmar(base);
    expect(sqlOf(conn.execute.mock.calls[1])).toContain('ORDER BY lot_id');
    expect(conn.execute.mock.calls[3][1]).toEqual(['sold', 10, 11, 12]);
  });
});
