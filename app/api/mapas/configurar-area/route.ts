import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { dbConfig } from '@/lib/db';

// Forçar rota dinâmica
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  let connection;
  
  try {
    const body = await request.json();
    const { mapId, address, boundaryCoordinates } = body;

    if (!mapId) {
      return NextResponse.json(
        { error: 'ID do mapa é obrigatório' },
        { status: 400 }
      );
    }

    if (!address || !address.trim()) {
      return NextResponse.json(
        { error: 'Endereço é obrigatório' },
        { status: 400 }
      );
    }

    if (!boundaryCoordinates || !Array.isArray(boundaryCoordinates) || boundaryCoordinates.length < 3) {
      return NextResponse.json(
        { error: 'Coordenadas do polígono são obrigatórias (mínimo 3 pontos)' },
        { status: 400 }
      );
    }

    connection = await mysql.createConnection(dbConfig);

    // Verificar se o mapa existe
    const [maps] = await connection.execute(
      'SELECT id FROM maps WHERE id = ?',
      [mapId]
    );

    if (!Array.isArray(maps) || maps.length === 0) {
      return NextResponse.json(
        { error: 'Mapa não encontrado' },
        { status: 404 }
      );
    }

    // Verificar se as colunas necessárias existem
    const [columns] = await connection.execute(
      `SELECT COLUMN_NAME 
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() 
       AND TABLE_NAME = 'maps' 
       AND COLUMN_NAME IN ('boundary_coordinates', 'address')`
    ) as any;

    const hasAddress = Array.isArray(columns) && columns.some((col: any) => col.COLUMN_NAME === 'address');
    const hasBoundary = Array.isArray(columns) && columns.some((col: any) => col.COLUMN_NAME === 'boundary_coordinates');

    // Criar coluna address se não existir
    if (!hasAddress) {
      await connection.execute(
        `ALTER TABLE maps 
         ADD COLUMN address VARCHAR(500) AFTER location`
      );
      console.log('✅ Coluna address criada com sucesso');
    }

    // Criar coluna boundary_coordinates se não existir
    if (!hasBoundary) {
      await connection.execute(
        `ALTER TABLE maps 
         ADD COLUMN boundary_coordinates JSON AFTER address`
      );
      console.log('✅ Coluna boundary_coordinates criada com sucesso');
    }

    // Atualizar endereço e coordenadas do boundary
    await connection.execute(
      `UPDATE maps 
       SET address = ?, 
           boundary_coordinates = ?, 
           updated_at = NOW()
       WHERE id = ?`,
      [address.trim(), JSON.stringify(boundaryCoordinates), mapId]
    );

    return NextResponse.json({
      success: true,
      message: 'Área configurada com sucesso',
      mapId,
      address: address.trim(),
      boundaryCoordinates
    });

  } catch (error: any) {
    console.error('[API] Erro ao configurar área do mapa:', error);
    
    return NextResponse.json(
      { 
        error: 'Erro ao configurar área do mapa',
        details: error.message 
      },
      { status: 500 }
    );
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}
