import { createHash } from 'crypto';
import { isIP } from 'net';
import { NextRequest, NextResponse } from 'next/server';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function errorResponse(
  error: string,
  status: number,
  extra: Record<string, unknown> = {},
  headers?: Record<string, string>
): NextResponse {
  return NextResponse.json({ error, ...extra }, { status, headers });
}

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/**
 * IP do cliente. Os cabeçalhos x-forwarded-for / x-real-ip só são confiáveis atrás do proxy da
 * Vercel (que os sobrescreve); fora dela qualquer cliente poderia forjá-los para fugir do limite
 * de tentativas, então todos caem no mesmo balde 'local'.
 */
export function getClientIp(request: NextRequest): string {
  if (!process.env.VERCEL) return 'local';
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const candidate = forwarded || request.headers.get('x-real-ip')?.trim();
  return candidate && isIP(candidate) ? candidate : 'unknown';
}

export function getUserAgent(request: NextRequest): string | null {
  return request.headers.get('user-agent')?.slice(0, 255) || null;
}

function allowedOrigins(request: NextRequest): string[] {
  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, '');
  return [request.nextUrl.origin, ...(site ? [site] : [])];
}

/**
 * Defesa CSRF em métodos que mudam estado (POST/PUT/PATCH/DELETE): exige Sec-Fetch-Site
 * same-origin ou Origin igual à origem da aplicação. Sem nenhum dos dois, recusa.
 * Devolve a resposta 403 ou null se a requisição pode seguir.
 */
export function assertSameOrigin(request: NextRequest): NextResponse | null {
  if (SAFE_METHODS.has(request.method)) return null;

  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite) {
    if (fetchSite === 'same-origin') return null;
  } else {
    const origin = request.headers.get('origin');
    if (origin && allowedOrigins(request).includes(origin)) return null;
  }
  return errorResponse('Requisição não permitida.', 403, { code: 'CSRF' });
}

/** Lê o corpo JSON; devolve null se ausente, inválido ou não for um objeto. */
export async function readJsonBody(request: NextRequest): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json();
    return body && typeof body === 'object' && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export function onlyDigits(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\D/g, '') : '';
}
