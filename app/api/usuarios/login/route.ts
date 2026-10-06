import { NextRequest, NextResponse } from 'next/server';
import mysql, { type RowDataPacket } from 'mysql2/promise';
import crypto from 'crypto';
import { dbConfig } from '@/lib/db';

// Forçar rota dinâmica
export const dynamic = 'force-dynamic';

/**
 * GET /api/usuarios/login?cpf=12345678900&password=senha123
 * Endpoint de autenticação com hash MD5
 */
export async function GET(request: NextRequest) {
  let connection;

  try {
    const { searchParams } = new URL(request.url);
    const cpf = searchParams.get('cpf');
    const password = searchParams.get('password');

    if (!cpf || !password) {
      return NextResponse.json({ error: 'CPF e senha são obrigatórios' }, { status: 400 });
    }

    // Remover formatação do CPF
    const cleanCpf = cpf.replace(/\D/g, '');

    // Gerar hash MD5 da senha (mesmo algoritmo do n8n)
    const hashedPassword = crypto.createHash('md5').update(password).digest('hex');

    // Conectar ao banco de dados
    connection = await mysql.createConnection(dbConfig);

    // Buscar usuário no banco
    const [rows] = await connection.execute(
      `SELECT id, cpf, name, email, phone, first_login, creci, role, status, active, theme_preference, created_at, updated_at 
       FROM users 
       WHERE cpf = ? AND password = ?`,
      [cleanCpf, hashedPassword]
    );

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'CPF ou senha inválidos' }, { status: 401 });
    }

    const user = rows[0] as RowDataPacket;

    // Verificar se o usuário está aprovado
    if (user.status !== 'approved') {
      return NextResponse.json(
        { error: 'Usuário aguardando aprovação ou foi rejeitado' },
        { status: 403 }
      );
    }

    // Verificar se o usuário está ativo
    if (user.active === 0 || user.active === false) {
      return NextResponse.json(
        { error: 'Sua conta foi desativada. Entre em contato com o administrador.' },
        { status: 403 }
      );
    }

    // Formatar resposta (mantendo snake_case para compatibilidade com AuthContext)
    const userData = {
      id: user.id.toString(),
      name: user.name,
      email: user.email,
      cpf: user.cpf,
      phone: user.phone || '',
      creci: user.creci || '',
      role: user.role,
      status: user.status,
      active: user.active !== 0, // Converte TINYINT(1) para booleano
      first_login: Boolean(user.first_login), // Converte TINYINT(1) para booleano
      theme_preference: user.theme_preference || 'light', // Preferência de tema
      created_at: user.created_at,
      updated_at: user.updated_at,
    };

    return NextResponse.json(userData, { status: 200 });
  } catch (error) {
    console.error('[API /usuarios/login] ❌ Erro:', error);
    return NextResponse.json({ error: 'Erro ao fazer login' }, { status: 500 });
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}
