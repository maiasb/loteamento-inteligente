import { NextRequest, NextResponse } from 'next/server';
import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { getPool } from '@/lib/db';

export const dynamic = 'force-dynamic';

// CPF e telefone são gravados só com dígitos (igual a lotes/reservar)
function onlyDigits(value: unknown): string | null {
  return value ? String(value).replace(/\D/g, '') || null : null;
}

export async function PUT(request: NextRequest) {
  let connection: PoolConnection | undefined;

  try {
    const body = await request.json();
    const {
      id,
      customer_name,
      customer_email,
      customer_phone,
      customer_cpf,
      payment_method,
      contract,
      message,
      seller_name,
      seller_email,
      seller_phone,
      seller_cpf,
      created_at,
      userRole,
      lots, // Cada item terá: { id: lotId, agreed_price, firstPayment, installments }
    } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID da reserva é obrigatório' }, { status: 400 });
    }

    if (!customer_name) {
      return NextResponse.json({ error: 'Nome do cliente é obrigatório' }, { status: 400 });
    }

    if (!seller_name) {
      return NextResponse.json({ error: 'Nome do vendedor é obrigatório' }, { status: 400 });
    }

    connection = await getPool().getConnection();
    await connection.beginTransaction();

    // O status vem do banco (com lock), não do corpo da requisição
    const [requests] = await connection.execute<RowDataPacket[]>(
      'SELECT status FROM purchase_requests WHERE id = ? FOR UPDATE',
      [id]
    );

    if (requests.length === 0) {
      await connection.rollback();
      return NextResponse.json({ error: 'Reserva não encontrada' }, { status: 404 });
    }

    // Vendedores não podem editar reservas concluídas ou canceladas
    if (userRole !== 'admin' && userRole !== 'dev' && requests[0].status !== 'pending') {
      await connection.rollback();
      return NextResponse.json(
        { error: 'Você não tem permissão para editar reservas já confirmadas ou canceladas' },
        { status: 403 }
      );
    }

    // created_at já vem no formato correto (YYYY-MM-DD HH:MM:SS) do frontend
    // Não converter para Date para evitar problemas de timezone
    const mysqlCreatedAt = created_at || null;

    await connection.execute<ResultSetHeader>(
      `UPDATE purchase_requests SET
        customer_name = ?,
        customer_email = ?,
        customer_phone = ?,
        customer_cpf = ?,
        payment_method = ?,
        contract = ?,
        message = ?,
        seller_name = ?,
        seller_email = ?,
        seller_phone = ?,
        seller_cpf = ?,
        created_at = COALESCE(?, created_at)
      WHERE id = ?`,
      [
        customer_name,
        customer_email || null,
        onlyDigits(customer_phone),
        onlyDigits(customer_cpf),
        payment_method || null,
        contract || null,
        message || null,
        seller_name,
        seller_email || null,
        onlyDigits(seller_phone),
        onlyDigits(seller_cpf),
        mysqlCreatedAt,
        id,
      ]
    );

    // Atualizar preços, entrada e parcelas dos lotes, se fornecidos
    if (Array.isArray(lots)) {
      for (const lot of lots) {
        if (!lot.id) continue;

        const [result] = await connection.execute<ResultSetHeader>(
          `UPDATE purchase_request_lots 
           SET agreed_price = ?, first_payment = ?, installments = ?, payment_method = ?
           WHERE purchase_request_id = ? AND lot_id = ?`,
          [
            lot.agreed_price ?? null,
            lot.firstPayment ?? null,
            lot.installments || null,
            lot.paymentMethod || null,
            id,
            lot.id,
          ]
        );

        if (result.affectedRows === 0) {
          await connection.rollback();
          return NextResponse.json(
            { error: `O lote ${lot.id} não pertence a esta reserva` },
            { status: 400 }
          );
        }
      }
    }

    await connection.commit();

    return NextResponse.json({ message: 'Reserva atualizada com sucesso' }, { status: 200 });
  } catch (error) {
    await connection?.rollback();
    console.error('[API /reservas/atualizar] ❌ Erro:', error);
    return NextResponse.json({ error: 'Erro ao atualizar reserva' }, { status: 500 });
  } finally {
    connection?.release();
  }
}
