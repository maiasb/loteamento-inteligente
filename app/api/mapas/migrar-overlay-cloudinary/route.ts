import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { dbConfig } from '@/lib/db';
import { uploadToCloudinary } from '@/lib/cloudinary';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * Migra overlay_config com base64 inline para URLs do Cloudinary.
 * Deve ser chamado uma vez para limpar dados legados.
 * GET /api/mapas/migrar-overlay-cloudinary
 */
export async function GET(request: NextRequest) {
  let connection;

  try {
    connection = await mysql.createConnection(dbConfig);

    // Buscar mapas que tenham overlay_config com data URL (base64)
    const [rows] = await connection.execute(
      `SELECT id, overlay_config FROM maps WHERE overlay_config IS NOT NULL`
    );

    const maps = rows as any[];
    const results: any[] = [];

    for (const map of maps) {
      let config: any;
      try {
        config = typeof map.overlay_config === 'string'
          ? JSON.parse(map.overlay_config)
          : map.overlay_config;
      } catch {
        results.push({ mapId: map.id, status: 'skip', reason: 'JSON inválido' });
        continue;
      }

      if (!config || !config.imageUrl) {
        results.push({ mapId: map.id, status: 'skip', reason: 'Sem imageUrl' });
        continue;
      }

      // Pular se já é uma URL (não é base64)
      if (!config.imageUrl.startsWith('data:')) {
        results.push({ mapId: map.id, status: 'skip', reason: 'Já é URL' });
        continue;
      }

      try {
        // Upload para Cloudinary
        const uploaded = await uploadToCloudinary(config.imageUrl, {
          folder: 'vale-dos-carajas/overlays',
          publicId: `overlay-${map.id}`,
        });

        // Atualizar config com URL do Cloudinary
        config.imageUrl = uploaded.url;
        
        await connection.execute(
          `UPDATE maps SET overlay_config = ?, updated_at = NOW() WHERE id = ?`,
          [JSON.stringify(config), map.id]
        );

        results.push({ mapId: map.id, status: 'migrated', url: uploaded.url });
      } catch (uploadError: any) {
        results.push({ mapId: map.id, status: 'error', error: uploadError.message });
      }
    }

    return NextResponse.json({
      message: 'Migração concluída',
      total: maps.length,
      results,
    }, { status: 200 });

  } catch (error: any) {
    console.error('[API /mapas/migrar-overlay-cloudinary] Erro:', error);
    return NextResponse.json(
      { error: 'Erro na migração', details: error.message },
      { status: 500 }
    );
  } finally {
    if (connection) await connection.end();
  }
}
