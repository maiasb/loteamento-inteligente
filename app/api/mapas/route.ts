import { NextRequest, NextResponse } from 'next/server';
import type { RowDataPacket } from 'mysql2/promise';
import { executeQuery, type QueryParam } from '@/lib/db';

// Forçar rota dinâmica
export const dynamic = 'force-dynamic';

interface MapResponse {
  mapId: string;
  name: string;
  description: string;
  width: number | null;
  height: number | null;
  address: string;
  overlayConfig: unknown;
  createdAt: string | null;
  updatedAt: string | null;
  imageUrl?: string;
}

export async function GET(request: NextRequest) {
  try {
    // Verificar se é requisição do dashboard (sem imagem) ou filtro por ID
    const { searchParams } = new URL(request.url);
    const minimal = searchParams.get('minimal') === 'true';
    const mapId = searchParams.get('id');
    const withLots = searchParams.get('withLots') === 'true'; // Apenas mapas com lotes

    // Construir query baseada nos parâmetros
    let query: string;
    let params: QueryParam[] = [];

    if (mapId) {
      // Buscar mapa específico por ID (sempre com imageUrl)
      query = `SELECT id, name, description, image_url, width, height, address, overlay_config, created_at, updated_at FROM maps WHERE id = ?`;
      params = [mapId];
    } else if (withLots) {
      // Buscar apenas mapas que tenham pelo menos um lote cadastrado
      const imageCol = minimal ? '' : ' m.image_url,';
      query = `
        SELECT m.id, m.name, m.description,${imageCol} m.width, m.height, m.address, m.overlay_config, m.created_at, m.updated_at
        FROM maps m
        WHERE EXISTS (SELECT 1 FROM lots l WHERE l.map_id = m.id)
        ORDER BY m.created_at DESC
      `;
    } else {
      const imageCol = minimal ? '' : ' image_url,';
      query = `SELECT id, name, description,${imageCol} width, height, address, overlay_config, created_at, updated_at FROM maps ORDER BY created_at DESC`;
    }

    const rows = await executeQuery<RowDataPacket[]>(query, params);

    // Formatar resposta
    const formattedMaps = rows.map((map) => {
      // Parse overlay_config
      let overlayConfig = null;
      if (map.overlay_config) {
        try {
          overlayConfig =
            typeof map.overlay_config === 'string'
              ? JSON.parse(map.overlay_config)
              : map.overlay_config;
        } catch (e) {
          console.error('Erro ao fazer parse de overlay_config:', e);
        }
      }

      const base: MapResponse = {
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
    return NextResponse.json({ error: 'Erro ao buscar mapas' }, { status: 500 });
  }
}
