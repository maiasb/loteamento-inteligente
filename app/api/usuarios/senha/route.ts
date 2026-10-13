import { NextRequest, NextResponse } from 'next/server';
import type { RowDataPacket } from 'mysql2/promise';
import { executeQuery } from '@/lib/db';
import { requireUser } from '@/lib/auth/guard';
import {
  hashPassword,
  PASSWORD_MAX_LENGTH,
  validatePasswordPolicy,
  verifyPassword,
} from '@/lib/auth/password';
import {
  RATE_LIMITS,
  checkRateLimit,
  clearAttempts,
  rateLimitedResponse,
  recordAttempt,
} from '@/lib/auth/rate-limit';
import { errorResponse, getClientIp, getUserAgent, readJsonBody } from '@/lib/auth/request';
import { createSession, revokeUserSessions, setSessionCookie } from '@/lib/auth/session';
import { withTransaction } from '@/lib/auth/accounts';

export const dynamic = 'force-dynamic';

/**
 * POST /api/usuarios/senha  { currentPassword, newPassword }
 * Troca da PRÓPRIA senha (conta da sessão; userId do corpo/URL é ignorado). Exige a senha atual
 * (a provisória, no primeiro acesso). Revoga todas as sessões e abre uma nova com token novo.
 */
export async function POST(request: NextRequest) {
  const auth = await requireUser(request, { allowPasswordChange: true });
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await readJsonBody(request);
    const { currentPassword, newPassword } = body ?? {};
    if (
      typeof currentPassword !== 'string' ||
      typeof newPassword !== 'string' ||
      !currentPassword
    ) {
      return errorResponse('Senha atual e nova senha são obrigatórias', 400);
    }

    const policyError = validatePasswordPolicy(newPassword, auth.user.cpf);
    if (policyError) return errorResponse(policyError, 400);
    if (newPassword === currentPassword) {
      return errorResponse('A nova senha deve ser diferente da atual.', 400);
    }

    const subject = String(auth.user.id);
    const limit = await checkRateLimit(RATE_LIMITS.passwordChange, subject);
    if (!limit.allowed) return rateLimitedResponse(limit.retryAfter);

    const rows = await executeQuery<RowDataPacket[]>('SELECT password FROM users WHERE id = ?', [
      auth.user.id,
    ]);
    const currentOk =
      currentPassword.length <= PASSWORD_MAX_LENGTH &&
      rows[0] !== undefined &&
      (await verifyPassword(currentPassword, String(rows[0].password)));
    if (!currentOk) {
      await recordAttempt(RATE_LIMITS.passwordChange, subject);
      return errorResponse('Senha atual incorreta.', 403);
    }

    const hashedPassword = await hashPassword(newPassword);
    const token = await withTransaction(async (connection) => {
      await connection.execute(
        'UPDATE users SET password = ?, first_login = 0, updated_at = NOW() WHERE id = ?',
        [hashedPassword, auth.user.id]
      );
      await revokeUserSessions(auth.user.id, connection);
      return createSession(
        auth.user.id,
        { ip: getClientIp(request), userAgent: getUserAgent(request) },
        connection
      );
    });
    await clearAttempts(RATE_LIMITS.passwordChange, subject);

    const response = NextResponse.json({ success: true, message: 'Senha atualizada com sucesso' });
    setSessionCookie(response, token);
    return response;
  } catch (error) {
    console.error('[API /usuarios/senha] Erro:', error instanceof Error ? error.message : error);
    return errorResponse('Erro ao atualizar a senha', 500);
  }
}
