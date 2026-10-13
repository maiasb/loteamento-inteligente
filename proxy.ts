import { NextRequest, NextResponse } from 'next/server';

const ORIGENS_DEV = ['http://localhost:3000', 'http://127.0.0.1:3000'];

// Lista fechada: ALLOWED_ORIGINS (separadas por vírgula) + NEXT_PUBLIC_SITE_URL; localhost só em dev.
function getAllowedOrigins(): string[] {
  const configuradas = [process.env.ALLOWED_ORIGINS, process.env.NEXT_PUBLIC_SITE_URL]
    .flatMap((valor) => (valor ? valor.split(',') : []))
    .map((valor) => valor.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  const dev = process.env.NODE_ENV === 'production' ? [] : ORIGENS_DEV;
  return [...dev, ...configuradas];
}

function getCorsHeaders(origin: string | null) {
  const headers: Record<string, string> = {};

  // Requisições same-origin não enviam Origin; origem desconhecida não recebe nenhum header CORS.
  if (origin && getAllowedOrigins().includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Credentials'] = 'true';
    headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, PATCH, OPTIONS';
    headers['Access-Control-Allow-Headers'] =
      'Content-Type, Authorization, X-Requested-With, Accept';
    headers['Access-Control-Max-Age'] = '86400';
    headers['Vary'] = 'Origin';
  }

  return headers;
}

export function proxy(request: NextRequest) {
  const origin = request.headers.get('origin');
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/api/')) {
    if (request.method === 'OPTIONS') {
      return new NextResponse(null, {
        status: 204,
        headers: getCorsHeaders(origin),
      });
    }

    const response = NextResponse.next();
    Object.entries(getCorsHeaders(origin)).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*'],
};
