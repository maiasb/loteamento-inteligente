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

/** PUT /api/usuarios/aprovar  { idUsuario, status: 'approved' | 'rejected' } (admin/dev). */
export async function PUT(request: NextRequest) {
  const auth = await requireRole(request, ADMIN_ROLES);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await readJsonBody(request);
    const targetId = parseUserId(body?.idUsuario);
    const status = body?.status;
    if (!targetId || !status) {
      return errorResponse('idUsuario e status são obrigatórios', 400);
    }
    if (status !== 'approved' && status !== 'rejected') {
      return errorResponse('status deve ser "approved" ou "rejected"', 400);
    }

    return await withTransaction(async (connection) => {
      const locked = await lockManageableTarget(connection, auth.user, targetId);
      if ('response' in locked) return locked.response;

      if (status === 'rejected') {
        const blocked = await guardLastActiveDev(connection, locked.target);
        if (blocked) return blocked;
      }

      await connection.execute('UPDATE users SET status = ?, updated_at = NOW() WHERE id = ?', [
        status,
        targetId,
      ]);
      if (status === 'rejected') await revokeUserSessions(targetId, connection);

      return NextResponse.json({
        message: `Usuário ${status === 'approved' ? 'aprovado' : 'rejeitado'} com sucesso`,
        status,
      });
    });
  } catch (error) {
    console.error('[API /usuarios/aprovar] Erro:', error instanceof Error ? error.message : error);
    return errorResponse('Erro ao atualizar status do usuário', 500);
  }
}
