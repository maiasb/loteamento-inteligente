import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { dbConfig } from '@/lib/db';

export async function PUT(request: NextRequest) {
  let connection;
  
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
      status,
      userRole,
      lots // Cada item terá: { id: lotId, agreed_price, firstPayment, installments }
    } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'ID da reserva é obrigatório' },
        { status: 400 }
      );
    }

    if (!customer_name) {
      return NextResponse.json(
        { error: 'Nome do cliente é obrigatório' },
        { status: 400 }
      );
    }

    if (!seller_name) {
      return NextResponse.json(
        { error: 'Nome do vendedor é obrigatório' },
        { status: 400 }
      );
    }

    // Verificar permissão: vendedores não podem editar reservas concluídas ou canceladas
    if (userRole !== 'admin' && userRole !== 'dev' && status !== 'pending') {
      return NextResponse.json(
        { error: 'Você não tem permissão para editar reservas já confirmadas ou canceladas' },
        { status: 403 }
      );
    }

    connection = await mysql.createConnection(dbConfig);
    await connection.beginTransaction();

    try {
      // created_at já vem no formato correto (YYYY-MM-DD HH:MM:SS) do frontend
      // Não converter para Date para evitar problemas de timezone
      const mysqlCreatedAt = created_at || null;

      // Atualizar reserva (sem first_payment e installments)
      await connection.execute(
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
          created_at = ?
        WHERE id = ?`,
        [
          customer_name,
          customer_email || null,
          customer_phone || null,
          customer_cpf || null,
          payment_method || null,
          contract || null,
          message || null,
          seller_name,
          seller_email || null,
          seller_phone || null,
          seller_cpf || null,
          mysqlCreatedAt,
          id
        ]
      );

      // Atualizar preços, first_payment e installments dos lotes se fornecidos
      if (lots && Array.isArray(lots) && lots.length > 0) {
        for (const lot of lots) {
          if (lot.id) {
            await connection.execute(
              `UPDATE purchase_request_lots 
               SET agreed_price = ?, first_payment = ?, installments = ?, payment_method = ?
               WHERE purchase_request_id = ? AND lot_id = ?`,
              [
                lot.agreed_price || null, 
                lot.firstPayment || null, 
                lot.installments || null, 
                lot.paymentMethod || null,
                id, 
                lot.id
              ]
            );
          }
        }
      }

      await connection.commit();

      
      return NextResponse.json(
        { message: 'Reserva atualizada com sucesso' },
        { status: 200 }
      );
    } catch (error) {
      await connection.rollback();
      throw error;
    }
  } catch (error) {
    console.error('[API /reservas/atualizar] ❌ Erro:', error);
    return NextResponse.json(
      { error: 'Erro ao atualizar reserva' },
      { status: 500 }
    );
  } finally {
    if (connection) await connection.end();
  }
}
