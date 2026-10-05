import { NextRequest, NextResponse } from 'next/server';
import mysql, { type RowDataPacket } from 'mysql2/promise';
import { dbConfig } from '@/lib/db';

// Forçar rota dinâmica
export const dynamic = 'force-dynamic';

export async function DELETE(request: NextRequest) {
  let connection;

  try {
    const { searchParams } = new URL(request.url);
    const mapId = searchParams.get('mapId');

    if (!mapId) {
      return NextResponse.json({ error: 'mapId é obrigatório' }, { status: 400 });
    }

    connection = await mysql.createConnection(dbConfig);

    // Verificar se há lotes reservados ou vendidos no mapa
    const [lotsCheck] = await connection.execute<RowDataPacket[]>(
      `SELECT COUNT(*) as count FROM lots 
       WHERE map_id = ? AND status IN ('reserved', 'sold')`,
      [mapId]
    );

    if (lotsCheck[0].count > 0) {
      return NextResponse.json(
        {
          error: `Não é possível excluir este mapa. Existem ${lotsCheck[0].count} lote(s) reservado(s) ou vendido(s).`,
          count: lotsCheck[0].count,
        },
        { status: 409 }
      );
    }

    await connection.execute('DELETE FROM maps WHERE id = ?', [mapId]);

    return NextResponse.json({ message: 'Mapa deletado com sucesso' }, { status: 200 });
  } catch (error) {
    console.error('[API /mapas/deletar] Erro:', error);
    return NextResponse.json({ error: 'Erro ao deletar mapa' }, { status: 500 });
  } finally {
    if (connection) await connection.end();
  }
}
