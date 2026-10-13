import { NextRequest, NextResponse } from 'next/server';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { executeQuery } from '@/lib/db';
import { hashPassword, validatePasswordPolicy } from '@/lib/auth/password';
import {
  RATE_LIMITS,
  checkRateLimits,
  rateLimitedResponse,
  recordAttempt,
} from '@/lib/auth/rate-limit';
import {
  assertSameOrigin,
  errorResponse,
  getClientIp,
  onlyDigits,
  readJsonBody,
} from '@/lib/auth/request';
import {
  RESET_CODE_MAX_ATTEMPTS,
  hashResetCode,
  normalizeResetCode,
  resetCodeMatches,
} from '@/lib/auth/reset-code';
import { revokeUserSessions } from '@/lib/auth/session';
import { withTransaction } from '@/lib/auth/accounts';

export const dynamic = 'force-dynamic';

const INVALID_CODE = 'Código inválido ou expirado. Peça um novo ao administrador.';

/**
 * POST /api/usuarios/senha/redefinir  { cpf, code, newPassword }
 * O usuário define a própria senha com o código de uso único emitido por admin/dev. Erro único
 * para CPF inexistente, código errado, vencido ou já usado. Sem userId em nenhuma direção.
 */
export async function POST(request: NextRequest) {
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;

  try {
    const body = await readJsonBody(request);
    const cpf = onlyDigits(body?.cpf);
    const code = normalizeResetCode(body?.code);
    if (cpf.length !== 11 || typeof body?.newPassword !== 'string' || !body.code) {
      return errorResponse('Informe o CPF, o código e a nova senha.', 400);
    }

    // Política antes de consumir o código: senha fraca não gasta o código (RN-18d).
    const policyError = validatePasswordPolicy(body.newPassword, cpf);
    if (policyError) return errorResponse(policyError, 400);

    const ip = getClientIp(request);
    const limit = await checkRateLimits([
      [RATE_LIMITS.resetCodeCpf, cpf],
      [RATE_LIMITS.resetCodeIp, ip],
    ]);
    if (!limit.allowed) return rateLimitedResponse(limit.retryAfter);

    const rows = await executeQuery<RowDataPacket[]>(
      `SELECT r.id, r.code_hash, r.user_id
         FROM password_reset_requests r
         JOIN users u ON u.id = r.user_id
        WHERE u.cpf = ? AND u.status = 'approved' AND u.active = 1
          AND r.status = 'issued' AND r.expires_at > NOW() AND r.failed_attempts < ?`,
      [cpf, RESET_CODE_MAX_ATTEMPTS]
    );
    const found = rows[0];

    const codeOk =
      found !== undefined &&
      code !== null &&
      resetCodeMatches(String(found.code_hash), hashResetCode(found.id, code));

    if (!found || !codeOk) {
      await recordAttempt(RATE_LIMITS.resetCodeCpf, cpf);
      await recordAttempt(RATE_LIMITS.resetCodeIp, ip);
      if (found) {
        // A atribuição de status vem antes do incremento: usa o valor antigo (MySQL avalia da
        // esquerda para a direita). Na 5ª falha o código é invalidado.
        await executeQuery(
          `UPDATE password_reset_requests
              SET status = IF(failed_attempts + 1 >= ?, 'expired', status),
                  closed_at = IF(failed_attempts + 1 >= ?, NOW(), closed_at),
                  failed_attempts = failed_attempts + 1
            WHERE id = ?`,
          [RESET_CODE_MAX_ATTEMPTS, RESET_CODE_MAX_ATTEMPTS, found.id]
        );
      }
      return errorResponse(INVALID_CODE, 400);
    }

    const hashedPassword = await hashPassword(body.newPassword);
    const consumed = await withTransaction(async (connection) => {
      // Uso único e atômico: só um pedido concorrente consegue virar 'used'.
      const [used] = await connection.execute<ResultSetHeader>(
        `UPDATE password_reset_requests SET status = 'used', closed_at = NOW()
          WHERE id = ? AND status = 'issued' AND expires_at > NOW() AND failed_attempts < ?`,
        [found.id, RESET_CODE_MAX_ATTEMPTS]
      );
      if (used.affectedRows === 0) return false;

      await connection.execute(
        'UPDATE users SET password = ?, first_login = 0, updated_at = NOW() WHERE id = ?',
        [hashedPassword, found.user_id]
      );
      await revokeUserSessions(Number(found.user_id), connection);
      return true;
    });
    if (!consumed) return errorResponse(INVALID_CODE, 400);

    return NextResponse.json({ message: 'Senha redefinida com sucesso. Entre com a nova senha.' });
  } catch (error) {
    console.error(
      '[API /usuarios/senha/redefinir] Erro:',
      error instanceof Error ? error.message : error
    );
    return errorResponse('Erro ao redefinir a senha', 500);
  }
}
