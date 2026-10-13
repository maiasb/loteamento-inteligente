import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/api/reservas/find-page/route';
import { executeQuery } from '@/lib/db';
import { jsonRequest, sqlOf } from '../helpers/db';

vi.mock('@/lib/db', () => ({ executeQuery: vi.fn() }));

const query = vi.mocked(executeQuery);
const buscar = (qs: string) => GET(jsonRequest(`/api/reservas/find-page${qs}`, 'GET'));

describe('GET /api/reservas/find-page', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('exige reservationId', async () => {
    expect((await buscar('')).status).toBe(400);
  });

  it('desempata por id e calcula a página', async () => {
    query.mockResolvedValueOnce([{ position: 23 }]);
    const res = await buscar('?reservationId=40&limit=10');
    expect(await res.json()).toEqual({ page: 3, position: 23, limit: 10 });
    const sql = sqlOf(query.mock.calls[0]);
    expect(sql).toContain('pr.created_at > ref.created_at');
    expect(sql).toContain('pr.created_at = ref.created_at AND pr.id >= ref.id');
  });

  it('aplica os mesmos filtros da listagem', async () => {
    query.mockResolvedValueOnce([{ position: 1 }]);
    await buscar('?reservationId=40&status=pending&userId=7');
    expect(sqlOf(query.mock.calls[0])).toContain('WHERE pr.status = ? AND pr.user_id = ?');
    expect(query.mock.calls[0][1]).toEqual(['40', 'pending', 7]);
  });

  it('ignora filtros "all", "undefined" e "null"', async () => {
    query.mockResolvedValueOnce([{ position: 1 }]);
    await buscar('?reservationId=40&status=all&userId=undefined');
    expect(sqlOf(query.mock.calls[0])).not.toContain('pr.status');
    expect(query.mock.calls[0][1]).toEqual(['40']);
  });
});
