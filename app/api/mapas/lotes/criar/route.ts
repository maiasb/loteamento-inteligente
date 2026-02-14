import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { dbConfig } from '@/lib/db';

// Forçar rota dinâmica
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  let connection;
  let lotNumber = '';
  
  try {
    const body = await request.json();
    const {
      mapId,
      blockId,
      lotNumber: lotNum,
      status = 'available',
      price,
      pricePerM2,
      size,
      description,
      features = [],
      lat,
      lng,
    } = body;
    
    lotNumber = lotNum;

    if (!mapId || !lotNumber || !price || !size) {
      return NextResponse.json(
        { error: 'mapId, lotNumber, price e size são obrigatórios' },
        { status: 400 }
      );
    }

    connection = await mysql.createConnection(dbConfig);

    // Verificar se já existe um lote com o mesmo número na mesma quadra do mesmo mapa
    const [existingLots] = await connection.execute(
      'SELECT id FROM lots WHERE map_id = ? AND block_id = ? AND lot_number = ?',
      [mapId, blockId || null, lotNumber]
    );

    if (Array.isArray(existingLots) && existingLots.length > 0) {
      return NextResponse.json(
        { error: `Já existe um lote "${lotNumber}" nesta quadra` },
        { status: 409 }
      );
    }

    // INSERT sem id (AUTO_INCREMENT) e sem price_per_m2 (coluna não existe)
    await connection.execute(
      `INSERT INTO lots (
        map_id, block_id, lot_number, status,
        price, size, description, features, coordinates,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        mapId,
        blockId || null,
        lotNumber,
        status,
        price,
        size,
        description || '',
        JSON.stringify(features),
        (lat !== undefined && lng !== undefined) ? JSON.stringify({ lat, lng }) : null,
      ]
    );

    // Buscar o ID inserido
    const [rows] = await connection.execute(
      'SELECT LAST_INSERT_ID() as insertedId'
    );
    const insertedId = (rows as any)[0].insertedId;

    const newLot = {
      id: insertedId.toString(),
      mapId,
      blockId: blockId || null,
      lotNumber,
      status,
      price,
      size,
      description: description || '',
      features,
      lat: lat ?? null,
      lng: lng ?? null,
    };

    return NextResponse.json(newLot, { status: 201 });
  } catch (error: any) {
    console.error('[API /mapas/lotes/criar] Erro:', error);
    
    // Tratamento específico para erro de duplicata
    if (error.code === 'ER_DUP_ENTRY') {
      return NextResponse.json(
        { error: `O lote "${lotNumber}" já existe nesta quadra` },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { error: 'Erro ao criar lote' },
      { status: 500 }
    );
  } finally {
    if (connection) await connection.end();
  }
}
