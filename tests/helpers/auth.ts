import { vi } from 'vitest';
import { NextRequest } from 'next/server';
import { executeQuery, getPool } from '@/lib/db';
import { hashSessionToken } from '@/lib/auth/session';

/** Resposta falsa para consultas cujo SQL casa com `match` (a primeira regra que casar vence). */
export type SqlRule = {
  match: RegExp;
  result: unknown | ((params: unknown[], sql: string) => unknown);
};

export type FakeDb = {
  /** Todas as consultas executadas (executeQuery e conexões de transação), em ordem. */
  calls: Array<{ sql: string; params: unknown[] }>;
  connection: {
    beginTransaction: ReturnType<typeof vi.fn>;
    commit: ReturnType<typeof vi.fn>;
    rollback: ReturnType<typeof vi.fn>;
    release: ReturnType<typeof vi.fn>;
  };
  /** Consultas cujo SQL casa com o padrão. */
  where: (pattern: RegExp) => Array<{ sql: string; params: unknown[] }>;
};

export const OK_WRITE = { affectedRows: 1, insertId: 1 };

/**
 * Instala um banco falso em `@/lib/db` (o arquivo de teste precisa de
 * vi.mock('@/lib/db', () => ({ executeQuery: vi.fn(), getPool: vi.fn() }))).
 * Sem regra: SELECT devolve [] e demais comandos devolvem { affectedRows: 1, insertId: 1 }.
 */
export function installFakeDb(rules: SqlRule[] = []): FakeDb {
  const calls: FakeDb['calls'] = [];

  const respond = (rawSql: string, params: unknown[] = []) => {
    const sql = rawSql.replace(/\s+/g, ' ').trim();
    calls.push({ sql, params });
    const rule = rules.find((candidate) => candidate.match.test(sql));
    if (rule) {
      return typeof rule.result === 'function'
        ? (rule.result as (p: unknown[], s: string) => unknown)(params, sql)
        : rule.result;
    }
    return /^SELECT/i.test(sql) ? [] : OK_WRITE;
  };

  const connection = {
    execute: vi.fn(async (sql: string, params?: unknown[]) => [respond(sql, params)]),
    beginTransaction: vi.fn().mockResolvedValue(undefined),
    commit: vi.fn().mockResolvedValue(undefined),
    rollback: vi.fn().mockResolvedValue(undefined),
    release: vi.fn(),
  };

  vi.mocked(executeQuery).mockImplementation((async (sql: string, params?: unknown[]) =>
    respond(sql, params)) as never);
  vi.mocked(getPool).mockReturnValue({ getConnection: async () => connection } as never);

  return {
    calls,
    connection,
    where: (pattern) => calls.filter((call) => pattern.test(call.sql)),
  };
}

export const SESSION_TOKEN = 'token-de-teste-da-sessao';

export function sessionRow(overrides: Record<string, unknown> = {}) {
  return {
    session_id: 10,
    since_seen: 1,
    id: 1,
    name: 'Maria',
    email: 'maria@exemplo.com',
    cpf: '52998224725',
    phone: '11999998888',
    creci: null,
    role: 'vendedor',
    status: 'approved',
    active: 1,
    first_login: 0,
    theme_preference: 'light',
    ...overrides,
  };
}

/** Regra que faz o token SESSION_TOKEN valer como sessão do usuário descrito por `overrides`. */
export function sessionRule(overrides: Record<string, unknown> = {}): SqlRule {
  const expectedHash = hashSessionToken(SESSION_TOKEN);
  return {
    match: /FROM user_sessions s JOIN users u/,
    result: (params: unknown[]) => (params[0] === expectedHash ? [sessionRow(overrides)] : []),
  };
}

type RequestOptions = {
  body?: unknown;
  cookie?: string | null;
  headers?: Record<string, string>;
  /** false = sem Origin (para testar CSRF). */
  origin?: string | false;
};

/** Requisição same-origin (Origin http://localhost) com cookie de sessão opcional. */
export function apiRequest(url: string, method: string, options: RequestOptions = {}) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (options.origin !== false) headers.origin = options.origin ?? 'http://localhost';
  if (options.cookie) headers.cookie = `session=${options.cookie}`;
  Object.assign(headers, options.headers);
  return new NextRequest(`http://localhost${url}`, {
    method,
    headers,
    body: options.body === undefined || method === 'GET' ? undefined : JSON.stringify(options.body),
  });
}

/** Requisição autenticada com SESSION_TOKEN. */
export function authed(url: string, method: string, body?: unknown) {
  return apiRequest(url, method, { body, cookie: SESSION_TOKEN });
}

export const PASSWORD_OK = 'senha-forte-123';
