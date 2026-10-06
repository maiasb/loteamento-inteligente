import { NextRequest, NextResponse } from 'next/server';
import mysql, { type RowDataPacket } from 'mysql2/promise';
import { dbConfig } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function PUT(request: NextRequest) {
  let connection;

  try {
    const body = await request.json();
    const { reservationId, status, lotStatus, userRole } = body;

    if (!reservationId || !status || !lotStatus) {
      return NextResponse.json(
        { error: 'reservationId, status e lotStatus são obrigatórios' },
        { status: 400 }
      );
    }

    // Verificar permissão: apenas admin ou dev podem confirmar/cancelar reservas
    if (userRole !== 'admin' && userRole !== 'dev') {
      return NextResponse.json(
        { error: 'Você não tem permissão para confirmar ou cancelar reservas' },
        { status: 403 }
      );
    }

    if (!['completed', 'cancelled'].includes(status)) {
      return NextResponse.json(
        { error: 'status deve ser "completed" ou "cancelled"' },
        { status: 400 }
      );
    }

    if (!['sold', 'available'].includes(lotStatus)) {
      return NextResponse.json(
        { error: 'lotStatus deve ser "sold" ou "available"' },
        { status: 400 }
      );
    }

    connection = await mysql.createConnection(dbConfig);
    await connection.beginTransaction();

    try {
      // Buscar todos os lotes associados à reserva via purchase_request_lots
      const [lotRelations] = await connection.execute(
        'SELECT lot_id FROM purchase_request_lots WHERE purchase_request_id = ?',
        [reservationId]
      );

      if (!Array.isArray(lotRelations) || lotRelations.length === 0) {
        await connection.rollback();
        return NextResponse.json(
          { error: 'Reserva não encontrada ou sem lotes associados' },
          { status: 404 }
        );
      }

      const lotIds = (lotRelations as RowDataPacket[]).map((rel) => rel.lot_id);

      // Atualizar status da reserva
      await connection.execute('UPDATE purchase_requests SET status = ? WHERE id = ?', [
        status,
        reservationId,
      ]);

      // Atualizar status de todos os lotes associados
      const placeholders = lotIds.map(() => '?').join(',');
      await connection.execute(
        `UPDATE lots SET status = ?, updated_at = NOW() WHERE id IN (${placeholders})`,
        [lotStatus, ...lotIds]
      );

      await connection.commit();

      return NextResponse.json(
        {
          message: 'Reserva atualizada com sucesso',
          reservationId,
          status,
          lotStatus,
          lotsUpdated: lotIds.length,
        },
        { status: 200 }
      );
    } catch (error) {
      await connection.rollback();
      throw error;
    }
  } catch (error) {
    console.error('[API /reserva/confirmacao] Erro:', error);
    return NextResponse.json({ error: 'Erro ao atualizar reserva' }, { status: 500 });
  } finally {
    if (connection) await connection.end();
  }
}
