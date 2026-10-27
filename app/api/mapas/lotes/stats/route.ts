import { NextRequest, NextResponse } from 'next/server';
import mysql, { type RowDataPacket } from 'mysql2/promise';
import { dbConfig } from '@/lib/db';
import { LotStatus } from '@/types/LotStatus';

// Forçar rota dinâmica
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

    // Buscar estatísticas agregadas dos lotes
    const [rows] = await connection.execute(
      `SELECT 
        status,
        COUNT(*) as count
      FROM lots
      WHERE map_id = ?
      GROUP BY status`,
      [mapId]
    );

    const result = {
      available: 0,
      reserved: 0,
      sold: 0,
      blocked: 0,
    };

    (rows as RowDataPacket[]).forEach((row) => {
      switch (row.status) {
        case LotStatus.AVAILABLE:
          result.available = row.count;
          break;
        case LotStatus.RESERVED:
          result.reserved = row.count;
          break;
        case LotStatus.SOLD:
          result.sold = row.count;
          break;
        case LotStatus.BLOCKED:
          result.blocked = row.count;
          break;
      }
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Erro ao buscar estatísticas dos lotes:', error);
    return NextResponse.json({ error: 'Erro ao buscar estatísticas dos lotes' }, { status: 500 });
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}
