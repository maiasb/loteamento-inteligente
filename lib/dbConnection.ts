import mysql from 'mysql2/promise';
import { dbConfig } from './db';

/**
 * Cria uma conexão com o banco de dados com configurações otimizadas
 * e gerenciamento adequado de timeout e fechamento
 */
export async function createDbConnection(): Promise<mysql.Connection> {
  const connection = await mysql.createConnection({
    ...dbConfig,
    connectTimeout: 5000, // 5 segundos para conectar
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
  });

  return connection;
}

/**
 * Fecha uma conexão de forma segura, tratando erros
 */
export async function closeDbConnection(connection: mysql.Connection | null): Promise<void> {
  if (connection) {
    try {
      await connection.end();
    } catch (error) {
      console.error('❌ Erro ao fechar conexão com o banco:', error);
    }
  }
}

/**
 * Executa uma função com uma conexão de banco de dados
 * garantindo que a conexão será fechada ao final
 */
export async function withDbConnection<T>(
  callback: (connection: mysql.Connection) => Promise<T>
): Promise<T> {
  let connection: mysql.Connection | null = null;

  try {
    connection = await createDbConnection();
    return await callback(connection);
  } finally {
    await closeDbConnection(connection);
  }
}
