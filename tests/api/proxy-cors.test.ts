import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy } from '@/proxy';

const req = (origin?: string, method = 'GET') =>
  new NextRequest('http://localhost/api/mapas', {
    method,
    headers: origin ? { origin } : {},
  });

describe('CORS do proxy', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('não libera origem desconhecida nem usa curinga', () => {
    vi.stubEnv('ALLOWED_ORIGINS', 'https://app.exemplo.com');
    for (const r of [req('https://evil.example'), req('https://evil.example', 'OPTIONS'), req()]) {
      const res = proxy(r);
      expect(res.headers.get('access-control-allow-origin')).toBeNull();
      expect(res.headers.get('access-control-allow-credentials')).toBeNull();
    }
  });

  it('libera só a origem configurada, com Vary', () => {
    vi.stubEnv('ALLOWED_ORIGINS', 'https://app.exemplo.com, https://www.exemplo.com/');
    const res = proxy(req('https://www.exemplo.com', 'OPTIONS'));
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe('https://www.exemplo.com');
    expect(res.headers.get('vary')).toBe('Origin');
  });

  it('localhost só é aceito fora de produção', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(
      proxy(req('http://localhost:3000')).headers.get('access-control-allow-origin')
    ).toBeNull();
    vi.stubEnv('NODE_ENV', 'development');
    expect(proxy(req('http://localhost:3000')).headers.get('access-control-allow-origin')).toBe(
      'http://localhost:3000'
    );
  });
});
