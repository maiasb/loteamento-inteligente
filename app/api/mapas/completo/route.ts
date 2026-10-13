import { NextResponse } from 'next/server';
import type { RowDataPacket } from 'mysql2/promise';
import { executeQuery } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Três queries no total (mapas, quadras e lotes), agrupadas em memória: sem N+1
    const maps = await executeQuery<RowDataPacket[]>(
      'SELECT id as mapId, name, description, location, image_url as imageUrl, created_at, updated_at FROM maps ORDER BY created_at DESC'
    );

    if (maps.length === 0) {
      return NextResponse.json([], { status: 200 });
    }

    const mapIds = maps.map((map) => map.mapId);
    const placeholders = mapIds.map(() => '?').join(',');

    const [blocks, lots] = await Promise.all([
      executeQuery<RowDataPacket[]>(
        `SELECT id, mapId, name, identifier, description, createdAt, updatedAt
         FROM blocks WHERE mapId IN (${placeholders}) ORDER BY name`,
        mapIds
      ),
      executeQuery<RowDataPacket[]>(
        `SELECT 
          id, 
          block_id as blockId, 
          map_id as mapId, 
          lot_number as lotNumber, 
          status, 
          price, 
          size, 
          description, 
          features,
          created_at as createdAt, 
          updated_at as updatedAt
        FROM lots 
        WHERE map_id IN (${placeholders}) AND block_id IS NOT NULL
        ORDER BY CAST(lot_number AS UNSIGNED), lot_number`,
        mapIds
      ),
    ]);

    const lotsByBlock = new Map<string, RowDataPacket[]>();
    for (const lot of lots) {
      const key = String(lot.blockId);
      const list = lotsByBlock.get(key) ?? [];
      list.push(lot);
      lotsByBlock.set(key, list);
    }

    const blocksByMap = new Map<string, RowDataPacket[]>();
    for (const block of blocks) {
      const key = String(block.mapId);
      const list = blocksByMap.get(key) ?? [];
      list.push(block);
      blocksByMap.set(key, list);
    }

    const mapsWithData = maps.map((map) => {
      const mapBlocks = blocksByMap.get(String(map.mapId)) ?? [];

      const blocksWithLots = mapBlocks.map((block) => ({
        blockId: block.id.toString(),
        blockName: block.name,
        blockIdentifier: block.identifier,
        blockDescription: block.description,
        createdAt: block.createdAt,
        updatedAt: block.updatedAt,
        lots: (lotsByBlock.get(String(block.id)) ?? []).map((lot) => ({
          id: lot.id.toString(),
          mapId: lot.mapId,
          blockId: lot.blockId.toString(),
          lotNumber: lot.lotNumber,
          status: lot.status,
          price: parseFloat(lot.price),
          pricePerM2: null,
          size: parseFloat(lot.size),
          description: lot.description,
          // Coluna JSON: o MySQL 8 já devolve o valor decodificado pelo mysql2
          features:
            typeof lot.features === 'string' ? JSON.parse(lot.features) : (lot.features ?? []),
          createdAt: lot.createdAt,
          updatedAt: lot.updatedAt,
        })),
      }));

      return {
        mapId: map.mapId,
        mapName: map.name,
        mapDescription: map.description,
        mapLocation: map.location,
        mapImageUrl: map.imageUrl,
        totalBlocks: mapBlocks.length,
        totalLots: blocksWithLots.reduce((sum, block) => sum + block.lots.length, 0),
        createdAt: map.created_at,
        updatedAt: map.updated_at,
        blocks: blocksWithLots,
      };
    });

    return NextResponse.json(mapsWithData, { status: 200 });
  } catch (error) {
    console.error('[API /mapas/completo GET] Erro:', error);
    return NextResponse.json({ error: 'Erro ao buscar dados completos' }, { status: 500 });
  }
}
