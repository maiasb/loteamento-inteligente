import { NextRequest, NextResponse } from 'next/server';
import type { RowDataPacket } from 'mysql2/promise';
import { executeQuery, type QueryParam } from '@/lib/db';

// Forçar rota dinâmica
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const reservationId = searchParams.get('reservationId');
    const status = searchParams.get('status');
    const userId = searchParams.get('userId');
    const limit = parseInt(searchParams.get('limit') || '10');

    if (!reservationId) {
      return NextResponse.json({ error: 'reservationId é obrigatório' }, { status: 400 });
    }

    // Conta as reservas que aparecem até esta na listagem (created_at DESC, id DESC): as mais
    // novas e a própria. O desempate por id mantém a posição estável quando há created_at igual.
    let countQuery = `
      SELECT COUNT(*) as position
      FROM purchase_requests pr
      INNER JOIN (SELECT created_at, id FROM purchase_requests WHERE id = ?) ref
        ON pr.created_at > ref.created_at
        OR (pr.created_at = ref.created_at AND pr.id >= ref.id)
    `;

    const whereConditions: string[] = [];
    const filterParams: QueryParam[] = [reservationId];

    // Aplicar os mesmos filtros que a listagem principal
    if (status && status !== 'all' && status !== 'undefined' && status !== 'null') {
      whereConditions.push('pr.status = ?');
      filterParams.push(status);
    }

    if (userId && userId !== 'undefined' && userId !== 'null') {
      whereConditions.push('pr.user_id = ?');
      filterParams.push(parseInt(userId));
    }

    if (whereConditions.length > 0) {
      countQuery += ' WHERE ' + whereConditions.join(' AND ');
    }

    const result = await executeQuery<RowDataPacket[]>(countQuery, filterParams);
    const position = result[0].position;

    // Calcular a página
    const page = Math.max(1, Math.ceil(position / limit));

    return NextResponse.json(
      {
        page,
        position,
        limit,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[API /reservas/find-page GET] Erro:', error);
    return NextResponse.json({ error: 'Erro ao buscar página da reserva' }, { status: 500 });
  }
}
