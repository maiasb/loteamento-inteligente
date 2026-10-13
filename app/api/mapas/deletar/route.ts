import { NextRequest, NextResponse } from 'next/server';
import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { getPool } from '@/lib/db';

export const dynamic = 'force-dynamic';

const ER_ROW_IS_REFERENCED = 1451;

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mapId = searchParams.get('mapId');

  if (!mapId) {
    return NextResponse.json({ error: 'mapId é obrigatório' }, { status: 400 });
  }

  let connection: PoolConnection | undefined;

  try {
    connection = await getPool().getConnection();
    await connection.beginTransaction();

    // Trava os lotes do mapa (em ordem de id) para ninguém reservá-los durante a exclusão
    const [lots] = await connection.execute<RowDataPacket[]>(
      'SELECT id, status FROM lots WHERE map_id = ? ORDER BY id FOR UPDATE',
      [mapId]
    );

    const inUse = lots.filter((lot) => lot.status === 'reserved' || lot.status === 'sold').length;
    if (inUse > 0) {
      await connection.rollback();
      return NextResponse.json(
        {
          error: `Não é possível excluir este mapa. Existem ${inUse} lote(s) reservado(s) ou vendido(s).`,
          count: inUse,
        },
        { status: 409 }
      );
    }

    // Reservas encerradas (cancelled, rejected) não impedem a exclusão; as ativas, sim
    const [active] = await connection.execute<RowDataPacket[]>(
      `SELECT COUNT(DISTINCT pr.id) AS count FROM purchase_request_lots prl
       INNER JOIN lots l ON l.id = prl.lot_id
       INNER JOIN purchase_requests pr ON pr.id = prl.purchase_request_id
       WHERE l.map_id = ? AND COALESCE(pr.status, 'pending') NOT IN ('cancelled', 'rejected')`,
      [mapId]
    );

    if (active[0].count > 0) {
      await connection.rollback();
      return NextResponse.json(
        {
          error: `Não é possível excluir este mapa. Existem ${active[0].count} reserva(s) ativa(s) (pendente, aprovada ou concluída) em lotes dele. Cancele essas reservas na página de Reservas para poder excluir.`,
          count: active[0].count,
        },
        { status: 409 }
      );
    }

    // As reservas canceladas continuam como histórico, só sem os lotes excluídos
    await connection.execute(
      `DELETE prl FROM purchase_request_lots prl
       INNER JOIN lots l ON l.id = prl.lot_id
       WHERE l.map_id = ?`,
      [mapId]
    );
    await connection.execute('DELETE FROM maps WHERE id = ?', [mapId]);
    await connection.commit();

    return NextResponse.json({ message: 'Mapa deletado com sucesso' }, { status: 200 });
  } catch (error) {
    await connection?.rollback();

    if ((error as { errno?: number }).errno === ER_ROW_IS_REFERENCED) {
      return NextResponse.json(
        {
          error:
            'Não é possível excluir este mapa. Uma reserva foi criada durante a exclusão. Tente novamente.',
        },
        { status: 409 }
      );
    }

    console.error('[API /mapas/deletar] Erro:', error);
    return NextResponse.json({ error: 'Erro ao deletar mapa' }, { status: 500 });
  } finally {
    connection?.release();
  }
}
