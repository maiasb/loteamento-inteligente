import { NextResponse } from 'next/server';
import mysql, { Connection, type RowDataPacket } from 'mysql2/promise';
import { dbConfig } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  let connection: Connection | undefined;

  try {
    connection = await mysql.createConnection(dbConfig);

    // Buscar todos os mapas
    const [maps] = await connection.execute<RowDataPacket[]>(
      'SELECT id as mapId, name, description, location, image_url as imageUrl, created_at, updated_at FROM maps ORDER BY created_at DESC'
    );

    // Para cada mapa, buscar quadras e lotes
    const mapsWithData = await Promise.all(
      maps.map(async (map) => {
        // Buscar quadras do mapa
        const [blocks] = await connection!.execute<RowDataPacket[]>(
          'SELECT id, name, identifier, description, createdAt, updatedAt FROM blocks WHERE mapId = ? ORDER BY name',
          [map.mapId]
        );

        // Para cada quadra, buscar seus lotes
        const blocksWithLots = await Promise.all(
          blocks.map(async (block) => {
            const [lots] = await connection!.execute<RowDataPacket[]>(
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
              WHERE map_id = ? AND block_id = ?
              ORDER BY CAST(lot_number AS UNSIGNED), lot_number`,
              [map.mapId, block.id]
            );

            return {
              blockId: block.id.toString(),
              blockName: block.name,
              blockIdentifier: block.identifier,
              blockDescription: block.description,
              createdAt: block.createdAt,
              updatedAt: block.updatedAt,
              lots: lots.map((lot) => ({
                id: lot.id.toString(),
                mapId: lot.mapId,
                blockId: lot.blockId.toString(),
                lotNumber: lot.lotNumber,
                status: lot.status,
                price: parseFloat(lot.price),
                pricePerM2: null,
                size: parseFloat(lot.size),
                description: lot.description,
                features: lot.features ? JSON.parse(lot.features) : [],
                createdAt: lot.createdAt,
                updatedAt: lot.updatedAt,
              })),
            };
          })
        );

        // Total de lotes do mapa
        const totalLots = blocksWithLots.reduce((sum, block) => sum + block.lots.length, 0);

        return {
          mapId: map.mapId,
          mapName: map.name,
          mapDescription: map.description,
          mapLocation: map.location,
          mapImageUrl: map.imageUrl,
          totalBlocks: blocks.length,
          totalLots,
          createdAt: map.created_at,
          updatedAt: map.updated_at,
          blocks: blocksWithLots,
        };
      })
    );

    return NextResponse.json(mapsWithData, { status: 200 });
  } catch (error) {
    console.error('[API /mapas/completo GET] Erro:', error);
    return NextResponse.json({ error: 'Erro ao buscar dados completos' }, { status: 500 });
  } finally {
    if (connection) await connection.end();
  }
}
