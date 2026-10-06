import { NextRequest, NextResponse } from 'next/server';
import mysql, { type RowDataPacket } from 'mysql2/promise';
import { dbConfig } from '@/lib/db';

// Forçar rota dinâmica
export const dynamic = 'force-dynamic';

export async function PATCH(request: NextRequest) {
  let connection;

  try {
    const body = await request.json();
    const { id, mapId, name, description, coordinates } = body;

    if (!id || !mapId) {
      return NextResponse.json({ error: 'id e mapId são obrigatórios' }, { status: 400 });
    }

    connection = await mysql.createConnection(dbConfig);

    // Verificar se a coluna coordinates existe
    const [columns] = await connection.execute<RowDataPacket[]>(
      `SELECT COLUMN_NAME 
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() 
       AND TABLE_NAME = 'blocks' 
       AND COLUMN_NAME = 'coordinates'`
    );

    const hasCoordinates = Array.isArray(columns) && columns.length > 0;

    // Criar coluna coordinates se não existir
    if (!hasCoordinates) {
      await connection.execute(
        `ALTER TABLE blocks 
         ADD COLUMN coordinates JSON AFTER description`
      );
    }

    // UPDATE com coordenadas
    await connection.execute(
      'UPDATE blocks SET name = ?, description = ?, coordinates = ?, updatedAt = NOW() WHERE id = ? AND mapId = ?',
      [name, description || '', coordinates ? JSON.stringify(coordinates) : null, id, mapId]
    );

    const updatedBlock = {
      id,
      mapId,
      name,
      description: description || '',
      coordinates,
      updatedAt: new Date().toISOString(),
    };

    return NextResponse.json(updatedBlock, { status: 200 });
  } catch (error) {
    console.error('[API /mapas/quadras PATCH] Erro:', error);
    return NextResponse.json({ error: 'Erro ao atualizar quadra' }, { status: 500 });
  } finally {
    if (connection) await connection.end();
  }
}
