import { NextRequest, NextResponse } from 'next/server';
import mysql, { type RowDataPacket } from 'mysql2/promise';
import { dbConfig } from '@/lib/db';

export async function DELETE(request: NextRequest) {
  let connection;

  try {
    const { searchParams } = new URL(request.url);
    const lotId = searchParams.get('lotId');

    if (!lotId) {
      return NextResponse.json({ error: 'lotId é obrigatório' }, { status: 400 });
    }

    connection = await mysql.createConnection(dbConfig);

    // Verificar se o lote está reservado ou vendido
    const [lots] = await connection.execute<RowDataPacket[]>(
      'SELECT status FROM lots WHERE id = ?',
      [lotId]
    );

    if (lots.length === 0) {
      return NextResponse.json({ error: 'Lote não encontrado' }, { status: 404 });
    }

    const lot = lots[0];
    if (lot.status === 'reserved' || lot.status === 'sold') {
      return NextResponse.json(
        {
          error: 'Não é possível excluir este lote',
          message: `Este lote está ${lot.status === 'reserved' ? 'reservado' : 'vendido'}. Para excluí-lo, cancele primeiro a ${lot.status === 'reserved' ? 'reserva' : 'venda'} na página de Reservas.`,
          status: lot.status,
        },
        { status: 400 }
      );
    }

    await connection.execute('DELETE FROM lots WHERE id = ?', [lotId]);

    return NextResponse.json({ message: 'Lote deletado com sucesso' }, { status: 200 });
  } catch (error) {
    console.error('[API /mapas/lotes/deletar] Erro:', error);
    return NextResponse.json({ error: 'Erro ao deletar lote' }, { status: 500 });
  } finally {
    if (connection) await connection.end();
  }
}
