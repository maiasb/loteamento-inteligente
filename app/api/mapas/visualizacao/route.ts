import { NextRequest, NextResponse } from 'next/server';
import mysql, { Connection } from 'mysql2/promise';
import { dbConfig } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/mapas/visualizacao?mapId=123
 * Retorna dados completos do mapa para visualização pública: mapa, quadras e lotes
 */
export async function GET(request: NextRequest) {
  let connection: Connection | undefined;

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

    // Buscar dados do mapa
    const [mapRows]: any = await connection.execute(
      `SELECT 
        id, 
        name, 
        description, 
        address, 
        boundary_coordinates as boundaryCoordinates,
        image_url as imageUrl,
        created_at as createdAt, 
        updated_at as updatedAt 
      FROM maps 
      WHERE id = ?`,
      [mapId]
    );

    if (!mapRows || mapRows.length === 0) {
      return NextResponse.json(
        { error: 'Mapa não encontrado' },
        { status: 404 }
      );
    }

    const mapData = mapRows[0];

    // Parse boundary coordinates se existir
    let boundaryCoordinates = null;
    if (mapData.boundaryCoordinates) {
      try {
        boundaryCoordinates = typeof mapData.boundaryCoordinates === 'string' 
          ? JSON.parse(mapData.boundaryCoordinates) 
          : mapData.boundaryCoordinates;
      } catch (e) {
        console.error('[API /mapas/visualizacao] Erro ao parsear boundary_coordinates:', e);
      }
    }

    // Buscar quadras do mapa com coordenadas
    const [blockRows]: any = await connection.execute(
      `SELECT 
        id, 
        mapId, 
        name, 
        description, 
        coordinates,
        createdAt, 
        updatedAt 
      FROM blocks 
      WHERE mapId = ?
      ORDER BY name`,
      [mapId]
    );

    const blocks = blockRows.map((block: any) => {
      let coordinates = null;
      if (block.coordinates) {
        try {
          coordinates = typeof block.coordinates === 'string' 
            ? JSON.parse(block.coordinates) 
            : block.coordinates;
        } catch (e) {
          console.error(`[API /mapas/visualizacao] Erro ao parsear coordinates da quadra ${block.id}:`, e);
        }
      }

      return {
        id: block.id.toString(),
        mapId: block.mapId.toString(),
        name: block.name,
        description: block.description || null,
        coordinates,
        createdAt: block.createdAt,
        updatedAt: block.updatedAt,
      };
    });

    // Buscar lotes do mapa com coordenadas
    const [lotRows]: any = await connection.execute(
      `SELECT 
        l.id, 
        l.map_id as mapId, 
        l.block_id as blockId,
        b.name as blockName,
        l.lot_number as lotNumber, 
        l.status, 
        l.price,
        l.size, 
        l.description, 
        l.features,
        l.coordinates,
        l.created_at as createdAt, 
        l.updated_at as updatedAt
      FROM lots l
      LEFT JOIN blocks b ON l.block_id = b.id AND l.map_id = b.mapId
      WHERE l.map_id = ?
      ORDER BY CAST(l.lot_number AS UNSIGNED), l.lot_number`,
      [mapId]
    );

    const lots = lotRows.map((lot: any) => {
      let coordinates = null;
      if (lot.coordinates) {
        try {
          coordinates = typeof lot.coordinates === 'string' 
            ? JSON.parse(lot.coordinates) 
            : lot.coordinates;
        } catch (e) {
          console.error(`[API /mapas/visualizacao] Erro ao parsear coordinates do lote ${lot.id}:`, e);
        }
      }

      let features = [];
      if (lot.features) {
        try {
          features = typeof lot.features === 'string' 
            ? JSON.parse(lot.features) 
            : lot.features;
        } catch (e) {
          console.error(`[API /mapas/visualizacao] Erro ao parsear features do lote ${lot.id}:`, e);
        }
      }

      const price = parseFloat(lot.price) || 0;
      const size = parseFloat(lot.size) || 0;
      const pricePerM2 = size > 0 ? price / size : null;

      return {
        id: lot.id.toString(),
        mapId: lot.mapId.toString(),
        blockId: lot.blockId ? lot.blockId.toString() : null,
        blockName: lot.blockName || null,
        lotNumber: lot.lotNumber,
        status: lot.status,
        price,
        pricePerM2,
        size,
        description: lot.description || null,
        features,
        coordinates,
        createdAt: lot.createdAt,
        updatedAt: lot.updatedAt,
      };
    });

    const response = {
      map: {
        id: mapData.id.toString(),
        name: mapData.name,
        description: mapData.description || null,
        address: mapData.address || null,
        boundaryCoordinates,
        imageUrl: mapData.imageUrl,
        createdAt: mapData.createdAt,
        updatedAt: mapData.updatedAt,
      },
      blocks,
      lots,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('[API /mapas/visualizacao GET] Erro:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar dados de visualização' },
      { status: 500 }
    );
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}
