import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/guard';
import { errorResponse, readJsonBody } from '@/lib/auth/request';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import {
  guardLastActiveDev,
  lockManageableTarget,
  parseUserId,
  withTransaction,
} from '@/lib/auth/accounts';

export const dynamic = 'force-dynamic';

/** DELETE /api/usuarios/excluir  { userId } (admin/dev). Sessões saem em cascata (FK). */
export async function DELETE(request: NextRequest) {
  const auth = await requireRole(request, ADMIN_ROLES);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await readJsonBody(request);
    const targetId = parseUserId(body?.userId);
    if (!targetId) return errorResponse('ID do usuário é obrigatório', 400);

    return await withTransaction(async (connection) => {
      const locked = await lockManageableTarget(connection, auth.user, targetId);
      if ('response' in locked) return locked.response;

      const blocked = await guardLastActiveDev(connection, locked.target);
      if (blocked) return blocked;

      await connection.execute('DELETE FROM users WHERE id = ?', [targetId]);
      return NextResponse.json({ message: 'Usuário excluído com sucesso' });
    });
  } catch (error) {
    console.error('[API /usuarios/excluir] Erro:', error instanceof Error ? error.message : error);
    return errorResponse('Erro ao excluir usuário', 500);
  }
}
