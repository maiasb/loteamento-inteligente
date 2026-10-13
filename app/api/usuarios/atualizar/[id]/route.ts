import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/guard';
import { errorResponse, readJsonBody } from '@/lib/auth/request';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { lockManageableTarget, parseUserId, withTransaction } from '@/lib/auth/accounts';
import { parseUserFields } from '@/lib/auth/user-input';

export const dynamic = 'force-dynamic';

// Alterados só pelas rotas próprias (role, aprovar, toggle-active, senha, reset-password).
const FORBIDDEN_FIELDS = ['password', 'role', 'status', 'active', 'first_login'];

const COLUMNS = ['name', 'email', 'cpf', 'phone', 'creci'] as const;

/** PUT /api/usuarios/atualizar/[id]  corpo JSON: name, email, cpf, phone, creci (admin/dev). */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(request, ADMIN_ROLES);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const targetId = parseUserId(id);
    if (!targetId) return errorResponse('ID do usuário é obrigatório', 400);

    const body = await readJsonBody(request);
    if (!body) return errorResponse('Dados inválidos', 400);
    if (FORBIDDEN_FIELDS.some((field) => field in body)) {
      return errorResponse('Campo não pode ser alterado por esta rota', 400);
    }

    const fields = parseUserFields(body, true);
    if (!fields.ok) return errorResponse(fields.error, 400);

    const updates = COLUMNS.filter((column) => fields.data[column] !== undefined);
    if (updates.length === 0) return errorResponse('Nenhum campo para atualizar', 400);

    return await withTransaction(async (connection) => {
      const locked = await lockManageableTarget(connection, auth.user, targetId, {
        allowSelf: true,
      });
      if ('response' in locked) return locked.response;

      await connection.execute(
        `UPDATE users SET ${updates.map((column) => `${column} = ?`).join(', ')}, updated_at = NOW()
          WHERE id = ?`,
        [...updates.map((column) => fields.data[column] ?? null), targetId]
      );
      return NextResponse.json({ message: 'Usuário atualizado com sucesso' });
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ER_DUP_ENTRY') {
      return errorResponse('E-mail ou CPF já cadastrado', 409);
    }
    console.error(
      '[API /usuarios/atualizar] Erro:',
      error instanceof Error ? error.message : error
    );
    return errorResponse('Erro ao atualizar usuário', 500);
  }
}
