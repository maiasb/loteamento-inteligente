import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET as listarMapas } from '@/app/api/mapas/route';
import { GET as visualizacao } from '@/app/api/mapas/visualizacao/route';
import { GET as completo } from '@/app/api/mapas/completo/route';
import { executeQuery } from '@/lib/db';
import { jsonRequest, sqlOf } from '../helpers/db';

vi.mock('@/lib/db', () => ({ executeQuery: vi.fn() }));

const query = vi.mocked(executeQuery);

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('GET /api/mapas', () => {
  const listar = (qs = '') => listarMapas(jsonRequest(`/api/mapas${qs}`, 'GET'));
  const sqls = () => query.mock.calls.map((call) => sqlOf(call));

  it('faz uma única query, sem consultar INFORMATION_SCHEMA', async () => {
    query.mockResolvedValueOnce([]);
    expect((await listar()).status).toBe(200);
    expect(query).toHaveBeenCalledTimes(1);
    expect(sqls()[0]).not.toContain('INFORMATION_SCHEMA');
    expect(sqls()[0]).toContain('overlay_config');
  });

  it('withLots usa EXISTS, sem DISTINCT nem INNER JOIN', async () => {
    query.mockResolvedValueOnce([]);
    await listar('?withLots=true&minimal=true');
    expect(sqls()[0]).toContain('WHERE EXISTS (SELECT 1 FROM lots l WHERE l.map_id = m.id)');
    expect(sqls()[0]).not.toMatch(/DISTINCT|INNER JOIN/);
    expect(sqls()[0]).not.toContain('image_url');
  });

  it('minimal omite image_url e formata o mapa', async () => {
    query.mockResolvedValueOnce([
      {
        id: 5,
        name: 'Vale',
        overlay_config: { a: 1 },
        created_at: new Date('2025-01-02T03:04:05Z'),
        updated_at: null,
      },
    ]);
    const [map] = await (await listar('?minimal=true')).json();
    expect(map).toMatchObject({
      mapId: '5',
      overlayConfig: { a: 1 },
      createdAt: '2025-01-02 03:04:05',
      updatedAt: null,
    });
    expect(map.imageUrl).toBeUndefined();
  });

  it('busca por id passa o parâmetro', async () => {
    query.mockResolvedValueOnce([]);
    await listar('?id=9');
    expect(query.mock.calls[0][1]).toEqual(['9']);
  });

  it('retorna 500 em erro de banco', async () => {
    query.mockRejectedValueOnce(new Error('falha'));
    expect((await listar()).status).toBe(500);
  });
});

describe('GET /api/mapas/visualizacao', () => {
  const ver = (qs = '?mapId=5') => visualizacao(jsonRequest(`/api/mapas/visualizacao${qs}`, 'GET'));

  it('exige mapId e retorna 404 para mapa inexistente', async () => {
    expect((await ver('')).status).toBe(400);
    query.mockResolvedValueOnce([]);
    expect((await ver()).status).toBe(404);
  });

  it('monta mapa, quadras e lotes sem INFORMATION_SCHEMA', async () => {
    query
      .mockResolvedValueOnce([{ id: 5, name: 'Vale', overlayConfig: '{"x":1}', imageUrl: 'u' }])
      .mockResolvedValueOnce([{ id: 1, mapId: 5, name: 'Q1' }])
      .mockResolvedValueOnce([
        {
          id: 10,
          mapId: 5,
          blockId: null,
          lotNumber: '1',
          status: 'available',
          price: '1000.00',
          size: '250.00',
          features: ['a'],
          coordinates: { lat: 1, lng: 2 },
        },
      ]);
    const json = await (await ver()).json();
    expect(query).toHaveBeenCalledTimes(3);
    expect(query.mock.calls.every((call) => !sqlOf(call).includes('INFORMATION_SCHEMA'))).toBe(
      true
    );
    expect(json.map.overlayConfig).toEqual({ x: 1 });
    expect(json.lots[0]).toMatchObject({
      blockId: null,
      price: 1000,
      pricePerM2: 4,
      lat: 1,
      lng: 2,
    });
    expect(json.blocks[0].id).toBe('1');
  });
});

describe('GET /api/mapas/completo', () => {
  it('retorna lista vazia sem consultar quadras e lotes', async () => {
    query.mockResolvedValueOnce([]);
    const res = await completo();
    expect(await res.json()).toEqual([]);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('usa 3 queries no total e agrupa quadras e lotes em memória', async () => {
    query
      .mockResolvedValueOnce([
        { mapId: 1, name: 'A' },
        { mapId: 2, name: 'B' },
      ])
      .mockResolvedValueOnce([
        { id: 10, mapId: 1, name: 'Q1' },
        { id: 11, mapId: 1, name: 'Q2' },
        { id: 12, mapId: 2, name: 'Q1' },
      ])
      .mockResolvedValueOnce([
        {
          id: 100,
          blockId: 10,
          mapId: 1,
          lotNumber: '1',
          price: '10.50',
          size: '2',
          features: '["x"]',
        },
        { id: 101, blockId: 12, mapId: 2, lotNumber: '1', price: '5', size: '1', features: ['y'] },
        { id: 102, blockId: 10, mapId: 1, lotNumber: '2', price: '1', size: '1', features: null },
      ]);
    const json = await (await completo()).json();
    expect(query).toHaveBeenCalledTimes(3);
    expect(query.mock.calls[1][1]).toEqual([1, 2]);
    expect(json[0].totalBlocks).toBe(2);
    expect(json[0].totalLots).toBe(2);
    expect(json[0].blocks[0].lots.map((l: { id: string }) => l.id)).toEqual(['100', '102']);
    expect(json[0].blocks[0].lots[0]).toMatchObject({ price: 10.5, features: ['x'] });
    expect(json[0].blocks[0].lots[1].features).toEqual([]);
    expect(json[1].blocks[0].lots[0].features).toEqual(['y']);
  });
});
