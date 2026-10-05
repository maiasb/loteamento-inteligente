import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DELETE as deletarLote } from '@/app/api/mapas/lotes/deletar/route';
import { DELETE as deletarQuadra } from '@/app/api/mapas/quadras/deletar/route';
import { jsonRequest, sqlOf, useFakeConnection, type FakeConnection } from '../helpers/db';

vi.mock('mysql2/promise', () => ({ default: { createConnection: vi.fn() } }));

describe('DELETE /api/mapas/quadras/deletar', () => {
  let conn: FakeConnection;
  beforeEach(() => {
    conn = useFakeConnection();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('exige blockId', async () => {
    expect((await deletarQuadra(jsonRequest('/api/mapas/quadras/deletar', 'DELETE'))).status).toBe(
      400
    );
  });

  it('recusa com 409 quando há lote reservado ou vendido e não apaga nada', async () => {
    conn.execute.mockResolvedValueOnce([[{ count: 2 }]]);
    const res = await deletarQuadra(jsonRequest('/api/mapas/quadras/deletar?blockId=3', 'DELETE'));
    expect(res.status).toBe(409);
    expect((await res.json()).count).toBe(2);
    expect(conn.execute).toHaveBeenCalledTimes(1);
  });

  it('apaga os lotes e depois a quadra quando todos estão livres', async () => {
    conn.execute.mockResolvedValueOnce([[{ count: 0 }]]).mockResolvedValue([{}]);
    const res = await deletarQuadra(jsonRequest('/api/mapas/quadras/deletar?blockId=3', 'DELETE'));
    expect(res.status).toBe(200);
    expect(sqlOf(conn.execute.mock.calls[1])).toBe('DELETE FROM lots WHERE block_id = ?');
    expect(sqlOf(conn.execute.mock.calls[2])).toBe('DELETE FROM blocks WHERE id = ?');
  });
});

describe('DELETE /api/mapas/lotes/deletar', () => {
  let conn: FakeConnection;
  beforeEach(() => {
    conn = useFakeConnection();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  const call = (query = '?lotId=8') =>
    deletarLote(jsonRequest(`/api/mapas/lotes/deletar${query}`, 'DELETE'));

  it('exige lotId e retorna 404 para lote inexistente', async () => {
    expect((await call('')).status).toBe(400);
    conn.execute.mockResolvedValueOnce([[]]);
    expect((await call()).status).toBe(404);
  });

  it('recusa lote reservado ou vendido', async () => {
    for (const status of ['reserved', 'sold']) {
      conn.execute.mockResolvedValueOnce([[{ status }]]);
      const res = await call();
      expect(res.status).toBe(400);
      expect((await res.json()).status).toBe(status);
    }
    expect(conn.execute).toHaveBeenCalledTimes(2);
  });

  it('apaga lote disponível ou bloqueado', async () => {
    conn.execute.mockResolvedValueOnce([[{ status: 'available' }]]).mockResolvedValue([{}]);
    expect((await call()).status).toBe(200);
    expect(sqlOf(conn.execute.mock.calls[1])).toBe('DELETE FROM lots WHERE id = ?');
  });
});
