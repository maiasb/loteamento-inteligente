import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST as criarQuadra } from '@/app/api/mapas/quadras/criar/route';
import { PATCH as atualizarQuadra } from '@/app/api/mapas/quadras/atualizar/route';
import { executeQuery } from '@/lib/db';
import { jsonRequest, sqlOf } from '../helpers/db';

vi.mock('@/lib/db', () => ({ executeQuery: vi.fn() }));

const query = vi.mocked(executeQuery);
const dup = Object.assign(new Error('dup'), { code: 'ER_DUP_ENTRY' });

describe('POST /api/mapas/quadras/criar', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  const criar = (body: unknown) =>
    criarQuadra(jsonRequest('/api/mapas/quadras/criar', 'POST', body));

  it('exige mapId e name', async () => {
    expect((await criar({ name: 'Q1' })).status).toBe(400);
    expect((await criar({ mapId: 1 })).status).toBe(400);
  });

  it('cria a quadra usando o insertId', async () => {
    query.mockResolvedValueOnce({ insertId: 9 } as never);
    const res = await criar({ mapId: 1, name: 'Q1' });
    expect(res.status).toBe(201);
    expect((await res.json()).id).toBe('9');
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('retorna 409 para nome repetido no mapa', async () => {
    query.mockRejectedValueOnce(dup);
    expect((await criar({ mapId: 1, name: 'Q1' })).status).toBe(409);
  });
});

describe('PATCH /api/mapas/quadras/atualizar', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  const atualizar = (body: unknown) =>
    atualizarQuadra(jsonRequest('/api/mapas/quadras/atualizar', 'PATCH', body));

  it('exige id e mapId', async () => {
    expect((await atualizar({ mapId: 1 })).status).toBe(400);
    expect((await atualizar({ id: 1 })).status).toBe(400);
  });

  it('atualiza sem consultar nem alterar o schema', async () => {
    query.mockResolvedValueOnce({ affectedRows: 1 } as never);
    const res = await atualizar({ id: 1, mapId: 2, name: 'Q2', coordinates: [{ lat: 1, lng: 2 }] });
    expect(res.status).toBe(200);
    expect(query).toHaveBeenCalledTimes(1);
    expect(sqlOf(query.mock.calls[0])).toMatch(/^UPDATE blocks SET/);
    expect(sqlOf(query.mock.calls[0])).not.toMatch(/ALTER|INFORMATION_SCHEMA/);
  });

  it('exige o nome da quadra', async () => {
    expect((await atualizar({ id: 1, mapId: 2 })).status).toBe(400);
    expect(query).not.toHaveBeenCalled();
  });

  it('retorna 404 quando nenhuma quadra é alterada', async () => {
    query.mockResolvedValueOnce({ affectedRows: 0 } as never);
    expect((await atualizar({ id: 9, mapId: 2, name: 'Q2' })).status).toBe(404);
  });

  it('retorna 409 para nome repetido no mapa', async () => {
    query.mockRejectedValueOnce(dup);
    expect((await atualizar({ id: 1, mapId: 2, name: 'Q1' })).status).toBe(409);
  });
});
