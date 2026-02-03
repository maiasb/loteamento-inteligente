import mysql from 'mysql2/promise';

export const dbConfig = {
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

// Pool de conexões global
let pool: mysql.Pool | null = null;

export function getPool(): mysql.Pool {
  if (!pool) {
    pool = mysql.createPool(dbConfig);
  }
  return pool;
}

export async function createConnection() {
  return await getPool().getConnection();
}

export async function executeQuery<T = any>(
  query: string,
  params?: any[]
): Promise<T> {
  const connection = await createConnection();
  try {
    const [rows] = await connection.execute(query, params);
    return rows as T;
  } finally {
    connection.release(); // Release ao invés de end() para reusar conexão
  }
}
