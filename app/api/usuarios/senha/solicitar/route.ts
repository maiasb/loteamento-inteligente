import { NextRequest, NextResponse } from 'next/server';
import type { RowDataPacket } from 'mysql2/promise';
import { executeQuery } from '@/lib/db';
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

export const dynamic = 'force-dynamic';

const GENERIC_MESSAGE =
  'Se os dados conferem, o administrador foi avisado. Ele vai confirmar a sua identidade e entregar um código.';

/**
 * POST /api/usuarios/senha/solicitar  { cpf, email }
 * Abre um pedido de redefinição para o admin/dev atender (RN-18a). A resposta é SEMPRE a mesma,
 * exista a conta ou não; CPF e e-mail só localizam a conta, não provam identidade, e nada
 * (código, token, id) volta para quem pediu.
 */
export async function POST(request: NextRequest) {
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;

  try {
    const body = await readJsonBody(request);
    const cpf = onlyDigits(body?.cpf);
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (cpf.length !== 11 || !email || email.length > 100) {
      return errorResponse('Informe o CPF e o e-mail cadastrados.', 400);
    }

    const ip = getClientIp(request);
    const limit = await checkRateLimits([
      [RATE_LIMITS.resetRequestCpf, cpf],
      [RATE_LIMITS.resetRequestIp, ip],
    ]);
    if (!limit.allowed) return rateLimitedResponse(limit.retryAfter);
    await recordAttempt(RATE_LIMITS.resetRequestCpf, cpf);
    await recordAttempt(RATE_LIMITS.resetRequestIp, ip);

    const users = await executeQuery<RowDataPacket[]>(
      `SELECT id FROM users
        WHERE cpf = ? AND email = ? AND status = 'approved' AND active = 1`,
      [cpf, email]
    );

    if (users[0]) {
      const userId = users[0].id;
      // Código emitido e vencido libera a vaga (o UNIQUE só admite um pedido aberto por conta).
      await executeQuery(
        `UPDATE password_reset_requests SET status = 'expired', closed_at = NOW()
          WHERE user_id = ? AND status = 'issued' AND expires_at <= NOW()`,
        [userId]
      );
      try {
        await executeQuery(
          'INSERT INTO password_reset_requests (user_id, requested_ip) VALUES (?, ?)',
          [userId, ip]
        );
      } catch (error) {
        // Já existe um pedido aberto para a conta: ignora, com a mesma resposta.
        if ((error as NodeJS.ErrnoException).code !== 'ER_DUP_ENTRY') throw error;
      }
    }

    return NextResponse.json({ message: GENERIC_MESSAGE });
  } catch (error) {
    console.error(
      '[API /usuarios/senha/solicitar] Erro:',
      error instanceof Error ? error.message : error
    );
    return errorResponse('Não foi possível registrar o pedido. Tente novamente.', 500);
  }
}
