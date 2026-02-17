import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { dbConfig } from '@/lib/db';

// Forçar rota dinâmica
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  let connection;
  
  try {
    const body = await request.json();
    const { mapId, imageUrl, width = 800, height = 600 } = body;

    if (!mapId || !imageUrl) {
      return NextResponse.json(
        { error: 'ID do mapa e imagem são obrigatórios' },
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

    // Atualizar imagem do mapa
    await connection.execute(
      `UPDATE maps 
       SET image_url = ?, width = ?, height = ?, updated_at = NOW()
       WHERE id = ?`,
      [imageUrl, width, height, mapId]
    );

    
    return NextResponse.json({
      message: 'Imagem atualizada com sucesso',
      mapId,
      width,
      height
    }, { status: 200 });
  } catch (error) {
    console.error('[API /mapas/atualizar-imagem] Erro:', error);
    return NextResponse.json(
      { error: 'Erro ao atualizar imagem do mapa' },
      { status: 500 }
    );
  } finally {
    if (connection) await connection.end();
  }
}
