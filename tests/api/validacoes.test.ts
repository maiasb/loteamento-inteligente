import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST as importar } from '@/app/api/mapas/importar/route';
import { jsonRequest, useFakeConnection } from '../helpers/db';

vi.mock('mysql2/promise', () => ({ default: { createConnection: vi.fn() } }));

describe('validações de entrada', () => {
  beforeEach(() => {
    useFakeConnection();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('importação exige nome do mapa e ao menos uma quadra', async () => {
    const semNome = await importar(jsonRequest('/api/mapas/importar', 'POST', { blocks: [{}] }));
    const semQuadras = await importar(
      jsonRequest('/api/mapas/importar', 'POST', { name: 'Mapa', blocks: [] })
    );
    expect(semNome.status).toBe(400);
    expect(semQuadras.status).toBe(400);
  });
});
