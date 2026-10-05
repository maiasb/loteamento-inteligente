import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import type { RowDataPacket } from 'mysql2/promise';

export async function POST(request: Request) {
  try {
    const { cpf, email } = await request.json();

    if (!cpf || !email) {
      return NextResponse.json(
        { success: false, message: 'CPF e email são obrigatórios' },
        { status: 400 }
      );
    }

    // Buscar usuário por CPF e email
    const users = await executeQuery<RowDataPacket[]>(
      `
      SELECT id, name, email, cpf, role, status
      FROM users
      WHERE cpf = ? AND email = ?
    `,
      [cpf, email.toLowerCase()]
    );

    const user = users.length > 0 ? users[0] : null;

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'CPF ou email não encontrados' },
        { status: 404 }
      );
    }

    // Verificar se a conta está ativa
    if (user.status !== 'approved') {
      return NextResponse.json(
        { success: false, message: 'Conta não está ativa. Entre em contato com o administrador.' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      userId: user.id,
      message: 'Usuário verificado com sucesso',
    });
  } catch (error) {
    console.error('Erro ao verificar usuário:', error);
    return NextResponse.json(
      { success: false, message: 'Erro ao verificar usuário' },
      { status: 500 }
    );
  }
}
