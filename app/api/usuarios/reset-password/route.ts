import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import type { RowDataPacket } from 'mysql2/promise';

/**
 * POST /api/usuarios/reset-password
 * Reset password for a user (Admin/Dev only)
 * Body: { userId: string }
 */
export async function POST(request: Request) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'userId é obrigatório' }, { status: 400 });
    }

    // Verificar se o usuário existe
    const users = await executeQuery<RowDataPacket[]>('SELECT id, name FROM users WHERE id = ?', [
      userId,
    ]);

    if (!users || users.length === 0) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
    }

    // Senha padrão: 123456
    // Hash SHA-256: e10adc3949ba59abbe56e057f20f883e
    const hashedPassword = 'e10adc3949ba59abbe56e057f20f883e';

    // Resetar senha e marcar como primeiro login
    await executeQuery(
      `UPDATE users 
       SET password = ?, first_login = 1 
       WHERE id = ?`,
      [hashedPassword, userId]
    );

    return NextResponse.json({
      success: true,
      message: 'Senha resetada com sucesso',
      defaultPassword: '123456',
    });
  } catch (error) {
    console.error('[ResetPassword] ❌ Erro ao resetar senha:', error);
    return NextResponse.json({ error: 'Erro ao resetar senha do usuário' }, { status: 500 });
  }
}
