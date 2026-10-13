import { NextRequest, NextResponse } from 'next/server';
import type { RowDataPacket } from 'mysql2/promise';
import { executeQuery } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/mapas/visualizacao?mapId=123
 * Retorna dados completos do mapa para visualização pública: mapa, quadras e lotes
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const mapId = searchParams.get('mapId');

    if (!mapId) {
      return NextResponse.json({ error: 'mapId é obrigatório' }, { status: 400 });
    }

    // Buscar dados do mapa
    const mapRows = await executeQuery<RowDataPacket[]>(
      `SELECT 
        id, 
        name, 
        description, 
        address, 
        overlay_config as overlayConfig,
        image_url as imageUrl,
        created_at as createdAt, 
        updated_at as updatedAt 
      FROM maps 
      WHERE id = ?`,
      [mapId]
    );

    if (!mapRows || mapRows.length === 0) {
      return NextResponse.json({ error: 'Mapa não encontrado' }, { status: 404 });
    }

    const mapData = mapRows[0];

    // Buscar quadras do mapa
    const blockRows = await executeQuery<RowDataPacket[]>(
      `SELECT 
        id, 
        mapId, 
        name, 
        description, 
        createdAt, 
        updatedAt 
      FROM blocks 
      WHERE mapId = ?
      ORDER BY name`,
      [mapId]
    );

    const blocks = blockRows.map((block) => {
      return {
        id: block.id.toString(),
        mapId: block.mapId.toString(),
        name: block.name,
        description: block.description || null,
        createdAt: block.createdAt,
        updatedAt: block.updatedAt,
      };
    });

    // Buscar lotes do mapa com coordenadas
    const lotRows = await executeQuery<RowDataPacket[]>(
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

    const lots = lotRows.map((lot) => {
      // Parse coordinates for lat/lng
      let lat = null;
      let lng = null;
      if (lot.coordinates) {
        try {
          const coords =
            typeof lot.coordinates === 'string' ? JSON.parse(lot.coordinates) : lot.coordinates;
          if (coords && typeof coords.lat === 'number' && typeof coords.lng === 'number') {
            lat = coords.lat;
            lng = coords.lng;
          }
        } catch {
          /* ignore */
        }
      }

      let features = [];
      if (lot.features) {
        try {
          features = typeof lot.features === 'string' ? JSON.parse(lot.features) : lot.features;
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
        lat,
        lng,
        createdAt: lot.createdAt,
        updatedAt: lot.updatedAt,
      };
    });

    // Parse overlay config
    let overlayConfig = null;
    if (mapData.overlayConfig) {
      try {
        overlayConfig =
          typeof mapData.overlayConfig === 'string'
            ? JSON.parse(mapData.overlayConfig)
            : mapData.overlayConfig;
      } catch (e) {
        console.error('[API /mapas/visualizacao] Erro ao parsear overlay_config:', e);
      }
    }

    const response = {
      map: {
        id: mapData.id.toString(),
        name: mapData.name,
        description: mapData.description || null,
        address: mapData.address || null,
        overlayConfig,
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
    return NextResponse.json({ error: 'Erro ao buscar dados de visualização' }, { status: 500 });
  }
}
