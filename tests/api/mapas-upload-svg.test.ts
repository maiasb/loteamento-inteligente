import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/mapas/upload-svg/route';
import { NextRequest } from 'next/server';
import { jsonRequest } from '../helpers/db';
import { uploadToCloudinary } from '@/lib/cloudinary';

vi.mock('@/lib/cloudinary', () => ({ uploadToCloudinary: vi.fn() }));

const png = 'data:image/png;base64,AAAA';
const enviar = (payload: unknown) => POST(jsonRequest('/api/mapas/upload-svg', 'POST', payload));

describe('POST /api/mapas/upload-svg', () => {
  beforeEach(() => {
    vi.mocked(uploadToCloudinary).mockReset();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('exige dataUrl e mapId', async () => {
    expect((await enviar({ mapId: 1 })).status).toBe(400);
    expect((await enviar({ dataUrl: png })).status).toBe(400);
  });

  it('rejeita mapId que não seja numérico', async () => {
    expect((await enviar({ dataUrl: png, mapId: '1/../x' })).status).toBe(400);
    expect((await enviar({ dataUrl: png, mapId: 'abc' })).status).toBe(400);
    expect(uploadToCloudinary).not.toHaveBeenCalled();
  });

  it('rejeita dataUrl acima de 10 MB com 413', async () => {
    const grande = `data:image/png;base64,${'A'.repeat(10 * 1024 * 1024)}`;
    expect((await enviar({ dataUrl: grande, mapId: 1 })).status).toBe(413);
    expect(uploadToCloudinary).not.toHaveBeenCalled();
  });

  it('rejeita cedo pelo content-length sem ler o corpo', async () => {
    const request = new NextRequest('http://localhost/api/mapas/upload-svg', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'content-length': String(11 * 1024 * 1024) },
      body: JSON.stringify({ dataUrl: png, mapId: 1 }),
    });
    const json = vi.spyOn(request, 'json');
    expect((await POST(request)).status).toBe(413);
    expect(json).not.toHaveBeenCalled();
    expect(uploadToCloudinary).not.toHaveBeenCalled();
  });

  it('rejeita tipos fora da lista e dataUrl que não seja texto', async () => {
    expect((await enviar({ dataUrl: 'data:text/html;base64,AAAA', mapId: 1 })).status).toBe(400);
    expect((await enviar({ dataUrl: 'data:image/gif;base64,AAAA', mapId: 1 })).status).toBe(400);
    expect((await enviar({ dataUrl: { a: 1 }, mapId: 1 })).status).toBe(400);
    expect(uploadToCloudinary).not.toHaveBeenCalled();
  });

  it('envia imagem válida ao Cloudinary', async () => {
    vi.mocked(uploadToCloudinary).mockResolvedValue({ url: 'https://x/y.png', publicId: 'y' });
    const res = await enviar({ dataUrl: png, mapId: 7 });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ url: 'https://x/y.png', publicId: 'y' });
    expect(vi.mocked(uploadToCloudinary).mock.calls[0][1]?.allowedFormats).toEqual([
      'png',
      'jpg',
      'jpeg',
      'webp',
      'svg',
    ]);
  });

  it('não vaza detalhes do erro interno', async () => {
    vi.mocked(uploadToCloudinary).mockRejectedValue(new Error('api_secret=segredo'));
    const res = await enviar({ dataUrl: png, mapId: 7 });
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json).toEqual({ error: 'Erro ao fazer upload da imagem' });
    expect(JSON.stringify(json)).not.toContain('segredo');
  });
});
