import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/guard';
import { generateTemporaryPassword, hashPassword } from '@/lib/auth/password';
import { errorResponse, readJsonBody } from '@/lib/auth/request';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { revokeUserSessions } from '@/lib/auth/session';
import { lockManageableTarget, parseUserId, withTransaction } from '@/lib/auth/accounts';

export const dynamic = 'force-dynamic';

/**
 * POST /api/usuarios/reset-password  { userId } (admin/dev).
 * Gera uma senha temporária aleatória, mostrada UMA vez nesta resposta; o usuário é obrigado a
 * trocá-la no primeiro acesso e todas as sessões dele são revogadas.
 */
export async function POST(request: NextRequest) {
  const auth = await requireRole(request, ADMIN_ROLES);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await readJsonBody(request);
    const targetId = parseUserId(body?.userId);
    if (!targetId) return errorResponse('userId é obrigatório', 400);

    const temporaryPassword = generateTemporaryPassword();
    const hashedPassword = await hashPassword(temporaryPassword);

    return await withTransaction(async (connection) => {
      const locked = await lockManageableTarget(connection, auth.user, targetId);
      if ('response' in locked) return locked.response;

      await connection.execute(
        'UPDATE users SET password = ?, first_login = 1, updated_at = NOW() WHERE id = ?',
        [hashedPassword, targetId]
      );
      await revokeUserSessions(targetId, connection);
      await connection.execute(
        `UPDATE password_reset_requests SET status = 'cancelled', closed_at = NOW()
          WHERE user_id = ? AND status IN ('open', 'issued')`,
        [targetId]
      );

      return NextResponse.json(
        { success: true, message: 'Senha resetada com sucesso', temporaryPassword },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    });
  } catch (error) {
    console.error(
      '[API /usuarios/reset-password] Erro:',
      error instanceof Error ? error.message : error
    );
    return errorResponse('Erro ao resetar senha do usuário', 500);
  }
}
