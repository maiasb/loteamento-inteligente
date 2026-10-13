import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DELETE as deletarLote } from '@/app/api/mapas/lotes/deletar/route';
import { DELETE as deletarQuadra } from '@/app/api/mapas/quadras/deletar/route';
import { DELETE as deletarMapa } from '@/app/api/mapas/deletar/route';
import { jsonRequest, sqlOf, useFakePool, type FakeConnection } from '../helpers/db';

vi.mock('@/lib/db', () => ({ getPool: vi.fn() }));

const refError = Object.assign(new Error('Cannot delete or update a parent row'), {
  errno: 1451,
  code: 'ER_ROW_IS_REFERENCED_2',
});

describe('DELETE /api/mapas/quadras/deletar', () => {
  let conn: FakeConnection;
  beforeEach(() => {
    conn = useFakePool();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  const call = (query = '?blockId=3') =>
    deletarQuadra(jsonRequest(`/api/mapas/quadras/deletar${query}`, 'DELETE'));

  it('exige blockId', async () => {
    expect((await call('')).status).toBe(400);
  });

  it('recusa com 409 quando há lote reservado ou vendido e não apaga nada', async () => {
    conn.execute.mockResolvedValueOnce([
      [
        { id: 1, status: 'reserved' },
        { id: 2, status: 'sold' },
        { id: 3, status: 'available' },
      ],
    ]);
    const res = await call();
    expect(res.status).toBe(409);
    expect((await res.json()).count).toBe(2);
    expect(conn.execute).toHaveBeenCalledTimes(1);
    expect(conn.rollback).toHaveBeenCalledTimes(1);
    expect(conn.release).toHaveBeenCalledTimes(1);
  });

  it('trava os lotes da quadra em ordem de id', async () => {
    conn.execute.mockResolvedValueOnce([[]]).mockResolvedValue([[{ count: 0 }]]);
    await call();
    expect(sqlOf(conn.execute.mock.calls[0])).toContain('ORDER BY id FOR UPDATE');
  });

  it('recusa com 409 quando algum lote tem reserva ativa e diz a condição', async () => {
    conn.execute
      .mockResolvedValueOnce([[{ id: 1, status: 'available' }]])
      .mockResolvedValueOnce([[{ count: 1 }]]);
    const res = await call();
    expect(res.status).toBe(409);
    expect((await res.json()).error).toContain('reserva(s) ativa(s)');
    expect(sqlOf(conn.execute.mock.calls[1])).toContain("NOT IN ('cancelled', 'rejected')");
    expect(conn.execute).toHaveBeenCalledTimes(2);
    expect(conn.commit).not.toHaveBeenCalled();
    expect(conn.rollback).toHaveBeenCalledTimes(1);
  });

  it('remove as linhas de purchase_request_lots, os lotes e a quadra quando só há reservas encerradas', async () => {
    conn.execute
      .mockResolvedValueOnce([[{ id: 1, status: 'available' }]])
      .mockResolvedValueOnce([[{ count: 0 }]])
      .mockResolvedValue([{}]);
    const res = await call();
    expect(res.status).toBe(200);
    expect(sqlOf(conn.execute.mock.calls[2])).toContain(
      'DELETE prl FROM purchase_request_lots prl'
    );
    expect(sqlOf(conn.execute.mock.calls[3])).toBe('DELETE FROM lots WHERE block_id = ?');
    expect(sqlOf(conn.execute.mock.calls[4])).toBe('DELETE FROM blocks WHERE id = ?');
    expect(conn.commit).toHaveBeenCalledTimes(1);
    expect(conn.release).toHaveBeenCalledTimes(1);
  });

  it('traduz a violação de FK (1451) em 409 e desfaz a transação', async () => {
    conn.execute
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[{ count: 0 }]])
      .mockRejectedValueOnce(refError);
    expect((await call()).status).toBe(409);
    expect(conn.rollback).toHaveBeenCalled();
    expect(conn.release).toHaveBeenCalledTimes(1);
  });

  it('retorna 500 e libera a conexão em erro inesperado', async () => {
    conn.execute.mockRejectedValueOnce(new Error('falha'));
    expect((await call()).status).toBe(500);
    expect(conn.release).toHaveBeenCalledTimes(1);
  });
});

describe('DELETE /api/mapas/lotes/deletar', () => {
  let conn: FakeConnection;
  beforeEach(() => {
    conn = useFakePool();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  const call = (query = '?lotId=8') =>
    deletarLote(jsonRequest(`/api/mapas/lotes/deletar${query}`, 'DELETE'));

  it('exige lotId e retorna 404 para lote inexistente', async () => {
    expect((await call('')).status).toBe(400);
    conn.execute.mockResolvedValueOnce([[]]);
    expect((await call()).status).toBe(404);
    expect(conn.rollback).toHaveBeenCalled();
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

  it('lê o lote com FOR UPDATE', async () => {
    conn.execute.mockResolvedValueOnce([[]]);
    await call();
    expect(sqlOf(conn.execute.mock.calls[0])).toBe(
      'SELECT status FROM lots WHERE id = ? FOR UPDATE'
    );
  });

  it('recusa com 409 lote com reserva ativa (pending, approved ou completed)', async () => {
    conn.execute
      .mockResolvedValueOnce([[{ status: 'available' }]])
      .mockResolvedValueOnce([[{ count: 1 }]]);
    const res = await call();
    expect(res.status).toBe(409);
    expect((await res.json()).message).toContain('reserva(s) ativa(s)');
    expect(sqlOf(conn.execute.mock.calls[1])).toContain("NOT IN ('cancelled', 'rejected')");
    expect(conn.execute).toHaveBeenCalledTimes(2);
    expect(conn.commit).not.toHaveBeenCalled();
    expect(conn.rollback).toHaveBeenCalledTimes(1);
    expect(conn.release).toHaveBeenCalledTimes(1);
  });

  it('recusa com 409 lote com uma reserva cancelada e uma concluída', async () => {
    // a consulta ignora a cancelada e conta só a concluída
    conn.execute
      .mockResolvedValueOnce([[{ status: 'available' }]])
      .mockResolvedValueOnce([[{ count: 1 }]]);
    expect((await call()).status).toBe(409);
    expect(conn.execute).toHaveBeenCalledTimes(2);
  });

  it('exclui lote cujas reservas estão todas canceladas e remove as linhas de purchase_request_lots', async () => {
    conn.execute
      .mockResolvedValueOnce([[{ status: 'available' }]])
      .mockResolvedValueOnce([[{ count: 0 }]])
      .mockResolvedValue([{ affectedRows: 1 }]);
    expect((await call()).status).toBe(200);
    expect(sqlOf(conn.execute.mock.calls[2])).toBe(
      'DELETE FROM purchase_request_lots WHERE lot_id = ?'
    );
    expect(sqlOf(conn.execute.mock.calls[3])).toBe('DELETE FROM lots WHERE id = ?');
    expect(conn.commit).toHaveBeenCalledTimes(1);
  });

  it('apaga lote disponível ou bloqueado sem reservas', async () => {
    conn.execute
      .mockResolvedValueOnce([[{ status: 'blocked' }]])
      .mockResolvedValueOnce([[{ count: 0 }]])
      .mockResolvedValue([{ affectedRows: 1 }]);
    expect((await call()).status).toBe(200);
    expect(conn.commit).toHaveBeenCalledTimes(1);
    expect(conn.release).toHaveBeenCalledTimes(1);
  });

  it('traduz a violação de FK (1451) em 409', async () => {
    conn.execute
      .mockResolvedValueOnce([[{ status: 'available' }]])
      .mockResolvedValueOnce([[{ count: 0 }]])
      .mockRejectedValueOnce(refError);
    expect((await call()).status).toBe(409);
    expect(conn.rollback).toHaveBeenCalled();
  });
});

describe('DELETE /api/mapas/deletar', () => {
  let conn: FakeConnection;
  beforeEach(() => {
    conn = useFakePool();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  const call = (query = '?mapId=5') =>
    deletarMapa(jsonRequest(`/api/mapas/deletar${query}`, 'DELETE'));

  it('exige mapId', async () => {
    expect((await call('')).status).toBe(400);
  });

  it('recusa com 409 quando há lote reservado ou vendido', async () => {
    conn.execute.mockResolvedValueOnce([[{ id: 1, status: 'sold' }]]);
    const res = await call();
    expect(res.status).toBe(409);
    expect((await res.json()).count).toBe(1);
    expect(conn.execute).toHaveBeenCalledTimes(1);
  });

  it('recusa com 409 quando algum lote tem reserva ativa', async () => {
    conn.execute
      .mockResolvedValueOnce([[{ id: 1, status: 'available' }]])
      .mockResolvedValueOnce([[{ count: 3 }]]);
    const res = await call();
    expect(res.status).toBe(409);
    expect((await res.json()).error).toContain('3 reserva(s) ativa(s)');
    expect(conn.commit).not.toHaveBeenCalled();
    expect(conn.release).toHaveBeenCalledTimes(1);
  });

  it('remove as linhas de purchase_request_lots e apaga o mapa quando só há reservas encerradas', async () => {
    conn.execute
      .mockResolvedValueOnce([[{ id: 1, status: 'available' }]])
      .mockResolvedValueOnce([[{ count: 0 }]])
      .mockResolvedValue([{}]);
    expect((await call()).status).toBe(200);
    expect(sqlOf(conn.execute.mock.calls[0])).toContain('ORDER BY id FOR UPDATE');
    expect(sqlOf(conn.execute.mock.calls[2])).toContain(
      'DELETE prl FROM purchase_request_lots prl'
    );
    expect(sqlOf(conn.execute.mock.calls[3])).toBe('DELETE FROM maps WHERE id = ?');
    expect(conn.commit).toHaveBeenCalledTimes(1);
  });

  it('traduz a violação de FK (1451) em 409 (reserva criada durante a exclusão)', async () => {
    conn.execute
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[{ count: 0 }]])
      .mockRejectedValueOnce(refError);
    const res = await call();
    expect(res.status).toBe(409);
    expect((await res.json()).error).toContain('durante a exclusão');
    expect(conn.rollback).toHaveBeenCalled();
  });
});
