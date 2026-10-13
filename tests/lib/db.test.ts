import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import mysql from 'mysql2/promise';
import { getPool } from '@/lib/db';

vi.mock('mysql2/promise', () => ({ default: { createPool: vi.fn() } }));

const globalForDb = globalThis as unknown as { __dbPool?: unknown };

describe('getPool', () => {
  beforeEach(() => {
    delete globalForDb.__dbPool;
    vi.mocked(mysql.createPool).mockImplementation(() => ({}) as never);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    delete globalForDb.__dbPool;
  });

  it('falha com mensagem clara listando as variáveis DB_* ausentes', () => {
    vi.stubEnv('DB_HOST', '');
    vi.stubEnv('DB_USER', '');
    vi.stubEnv('DB_NAME', 'banco');
    vi.stubEnv('DB_PASSWORD', 'x');
    expect(() => getPool()).toThrow('Variáveis de ambiente do banco ausentes: DB_HOST, DB_USER');
    expect(mysql.createPool).not.toHaveBeenCalled();
  });

  it('cria um único pool e o reutiliza (singleton em globalThis)', () => {
    vi.stubEnv('DB_HOST', 'localhost');
    vi.stubEnv('DB_USER', 'app');
    vi.stubEnv('DB_NAME', 'banco');
    vi.stubEnv('DB_PASSWORD', 'x');
    expect(getPool()).toBe(getPool());
    expect(mysql.createPool).toHaveBeenCalledTimes(1);
    expect(mysql.createPool).toHaveBeenCalledWith(
      expect.objectContaining({ connectionLimit: 5, idleTimeout: 60000, maxIdle: 2 })
    );
  });
});
