import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import crypto from 'crypto';
import { dbConfig, type QueryParam } from '@/lib/db';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let connection;

  try {
    const { id: userId } = await params;
    const { searchParams } = new URL(request.url);

    const name = searchParams.get('name');
    const email = searchParams.get('email');
    const cpf = searchParams.get('cpf');
    const phone = searchParams.get('phone');
    const role = searchParams.get('role');
    const creci = searchParams.get('creci');
    const password = searchParams.get('password');

    if (!userId) {
      return NextResponse.json({ error: 'ID do usuário é obrigatório' }, { status: 400 });
    }

    connection = await mysql.createConnection(dbConfig);

    // Construir query dinâmica
    const updates: string[] = [];
    const values: QueryParam[] = [];

    if (name) {
      updates.push('name = ?');
      values.push(name);
    }
    if (email) {
      updates.push('email = ?');
      values.push(email);
    }
    if (cpf) {
      updates.push('cpf = ?');
      values.push(cpf.replace(/\D/g, ''));
    }
    if (phone) {
      updates.push('phone = ?');
      values.push(phone.replace(/\D/g, ''));
    }
    if (role) {
      updates.push('role = ?');
      values.push(role);
    }
    if (creci) {
      updates.push('creci = ?');
      values.push(creci);
    }
    if (password) {
      const hashedPassword = crypto.createHash('md5').update(password).digest('hex');
      updates.push('password = ?');
      values.push(hashedPassword);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'Nenhum campo para atualizar' }, { status: 400 });
    }

    updates.push('updated_at = NOW()');
    values.push(userId);

    await connection.execute(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values);

    return NextResponse.json(
      { message: 'Usuário atualizado com sucesso', userId },
      { status: 200 }
    );
  } catch (error) {
    console.error('[API /usuarios/atualizar] Erro:', error);
    return NextResponse.json({ error: 'Erro ao atualizar usuário' }, { status: 500 });
  } finally {
    if (connection) await connection.end();
  }
}
