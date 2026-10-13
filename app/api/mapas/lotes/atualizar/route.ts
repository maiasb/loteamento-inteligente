import { NextRequest, NextResponse } from 'next/server';
import mysql, { type ResultSetHeader, type RowDataPacket } from 'mysql2/promise';
import { dbConfig } from '@/lib/db';

export const dynamic = 'force-dynamic';

const STATUS_PERMITIDOS = ['available', 'reserved', 'sold', 'unavailable', 'blocked'];
const STATUS_DO_FLUXO_DE_RESERVA = ['reserved', 'sold'];

export async function PATCH(request: NextRequest) {
  let connection;

  try {
    const body = await request.json();
    const { id, mapId, blockId, lotNumber, status, price, size, description, features, lat, lng } =
      body;

    if (!id || !mapId) {
      return NextResponse.json({ error: 'id e mapId são obrigatórios' }, { status: 400 });
    }

    if (status !== undefined && !STATUS_PERMITIDOS.includes(status)) {
      return NextResponse.json({ error: 'Status inválido' }, { status: 400 });
    }

    connection = await mysql.createConnection(dbConfig);

    const [lotRows] = await connection.execute<RowDataPacket[]>(
      'SELECT status FROM lots WHERE id = ? AND map_id = ?',
      [id, mapId]
    );
    if (lotRows.length === 0) {
      return NextResponse.json({ error: 'Lote não encontrado' }, { status: 404 });
    }

    if (status !== undefined && status !== lotRows[0].status) {
      const envolveReserva =
        STATUS_DO_FLUXO_DE_RESERVA.includes(status) ||
        STATUS_DO_FLUXO_DE_RESERVA.includes(lotRows[0].status);
      if (envolveReserva) {
        return NextResponse.json(
          { error: 'Reserva e venda de lotes devem ser feitas pelo fluxo de reservas' },
          { status: 409 }
        );
      }
    }

    if (blockId != null) {
      const [blockRows] = await connection.execute<RowDataPacket[]>(
        'SELECT id FROM blocks WHERE id = ? AND mapId = ?',
        [blockId, mapId]
      );
      if (blockRows.length === 0) {
        return NextResponse.json({ error: 'Quadra não encontrada neste mapa' }, { status: 404 });
      }
    }

    // Construir query dinamicamente
    const updateFields = [];
    const updateValues = [];

    if (blockId !== undefined) {
      updateFields.push('block_id = ?');
      updateValues.push(blockId);
    }
    if (lotNumber !== undefined) {
      updateFields.push('lot_number = ?');
      updateValues.push(lotNumber);
    }
    if (status !== undefined) {
      updateFields.push('status = ?');
      updateValues.push(status);
    }
    if (price !== undefined) {
      updateFields.push('price = ?');
      updateValues.push(price);
    }
    if (size !== undefined) {
      updateFields.push('size = ?');
      updateValues.push(size);
    }
    if (description !== undefined) {
      updateFields.push('description = ?');
      updateValues.push(description);
    }
    if (features !== undefined) {
      updateFields.push('features = ?');
      updateValues.push(features ? JSON.stringify(features) : null);
    }
    if (lat !== undefined && lng !== undefined) {
      updateFields.push('coordinates = ?');
      updateValues.push(lat != null && lng != null ? JSON.stringify({ lat, lng }) : null);
    }

    updateFields.push('updated_at = NOW()');
    updateValues.push(id, mapId);

    // Com mudança de status, o UPDATE só vale se o status ainda for o que foi lido
    const guardaStatus = status !== undefined;
    if (guardaStatus) updateValues.push(lotRows[0].status);

    const [updateResult] = await connection.execute<ResultSetHeader>(
      `UPDATE lots SET ${updateFields.join(', ')} WHERE id = ? AND map_id = ?${guardaStatus ? ' AND status = ?' : ''}`,
      updateValues
    );

    if (updateResult.affectedRows === 0) {
      if (guardaStatus) {
        return NextResponse.json(
          { error: 'O lote foi alterado por outra operação. Tente novamente.' },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: 'Lote não encontrado' }, { status: 404 });
    }

    const updatedLot = {
      id,
      mapId,
      blockId: blockId !== undefined ? blockId : null,
      lotNumber,
      status,
      price,
      size,
      description,
      features,
      lat: lat ?? null,
      lng: lng ?? null,
      updatedAt: new Date().toISOString(),
    };

    return NextResponse.json(updatedLot, { status: 200 });
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ER_DUP_ENTRY') {
      return NextResponse.json(
        { error: 'Já existe um lote com este número na quadra' },
        { status: 409 }
      );
    }
    if (code === 'ER_CHECK_CONSTRAINT_VIOLATED') {
      return NextResponse.json({ error: 'Preço ou tamanho inválido' }, { status: 400 });
    }

    console.error('[API /mapas/lotes PATCH] Erro:', error);
    return NextResponse.json({ error: 'Erro ao atualizar lote' }, { status: 500 });
  } finally {
    if (connection) await connection.end();
  }
}
