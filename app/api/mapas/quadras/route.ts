import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { dbConfig } from '@/lib/db';

// Forçar rota dinâmica
export const dynamic = 'force-dynamic';

/**
 * GET /api/mapas/quadras?mapId=123
 */
export async function GET(request: NextRequest) {
  let connection;
  
  try {
    const { searchParams } = new URL(request.url);
    const mapId = searchParams.get('mapId');

    if (!mapId) {
      return NextResponse.json(
        { error: 'mapId é obrigatório' },
        { status: 400 }
      );
    }

    connection = await mysql.createConnection(dbConfig);

    // Query corrigida: mapId (camelCase conforme estrutura real da tabela)
    const [rows] = await connection.execute(
      'SELECT * FROM blocks WHERE mapId = ? ORDER BY id ASC',
      [mapId]
    );

    // Formatar quadras com id como string
    const blocks = Array.isArray(rows) ? rows.map((block: any) => ({
      id: block.id.toString(),
      mapId: block.mapId,
      name: block.name,
      description: block.description || '',
      createdAt: block.createdAt,
      updatedAt: block.updatedAt,
    })) : [];

    return NextResponse.json(blocks, { status: 200 });
  } catch (error) {
    console.error('[API /mapas/quadras GET] Erro:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar quadras' },
      { status: 500 }
    );
  } finally {
    if (connection) await connection.end();
  }
}
