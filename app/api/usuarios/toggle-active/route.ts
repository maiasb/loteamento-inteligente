import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/guard';
import { errorResponse, readJsonBody } from '@/lib/auth/request';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { revokeUserSessions } from '@/lib/auth/session';
import {
  guardLastActiveDev,
  lockManageableTarget,
  parseUserId,
  withTransaction,
} from '@/lib/auth/accounts';

export const dynamic = 'force-dynamic';

/** PUT /api/usuarios/toggle-active  { userId, active: boolean } (admin/dev). */
export async function PUT(request: NextRequest) {
  const auth = await requireRole(request, ADMIN_ROLES);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await readJsonBody(request);
    const targetId = parseUserId(body?.userId);
    if (!targetId) return errorResponse('ID do usuário é obrigatório', 400);
    if (typeof body?.active !== 'boolean') {
      return errorResponse('O campo active deve ser true ou false', 400);
    }
    const active = body.active;

    return await withTransaction(async (connection) => {
      const locked = await lockManageableTarget(connection, auth.user, targetId);
      if ('response' in locked) return locked.response;

      if (!active) {
        const blocked = await guardLastActiveDev(connection, locked.target);
        if (blocked) return blocked;
      }

      await connection.execute('UPDATE users SET active = ?, updated_at = NOW() WHERE id = ?', [
        active ? 1 : 0,
        targetId,
      ]);
      if (!active) await revokeUserSessions(targetId, connection);

      return NextResponse.json({
        message: `Usuário ${active ? 'ativado' : 'desativado'} com sucesso`,
        active,
      });
    });
  } catch (error) {
    console.error(
      '[API /usuarios/toggle-active] Erro:',
      error instanceof Error ? error.message : error
    );
    return errorResponse('Erro ao atualizar status do usuário', 500);
  }
}
