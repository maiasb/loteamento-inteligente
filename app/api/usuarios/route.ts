import { NextResponse } from 'next/server';
import mysql, { type RowDataPacket } from 'mysql2/promise';
import { dbConfig } from '@/lib/db';

// Forçar rota dinâmica
export const dynamic = 'force-dynamic';

export async function GET() {
  let connection;

  try {
    connection = await mysql.createConnection(dbConfig);

    const [rows] = await connection.execute(
      'SELECT id, cpf, name, email, phone, creci, role, status, active, created_at, updated_at FROM users ORDER BY created_at DESC'
    );

    // Converter active de TINYINT para boolean
    const users = (rows as RowDataPacket[]).map((user) => ({
      ...user,
      active: user.active === 1 || user.active === true,
    }));

    return NextResponse.json(users || [], { status: 200 });
  } catch (error) {
    console.error('[API /usuarios GET] Erro:', error);
    return NextResponse.json({ error: 'Erro ao buscar usuários' }, { status: 500 });
  } finally {
    if (connection) await connection.end();
  }
}
