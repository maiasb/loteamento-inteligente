import { NextRequest, NextResponse } from 'next/server';
import mysql, { type RowDataPacket } from 'mysql2/promise';
import { dbConfig } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function DELETE(request: NextRequest) {
  let connection;

  try {
    const { searchParams } = new URL(request.url);
    const blockId = searchParams.get('blockId');

    if (!blockId) {
      return NextResponse.json({ error: 'blockId é obrigatório' }, { status: 400 });
    }

    connection = await mysql.createConnection(dbConfig);

    // Verificar se há lotes reservados ou vendidos na quadra
    const [lotsCheck] = await connection.execute<RowDataPacket[]>(
      `SELECT COUNT(*) as count FROM lots 
       WHERE block_id = ? AND status IN ('reserved', 'sold')`,
      [blockId]
    );

    if (lotsCheck[0].count > 0) {
      return NextResponse.json(
        {
          error: `Não é possível excluir esta quadra. Existem ${lotsCheck[0].count} lote(s) reservado(s) ou vendido(s).`,
          count: lotsCheck[0].count,
        },
        { status: 409 }
      );
    }

    // Primeiro deletar todos os lotes da quadra (apenas disponíveis)
    await connection.execute('DELETE FROM lots WHERE block_id = ?', [blockId]);

    // Depois deletar a quadra
    await connection.execute('DELETE FROM blocks WHERE id = ?', [blockId]);

    return NextResponse.json({ message: 'Quadra deletada com sucesso' }, { status: 200 });
  } catch (error) {
    console.error('[API /mapas/quadras/deletar] Erro:', error);
    return NextResponse.json({ error: 'Erro ao deletar quadra' }, { status: 500 });
  } finally {
    if (connection) await connection.end();
  }
}
