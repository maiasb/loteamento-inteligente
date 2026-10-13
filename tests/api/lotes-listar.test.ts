import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/api/mapas/lotes/route';
import { executeQuery } from '@/lib/db';
import { jsonRequest, sqlOf } from '../helpers/db';

vi.mock('@/lib/db', () => ({ executeQuery: vi.fn() }));

describe('GET /api/mapas/lotes', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('ordena numericamente e tolera features com JSON inválido', async () => {
    vi.mocked(executeQuery).mockResolvedValueOnce([
      { id: 1, map_id: 5, lot_number: '2', features: '{quebrado' },
      { id: 2, map_id: 5, lot_number: '10', features: '["a"]' },
    ]);
    const res = await GET(jsonRequest('/api/mapas/lotes?mapId=5', 'GET'));
    expect(res.status).toBe(200);
    expect(sqlOf(vi.mocked(executeQuery).mock.calls[0])).toContain(
      'ORDER BY CAST(l.lot_number AS UNSIGNED), l.lot_number'
    );
    const [{ lots }] = await res.json();
    expect(lots[0].features).toEqual([]);
    expect(lots[1].features).toEqual(['a']);
  });
});
