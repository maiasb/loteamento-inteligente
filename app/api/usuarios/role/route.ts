import { NextRequest, NextResponse } from 'next/server';
import mysql, { type RowDataPacket, type ResultSetHeader } from 'mysql2/promise';
import { dbConfig } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function PUT(request: NextRequest) {
  let connection;

  try {
    const body = await request.json();
    const { idUsuario, role } = body;

    if (!idUsuario || !role) {
      return NextResponse.json({ error: 'idUsuario e role são obrigatórios' }, { status: 400 });
    }

    if (!['dev', 'admin', 'vendedor'].includes(role)) {
      return NextResponse.json(
        { error: 'role deve ser "dev", "admin" ou "vendedor"' },
        { status: 400 }
      );
    }

    connection = await mysql.createConnection(dbConfig);

    // Verificar se o usuário existe
    const [users] = await connection.execute(
      'SELECT id, name, email, role FROM users WHERE id = ?',
      [idUsuario]
    );

    if (!Array.isArray(users) || users.length === 0) {
      return NextResponse.json(
        { error: 'Usuário não encontrado', message: 'O usuário especificado não existe' },
        { status: 404 }
      );
    }

    const user = users[0] as RowDataPacket;
    const oldRole = user.role;

    // Atualizar cargo do usuário
    const [result] = await connection.execute(
      'UPDATE users SET role = ?, updated_at = NOW() WHERE id = ?',
      [role, idUsuario]
    );

    const affectedRows = (result as ResultSetHeader).affectedRows;

    if (affectedRows === 0) {
      return NextResponse.json(
        {
          error: 'Nenhum usuário foi atualizado',
          message: 'Não foi possível atualizar o cargo do usuário',
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        message: 'Cargo do usuário atualizado com sucesso',
        userId: idUsuario,
        userName: user.name,
        userEmail: user.email,
        oldRole,
        newRole: role,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[API /usuarios/role] ❌ Erro:', error);
    return NextResponse.json(
      {
        error: 'Erro ao atualizar cargo do usuário',
        message: 'Ocorreu um erro ao processar a solicitação. Tente novamente.',
      },
      { status: 500 }
    );
  } finally {
    if (connection) await connection.end();
  }
}
