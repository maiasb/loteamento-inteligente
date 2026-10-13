import { NextRequest, NextResponse } from 'next/server';
import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { getPool } from '@/lib/db';

export const dynamic = 'force-dynamic';

const ER_ROW_IS_REFERENCED = 1451;

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const blockId = searchParams.get('blockId');

  if (!blockId) {
    return NextResponse.json({ error: 'blockId é obrigatório' }, { status: 400 });
  }

  let connection: PoolConnection | undefined;

  try {
    connection = await getPool().getConnection();
    await connection.beginTransaction();

    // Trava os lotes da quadra (em ordem de id) para ninguém reservá-los durante a exclusão
    const [lots] = await connection.execute<RowDataPacket[]>(
      'SELECT id, status FROM lots WHERE block_id = ? ORDER BY id FOR UPDATE',
      [blockId]
    );

    const inUse = lots.filter((lot) => lot.status === 'reserved' || lot.status === 'sold').length;
    if (inUse > 0) {
      await connection.rollback();
      return NextResponse.json(
        {
          error: `Não é possível excluir esta quadra. Existem ${inUse} lote(s) reservado(s) ou vendido(s).`,
          count: inUse,
        },
        { status: 409 }
      );
    }

    const [history] = await connection.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS count FROM purchase_request_lots prl
       INNER JOIN lots l ON l.id = prl.lot_id
       WHERE l.block_id = ?`,
      [blockId]
    );

    if (history[0].count > 0) {
      await connection.rollback();
      return NextResponse.json(
        {
          error:
            'Não é possível excluir esta quadra. Existem lotes com reservas registradas (mesmo canceladas).',
        },
        { status: 409 }
      );
    }

    await connection.execute('DELETE FROM lots WHERE block_id = ?', [blockId]);
    await connection.execute('DELETE FROM blocks WHERE id = ?', [blockId]);
    await connection.commit();

    return NextResponse.json({ message: 'Quadra deletada com sucesso' }, { status: 200 });
  } catch (error) {
    await connection?.rollback();

    if ((error as { errno?: number }).errno === ER_ROW_IS_REFERENCED) {
      return NextResponse.json(
        { error: 'Não é possível excluir esta quadra. Existem lotes com reservas registradas.' },
        { status: 409 }
      );
    }

    console.error('[API /mapas/quadras/deletar] Erro:', error);
    return NextResponse.json({ error: 'Erro ao deletar quadra' }, { status: 500 });
  } finally {
    connection?.release();
  }
}
