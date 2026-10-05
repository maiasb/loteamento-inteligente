import { NextRequest, NextResponse } from 'next/server';
import mysql, { type RowDataPacket, type ResultSetHeader } from 'mysql2/promise';
import { dbConfig } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function PUT(request: NextRequest) {
  let connection;

  try {
    const body = await request.json();
    const { idUsuario, status } = body;

    if (!idUsuario || !status) {
      return NextResponse.json({ error: 'idUsuario e status são obrigatórios' }, { status: 400 });
    }

    if (!['approved', 'rejected'].includes(status)) {
      return NextResponse.json(
        { error: 'status deve ser "approved" ou "rejected"' },
        { status: 400 }
      );
    }

    connection = await mysql.createConnection(dbConfig);

    // Verificar se o usuário existe
    const [users] = await connection.execute('SELECT id, name, email FROM users WHERE id = ?', [
      idUsuario,
    ]);

    if (!Array.isArray(users) || users.length === 0) {
      return NextResponse.json(
        { error: 'Usuário não encontrado', message: 'O usuário especificado não existe' },
        { status: 404 }
      );
    }

    const user = users[0] as RowDataPacket;

    // Atualizar status do usuário
    const [result] = await connection.execute(
      'UPDATE users SET status = ?, updated_at = NOW() WHERE id = ?',
      [status, idUsuario]
    );

    const affectedRows = (result as ResultSetHeader).affectedRows;

    if (affectedRows === 0) {
      return NextResponse.json(
        {
          error: 'Nenhum usuário foi atualizado',
          message: 'Não foi possível atualizar o status do usuário',
        },
        { status: 400 }
      );
    }

    const statusMessage = status === 'approved' ? 'aprovado' : 'rejeitado';

    return NextResponse.json(
      {
        message: `Usuário ${statusMessage} com sucesso`,
        userId: idUsuario,
        userName: user.name,
        userEmail: user.email,
        status,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[API /usuarios/aprovar] ❌ Erro:', error);
    return NextResponse.json(
      {
        error: 'Erro ao atualizar status do usuário',
        message: 'Ocorreu um erro ao processar a solicitação. Tente novamente.',
      },
      { status: 500 }
    );
  } finally {
    if (connection) await connection.end();
  }
}
