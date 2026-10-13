import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/mapas/lotes/criar/route';
import { executeQuery } from '@/lib/db';
import { jsonRequest, sqlOf } from '../helpers/db';

vi.mock('@/lib/db', () => ({ executeQuery: vi.fn() }));

const query = vi.mocked(executeQuery);
const payload = { mapId: 5, lotNumber: '12', price: 1000, size: 300 };
const criar = (body: unknown) => POST(jsonRequest('/api/mapas/lotes/criar', 'POST', body));

describe('POST /api/mapas/lotes/criar', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('exige mapId, lotNumber, price e size', async () => {
    expect((await criar({ ...payload, mapId: undefined })).status).toBe(400);
    expect((await criar({ ...payload, lotNumber: '' })).status).toBe(400);
    expect((await criar({ ...payload, price: 0 })).status).toBe(400);
    expect((await criar({ ...payload, size: undefined })).status).toBe(400);
    expect(query).not.toHaveBeenCalled();
  });

  it('cria lote sem quadra com block_id NULL e devolve o insertId', async () => {
    query.mockResolvedValueOnce({ insertId: 77 } as never);
    const res = await criar(payload);
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.id).toBe('77');
    expect(json.blockId).toBeNull();
    expect(query).toHaveBeenCalledTimes(1);
    expect(sqlOf(query.mock.calls[0])).toContain('INSERT INTO lots');
    expect(query.mock.calls[0][1]?.[1]).toBeNull();
  });

  it('cria lote em quadra e grava lat/lng em coordinates', async () => {
    query.mockResolvedValueOnce({ insertId: 78 } as never);
    const res = await criar({ ...payload, blockId: 3, lat: -6.06, lng: -50.04 });
    expect(res.status).toBe(201);
    const params = query.mock.calls[0][1];
    expect(params?.[1]).toBe(3);
    expect(params?.[8]).toBe(JSON.stringify({ lat: -6.06, lng: -50.04 }));
  });

  it('retorna 409 quando o banco acusa duplicata (com ou sem quadra)', async () => {
    query.mockRejectedValue(Object.assign(new Error('dup'), { code: 'ER_DUP_ENTRY' }));
    const semQuadra = await criar(payload);
    expect(semQuadra.status).toBe(409);
    expect((await semQuadra.json()).error).toContain('sem quadra');
    const comQuadra = await criar({ ...payload, blockId: 3 });
    expect(comQuadra.status).toBe(409);
    expect((await comQuadra.json()).error).toContain('nesta quadra');
  });

  it('retorna 500 em erro inesperado', async () => {
    query.mockRejectedValueOnce(new Error('falha'));
    expect((await criar(payload)).status).toBe(500);
  });
});
