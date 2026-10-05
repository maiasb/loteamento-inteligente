import { NextRequest, NextResponse } from 'next/server';
import mysql, { type RowDataPacket } from 'mysql2/promise';
import { dbConfig, type QueryParam } from '@/lib/db';

// Forçar rota dinâmica
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  let connection;

  try {
    connection = await mysql.createConnection(dbConfig);

    const { searchParams } = new URL(request.url);
    const reservationId = searchParams.get('reservationId');
    const status = searchParams.get('status');
    const userId = searchParams.get('userId');
    const limit = parseInt(searchParams.get('limit') || '10');

    if (!reservationId) {
      return NextResponse.json({ error: 'reservationId é obrigatório' }, { status: 400 });
    }

    // Construir query para contar quantas reservas existem antes desta
    let countQuery = `
      SELECT COUNT(*) as position 
      FROM purchase_requests 
      WHERE created_at >= (SELECT created_at FROM purchase_requests WHERE id = ?)
    `;

    const whereConditions: string[] = [];
    const filterParams: QueryParam[] = [reservationId];

    // Aplicar os mesmos filtros que a listagem principal
    if (status && status !== 'all' && status !== 'undefined' && status !== 'null') {
      whereConditions.push('status = ?');
      filterParams.push(status);
    }

    if (userId && userId !== 'undefined' && userId !== 'null') {
      whereConditions.push('user_id = ?');
      filterParams.push(parseInt(userId));
    }

    if (whereConditions.length > 0) {
      countQuery += ' AND ' + whereConditions.join(' AND ');
    }

    const [result] = await connection.execute(countQuery, filterParams);
    const position = (result as RowDataPacket[])[0].position;

    // Calcular a página
    const page = Math.ceil(position / limit);

    return NextResponse.json(
      {
        page,
        position,
        limit,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[API /reservas/find-page GET] Erro:', error);
    return NextResponse.json({ error: 'Erro ao buscar página da reserva' }, { status: 500 });
  } finally {
    if (connection) await connection.end();
  }
}
