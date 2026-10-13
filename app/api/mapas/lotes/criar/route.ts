import { NextRequest, NextResponse } from 'next/server';
import type { ResultSetHeader } from 'mysql2/promise';
import { executeQuery } from '@/lib/db';

// Forçar rota dinâmica
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  let lotNumber = '';
  let withBlock = true;

  try {
    const body = await request.json();
    const {
      mapId,
      blockId,
      lotNumber: lotNum,
      status = 'available',
      price,
      size,
      description,
      features = [],
      lat,
      lng,
    } = body;

    lotNumber = lotNum;
    withBlock = Boolean(blockId);

    if (!mapId || !lotNumber || !price || !size) {
      return NextResponse.json(
        { error: 'mapId, lotNumber, price e size são obrigatórios' },
        { status: 400 }
      );
    }

    // A unicidade (mapa, quadra, número) é garantida pelo UNIQUE do banco; lote sem quadra
    // (blockId nulo) também é coberto por ele, via coluna gerada block_key.
    const result = await executeQuery<ResultSetHeader>(
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
        lat !== undefined && lng !== undefined ? JSON.stringify({ lat, lng }) : null,
      ]
    );

    const newLot = {
      id: result.insertId.toString(),
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
  } catch (error) {
    const dbError = error as NodeJS.ErrnoException;
    console.error('[API /mapas/lotes/criar] Erro:', error);

    // Tratamento específico para erro de duplicata
    if (dbError.code === 'ER_DUP_ENTRY') {
      return NextResponse.json(
        {
          error: `Já existe um lote "${lotNumber}" ${withBlock ? 'nesta quadra' : 'neste mapa sem quadra'}`,
        },
        { status: 409 }
      );
    }

    return NextResponse.json({ error: 'Erro ao criar lote' }, { status: 500 });
  }
}
