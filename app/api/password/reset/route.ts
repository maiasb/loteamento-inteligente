import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import crypto from 'crypto';
import type { RowDataPacket } from 'mysql2/promise';

export async function POST(request: Request) {
  try {
    const { userId, newPassword } = await request.json();

    if (!userId || !newPassword) {
      return NextResponse.json({ success: false, message: 'Dados inválidos' }, { status: 400 });
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { success: false, message: 'A senha deve ter no mínimo 6 caracteres' },
        { status: 400 }
      );
    }

    // Verificar se o usuário existe
    const users = await executeQuery<RowDataPacket[]>('SELECT id FROM users WHERE id = ?', [
      userId,
    ]);
    const user = users.length > 0 ? users[0] : null;

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Usuário não encontrado' },
        { status: 404 }
      );
    }

    // Hash da nova senha usando SHA-256 (mesmo padrão do sistema)
    const hashedPassword = crypto.createHash('sha256').update(newPassword).digest('hex');

    // Atualizar senha e marcar que não é mais primeiro login
    await executeQuery(
      `
      UPDATE users
      SET password = ?, first_login = 0
      WHERE id = ?
    `,
      [hashedPassword, userId]
    );

    return NextResponse.json({
      success: true,
      message: 'Senha redefinida com sucesso',
    });
  } catch (error) {
    console.error('Erro ao redefinir senha:', error);
    return NextResponse.json(
      { success: false, message: 'Erro ao redefinir senha' },
      { status: 500 }
    );
  }
}
