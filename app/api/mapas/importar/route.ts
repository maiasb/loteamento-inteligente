import { NextRequest, NextResponse } from 'next/server';
import mysql, { type ResultSetHeader } from 'mysql2/promise';
import { dbConfig } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface ImportLotReservation {
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  customer_cpf?: string;
  payment_method?: 'cash' | 'financing' | 'installments';
  status?: string; // Aceita qualquer string para mapear depois
}

interface ImportLot {
  lotNumber: string;
  status?: string;
  price: number;
  size: number;
  description?: string;
  features?: string[];
  reservation?: ImportLotReservation;
}

interface ImportBlock {
  name: string;
  description?: string;
  lots: ImportLot[];
}

interface ImportMap {
  name: string;
  imageUrl?: string;
  imageType?: string;
  width?: number;
  height?: number;
  blocks: ImportBlock[];
}

const LOT_STATUSES = ['available', 'reserved', 'sold', 'unavailable', 'blocked'];

export async function POST(request: NextRequest) {
  let connection;

  try {
    const body = await request.json();
    const importData: ImportMap = body;

    // Validações básicas
    if (!importData.name) {
      return NextResponse.json(
        { error: 'Nome do mapa é obrigatório', message: 'O campo "name" é obrigatório' },
        { status: 400 }
      );
    }

    if (!importData.blocks || !Array.isArray(importData.blocks) || importData.blocks.length === 0) {
      return NextResponse.json(
        {
          error: 'Pelo menos uma quadra é obrigatória',
          message: 'O campo "blocks" deve conter pelo menos uma quadra',
        },
        { status: 400 }
      );
    }

    connection = await mysql.createConnection(dbConfig);
    await connection.beginTransaction();

    try {
      // 1. Criar o mapa
      const mapId = Date.now().toString();
      await connection.execute(
        `INSERT INTO maps (id, name, image_url, width, height, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          mapId,
          importData.name,
          importData.imageUrl || null,
          importData.width || 800,
          importData.height || 600,
        ]
      );

      let totalBlocks = 0;
      let totalLots = 0;

      // 2. Criar quadras e lotes
      for (const blockData of importData.blocks) {
        if (!blockData.name) {
          await connection.rollback();
          return NextResponse.json(
            {
              error: 'Nome da quadra é obrigatório',
              message: 'Todas as quadras devem ter um nome',
            },
            { status: 400 }
          );
        }

        // Criar quadra
        const [blockResult] = await connection.execute(
          `INSERT INTO blocks (mapId, name, description, createdAt, updatedAt)
           VALUES (?, ?, ?, NOW(), NOW())`,
          [mapId, blockData.name, blockData.description || '']
        );

        const blockId = (blockResult as ResultSetHeader).insertId;
        totalBlocks++;

        // Criar lotes da quadra
        if (blockData.lots && Array.isArray(blockData.lots) && blockData.lots.length > 0) {
          for (const lotData of blockData.lots) {
            if (!lotData.lotNumber) {
              await connection.rollback();
              return NextResponse.json(
                {
                  error: 'Número do lote é obrigatório',
                  message: `Todos os lotes da quadra "${blockData.name}" devem ter um número (lotNumber)`,
                },
                { status: 400 }
              );
            }

            if (lotData.price == null || lotData.size == null) {
              await connection.rollback();
              return NextResponse.json(
                {
                  error: 'Preço e tamanho são obrigatórios',
                  message: `Lote ${lotData.lotNumber} da quadra "${blockData.name}" deve ter price e size`,
                },
                { status: 400 }
              );
            }

            const lotStatus = lotData.status ?? 'available';
            if (!LOT_STATUSES.includes(lotStatus)) {
              await connection.rollback();
              return NextResponse.json(
                {
                  error: 'Status do lote inválido',
                  message: `Lote ${lotData.lotNumber} da quadra "${blockData.name}" tem status inválido. Valores aceitos: ${LOT_STATUSES.join(', ')}`,
                },
                { status: 400 }
              );
            }

            if ((lotStatus === 'reserved' || lotStatus === 'sold') && !lotData.reservation) {
              await connection.rollback();
              return NextResponse.json(
                {
                  error: 'Dados de reserva obrigatórios',
                  message: `Lote ${lotData.lotNumber} (${lotStatus}) requer os dados da reserva (reservation)`,
                },
                { status: 400 }
              );
            }

            const features = lotData.features ? JSON.stringify(lotData.features) : null;

            // Criar o lote (sem id, deixa o AUTO_INCREMENT gerar)
            const [lotResult] = await connection.execute(
              `INSERT INTO lots (
                map_id, block_id, lot_number, status, price, size, 
                description, features, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
              [
                mapId,
                blockId,
                lotData.lotNumber,
                lotStatus,
                lotData.price,
                lotData.size,
                lotData.description || '',
                features,
              ]
            );

            const lotId = (lotResult as ResultSetHeader).insertId;
            totalLots++;

            // Se o lote está reservado ou vendido e tem dados de reserva, criar purchase_request
            if ((lotStatus === 'reserved' || lotStatus === 'sold') && lotData.reservation) {
              const reservation = lotData.reservation;

              // Validar dados obrigatórios da reserva
              if (
                !reservation.customer_name ||
                !reservation.customer_email ||
                !reservation.customer_phone
              ) {
                await connection.rollback();
                return NextResponse.json(
                  {
                    error: 'Dados de reserva incompletos',
                    message: `Lote ${lotData.lotNumber} (${lotStatus}) requer customer_name, customer_email e customer_phone na reserva`,
                  },
                  { status: 400 }
                );
              }

              // Mapear status da reserva para valores válidos na tabela
              // Valores gravados: 'pending', 'completed', 'cancelled' ('contacted' vira 'pending')
              let reservationStatus = 'pending';
              if (reservation.status === 'completed' || reservation.status === 'approved') {
                reservationStatus = 'completed';
              } else if (reservation.status === 'cancelled' || reservation.status === 'rejected') {
                reservationStatus = 'cancelled';
              }

              // Criar purchase_request com a estrutura correta (sem map_id e lot_id)
              const [purchaseResult] = await connection.execute(
                `INSERT INTO purchase_requests (
                  customer_name, customer_email, customer_phone,
                  customer_cpf, message, payment_method, status,
                  seller_name, seller_email, seller_phone, seller_cpf,
                  created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
                [
                  reservation.customer_name,
                  reservation.customer_email,
                  reservation.customer_phone,
                  reservation.customer_cpf || null,
                  null, // message
                  reservation.payment_method || 'cash',
                  reservationStatus,
                  // Dados do vendedor (importação assume vendedor padrão)
                  'Sistema de Importação',
                  'importacao@sistema.com',
                  '00000000000',
                  '00000000000',
                ]
              );

              const purchaseRequestId = (purchaseResult as ResultSetHeader).insertId;

              // Criar relacionamento em purchase_request_lots
              await connection.execute(
                `INSERT INTO purchase_request_lots (purchase_request_id, lot_id, agreed_price)
                 VALUES (?, ?, ?)`,
                [purchaseRequestId, lotId, lotData.price]
              );
            }
          }
        }
      }

      await connection.commit();

      return NextResponse.json(
        {
          message: 'Loteamento importado com sucesso',
          mapId,
          mapName: importData.name,
          totalBlocks,
          totalLots,
        },
        { status: 201 }
      );
    } catch (error) {
      await connection.rollback();
      throw error;
    }
  } catch (error) {
    const dbError = error as NodeJS.ErrnoException;
    console.error('[API /mapas/importar] ❌ Erro:', error);

    // Erro de constraint (duplicação)
    if (dbError.code === 'ER_DUP_ENTRY') {
      return NextResponse.json(
        {
          error: 'Dados duplicados',
          message:
            'Já existe um mapa, quadra ou lote com esses dados. Verifique números de lotes duplicados.',
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        error: 'Erro ao importar loteamento',
        message: 'Ocorreu um erro ao processar o arquivo. Verifique o formato dos dados.',
      },
      { status: 500 }
    );
  } finally {
    if (connection) await connection.end();
  }
}
