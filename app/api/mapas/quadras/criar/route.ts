import { NextRequest, NextResponse } from 'next/server';
import type { ResultSetHeader } from 'mysql2/promise';
import { executeQuery } from '@/lib/db';

// Forçar rota dinâmica
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { mapId, name, description } = body;

    if (!mapId || !name) {
      return NextResponse.json({ error: 'mapId e name são obrigatórios' }, { status: 400 });
    }

    // INSERT incluindo createdAt e updatedAt (campos obrigatórios)
    const result = await executeQuery<ResultSetHeader>(
      'INSERT INTO blocks (mapId, name, description, createdAt, updatedAt) VALUES (?, ?, ?, NOW(), NOW())',
      [mapId, name, description || '']
    );

    const newBlock = {
      id: result.insertId.toString(),
      mapId,
      name,
      description: description || '',
    };

    return NextResponse.json(newBlock, { status: 201 });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ER_DUP_ENTRY') {
      return NextResponse.json(
        { error: 'Já existe uma quadra com este nome no mapa' },
        { status: 409 }
      );
    }

    console.error('[API /mapas/quadras/criar] Erro:', error);
    return NextResponse.json({ error: 'Erro ao criar quadra' }, { status: 500 });
  }
}
