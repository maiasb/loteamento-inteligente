import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/api/dashboard/stats/route';
import { executeQuery } from '@/lib/db';
import { sqlOf } from '../helpers/db';

vi.mock('@/lib/db', () => ({ executeQuery: vi.fn() }));

const query = vi.mocked(executeQuery);

describe('GET /api/dashboard/stats', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('totalLots soma todos os status e os valores vêm somados do SQL', async () => {
    query
      .mockResolvedValueOnce([{ total: 2 }])
      .mockResolvedValueOnce([
        { status: 'available', count: 3 },
        { status: 'reserved', count: 2 },
        { status: 'sold', count: 1 },
        { status: 'blocked', count: 4 },
        { status: 'unavailable', count: 5 },
      ])
      .mockResolvedValueOnce([
        {
          available_value: '300000.10',
          blocked_value: '1000.00',
          reserved_value: '200000.20',
          sold_value: '150000.00',
          total_first_payments: '25000.50',
          total_value: '651000.30',
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 1,
          name: 'Mapa',
          description: null,
          total_lots: '15',
          available_lots: '3',
          reserved_lots: '2',
          sold_lots: '1',
          blocked_lots: '4',
        },
      ]);

    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.summary).toEqual({
      totalMaps: 2,
      totalLots: 15,
      availableLots: 3,
      reservedLots: 2,
      soldLots: 1,
      blockedLots: 4,
    });
    expect(json.financial).toEqual({
      totalValue: 651000.3,
      availableValue: 300000.1,
      reservedValue: 200000.2,
      soldValue: 150000,
      blockedValue: 1000,
      totalFirstPayments: 25000.5,
    });
    expect(json.maps[0]).toMatchObject({ id: '1', totalLots: 15, blockedLots: 4 });
  });

  it('soma o total financeiro no SQL, não em JavaScript', async () => {
    query.mockResolvedValue([]);
    await GET();
    const sqls = query.mock.calls.map((call) => sqlOf(call));
    expect(
      sqls.some((sql) =>
        sql.includes('(t.available_value + t.reserved_value + t.sold_value + t.blocked_value)')
      )
    ).toBe(true);
  });

  it('responde com zeros quando o banco está vazio', async () => {
    query.mockResolvedValue([]);
    const json = await (await GET()).json();
    expect(json.summary.totalLots).toBe(0);
    expect(json.financial.totalValue).toBe(0);
    expect(json.maps).toEqual([]);
  });

  it('retorna 500 em erro de banco', async () => {
    query.mockRejectedValue(new Error('falha'));
    expect((await GET()).status).toBe(500);
  });
});
