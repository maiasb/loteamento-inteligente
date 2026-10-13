import mysql, { type RowDataPacket } from 'mysql2/promise';

export type QueryParam = string | number | boolean | Date | null;

function buildDbConfig() {
  return {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 5, // Reduzido para economizar memória
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    connectTimeout: 10000,
  };
}

export const dbConfig = buildDbConfig();

// Em desenvolvimento o Next recarrega os módulos; guardar o pool em globalThis evita abrir
// um pool novo (e vazar conexões) a cada recarga.
const globalForDb = globalThis as unknown as { __dbPool?: mysql.Pool };

function assertDbEnv() {
  const missing = ['DB_HOST', 'DB_USER', 'DB_NAME'].filter((name) => !process.env[name]);
  if (process.env.DB_PASSWORD === undefined) missing.push('DB_PASSWORD');
  if (missing.length > 0) {
    throw new Error(`Variáveis de ambiente do banco ausentes: ${missing.join(', ')}`);
  }
}

export function getPool(): mysql.Pool {
  if (!globalForDb.__dbPool) {
    assertDbEnv();
    globalForDb.__dbPool = mysql.createPool({
      ...buildDbConfig(),
      idleTimeout: 60000, // fecha conexões ociosas após 60 s
      maxIdle: 2, // mantém no máximo 2 conexões ociosas
    });
  }
  return globalForDb.__dbPool;
}

export async function createConnection() {
  return await getPool().getConnection();
}

export async function executeQuery<T = RowDataPacket[]>(
  query: string,
  params?: QueryParam[]
): Promise<T> {
  const connection = await createConnection();
  try {
    const [rows] = await connection.execute(query, params);
    return rows as T;
  } finally {
    connection.release(); // Release ao invés de end() para reusar conexão
  }
}
