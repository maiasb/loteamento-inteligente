import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { dbConfig } from '@/lib/db';

// Forçar rota dinâmica
export const dynamic = 'force-dynamic';

/**
 * GET /api/mapas/lotes?mapId=123&blockId=456
 * Retorna lotes de um mapa (e opcionalmente de uma quadra específica)
 */
export async function GET(request: NextRequest) {
  let connection;
  
  try {
    const { searchParams } = new URL(request.url);
    const mapId = searchParams.get('mapId');
    const blockId = searchParams.get('blockId');

    if (!mapId) {
      return NextResponse.json(
        { error: 'mapId é obrigatório' },
        { status: 400 }
      );
    }


    // Conectar ao banco de dados
    connection = await mysql.createConnection(dbConfig);

    // Construir query com JOIN na tabela blocks para trazer o blockName
    let query = `
      SELECT 
        l.*,
        b.name as block_name
      FROM lots l
      LEFT JOIN blocks b ON l.block_id = b.id
      WHERE l.map_id = ?
    `;
    const params: any[] = [mapId];

    if (blockId) {
      query += ' AND l.block_id = ?';
      params.push(blockId);
    }

    query += ' ORDER BY l.lot_number ASC';

    // Executar query
    const [rows] = await connection.execute(query, params);

    if (!Array.isArray(rows)) {
      return NextResponse.json([{ mapId, lots: [] }], { status: 200 });
    }

    // Formatar lotes (mesmo formato esperado pelo frontend)
    const lots = rows.map((lot: any) => ({
      id: lot.id?.toString() || '',
      mapId: lot.map_id?.toString() || mapId,
      blockId: lot.block_id?.toString() || null,
      blockName: lot.block_name || null,
      lotNumber: lot.lot_number || '',
      status: lot.status || 'available',
      price: lot.price ? Number(lot.price) : 0,
      pricePerM2: lot.price_per_m2 ? Number(lot.price_per_m2) : null,
      size: lot.size ? Number(lot.size) : 0,
      description: lot.description || '',
      features: lot.features ? JSON.parse(lot.features) : [],
      coordinates: lot.coordinates ? (typeof lot.coordinates === 'string' ? JSON.parse(lot.coordinates) : lot.coordinates) : null,
      createdAt: lot.created_at || new Date(),
      updatedAt: lot.updated_at || new Date(),
    }));

    // Retorna no formato esperado pelo frontend
    const response = [
      {
        mapId,
        lots,
      }
    ];

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('[API /mapas/lotes GET] ❌ Erro:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar lotes' },
      { status: 500 }
    );
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}
