import { NextRequest, NextResponse } from 'next/server';
import type { RowDataPacket } from 'mysql2/promise';
import { executeQuery, type QueryParam } from '@/lib/db';

// Forçar rota dinâmica
export const dynamic = 'force-dynamic';

// Função auxiliar para formatar datetime sem timezone
function formatDateTime(date: unknown): string {
  if (!date) return '';
  if (typeof date === 'string') return date;

  // Se for Date object, formatar para YYYY-MM-DD HH:MM:SS (hora local do servidor)
  if (date instanceof Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }

  return String(date);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const minimal = searchParams.get('minimal') === 'true';
    const mapId = searchParams.get('mapId');
    const blockId = searchParams.get('blockId');

    // Parâmetros de paginação
    const parsedPage = parseInt(searchParams.get('page') ?? '', 10);
    const parsedLimit = parseInt(searchParams.get('limit') ?? '', 10);
    const page = Number.isNaN(parsedPage) ? 1 : Math.max(1, parsedPage);
    const limit = Number.isNaN(parsedLimit) ? 10 : Math.min(1000, Math.max(1, parsedLimit));
    const status = searchParams.get('status');
    const userId = searchParams.get('userId');

    if (minimal) {
      // Retornar apenas campos essenciais para tooltip em /maps/
      let query =
        'SELECT id, customer_name, seller_name, status, created_at FROM purchase_requests';
      const params: QueryParam[] = [];

      // Filtrar por quadra (mais específico) ou por mapa
      if (blockId) {
        query +=
          ' WHERE id IN (SELECT DISTINCT purchase_request_id FROM purchase_request_lots prl INNER JOIN lots l ON prl.lot_id = l.id WHERE l.block_id = ?)';
        params.push(blockId);
      } else if (mapId) {
        query +=
          ' WHERE id IN (SELECT DISTINCT purchase_request_id FROM purchase_request_lots prl INNER JOIN lots l ON prl.lot_id = l.id WHERE l.map_id = ?)';
        params.push(mapId);
      }

      query += ' ORDER BY created_at DESC, id DESC';

      const reservationRows = await executeQuery<RowDataPacket[]>(query, params);
      const lotsByReservation = new Map<number, RowDataPacket[]>();

      if (reservationRows.length > 0) {
        const placeholders = reservationRows.map(() => '?').join(',');
        const lotParams: QueryParam[] = reservationRows.map((reservation) => reservation.id);
        let lotQuery = `SELECT prl.purchase_request_id, prl.lot_id as id, prl.agreed_price, prl.first_payment, prl.installments, prl.payment_method
                        FROM purchase_request_lots prl
                        INNER JOIN lots l ON prl.lot_id = l.id
                        WHERE prl.purchase_request_id IN (${placeholders})`;

        if (blockId) {
          lotQuery += ' AND l.block_id = ?';
          lotParams.push(blockId);
        } else if (mapId) {
          lotQuery += ' AND l.map_id = ?';
          lotParams.push(mapId);
        }

        const lotRows = await executeQuery<RowDataPacket[]>(lotQuery, lotParams);
        for (const row of lotRows) {
          const { purchase_request_id: requestId, ...lot } = row;
          const list = lotsByReservation.get(requestId) ?? [];
          list.push(lot as RowDataPacket);
          lotsByReservation.set(requestId, list);
        }
      }

      const reservationsWithLots = reservationRows.map((reservation) => ({
        id: reservation.id,
        customer_name: reservation.customer_name,
        seller_name: reservation.seller_name,
        status: reservation.status,
        created_at: formatDateTime(reservation.created_at),
        lots: lotsByReservation.get(reservation.id) ?? [],
      }));

      return NextResponse.json(reservationsWithLots || [], { status: 200 });
    }

    // Buscar todas as reservas (modo completo) com paginação
    let query = 'SELECT * FROM purchase_requests';
    let countQuery = 'SELECT COUNT(*) as total FROM purchase_requests';
    const whereConditions: string[] = [];
    const filterParams: QueryParam[] = [];

    // Aplicar filtros (verificar se não é null/undefined)
    if (status && status !== 'all' && status !== 'undefined' && status !== 'null') {
      whereConditions.push('status = ?');
      filterParams.push(status);
    }

    if (userId && userId !== 'undefined' && userId !== 'null') {
      whereConditions.push('user_id = ?');
      filterParams.push(parseInt(userId));
    }

    // Adicionar WHERE clause se houver condições
    if (whereConditions.length > 0) {
      const whereClause = ' WHERE ' + whereConditions.join(' AND ');
      query += whereClause;
      countQuery += whereClause;
    }

    // Obter contagem total
    const countResult = await executeQuery<RowDataPacket[]>(countQuery, filterParams);
    const totalCount = countResult[0].total;

    // Obter estatísticas gerais (todas as reservas, sem filtro de status/paginação)
    // para evitar requisição separada ao /reservas/stats
    let statsBaseQuery = 'SELECT COUNT(*) as count, status FROM purchase_requests';
    const statsParams: QueryParam[] = [];

    if (userId && userId !== 'undefined' && userId !== 'null') {
      statsBaseQuery += ' WHERE user_id = ?';
      statsParams.push(parseInt(userId));
    }

    statsBaseQuery += ' GROUP BY status';
    const statsResults = await executeQuery<RowDataPacket[]>(statsBaseQuery, statsParams);

    const stats = { total: 0, pending: 0, completed: 0, cancelled: 0 };
    statsResults.forEach((row) => {
      stats.total += row.count;
      if (row.status === 'pending') stats.pending = row.count;
      else if (row.status === 'completed') stats.completed = row.count;
      else if (row.status === 'cancelled') stats.cancelled = row.count;
    });

    // Adicionar ordenação e paginação
    query += ' ORDER BY created_at DESC, id DESC';

    // Calcular offset - garantir que são números inteiros
    const limitInt = limit;
    const offsetInt = (page - 1) * limit;

    // Usar interpolação direta para LIMIT e OFFSET (seguro pois são inteiros validados)
    query += ` LIMIT ${limitInt} OFFSET ${offsetInt}`;

    const reservationRows = await executeQuery<RowDataPacket[]>(query, filterParams);
    const lotsByReservation = new Map<number, RowDataPacket[]>();

    if (reservationRows.length > 0) {
      const placeholders = reservationRows.map(() => '?').join(',');
      const lotRows = await executeQuery<RowDataPacket[]>(
        `SELECT l.*, prl.purchase_request_id, prl.agreed_price, prl.first_payment, prl.installments, prl.payment_method,
                b.name as block_name, m.name as map_name
         FROM purchase_request_lots prl
         INNER JOIN lots l ON prl.lot_id = l.id
         LEFT JOIN blocks b ON l.block_id = b.id
         LEFT JOIN maps m ON l.map_id = m.id
         WHERE prl.purchase_request_id IN (${placeholders})`,
        reservationRows.map((reservation) => reservation.id)
      );
      for (const row of lotRows) {
        const list = lotsByReservation.get(row.purchase_request_id) ?? [];
        list.push(row);
        lotsByReservation.set(row.purchase_request_id, list);
      }
    }

    const reservationsWithLots = reservationRows.map((reservation) => ({
      ...reservation,
      created_at: formatDateTime(reservation.created_at),
      lots: lotsByReservation.get(reservation.id) ?? [],
    }));

    return NextResponse.json(
      {
        reservations: reservationsWithLots || [],
        totalCount,
        stats,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[API /reservas GET] Erro:', error);
    return NextResponse.json({ error: 'Erro ao buscar reservas' }, { status: 500 });
  }
}
