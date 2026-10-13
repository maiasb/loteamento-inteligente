import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/guard';
import { errorResponse, readJsonBody } from '@/lib/auth/request';
import { ADMIN_ROLES, canAssignRole, isUserRole } from '@/lib/auth/roles';
import { UserRole } from '@/types';
import {
  guardLastActiveDev,
  lockManageableTarget,
  parseUserId,
  withTransaction,
} from '@/lib/auth/accounts';

export const dynamic = 'force-dynamic';

/**
 * PUT /api/usuarios/role  { idUsuario, role } (admin/dev). Ninguém altera o próprio papel; admin
 * só atribui vendedor/admin; o último dev ativo não pode ser rebaixado. Não revoga sessões: o
 * papel é relido do banco a cada requisição.
 */
export async function PUT(request: NextRequest) {
  const auth = await requireRole(request, ADMIN_ROLES);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await readJsonBody(request);
    const targetId = parseUserId(body?.idUsuario);
    if (!targetId || !body?.role) {
      return errorResponse('idUsuario e role são obrigatórios', 400);
    }
    if (!isUserRole(body.role)) {
      return errorResponse('role deve ser "dev", "admin" ou "vendedor"', 400);
    }
    const newRole = body.role;
    if (!canAssignRole(auth.user.role, newRole)) {
      return errorResponse('Você não tem permissão para atribuir este perfil.', 403);
    }

    return await withTransaction(async (connection) => {
      const locked = await lockManageableTarget(connection, auth.user, targetId);
      if ('response' in locked) return locked.response;

      if (newRole !== UserRole.DEV) {
        const blocked = await guardLastActiveDev(connection, locked.target);
        if (blocked) return blocked;
      }

      await connection.execute('UPDATE users SET role = ?, updated_at = NOW() WHERE id = ?', [
        newRole,
        targetId,
      ]);
      return NextResponse.json({
        message: 'Cargo do usuário atualizado com sucesso',
        oldRole: locked.target.role,
        newRole,
      });
    });
  } catch (error) {
    console.error('[API /usuarios/role] Erro:', error instanceof Error ? error.message : error);
    return errorResponse('Erro ao atualizar cargo do usuário', 500);
  }
}
