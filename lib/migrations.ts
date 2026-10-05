import { createConnection } from './db';
import fs from 'fs';
import path from 'path';
import type { RowDataPacket } from 'mysql2/promise';

export interface Migration {
  id: number;
  name: string;
  executed_at: Date;
}

/**
 * Cria a tabela de controle de migrations se não existir
 */
export async function createMigrationsTable() {
  const connection = await createConnection();
  try {
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_name (name),
        INDEX idx_executed_at (executed_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  } finally {
    await connection.end();
  }
}

/**
 * Retorna as migrations já executadas
 */
export async function getExecutedMigrations(): Promise<string[]> {
  const connection = await createConnection();
  try {
    const [rows] = await connection.execute<RowDataPacket[]>(
      'SELECT name FROM migrations ORDER BY id ASC'
    );
    return rows.map((row) => row.name);
  } finally {
    await connection.end();
  }
}

/**
 * Lista todas as migrations disponíveis no diretório
 */
export function getAvailableMigrations(): string[] {
  const migrationsDir = path.join(process.cwd(), 'migrations');

  if (!fs.existsSync(migrationsDir)) {
    return [];
  }

  return fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort();
}

/**
 * Retorna as migrations pendentes (ainda não executadas)
 */
export async function getPendingMigrations(): Promise<string[]> {
  const available = getAvailableMigrations();
  const executed = await getExecutedMigrations();
  return available.filter((migration) => !executed.includes(migration));
}

/**
 * Executa uma migration específica
 */
export async function executeMigration(filename: string): Promise<void> {
  const connection = await createConnection();
  try {
    const migrationsDir = path.join(process.cwd(), 'migrations');
    const filepath = path.join(migrationsDir, filename);
    const sql = fs.readFileSync(filepath, 'utf-8');

    // Dividir em statements individuais (separados por ;)
    const statements = sql
      .split(';')
      .map((stmt) => stmt.trim())
      .filter((stmt) => stmt.length > 0 && !stmt.startsWith('--'));

    // Executar cada statement
    for (const statement of statements) {
      await connection.query(statement);
    }

    // Registrar migration como executada
    await connection.execute('INSERT INTO migrations (name) VALUES (?)', [filename]);
  } catch (error) {
    console.error(`❌ Erro ao executar migration ${filename}:`, error);
    throw error;
  } finally {
    await connection.end();
  }
}

/**
 * Executa todas as migrations pendentes
 */
export async function runPendingMigrations(): Promise<void> {
  await createMigrationsTable();
  const pending = await getPendingMigrations();

  if (pending.length === 0) {
    return;
  }

  for (const migration of pending) {
    await executeMigration(migration);
  }
}

/**
 * Mostra o status das migrations
 */
export async function showMigrationsStatus(): Promise<void> {
  await createMigrationsTable();
}
