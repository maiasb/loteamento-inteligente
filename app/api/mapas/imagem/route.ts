import { NextRequest, NextResponse } from 'next/server';
import mysql, { type RowDataPacket } from 'mysql2/promise';
import { dbConfig } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  let connection;

  try {
    const { searchParams } = new URL(request.url);
    const mapId = searchParams.get('mapId');

    if (!mapId) {
      return NextResponse.json({ error: 'mapId é obrigatório' }, { status: 400 });
    }

    connection = await mysql.createConnection(dbConfig);

    const [rows] = await connection.execute<RowDataPacket[]>(
      `SELECT image_url, width, height FROM maps WHERE id = ?`,
      [mapId]
    );

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'Mapa não encontrado' }, { status: 404 });
    }

    const map = rows[0];

    return NextResponse.json(
      {
        imageUrl: map.image_url || '',
        width: map.width ? Number(map.width) : 800,
        height: map.height ? Number(map.height) : 600,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[API /mapas/imagem GET] Erro:', error);
    return NextResponse.json({ error: 'Erro ao buscar imagem do mapa' }, { status: 500 });
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}
