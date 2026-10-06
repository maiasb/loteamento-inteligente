import { NextRequest, NextResponse } from 'next/server';
import mysql, { type RowDataPacket } from 'mysql2/promise';
import { dbConfig } from '@/lib/db';

export async function DELETE(request: NextRequest) {
  let connection;

  try {
    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json({ error: 'ID do usuário é obrigatório' }, { status: 400 });
    }

    connection = await mysql.createConnection(dbConfig);

    // Verificar se o usuário existe
    const [users] = await connection.execute('SELECT id, name, role FROM users WHERE id = ?', [
      userId,
    ]);

    if (!Array.isArray(users) || users.length === 0) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
    }

    const user = users[0] as RowDataPacket;

    // Prevenir exclusão de desenvolvedores
    if (user.role === 'dev') {
      return NextResponse.json(
        { error: 'Não é possível excluir usuários com perfil de desenvolvedor' },
        { status: 403 }
      );
    }

    // Excluir usuário
    await connection.execute('DELETE FROM users WHERE id = ?', [userId]);

    return NextResponse.json(
      {
        message: 'Usuário excluído com sucesso',
        userId,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[API /usuarios/excluir] ❌ Erro:', error);

    // Verificar se é erro de foreign key constraint
    if (error instanceof Error && error.message.includes('foreign key constraint')) {
      return NextResponse.json(
        {
          error:
            'Não é possível excluir este usuário pois possui dados relacionados (reservas, etc.)',
        },
        { status: 400 }
      );
    }

    return NextResponse.json({ error: 'Erro ao excluir usuário' }, { status: 500 });
  } finally {
    if (connection) await connection.end();
  }
}
