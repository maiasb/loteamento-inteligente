import { NextResponse } from 'next/server';
import type { RowDataPacket } from 'mysql2/promise';
import { executeQuery } from '@/lib/db';

// Forçar rota dinâmica
export const dynamic = 'force-dynamic';

/**
 * GET /api/dashboard/stats
 * Retorna estatísticas agregadas do dashboard (quantidades e valores financeiros).
 * Os valores em dinheiro são somados no SQL (DECIMAL) e só convertidos para número na resposta,
 * porque o dashboard os exibe formatados; nenhuma soma é feita em JavaScript.
 */
export async function GET() {
  try {
    const [mapsCount, lotsByStatus, financial, mapStats] = await Promise.all([
      executeQuery<RowDataPacket[]>('SELECT COUNT(*) AS total FROM maps'),

      // Quantidade de lotes por status
      executeQuery<RowDataPacket[]>('SELECT status, COUNT(*) AS count FROM lots GROUP BY status'),

      // Valores: disponível/bloqueado pelo preço de tabela; reservado/vendido pelo preço acordado
      // nas reservas pendentes/concluídas; entradas das reservas pendentes e concluídas
      executeQuery<RowDataPacket[]>(`
        SELECT
          t.*,
          (t.available_value + t.reserved_value + t.sold_value + t.blocked_value) AS total_value
        FROM (
          SELECT
            (SELECT COALESCE(SUM(price), 0) FROM lots WHERE status = 'available') AS available_value,
            (SELECT COALESCE(SUM(price), 0) FROM lots WHERE status = 'blocked') AS blocked_value,
            COALESCE(SUM(CASE WHEN pr.status = 'pending' THEN prl.agreed_price END), 0) AS reserved_value,
            COALESCE(SUM(CASE WHEN pr.status = 'completed' THEN prl.agreed_price END), 0) AS sold_value,
            COALESCE(SUM(CASE WHEN pr.status IN ('pending', 'completed') THEN prl.first_payment END), 0) AS total_first_payments
          FROM purchase_requests pr
          INNER JOIN purchase_request_lots prl ON prl.purchase_request_id = pr.id
        ) t
      `),

      // Estatísticas por mapa
      executeQuery<RowDataPacket[]>(`
        SELECT 
          m.id,
          m.name,
          m.description,
          COUNT(l.id) AS total_lots,
          SUM(CASE WHEN l.status = 'available' THEN 1 ELSE 0 END) AS available_lots,
          SUM(CASE WHEN l.status = 'reserved' THEN 1 ELSE 0 END) AS reserved_lots,
          SUM(CASE WHEN l.status = 'sold' THEN 1 ELSE 0 END) AS sold_lots,
          SUM(CASE WHEN l.status = 'blocked' THEN 1 ELSE 0 END) AS blocked_lots
        FROM maps m
        LEFT JOIN lots l ON m.id = l.map_id
        GROUP BY m.id, m.name, m.description
        ORDER BY m.created_at DESC
      `),
    ]);

    const countOf = (status: string) =>
      Number(lotsByStatus.find((row) => row.status === status)?.count) || 0;
    const totalLots = lotsByStatus.reduce((sum, row) => sum + (Number(row.count) || 0), 0);
    const money = financial[0] ?? {};

    const response = {
      summary: {
        totalMaps: Number(mapsCount[0]?.total) || 0,
        totalLots,
        availableLots: countOf('available'),
        reservedLots: countOf('reserved'),
        soldLots: countOf('sold'),
        blockedLots: countOf('blocked'),
      },
      financial: {
        totalValue: Number(money.total_value) || 0,
        availableValue: Number(money.available_value) || 0,
        reservedValue: Number(money.reserved_value) || 0,
        soldValue: Number(money.sold_value) || 0,
        blockedValue: Number(money.blocked_value) || 0,
        totalFirstPayments: Number(money.total_first_payments) || 0,
      },
      maps: mapStats.map((map) => ({
        id: map.id?.toString() || '',
        name: map.name || '',
        description: map.description || '',
        totalLots: Number(map.total_lots) || 0,
        availableLots: Number(map.available_lots) || 0,
        reservedLots: Number(map.reserved_lots) || 0,
        soldLots: Number(map.sold_lots) || 0,
        blockedLots: Number(map.blocked_lots) || 0,
      })),
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('[API /dashboard/stats GET] ❌ Erro:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar estatísticas do dashboard' },
      { status: 500 }
    );
  }
}
