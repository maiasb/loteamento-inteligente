import { NextRequest, NextResponse } from 'next/server';
import mysql, { type RowDataPacket } from 'mysql2/promise';
import { dbConfig } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  let connection;

  try {
    const body = await request.json();
    const { mapId, overlayConfig } = body;

    if (!mapId) {
      return NextResponse.json({ error: 'ID do mapa é obrigatório' }, { status: 400 });
    }

    connection = await mysql.createConnection(dbConfig);

    // Verificar se o mapa existe
    const [maps] = await connection.execute('SELECT id FROM maps WHERE id = ?', [mapId]);

    if (!Array.isArray(maps) || maps.length === 0) {
      return NextResponse.json({ error: 'Mapa não encontrado' }, { status: 404 });
    }

    // Verificar se a coluna overlay_config existe
    const [columns] = await connection.execute<RowDataPacket[]>(
      `SELECT COLUMN_NAME 
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() 
       AND TABLE_NAME = 'maps' 
       AND COLUMN_NAME = 'overlay_config'`
    );

    const hasOverlayConfig = Array.isArray(columns) && columns.length > 0;

    if (!hasOverlayConfig) {
      await connection.execute(
        `ALTER TABLE maps 
         ADD COLUMN overlay_config JSON DEFAULT NULL AFTER address`
      );
    }

    // Validar overlayConfig se fornecido
    if (overlayConfig) {
      if (!overlayConfig.imageUrl || typeof overlayConfig.imageUrl !== 'string') {
        return NextResponse.json(
          { error: 'imageUrl é obrigatório no overlayConfig' },
          { status: 400 }
        );
      }
      if (!overlayConfig.bounds || typeof overlayConfig.bounds.north !== 'number') {
        return NextResponse.json({ error: 'bounds inválidos no overlayConfig' }, { status: 400 });
      }
    }

    // Salvar (null para remover overlay)
    const configValue = overlayConfig ? JSON.stringify(overlayConfig) : null;

    await connection.execute(
      `UPDATE maps 
       SET overlay_config = ?, 
           updated_at = NOW()
       WHERE id = ?`,
      [configValue, mapId]
    );

    return NextResponse.json({
      success: true,
      message: overlayConfig ? 'Overlay configurado com sucesso' : 'Overlay removido com sucesso',
      mapId,
      overlayConfig,
    });
  } catch (error) {
    console.error('[API] Erro ao configurar overlay do mapa:', error);
    return NextResponse.json(
      {
        error: 'Erro ao configurar overlay do mapa',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}
