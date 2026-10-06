import { NextRequest, NextResponse } from 'next/server';
import mysql, { type RowDataPacket } from 'mysql2/promise';
import { dbConfig } from '@/lib/db';

// Forçar rota dinâmica
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  let connection;

  try {
    const { searchParams } = new URL(request.url);
    const idLote = searchParams.get('idLote');

    if (!idLote) {
      return NextResponse.json({ error: 'idLote é obrigatório' }, { status: 400 });
    }

    connection = await mysql.createConnection(dbConfig);

    const [rows] = await connection.execute(
      "SELECT IF(status = 'available', TRUE, FALSE) AS isAvailable FROM lots WHERE id = ?",
      [idLote]
    );

    const result =
      Array.isArray(rows) && rows.length > 0 ? (rows[0] as RowDataPacket) : { isAvailable: false };

    return NextResponse.json(
      { valid: result.isAvailable === 1 || result.isAvailable === true },
      { status: 200 }
    );
  } catch (error) {
    console.error('[API /mapas/lotes/valido GET] Erro:', error);
    return NextResponse.json({ error: 'Erro ao validar lote' }, { status: 500 });
  } finally {
    if (connection) await connection.end();
  }
}
