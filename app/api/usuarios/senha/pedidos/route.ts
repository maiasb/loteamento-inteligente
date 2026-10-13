import { NextRequest, NextResponse } from 'next/server';
import type { RowDataPacket } from 'mysql2/promise';
import { executeQuery } from '@/lib/db';
import { requireRole } from '@/lib/auth/guard';
import { errorResponse } from '@/lib/auth/request';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { UserRole } from '@/types';

export const dynamic = 'force-dynamic';

/**
 * GET /api/usuarios/senha/pedidos: pedidos de redefinição abertos ou com código ainda válido
 * (admin/dev). Admin não vê pedidos de contas dev (RN-14).
 */
export async function GET(request: NextRequest) {
  const auth = await requireRole(request, ADMIN_ROLES);
  if (auth instanceof NextResponse) return auth;

  try {
    const onlyNonDev = auth.user.role !== UserRole.DEV;
    const rows = await executeQuery<RowDataPacket[]>(
      `SELECT r.id, r.status, r.created_at, r.expires_at,
              u.name, u.email, u.phone, u.cpf, u.role
         FROM password_reset_requests r
         JOIN users u ON u.id = r.user_id
        WHERE (r.status = 'open' OR (r.status = 'issued' AND r.expires_at > NOW()))
          AND u.id <> ?
          ${onlyNonDev ? "AND u.role <> 'dev'" : ''}
        ORDER BY r.created_at ASC`,
      [auth.user.id]
    );
    return NextResponse.json(rows);
  } catch (error) {
    console.error(
      '[API /usuarios/senha/pedidos] Erro:',
      error instanceof Error ? error.message : error
    );
    return errorResponse('Erro ao buscar pedidos de redefinição', 500);
  }
}
