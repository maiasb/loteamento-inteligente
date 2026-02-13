import { NextRequest, NextResponse } from 'next/server';

// Origens permitidas
const allowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://82.25.66.222:3000',
  'http://82.25.66.222',
  'https://82.25.66.222',
];

// Adicionar domínios customizados se existirem
if (process.env.NEXT_PUBLIC_SITE_URL) {
  allowedOrigins.push(process.env.NEXT_PUBLIC_SITE_URL);
}

function getCorsHeaders(origin: string | null) {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Accept, Origin',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400', // 24 horas de cache para preflight
  };

  // Se a origem está na lista, permite ela especificamente
  if (origin && allowedOrigins.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  } else if (!origin) {
    // Requisições same-origin não enviam Origin header
    headers['Access-Control-Allow-Origin'] = '*';
  } else {
    // Para origens não listadas, permitir (ajuste conforme necessário)
    headers['Access-Control-Allow-Origin'] = origin;
  }

  return headers;
}

export function proxy(request: NextRequest) {
  const origin = request.headers.get('origin');
  const { pathname } = request.nextUrl;

  // Apenas aplicar CORS nas rotas de API
  if (pathname.startsWith('/api/')) {
    // Responder imediatamente a preflight requests (OPTIONS)
    if (request.method === 'OPTIONS') {
      return new NextResponse(null, {
        status: 204,
        headers: getCorsHeaders(origin),
      });
    }

    // Para outros métodos, adicionar headers CORS na resposta
    const response = NextResponse.next();
    const corsHeaders = getCorsHeaders(origin);
    
    Object.entries(corsHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Aplicar middleware em todas as rotas de API
    '/api/:path*',
  ],
};
