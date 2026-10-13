import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PATCH, dynamic } from '@/app/api/mapas/lotes/atualizar/route';
import { jsonRequest, sqlOf, useFakeConnection, type FakeConnection } from '../helpers/db';

vi.mock('mysql2/promise', () => ({ default: { createConnection: vi.fn() } }));

const atualizar = (payload: unknown) =>
  PATCH(jsonRequest('/api/mapas/lotes/atualizar', 'PATCH', payload));

const updates = (conn: FakeConnection) =>
  conn.execute.mock.calls.filter((c) => sqlOf(c).startsWith('UPDATE lots'));

describe('PATCH /api/mapas/lotes/atualizar', () => {
  let conn: FakeConnection;
  beforeEach(() => {
    conn = useFakeConnection();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('é dinâmica (sem cache)', () => {
    expect(dynamic).toBe('force-dynamic');
  });

  it('exige id e mapId', async () => {
    expect((await atualizar({ mapId: 1 })).status).toBe(400);
    expect((await atualizar({ id: 1 })).status).toBe(400);
  });

  it('rejeita status fora da lista antes de tocar no banco', async () => {
    const res = await atualizar({ id: 1, mapId: 1, status: 'hackeado' });
    expect(res.status).toBe(400);
    expect(conn.execute).not.toHaveBeenCalled();
  });

  it('retorna 404 quando o lote não pertence ao mapa', async () => {
    conn.execute.mockResolvedValueOnce([[]]);
    const res = await atualizar({ id: 1, mapId: 2, price: 10 });
    expect(res.status).toBe(404);
    expect(updates(conn)).toHaveLength(0);
  });

  it('retorna 404 quando a quadra não pertence ao mapa do lote', async () => {
    conn.execute.mockResolvedValueOnce([[{ status: 'available' }]]).mockResolvedValueOnce([[]]);
    const res = await atualizar({ id: 1, mapId: 2, blockId: 99 });
    expect(res.status).toBe(404);
    expect(sqlOf(conn.execute.mock.calls[1])).toContain('FROM blocks WHERE id = ? AND mapId = ?');
    expect(updates(conn)).toHaveLength(0);
  });

  it.each([
    ['available', 'reserved'],
    ['available', 'sold'],
    ['reserved', 'available'],
    ['sold', 'blocked'],
  ])('retorna 409 na transição %s -> %s', async (atual, novo) => {
    conn.execute.mockResolvedValueOnce([[{ status: atual }]]);
    const res = await atualizar({ id: 1, mapId: 1, status: novo });
    expect(res.status).toBe(409);
    expect(updates(conn)).toHaveLength(0);
  });

  it('permite reenviar o mesmo status de um lote reservado (edição de outros campos)', async () => {
    conn.execute
      .mockResolvedValueOnce([[{ status: 'reserved' }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);
    const res = await atualizar({ id: 1, mapId: 1, status: 'reserved', price: 50 });
    expect(res.status).toBe(200);
  });

  it('bloqueia e desbloqueia lote normalmente', async () => {
    conn.execute
      .mockResolvedValueOnce([[{ status: 'available' }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);
    expect((await atualizar({ id: 1, mapId: 1, status: 'blocked' })).status).toBe(200);
  });

  it('atualiza com quadra do mesmo mapa', async () => {
    conn.execute
      .mockResolvedValueOnce([[{ status: 'available' }]])
      .mockResolvedValueOnce([[{ id: 5 }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);
    const res = await atualizar({ id: 1, mapId: 2, blockId: 5, status: 'unavailable' });
    expect(res.status).toBe(200);
    expect(updates(conn)).toHaveLength(1);
  });

  it('aceita blockId null (lote sem quadra) sem consultar quadra', async () => {
    conn.execute
      .mockResolvedValueOnce([[{ status: 'available' }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);
    const res = await atualizar({ id: 1, mapId: 1, blockId: null, status: 'blocked' });
    expect(res.status).toBe(200);
    expect(conn.execute).toHaveBeenCalledTimes(2);
    expect(conn.execute.mock.calls[1][1]).toContain(null);
  });

  it('traduz número duplicado em 409 e CHECK violado em 400', async () => {
    conn.execute.mockResolvedValueOnce([[{ status: 'available' }]]);
    conn.execute.mockRejectedValueOnce(Object.assign(new Error('dup'), { code: 'ER_DUP_ENTRY' }));
    expect((await atualizar({ id: 1, mapId: 1, lotNumber: '2' })).status).toBe(409);
    conn.execute.mockResolvedValueOnce([[{ status: 'available' }]]);
    conn.execute.mockRejectedValueOnce(
      Object.assign(new Error('chk'), { code: 'ER_CHECK_CONSTRAINT_VIOLATED' })
    );
    expect((await atualizar({ id: 1, mapId: 1, price: -1 })).status).toBe(400);
  });

  it('retorna 409 quando o status mudou entre a leitura e o UPDATE', async () => {
    conn.execute
      .mockResolvedValueOnce([[{ status: 'available' }]])
      .mockResolvedValueOnce([{ affectedRows: 0 }]);
    const res = await atualizar({ id: 1, mapId: 1, status: 'blocked' });
    expect(res.status).toBe(409);
    const [sql, params] = conn.execute.mock.calls[1];
    expect(sql).toContain('AND status = ?');
    expect(params.at(-1)).toBe('available');
  });

  it('retorna 404 quando o UPDATE não altera nenhuma linha', async () => {
    conn.execute
      .mockResolvedValueOnce([[{ status: 'available' }]])
      .mockResolvedValueOnce([{ affectedRows: 0 }]);
    expect((await atualizar({ id: 1, mapId: 1, price: 10 })).status).toBe(404);
  });
});
