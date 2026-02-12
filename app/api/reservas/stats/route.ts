import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { dbConfig } from '@/lib/db';

// Forçar rota dinâmica
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  let connection;
  
  try {
    connection = await mysql.createConnection(dbConfig);

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    let baseQuery = 'SELECT COUNT(*) as count, status FROM purchase_requests';
    const params: any[] = [];

    // Aplicar filtro de usuário se necessário
    if (userId && userId !== 'undefined' && userId !== 'null') {
      baseQuery += ' WHERE user_id = ?';
      params.push(parseInt(userId));
    }

    baseQuery += ' GROUP BY status';

    const [results] = await connection.execute(baseQuery, params);

    // Processar resultados
    const stats = {
      total: 0,
      pending: 0,
      completed: 0,
      cancelled: 0,
    };

    (results as any[]).forEach((row) => {
      stats.total += row.count;
      
      if (row.status === 'pending') {
        stats.pending = row.count;
      } else if (row.status === 'completed') {
        stats.completed = row.count;
      } else if (row.status === 'cancelled') {
        stats.cancelled = row.count;
      }
    });

    return NextResponse.json(stats, { status: 200 });

  } catch (error) {
    console.error('[API /reservas/stats GET] Erro:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar estatísticas' },
      { status: 500 }
    );
  } finally {
    if (connection) await connection.end();
  }
}
