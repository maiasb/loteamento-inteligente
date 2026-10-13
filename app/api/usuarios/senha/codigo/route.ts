import { NextRequest, NextResponse } from 'next/server';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { requireRole } from '@/lib/auth/guard';
import { errorResponse, readJsonBody } from '@/lib/auth/request';
import { ADMIN_ROLES, canManageAccount } from '@/lib/auth/roles';
import {
  RESET_CODE_TTL_MINUTES,
  generateResetCode,
  hashResetCode,
  normalizeResetCode,
} from '@/lib/auth/reset-code';
import { parseUserId } from '@/lib/auth/accounts';
import { executeQuery } from '@/lib/db';
import { UserRole } from '@/types';

export const dynamic = 'force-dynamic';

/**
 * POST /api/usuarios/senha/codigo  { requestId } (admin/dev)
 * Emite o código de uso único (15 min) de um pedido, depois de o admin confirmar a identidade
 * por fora do sistema. O código aparece UMA vez nesta resposta; no banco fica só o hash. Emitir
 * de novo para o mesmo pedido substitui o código anterior.
 */
export async function POST(request: NextRequest) {
  const auth = await requireRole(request, ADMIN_ROLES);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await readJsonBody(request);
    const requestId = parseUserId(body?.requestId);
    if (!requestId) return errorResponse('requestId é obrigatório', 400);

    const rows = await executeQuery<RowDataPacket[]>(
      `SELECT r.id, r.status, r.expires_at > NOW() AS still_valid, u.id AS user_id, u.name, u.role
         FROM password_reset_requests r
         JOIN users u ON u.id = r.user_id
        WHERE r.id = ?`,
      [requestId]
    );
    const found = rows[0];
    const issuable =
      found && (found.status === 'open' || (found.status === 'issued' && found.still_valid));
    if (!found || !issuable) return errorResponse('Pedido não encontrado ou já encerrado', 404);

    const target = { id: Number(found.user_id), role: found.role as UserRole };
    if (!canManageAccount(auth.user, target)) {
      return errorResponse('Você não tem permissão para atender este pedido.', 403);
    }

    const code = generateResetCode();
    const normalized = normalizeResetCode(code) as string;
    const result = await executeQuery<ResultSetHeader>(
      `UPDATE password_reset_requests
          SET status = 'issued', code_hash = ?, issued_by = ?, issued_at = NOW(),
              expires_at = DATE_ADD(NOW(), INTERVAL ? MINUTE), failed_attempts = 0
        WHERE id = ? AND (status = 'open' OR (status = 'issued' AND expires_at > NOW()))`,
      [hashResetCode(requestId, normalized), auth.user.id, RESET_CODE_TTL_MINUTES, requestId]
    );
    if (result.affectedRows === 0) {
      return errorResponse('Pedido não encontrado ou já encerrado', 404);
    }

    return NextResponse.json(
      { code, expiresInMinutes: RESET_CODE_TTL_MINUTES, userName: found.name },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error(
      '[API /usuarios/senha/codigo] Erro:',
      error instanceof Error ? error.message : error
    );
    return errorResponse('Erro ao emitir o código', 500);
  }
}
