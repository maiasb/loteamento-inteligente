import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { dbConfig } from '@/lib/db';

export async function PATCH(request: NextRequest) {
  let connection;
  
  try {
    const body = await request.json();
    const {
      id,
      mapId,
      blockId,
      lotNumber,
      status,
      price,
      size,
      description,
      features,
      coordinates,
    } = body;

    if (!id || !mapId) {
      return NextResponse.json(
        { error: 'id e mapId são obrigatórios' },
        { status: 400 }
      );
    }

    connection = await mysql.createConnection(dbConfig);

    // Construir query dinamicamente
    const updateFields = [];
    const updateValues = [];

    if (blockId !== undefined) {
      updateFields.push('block_id = ?');
      updateValues.push(blockId);
    }
    if (lotNumber !== undefined) {
      updateFields.push('lot_number = ?');
      updateValues.push(lotNumber);
    }
    if (status !== undefined) {
      updateFields.push('status = ?');
      updateValues.push(status);
    }
    if (price !== undefined) {
      updateFields.push('price = ?');
      updateValues.push(price);
    }
    if (size !== undefined) {
      updateFields.push('size = ?');
      updateValues.push(size);
    }
    if (description !== undefined) {
      updateFields.push('description = ?');
      updateValues.push(description);
    }
    if (features !== undefined) {
      updateFields.push('features = ?');
      updateValues.push(features ? JSON.stringify(features) : null);
    }
    if (coordinates !== undefined) {
      updateFields.push('coordinates = ?');
      updateValues.push(coordinates ? JSON.stringify(coordinates) : null);
    }

    updateFields.push('updated_at = NOW()');
    updateValues.push(id, mapId);

    await connection.execute(
      `UPDATE lots SET ${updateFields.join(', ')} WHERE id = ? AND map_id = ?`,
      updateValues
    );

    const updatedLot = {
      id,
      mapId,
      blockId: blockId !== undefined ? blockId : null,
      lotNumber,
      status,
      price,
      size,
      description,
      features,
      coordinates,
      updatedAt: new Date().toISOString(),
    };

    return NextResponse.json(updatedLot, { status: 200 });
  } catch (error) {
    console.error('[API /mapas/lotes PATCH] Erro:', error);
    return NextResponse.json(
      { error: 'Erro ao atualizar lote' },
      { status: 500 }
    );
  } finally {
    if (connection) await connection.end();
  }
}
