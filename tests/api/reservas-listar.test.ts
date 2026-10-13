import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/api/reservas/route';
import { executeQuery } from '@/lib/db';
import { jsonRequest, sqlOf } from '../helpers/db';

vi.mock('@/lib/db', () => ({ executeQuery: vi.fn() }));

const query = vi.mocked(executeQuery);

const listar = (query = '') => GET(jsonRequest(`/api/reservas${query}`, 'GET'));

describe('GET /api/reservas', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  const mockFull = (reservas: unknown[], lotes: unknown[]) => {
    query
      .mockResolvedValueOnce([{ total: reservas.length }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(reservas)
      .mockResolvedValueOnce(lotes);
  };

  it('usa os padrões quando page e limit são inválidos', async () => {
    mockFull([], []);
    expect((await listar('?page=abc&limit=xyz')).status).toBe(200);
    expect(sqlOf(query.mock.calls[2])).toContain('LIMIT 10 OFFSET 0');
  });

  it('limita page e limit aos intervalos permitidos', async () => {
    mockFull([], []);
    await listar('?page=-3&limit=5000');
    expect(sqlOf(query.mock.calls[2])).toContain('LIMIT 1000 OFFSET 0');
  });

  it('não consulta lotes quando não há reservas', async () => {
    mockFull([], []);
    await listar();
    expect(query).toHaveBeenCalledTimes(3);
  });

  it('busca os lotes em uma única query e agrupa por reserva', async () => {
    mockFull(
      [
        { id: 1, created_at: '2025-01-01 10:00:00' },
        { id: 2, created_at: '2025-01-02 10:00:00' },
      ],
      [
        { id: 10, purchase_request_id: 1 },
        { id: 11, purchase_request_id: 2 },
        { id: 12, purchase_request_id: 1 },
      ]
    );
    const json = await (await listar()).json();
    expect(query).toHaveBeenCalledTimes(4);
    expect(sqlOf(query.mock.calls[3])).toContain('prl.purchase_request_id IN (?,?)');
    expect(json.reservations[0].lots.map((l: { id: number }) => l.id)).toEqual([10, 12]);
    expect(json.reservations[1].lots).toHaveLength(1);
  });

  it('modo minimal também usa uma única query de lotes', async () => {
    query
      .mockResolvedValueOnce([{ id: 1, created_at: '2025-01-01 10:00:00' }])
      .mockResolvedValueOnce([{ purchase_request_id: 1, id: 10, agreed_price: 5 }]);
    const json = await (await listar('?minimal=true')).json();
    expect(query).toHaveBeenCalledTimes(2);
    expect(json[0].lots).toEqual([{ id: 10, agreed_price: 5 }]);
  });

  it('ordena por created_at e id para paginar de forma estável', async () => {
    mockFull([], []);
    await listar();
    expect(sqlOf(query.mock.calls[2])).toContain('ORDER BY created_at DESC, id DESC');
  });
});
