import { NextRequest, NextResponse } from 'next/server';
import mysql, { type RowDataPacket } from 'mysql2/promise';
import { dbConfig } from '@/lib/db';

export async function GET(request: NextRequest) {
  let connection;

  try {
    const { searchParams } = new URL(request.url);
    const mapId = searchParams.get('mapId');

    if (!mapId) {
      return NextResponse.json({ error: 'mapId é obrigatório' }, { status: 400 });
    }

    connection = await mysql.createConnection(dbConfig);

    // Contar lotes reservados ou vendidos neste mapa
    const [results] = await connection.execute<RowDataPacket[]>(
      `SELECT COUNT(*) as count 
       FROM lots 
       WHERE map_id = ? AND status IN ('reserved', 'sold')`,
      [mapId]
    );

    const count = results[0]?.count || 0;

    return NextResponse.json(
      {
        hasReservedOrSoldLots: count > 0,
        count: count,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[API /mapas/verificar-lotes-reservados] Erro:', error);
    return NextResponse.json({ error: 'Erro ao verificar lotes' }, { status: 500 });
  } finally {
    if (connection) await connection.end();
  }
}
