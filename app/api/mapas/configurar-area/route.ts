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

    // Permitir endereço vazio quando também estiver limpando as coordenadas (zerar configuração)
    const isClearing = (!address || !address.trim()) && Array.isArray(boundaryCoordinates) && boundaryCoordinates.length === 0;
    
    if (!isClearing && (!address || !address.trim())) {
      return NextResponse.json(
        { error: 'Endereço é obrigatório quando há coordenadas' },
        { status: 400 }
      );
    }

    if (!Array.isArray(boundaryCoordinates)) {
      return NextResponse.json(
        { error: 'Coordenadas devem ser um array' },
        { status: 400 }
      );
    }

    // Permitir array vazio para limpar as coordenadas, mas validar se não for vazio
    if (boundaryCoordinates.length > 0 && boundaryCoordinates.length < 3) {
      return NextResponse.json(
        { error: 'Se fornecidas, as coordenadas do polígono devem ter no mínimo 3 pontos' },
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
    }

    // Criar coluna boundary_coordinates se não existir
    if (!hasBoundary) {
      await connection.execute(
        `ALTER TABLE maps 
         ADD COLUMN boundary_coordinates JSON AFTER address`
      );
    }

    // Atualizar endereço e coordenadas do boundary
    // Se o array estiver vazio, salvar null ao invés de array vazio
    // Se o endereço estiver vazio, também salvar null
    const coordinatesValue = boundaryCoordinates.length === 0 ? null : JSON.stringify(boundaryCoordinates);
    const addressValue = (address && address.trim()) ? address.trim() : null;
    
    await connection.execute(
      `UPDATE maps 
       SET address = ?, 
           boundary_coordinates = ?, 
           updated_at = NOW()
       WHERE id = ?`,
      [addressValue, coordinatesValue, mapId]
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
