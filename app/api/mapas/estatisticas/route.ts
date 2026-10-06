import { NextRequest, NextResponse } from 'next/server';
import mysql, { type RowDataPacket } from 'mysql2/promise';
import { dbConfig } from '@/lib/db';

// Forçar rota dinâmica
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  let connection;

  try {
    const { searchParams } = new URL(request.url);
    const mapId = searchParams.get('mapId');

    if (!mapId) {
      console.error('[API /mapas/estatisticas GET] mapId não fornecido');
      return NextResponse.json({ error: 'mapId é obrigatório' }, { status: 400 });
    }

    // Verificar se as configurações do banco estão definidas
    if (!dbConfig.host || !dbConfig.user || !dbConfig.database) {
      console.error('[API /mapas/estatisticas GET] Configuração do banco de dados incompleta:', {
        host: dbConfig.host ? 'definido' : 'FALTANDO',
        user: dbConfig.user ? 'definido' : 'FALTANDO',
        database: dbConfig.database ? 'definido' : 'FALTANDO',
      });
      return NextResponse.json(
        { error: 'Configuração do banco de dados incompleta' },
        { status: 500 }
      );
    }

    connection = await mysql.createConnection(dbConfig);

    // Buscar contagem de lotes por status
    const [stats] = await connection.execute(
      `SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'available' THEN 1 ELSE 0 END) as available,
        SUM(CASE WHEN status = 'reserved' THEN 1 ELSE 0 END) as reserved,
        SUM(CASE WHEN status = 'sold' THEN 1 ELSE 0 END) as sold,
        SUM(CASE WHEN status = 'blocked' THEN 1 ELSE 0 END) as blocked
      FROM lots 
      WHERE map_id = ?`,
      [mapId]
    );

    const result = (stats as RowDataPacket[])[0];

    return NextResponse.json(
      {
        total: Number(result.total) || 0,
        available: Number(result.available) || 0,
        reserved: Number(result.reserved) || 0,
        sold: Number(result.sold) || 0,
        blocked: Number(result.blocked) || 0,
      },
      { status: 200 }
    );
  } catch (error) {
    const dbError = error as NodeJS.ErrnoException;
    console.error('[API /mapas/estatisticas GET] Erro:', error);
    console.error('[API /mapas/estatisticas GET] Tipo de erro:', dbError.code);
    console.error('[API /mapas/estatisticas GET] Mensagem:', dbError.message);

    let errorMessage = 'Erro ao buscar estatísticas do mapa';
    const statusCode = 500;

    if (dbError.code === 'ECONNREFUSED') {
      errorMessage = 'Não foi possível conectar ao banco de dados';
      console.error('[API /mapas/estatisticas GET] Banco de dados inacessível');
    } else if (dbError.code === 'ER_ACCESS_DENIED_ERROR') {
      errorMessage = 'Acesso negado ao banco de dados';
      console.error('[API /mapas/estatisticas GET] Credenciais inválidas');
    } else if (dbError.code === 'ETIMEDOUT') {
      errorMessage = 'Timeout na conexão com o banco de dados';
      console.error('[API /mapas/estatisticas GET] Timeout na conexão');
    }

    return NextResponse.json(
      { error: errorMessage, details: dbError.message },
      { status: statusCode }
    );
  } finally {
    if (connection) {
      try {
        await connection.end();
      } catch (closeError) {
        console.error('[API /mapas/estatisticas GET] Erro ao fechar conexão:', closeError);
      }
    }
  }
}
