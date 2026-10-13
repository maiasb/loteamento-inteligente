import { NextRequest, NextResponse } from 'next/server';
import mysql, { type ResultSetHeader, type RowDataPacket } from 'mysql2/promise';
import { dbConfig } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  let connection;

  try {
    const body = await request.json();
    const {
      lotIds,
      lotDetails, // Cada item terá: { lotId, price, firstPayment, installments }
      customerName,
      customerEmail,
      customerPhone,
      customerCPF,
      message,
      userId,
      sellerName,
      sellerEmail,
      sellerPhone,
      sellerCPF,
      paymentMethod,
      contract,
      reservationDate,
    } = body;

    if (!lotIds || !Array.isArray(lotIds) || lotIds.length === 0) {
      return NextResponse.json(
        { error: 'lotIds é obrigatório e deve ser um array' },
        { status: 400 }
      );
    }

    const ids = [...new Set(lotIds.map(Number))].sort((a, b) => a - b);
    if (ids.some((id) => !Number.isInteger(id) || id <= 0)) {
      return NextResponse.json({ error: 'lotIds deve conter apenas ids válidos' }, { status: 400 });
    }

    if (!Array.isArray(lotDetails) || lotDetails.length === 0) {
      return NextResponse.json(
        { error: 'lotDetails é obrigatório e deve ser um array' },
        { status: 400 }
      );
    }

    const detailIds = new Set<number>(lotDetails.map((detail) => Number(detail?.lotId)));
    if (
      detailIds.size !== lotDetails.length ||
      detailIds.size !== ids.length ||
      ids.some((id) => !detailIds.has(id))
    ) {
      return NextResponse.json(
        { error: 'lotDetails deve conter exatamente um item para cada lote de lotIds' },
        { status: 400 }
      );
    }

    if (!customerName) {
      return NextResponse.json({ error: 'Nome do cliente é obrigatório' }, { status: 400 });
    }

    if (!sellerName) {
      return NextResponse.json({ error: 'Nome do vendedor é obrigatório' }, { status: 400 });
    }

    connection = await mysql.createConnection(dbConfig);

    // Iniciar transação
    await connection.beginTransaction();

    try {
      // Verificar se todos os lotes estão disponíveis e pegar map_id
      const placeholders = ids.map(() => '?').join(',');
      const [lotsCheck] = await connection.execute(
        `SELECT id, status, map_id, block_id FROM lots WHERE id IN (${placeholders}) ORDER BY id FOR UPDATE`,
        ids
      );

      const lotsArray = lotsCheck as RowDataPacket[];

      if (lotsArray.length !== ids.length) {
        await connection.rollback();
        return NextResponse.json(
          { error: 'Um ou mais lotes não foram encontrados' },
          { status: 404 }
        );
      }

      const unavailableLots = lotsArray.filter((lot) => lot.status !== 'available');

      if (unavailableLots.length > 0) {
        await connection.rollback();
        return NextResponse.json(
          { error: 'Um ou mais lotes não estão disponíveis', unavailableLots },
          { status: 409 }
        );
      }

      // 1. Criar um único registro em purchase_requests (sem first_payment e installments)
      const [purchaseResult] = await connection.execute(
        `INSERT INTO purchase_requests (
          user_id, customer_name, customer_email, customer_phone,
          customer_cpf, message, payment_method, seller_name, seller_email, 
          seller_phone, seller_cpf, contract, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
        [
          userId || null,
          customerName,
          customerEmail || null,
          customerPhone ? customerPhone.replace(/\D/g, '') : null,
          customerCPF ? customerCPF.replace(/\D/g, '') : null,
          message || null,
          paymentMethod || null,
          sellerName,
          sellerEmail || null,
          sellerPhone ? sellerPhone.replace(/\D/g, '') : null,
          sellerCPF ? sellerCPF.replace(/\D/g, '') : null,
          contract || null,
          reservationDate
            ? new Date(reservationDate).toISOString().slice(0, 19).replace('T', ' ')
            : new Date().toISOString().slice(0, 19).replace('T', ' '),
        ]
      );

      const purchaseRequestId = (purchaseResult as ResultSetHeader).insertId;

      // 2. Criar registros em purchase_request_lots para cada lote com agreed_price, first_payment e installments
      for (const lotDetail of lotDetails) {
        await connection.execute(
          `INSERT INTO purchase_request_lots (
            purchase_request_id, lot_id, agreed_price, first_payment, installments, payment_method
          ) VALUES (?, ?, ?, ?, ?, ?)`,
          [
            purchaseRequestId,
            lotDetail.lotId,
            lotDetail.price ?? null,
            lotDetail.firstPayment ?? null,
            lotDetail.installments ?? null,
            lotDetail.paymentMethod ?? null,
          ]
        );
      }

      // 3. Atualizar status dos lotes para 'reserved'
      const [updateResult] = await connection.execute(
        `UPDATE lots SET status = 'reserved', updated_at = NOW() WHERE id IN (${placeholders}) AND status = 'available'`,
        ids
      );

      if ((updateResult as ResultSetHeader).affectedRows !== ids.length) {
        await connection.rollback();
        return NextResponse.json(
          { error: 'Um ou mais lotes não estão mais disponíveis' },
          { status: 409 }
        );
      }

      // Commit da transação
      await connection.commit();

      return NextResponse.json(
        {
          message: `Reserva criada com sucesso para ${ids.length} lote(s)`,
          purchaseRequestId,
          lotIds: ids,
        },
        { status: 201 }
      );
    } catch (error) {
      // Rollback em caso de erro
      await connection.rollback();
      throw error;
    }
  } catch (error) {
    console.error('[API /mapas/lotes/reservar] ❌ Erro ao criar reserva:', error);
    return NextResponse.json({ error: 'Erro ao criar reserva' }, { status: 500 });
  } finally {
    if (connection) await connection.end();
  }
}
