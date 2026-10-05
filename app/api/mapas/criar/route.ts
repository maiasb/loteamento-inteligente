import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { dbConfig } from '@/lib/db';

// Forçar rota dinâmica
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  let connection;

  try {
    const body = await request.json();
    const { name, description, imageUrl, width = 800, height = 600 } = body;

    if (!name) {
      return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 });
    }

    // Gerar ID baseado em timestamp (tabela não tem AUTO_INCREMENT)
    const mapId = Date.now().toString();

    connection = await mysql.createConnection(dbConfig);

    // INSERT com id fornecido
    await connection.execute(
      `INSERT INTO maps (id, name, description, image_url, width, height, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [mapId, name, description || '', imageUrl || '', width, height]
    );

    const newMap = {
      mapId,
      id: mapId,
      name,
      description: description || '',
      imageUrl: imageUrl || '',
      width,
      height,
    };

    return NextResponse.json(newMap, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Erro ao criar mapa' }, { status: 500 });
  } finally {
    if (connection) await connection.end();
  }
}
