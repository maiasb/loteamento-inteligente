import { NextRequest, NextResponse } from 'next/server';
import type { ResultSetHeader } from 'mysql2/promise';
import { executeQuery } from '@/lib/db';

// Forçar rota dinâmica
export const dynamic = 'force-dynamic';

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, mapId, name, description, coordinates } = body;

    if (!id || !mapId) {
      return NextResponse.json({ error: 'id e mapId são obrigatórios' }, { status: 400 });
    }
    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Nome da quadra é obrigatório' }, { status: 400 });
    }

    // A coluna blocks.coordinates é criada pela migration 013
    const result = await executeQuery<ResultSetHeader>(
      'UPDATE blocks SET name = ?, description = ?, coordinates = ?, updatedAt = NOW() WHERE id = ? AND mapId = ?',
      [name, description || '', coordinates ? JSON.stringify(coordinates) : null, id, mapId]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json({ error: 'Quadra não encontrada' }, { status: 404 });
    }

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
    if ((error as NodeJS.ErrnoException).code === 'ER_DUP_ENTRY') {
      return NextResponse.json(
        { error: 'Já existe uma quadra com este nome no mapa' },
        { status: 409 }
      );
    }

    console.error('[API /mapas/quadras PATCH] Erro:', error);
    return NextResponse.json({ error: 'Erro ao atualizar quadra' }, { status: 500 });
  }
}
