import { NextRequest, NextResponse } from 'next/server';
import { assertSameOrigin, errorResponse } from '@/lib/auth/request';
import { clearSessionCookie, readSessionToken, revokeSessionByToken } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

/** POST /api/usuarios/logout: idempotente (sem sessão também responde 200). */
export async function POST(request: NextRequest) {
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;

  try {
    const token = readSessionToken(request);
    if (token) await revokeSessionByToken(token);
    const response = NextResponse.json({ success: true });
    clearSessionCookie(response);
    return response;
  } catch (error) {
    console.error('[API /usuarios/logout] Erro:', error instanceof Error ? error.message : error);
    return errorResponse('Erro ao sair', 500);
  }
}
