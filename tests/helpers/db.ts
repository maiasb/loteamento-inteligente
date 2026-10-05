import { vi } from 'vitest';
import mysql from 'mysql2/promise';
import { NextRequest } from 'next/server';

export type FakeConnection = ReturnType<typeof createFakeConnection>;

export function createFakeConnection() {
  return {
    execute: vi.fn(),
    query: vi.fn(),
    beginTransaction: vi.fn().mockResolvedValue(undefined),
    commit: vi.fn().mockResolvedValue(undefined),
    rollback: vi.fn().mockResolvedValue(undefined),
    end: vi.fn().mockResolvedValue(undefined),
  };
}

/** Faz mysql.createConnection (mockado no arquivo de teste) devolver uma conexão falsa. */
export function useFakeConnection() {
  const connection = createFakeConnection();
  vi.mocked(mysql.createConnection).mockResolvedValue(connection as never);
  return connection;
}

export function jsonRequest(url: string, method: string, body?: unknown) {
  return new NextRequest(`http://localhost${url}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export function sqlOf(call: unknown[]): string {
  return String(call[0]).replace(/\s+/g, ' ').trim();
}
