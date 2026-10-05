import { NextRequest, NextResponse } from 'next/server';
import mysql, { type RowDataPacket } from 'mysql2/promise';
import { dbConfig, type QueryParam } from '@/lib/db';

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
  let connection;

  try {
    connection = await mysql.createConnection(dbConfig);

    const { searchParams } = new URL(request.url);
    const minimal = searchParams.get('minimal') === 'true';
    const mapId = searchParams.get('mapId');
    const blockId = searchParams.get('blockId');

    // Parâmetros de paginação
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
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

      query += ' ORDER BY created_at DESC';

      const [reservations] = await connection.execute(query, params);

      // Para cada reserva, buscar IDs dos lotes e agreed_price
      const reservationsWithLots = await Promise.all(
        (reservations as RowDataPacket[]).map(async (reservation) => {
          try {
            // Filtrar lotes por quadra ou mapa
            let lotQuery =
              'SELECT lot_id as id, agreed_price, first_payment, installments, payment_method FROM purchase_request_lots WHERE purchase_request_id = ?';
            const lotParams: QueryParam[] = [reservation.id];

            if (blockId) {
              lotQuery = `SELECT prl.lot_id as id, prl.agreed_price, prl.first_payment, prl.installments, prl.payment_method 
                          FROM purchase_request_lots prl 
                          INNER JOIN lots l ON prl.lot_id = l.id 
                          WHERE prl.purchase_request_id = ? AND l.block_id = ?`;
              lotParams.push(blockId);
            } else if (mapId) {
              lotQuery = `SELECT prl.lot_id as id, prl.agreed_price, prl.first_payment, prl.installments, prl.payment_method 
                          FROM purchase_request_lots prl 
                          INNER JOIN lots l ON prl.lot_id = l.id 
                          WHERE prl.purchase_request_id = ? AND l.map_id = ?`;
              lotParams.push(mapId);
            }

            const [lots] = await connection!.execute(lotQuery, lotParams);

            return {
              id: reservation.id,
              customer_name: reservation.customer_name,
              seller_name: reservation.seller_name,
              status: reservation.status,
              created_at: formatDateTime(reservation.created_at),
              lots: lots || [],
            };
          } catch (error) {
            console.error(
              `[API /reservas GET] Erro ao buscar lotes da reserva ${reservation.id}:`,
              error
            );
            return {
              id: reservation.id,
              customer_name: reservation.customer_name,
              seller_name: reservation.seller_name,
              status: reservation.status,
              created_at: formatDateTime(reservation.created_at),
              lots: [],
            };
          }
        })
      );

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
    const [countResult] = await connection.execute(countQuery, filterParams);
    const totalCount = (countResult as RowDataPacket[])[0].total;

    // Obter estatísticas gerais (todas as reservas, sem filtro de status/paginação)
    // para evitar requisição separada ao /reservas/stats
    let statsBaseQuery = 'SELECT COUNT(*) as count, status FROM purchase_requests';
    const statsParams: QueryParam[] = [];

    if (userId && userId !== 'undefined' && userId !== 'null') {
      statsBaseQuery += ' WHERE user_id = ?';
      statsParams.push(parseInt(userId));
    }

    statsBaseQuery += ' GROUP BY status';
    const [statsResults] = await connection.execute(statsBaseQuery, statsParams);

    const stats = { total: 0, pending: 0, completed: 0, cancelled: 0 };
    (statsResults as RowDataPacket[]).forEach((row) => {
      stats.total += row.count;
      if (row.status === 'pending') stats.pending = row.count;
      else if (row.status === 'completed') stats.completed = row.count;
      else if (row.status === 'cancelled') stats.cancelled = row.count;
    });

    // Adicionar ordenação e paginação
    query += ' ORDER BY created_at DESC';

    // Calcular offset - garantir que são números inteiros
    const limitInt = parseInt(limit.toString());
    const offsetInt = parseInt(((page - 1) * limit).toString());

    // Usar interpolação direta para LIMIT e OFFSET (seguro pois são inteiros validados)
    query += ` LIMIT ${limitInt} OFFSET ${offsetInt}`;

    const [reservations] = await connection.execute(query, filterParams);

    // Para cada reserva, buscar os lotes associados com agreed_price, first_payment e installments
    const reservationsWithLots = await Promise.all(
      (reservations as RowDataPacket[]).map(async (reservation) => {
        try {
          // Primeiro tenta com blocks e maps, se falhar, tenta sem blocks
          let lots;
          try {
            [lots] = await connection!.execute(
              `SELECT l.*, prl.purchase_request_id, prl.agreed_price, prl.first_payment, prl.installments, prl.payment_method, 
                      b.name as block_name, m.name as map_name 
               FROM purchase_request_lots prl
               INNER JOIN lots l ON prl.lot_id = l.id
               LEFT JOIN blocks b ON l.block_id = b.id
               LEFT JOIN maps m ON l.map_id = m.id
               WHERE prl.purchase_request_id = ?`,
              [reservation.id]
            );
          } catch {
            // Fallback sem blocks
            console.warn('[API /reservas GET] Tabela blocks não encontrada, usando fallback');
            [lots] = await connection!.execute(
              `SELECT l.*, prl.purchase_request_id, prl.agreed_price, prl.first_payment, prl.installments, prl.payment_method,
                      m.name as map_name
               FROM purchase_request_lots prl
               INNER JOIN lots l ON prl.lot_id = l.id
               LEFT JOIN maps m ON l.map_id = m.id
               WHERE prl.purchase_request_id = ?`,
              [reservation.id]
            );
          }

          return {
            ...reservation,
            created_at: formatDateTime(reservation.created_at),
            lots: lots || [],
          };
        } catch (lotError) {
          console.error(
            `[API /reservas GET] Erro ao buscar lotes da reserva ${reservation.id}:`,
            lotError
          );
          return {
            ...reservation,
            created_at: formatDateTime(reservation.created_at),
            lots: [],
          };
        }
      })
    );

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
  } finally {
    if (connection) await connection.end();
  }
}
