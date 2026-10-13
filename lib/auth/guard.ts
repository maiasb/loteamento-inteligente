import { NextRequest, NextResponse } from 'next/server';
import type { UserRole } from '@/types';
import { assertSameOrigin, errorResponse } from './request';
import {
  clearSessionCookie,
  findActiveSession,
  readSessionToken,
  type SessionUser,
} from './session';

export interface AuthSession {
  user: SessionUser;
  sessionId: number;
}

export interface GuardOptions {
  /** Só `me`, `senha` e `logout` ligam isto: permite a sessão com senha provisória (first_login). */
  allowPasswordChange?: boolean;
}

/**
 * Exige sessão válida. Devolve a sessão ou uma NextResponse pronta (401, 403 ou 500) que a rota
 * deve retornar sem alteração:
 *
 *   const auth = await requireUser(request);
 *   if (auth instanceof NextResponse) return auth;
 *
 * Também aplica a checagem CSRF (Origin / Sec-Fetch-Site) em POST/PUT/PATCH/DELETE e bloqueia
 * usuários com senha provisória (403 PASSWORD_CHANGE_REQUIRED), salvo allowPasswordChange.
 */
export async function requireUser(
  request: NextRequest,
  options: GuardOptions = {}
): Promise<AuthSession | NextResponse> {
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;

  const token = readSessionToken(request);
  if (!token) return errorResponse('Sessão inválida ou expirada. Faça login novamente.', 401);

  let session;
  try {
    session = await findActiveSession(token);
  } catch (error) {
    console.error('[auth] Erro ao validar sessão:', error instanceof Error ? error.message : error);
    return errorResponse('Erro ao validar a sessão.', 500);
  }

  if (!session) {
    const response = errorResponse('Sessão inválida ou expirada. Faça login novamente.', 401);
    clearSessionCookie(response);
    return response;
  }

  if (session.user.firstLogin && !options.allowPasswordChange) {
    return errorResponse('É necessário trocar a senha provisória antes de continuar.', 403, {
      code: 'PASSWORD_CHANGE_REQUIRED',
    });
  }

  return session;
}

/** Como requireUser, e exige que o papel do usuário (lido do banco) esteja em `roles`. */
export async function requireRole(
  request: NextRequest,
  roles: readonly UserRole[],
  options: GuardOptions = {}
): Promise<AuthSession | NextResponse> {
  const auth = await requireUser(request, options);
  if (auth instanceof NextResponse) return auth;
  if (!roles.includes(auth.user.role)) {
    return errorResponse('Você não tem permissão para esta ação.', 403);
  }
  return auth;
}
