import { NextRequest, NextResponse } from 'next/server';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { executeQuery } from '@/lib/db';
import { requireRole } from '@/lib/auth/guard';
import { hashPassword, validatePasswordPolicy } from '@/lib/auth/password';
import { errorResponse, readJsonBody } from '@/lib/auth/request';
import { ADMIN_ROLES, canAssignRole, isUserRole } from '@/lib/auth/roles';
import { parseUserFields } from '@/lib/auth/user-input';

export const dynamic = 'force-dynamic';

/** GET /api/usuarios: lista de usuários (admin/dev). */
export async function GET(request: NextRequest) {
  const auth = await requireRole(request, ADMIN_ROLES);
  if (auth instanceof NextResponse) return auth;

  try {
    const rows = await executeQuery<RowDataPacket[]>(
      `SELECT id, cpf, name, email, phone, creci, role, status, active, created_at, updated_at
         FROM users ORDER BY created_at DESC`
    );
    const users = rows.map((user) => ({ ...user, active: Boolean(user.active) }));
    return NextResponse.json(users, { status: 200 });
  } catch (error) {
    console.error('[API /usuarios GET] Erro:', error instanceof Error ? error.message : error);
    return errorResponse('Erro ao buscar usuários', 500);
  }
}

/**
 * POST /api/usuarios: criação por admin/dev. Papel conforme a hierarquia (admin não cria dev).
 * A conta nasce aprovada, com troca de senha obrigatória no primeiro acesso.
 */
export async function POST(request: NextRequest) {
  const auth = await requireRole(request, ADMIN_ROLES);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await readJsonBody(request);
    if (!body) return errorResponse('Dados inválidos', 400);

    const fields = parseUserFields(body);
    if (!fields.ok) return errorResponse(fields.error, 400);

    if (!isUserRole(body.role)) return errorResponse('Perfil inválido', 400);
    if (!canAssignRole(auth.user.role, body.role)) {
      return errorResponse('Você não tem permissão para criar este perfil.', 403);
    }

    const passwordError = validatePasswordPolicy(body.password, fields.data.cpf);
    if (passwordError) return errorResponse(passwordError, 400);
    const hashedPassword = await hashPassword(body.password as string);

    const { name, email, cpf, phone, creci } = fields.data;
    const result = await executeQuery<ResultSetHeader>(
      `INSERT INTO users (name, email, cpf, phone, creci, role, status, password, first_login)
       VALUES (?, ?, ?, ?, ?, ?, 'approved', ?, 1)`,
      [name, email, cpf, phone, creci, body.role, hashedPassword]
    );

    return NextResponse.json(
      {
        message: 'Usuário criado com sucesso',
        user: { id: result.insertId, name, email, cpf, phone, creci, role: body.role },
      },
      { status: 201 }
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ER_DUP_ENTRY') {
      return errorResponse('CPF ou email já cadastrado', 409);
    }
    console.error('[API /usuarios POST] Erro:', error instanceof Error ? error.message : error);
    return errorResponse('Erro ao criar usuário', 500);
  }
}
