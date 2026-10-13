import { NextRequest, NextResponse } from 'next/server';
import type { RowDataPacket } from 'mysql2/promise';
import { executeQuery } from '@/lib/db';
import { DUMMY_PASSWORD_HASH, PASSWORD_MAX_LENGTH, verifyPassword } from '@/lib/auth/password';
import {
  RATE_LIMITS,
  checkRateLimits,
  clearAttempts,
  rateLimitedResponse,
  recordAttempt,
} from '@/lib/auth/rate-limit';
import {
  assertSameOrigin,
  errorResponse,
  getClientIp,
  getUserAgent,
  onlyDigits,
  readJsonBody,
} from '@/lib/auth/request';
import {
  cleanupAuthData,
  createSession,
  readSessionToken,
  revokeSessionByToken,
  rowToSessionUser,
  setSessionCookie,
  toPublicUser,
} from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

const INVALID_CREDENTIALS = 'CPF ou senha inválidos';

/** POST /api/usuarios/login  { cpf, password }  (CPF e senha nunca na URL). */
export async function POST(request: NextRequest) {
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;

  try {
    const body = await readJsonBody(request);
    const cpf = onlyDigits(body?.cpf);
    const password = body?.password;
    if (!body || cpf.length !== 11 || typeof password !== 'string' || password.length === 0) {
      return errorResponse('CPF e senha são obrigatórios', 400);
    }

    const ip = getClientIp(request);
    const limit = await checkRateLimits([
      [RATE_LIMITS.loginCpf, cpf],
      [RATE_LIMITS.loginIp, ip],
    ]);
    if (!limit.allowed) return rateLimitedResponse(limit.retryAfter);

    const rows = await executeQuery<RowDataPacket[]>(
      `SELECT id, cpf, name, email, phone, creci, role, status, active, first_login,
              theme_preference, password
         FROM users WHERE cpf = ?`,
      [cpf]
    );
    const row = rows[0];

    // O hash é verificado também quando o CPF não existe (hash dummy): mesmo tempo de resposta.
    const passwordOk =
      password.length <= PASSWORD_MAX_LENGTH &&
      (await verifyPassword(password, row ? String(row.password) : DUMMY_PASSWORD_HASH));

    if (!row || !passwordOk) {
      await recordAttempt(RATE_LIMITS.loginCpf, cpf);
      await recordAttempt(RATE_LIMITS.loginIp, ip);
      return errorResponse(INVALID_CREDENTIALS, 401);
    }

    // Mensagens específicas só depois de a senha estar correta (RN-10).
    if (row.status !== 'approved') {
      return errorResponse('Usuário aguardando aprovação ou foi rejeitado', 403);
    }
    if (!row.active) {
      return errorResponse('Sua conta foi desativada. Entre em contato com o administrador.', 403);
    }

    // Fixação de sessão: nunca reaproveita o cookie recebido; a sessão antiga é revogada (RN-05).
    const previousToken = readSessionToken(request);
    if (previousToken) await revokeSessionByToken(previousToken);

    const token = await createSession(Number(row.id), { ip, userAgent: getUserAgent(request) });
    await executeQuery('UPDATE users SET last_login_at = NOW() WHERE id = ?', [row.id]);
    await clearAttempts(RATE_LIMITS.loginCpf, cpf);
    await cleanupAuthData().catch((error) =>
      console.error(
        '[API /usuarios/login] Falha na limpeza:',
        error instanceof Error ? error.message : error
      )
    );

    const response = NextResponse.json({ user: toPublicUser(rowToSessionUser(row)) });
    setSessionCookie(response, token);
    return response;
  } catch (error) {
    console.error('[API /usuarios/login] Erro:', error instanceof Error ? error.message : error);
    return errorResponse('Erro ao fazer login', 500);
  }
}
