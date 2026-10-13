import { NextRequest, NextResponse } from 'next/server';
import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { getPool } from '@/lib/db';

export const dynamic = 'force-dynamic';

const ER_ROW_IS_REFERENCED = 1451;

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lotId = searchParams.get('lotId');

  if (!lotId) {
    return NextResponse.json({ error: 'lotId é obrigatório' }, { status: 400 });
  }

  let connection: PoolConnection | undefined;

  try {
    connection = await getPool().getConnection();
    await connection.beginTransaction();

    // Trava o lote para que ninguém o reserve entre a verificação e a exclusão
    const [lots] = await connection.execute<RowDataPacket[]>(
      'SELECT status FROM lots WHERE id = ? FOR UPDATE',
      [lotId]
    );

    if (lots.length === 0) {
      await connection.rollback();
      return NextResponse.json({ error: 'Lote não encontrado' }, { status: 404 });
    }

    const lot = lots[0];
    if (lot.status === 'reserved' || lot.status === 'sold') {
      await connection.rollback();
      return NextResponse.json(
        {
          error: 'Não é possível excluir este lote',
          message: `Este lote está ${lot.status === 'reserved' ? 'reservado' : 'vendido'}. Para excluí-lo, cancele primeiro a ${lot.status === 'reserved' ? 'reserva' : 'venda'} na página de Reservas.`,
          status: lot.status,
        },
        { status: 400 }
      );
    }

    // Reservas encerradas (cancelled, rejected) não impedem a exclusão; as ativas, sim
    const [active] = await connection.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS count FROM purchase_request_lots prl
       INNER JOIN purchase_requests pr ON pr.id = prl.purchase_request_id
       WHERE prl.lot_id = ? AND COALESCE(pr.status, 'pending') NOT IN ('cancelled', 'rejected')`,
      [lotId]
    );

    if (active[0].count > 0) {
      await connection.rollback();
      return NextResponse.json(
        {
          error: 'Não é possível excluir este lote',
          message: `Este lote tem ${active[0].count} reserva(s) ativa(s) (pendente, aprovada ou concluída). Cancele todas as reservas dele na página de Reservas para poder excluí-lo.`,
        },
        { status: 409 }
      );
    }

    // A reserva cancelada continua como histórico, só sem este lote
    await connection.execute('DELETE FROM purchase_request_lots WHERE lot_id = ?', [lotId]);
    await connection.execute('DELETE FROM lots WHERE id = ?', [lotId]);
    await connection.commit();

    return NextResponse.json({ message: 'Lote deletado com sucesso' }, { status: 200 });
  } catch (error) {
    await connection?.rollback();

    if ((error as { errno?: number }).errno === ER_ROW_IS_REFERENCED) {
      return NextResponse.json(
        {
          error: 'Não é possível excluir este lote',
          message:
            'Uma reserva foi criada para este lote durante a exclusão. Tente novamente após cancelá-la.',
        },
        { status: 409 }
      );
    }

    console.error('[API /mapas/lotes/deletar] Erro:', error);
    return NextResponse.json({ error: 'Erro ao deletar lote' }, { status: 500 });
  } finally {
    connection?.release();
  }
}
