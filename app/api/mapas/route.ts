import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { dbConfig } from '@/lib/db';

// Forçar rota dinâmica
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  let connection;
  
  try {

    // Conectar ao banco de dados
    connection = await mysql.createConnection(dbConfig);

    // Verificar se a coluna overlay_config existe
    const [overlayCols] = await connection.execute(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'maps' AND COLUMN_NAME = 'overlay_config'`
    ) as any;
    const hasOverlay = Array.isArray(overlayCols) && overlayCols.length > 0;
    const overlayCol = hasOverlay ? ', overlay_config' : '';
    const overlayColM = hasOverlay ? ', m.overlay_config' : '';

    // Verificar se é requisição do dashboard (sem imagem) ou filtro por ID
    const { searchParams } = new URL(request.url);
    const minimal = searchParams.get('minimal') === 'true';
    const mapId = searchParams.get('id');
    const withLots = searchParams.get('withLots') === 'true'; // Apenas mapas com lotes

    // Construir query baseada nos parâmetros
    let query: string;
    let params: any[] = [];

    if (mapId) {
      // Buscar mapa específico por ID (sempre com imageUrl)
      query = `SELECT id, name, description, image_url, width, height, address${overlayCol}, created_at, updated_at FROM maps WHERE id = ?`;
      params = [mapId];
    } else if (withLots) {
      // Buscar apenas mapas que tenham pelo menos um lote cadastrado em qualquer quadra
      if (minimal) {
        query = `
          SELECT DISTINCT m.id, m.name, m.description, m.width, m.height, m.address${overlayColM}, m.created_at, m.updated_at
          FROM maps m
          INNER JOIN blocks b ON b.mapId = m.id
          INNER JOIN lots l ON l.block_id = b.id
          ORDER BY m.created_at DESC
        `;
      } else {
        query = `
          SELECT DISTINCT m.id, m.name, m.description, m.image_url, m.width, m.height, m.address${overlayColM}, m.created_at, m.updated_at
          FROM maps m
          INNER JOIN blocks b ON b.mapId = m.id
          INNER JOIN lots l ON l.block_id = b.id
          ORDER BY m.created_at DESC
        `;
      }
    } else if (minimal) {
      // Buscar todos sem image_url
      query = `SELECT id, name, description, width, height, address${overlayCol}, created_at, updated_at FROM maps ORDER BY created_at DESC`;
    } else {
      // Buscar todos com image_url
      query = `SELECT id, name, description, image_url, width, height, address${overlayCol}, created_at, updated_at FROM maps ORDER BY created_at DESC`;
    }

    const [rows] = await connection.execute(query, params);

    if (!Array.isArray(rows)) {
      return NextResponse.json([], { status: 200 });
    }

    // Formatar resposta (mesmo formato do n8n)
    const formattedMaps = rows.map((map: any) => {
      // Parse overlay_config
      let overlayConfig = null;
      if (map.overlay_config) {
        try {
          overlayConfig = typeof map.overlay_config === 'string'
            ? JSON.parse(map.overlay_config)
            : map.overlay_config;
        } catch (e) {
          console.error('Erro ao fazer parse de overlay_config:', e);
        }
      }

      const base: any = {
        mapId: map.id?.toString() || '',
        name: map.name || '',
        description: map.description || '',
        width: map.width ? Number(map.width) : null,
        height: map.height ? Number(map.height) : null,
        address: map.address || '',
        overlayConfig: overlayConfig,
        createdAt: map.created_at
          ? map.created_at.toISOString().replace('T', ' ').slice(0, 19)
          : null,
        updatedAt: map.updated_at
          ? map.updated_at.toISOString().replace('T', ' ').slice(0, 19)
          : null,
      };
      
      // Apenas incluir imageUrl se não for requisição minimal
      if (!minimal) {
        base.imageUrl = map.image_url || '';
      }
      
      return base;
    });

    return NextResponse.json(formattedMaps, { status: 200 });
  } catch (error) {
    console.error('[API /mapas GET] ❌ Erro:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar mapas' },
      { status: 500 }
    );
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}
