import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/api/mapas/migrar-overlay-cloudinary/route';
import { useFakeConnection, type FakeConnection } from '../helpers/db';
import { uploadToCloudinary } from '@/lib/cloudinary';

vi.mock('mysql2/promise', () => ({ default: { createConnection: vi.fn() } }));
vi.mock('@/lib/cloudinary', () => ({ uploadToCloudinary: vi.fn() }));

describe('GET /api/mapas/migrar-overlay-cloudinary', () => {
  let conn: FakeConnection;
  beforeEach(() => {
    conn = useFakeConnection();
    vi.mocked(uploadToCloudinary).mockReset();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('não vaza a mensagem do erro do banco', async () => {
    conn.execute.mockRejectedValueOnce(new Error('senha do banco errada'));
    const res = await GET();
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json).toEqual({ error: 'Erro na migração' });
    expect(JSON.stringify(json)).not.toContain('senha');
  });

  it('não vaza a mensagem do erro do upload por mapa', async () => {
    conn.execute.mockResolvedValueOnce([
      [{ id: 1, overlay_config: JSON.stringify({ imageUrl: 'data:image/png;base64,AAAA' }) }],
    ]);
    vi.mocked(uploadToCloudinary).mockRejectedValue(new Error('api_secret=segredo'));
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.results[0]).toEqual({
      mapId: 1,
      status: 'error',
      error: 'Falha ao migrar o overlay',
    });
    expect(JSON.stringify(json)).not.toContain('segredo');
  });
});
