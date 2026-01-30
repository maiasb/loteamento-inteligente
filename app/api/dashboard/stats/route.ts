import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { withDbConnection } from '@/lib/dbConnection';

// Forçar rota dinâmica
export const dynamic = 'force-dynamic';

/**
 * GET /api/dashboard/stats
 * Retorna estatísticas agregadas do dashboard (quantidades e valores financeiros)
 * Otimizado para não trazer dados detalhados desnecessários
 */
export async function GET(request: NextRequest) {
  try {
    const result = await withDbConnection(async (connection) => {
      // Executar queries em paralelo para melhor performance
      const [
        [mapsCount],
        [lotsStats],
        [reservationsStats],
        [mapStats]
      ] = await Promise.all([
        // Contar total de mapas
        connection.execute('SELECT COUNT(*) as total FROM maps'),
        
        // Estatísticas de lotes por status (contagem e valor)
        connection.execute(`
          SELECT 
            status,
            COUNT(*) as count,
            SUM(price) as total_value
          FROM lots
          GROUP BY status
        `),
        
        // Buscar dados agregados das reservas
        connection.execute(`
          SELECT 
            pr.status,
            SUM(prl.agreed_price) as total_agreed,
            SUM(prl.first_payment) as total_first_payment
          FROM purchase_requests pr
          INNER JOIN purchase_request_lots prl ON pr.id = prl.purchase_request_id
          GROUP BY pr.status
        `),
        
        // Buscar estatísticas por mapa
        connection.execute(`
          SELECT 
            m.id,
            m.name,
            m.description,
            COUNT(l.id) as total_lots,
            SUM(CASE WHEN l.status = 'available' THEN 1 ELSE 0 END) as available_lots,
            SUM(CASE WHEN l.status = 'reserved' THEN 1 ELSE 0 END) as reserved_lots,
            SUM(CASE WHEN l.status = 'sold' THEN 1 ELSE 0 END) as sold_lots,
            SUM(CASE WHEN l.status = 'blocked' THEN 1 ELSE 0 END) as blocked_lots
          FROM maps m
          LEFT JOIN lots l ON m.id = l.map_id
          GROUP BY m.id, m.name, m.description
          ORDER BY m.created_at DESC
        `)
      ]);
      
      const totalMaps = (mapsCount as any)[0]?.total || 0;

    // Processar estatísticas de lotes
    const lotsStatsMap = (lotsStats as any[]).reduce((acc, row) => {
      acc[row.status] = {
        count: Number(row.count) || 0,
        totalValue: Number(row.total_value) || 0,
      };
      return acc;
    }, {} as Record<string, { count: number; totalValue: number }>);

    // Processar estatísticas de reservas
    const reservationsStatsMap = (reservationsStats as any[]).reduce((acc, row) => {
      acc[row.status] = {
        totalAgreed: Number(row.total_agreed) || 0,
        totalFirstPayment: Number(row.total_first_payment) || 0,
      };
      return acc;
    }, {} as Record<string, { totalAgreed: number; totalFirstPayment: number }>);

    // Calcular totais
    const availableCount = lotsStatsMap['available']?.count || 0;
    const reservedCount = lotsStatsMap['reserved']?.count || 0;
    const soldCount = lotsStatsMap['sold']?.count || 0;
    const blockedCount = lotsStatsMap['blocked']?.count || 0;
    const totalLots = availableCount + reservedCount + soldCount + blockedCount;

    const availableValue = lotsStatsMap['available']?.totalValue || 0;
    const blockedValue = lotsStatsMap['blocked']?.totalValue || 0;
    const reservedValue = reservationsStatsMap['pending']?.totalAgreed || 0;
    const soldValue = reservationsStatsMap['completed']?.totalAgreed || 0;
    
    // Somar entradas dos lotes vendidos E reservados
    const totalFirstPayments = 
      (reservationsStatsMap['completed']?.totalFirstPayment || 0) + 
      (reservationsStatsMap['pending']?.totalFirstPayment || 0);

    const totalValue = availableValue + reservedValue + soldValue + blockedValue;

    // Formatar resposta
    const response = {
      summary: {
        totalMaps,
        totalLots,
        availableLots: availableCount,
        reservedLots: reservedCount,
        soldLots: soldCount,
        blockedLots: blockedCount,
      },
      financial: {
        totalValue,
        availableValue,
        reservedValue,
        soldValue,
        blockedValue,
        totalFirstPayments,
      },
      maps: (mapStats as any[]).map((map) => ({
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

    return response;
  });

  return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('[API /dashboard/stats GET] ❌ Erro:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar estatísticas do dashboard' },
      { status: 500 }
    );
  }
}
