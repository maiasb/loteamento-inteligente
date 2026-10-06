import crypto from 'crypto';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/api/usuarios/login/route';
import { useFakeConnection, type FakeConnection } from '../helpers/db';

vi.mock('mysql2/promise', () => ({ default: { createConnection: vi.fn() } }));

const login = (query: string) =>
  GET(new NextRequest(`http://localhost/api/usuarios/login${query}`));

const user = (overrides = {}) => ({
  id: 1,
  cpf: '52998224725',
  name: 'Maria',
  email: 'm@m.com',
  phone: null,
  first_login: 0,
  creci: null,
  role: 'vendedor',
  status: 'approved',
  active: 1,
  theme_preference: 'light',
  ...overrides,
});

describe('GET /api/usuarios/login', () => {
  let conn: FakeConnection;
  beforeEach(() => {
    conn = useFakeConnection();
  });

  it('exige cpf e senha', async () => {
    expect((await login('?cpf=52998224725')).status).toBe(400);
    expect((await login('?password=x')).status).toBe(400);
  });

  it('recusa credenciais inválidas com 401', async () => {
    conn.execute.mockResolvedValue([[]]);
    expect((await login('?cpf=52998224725&password=errada')).status).toBe(401);
  });

  it('compara CPF só com dígitos e a senha em MD5', async () => {
    conn.execute.mockResolvedValue([[user()]]);
    await login('?cpf=529.982.247-25&password=abc123');
    const md5 = crypto.createHash('md5').update('abc123').digest('hex');
    expect(conn.execute.mock.calls[0][1]).toEqual(['52998224725', md5]);
  });

  it('recusa usuário pendente ou rejeitado com 403', async () => {
    conn.execute.mockResolvedValue([[user({ status: 'pending' })]]);
    expect((await login('?cpf=52998224725&password=x')).status).toBe(403);
    conn.execute.mockResolvedValue([[user({ status: 'rejected' })]]);
    expect((await login('?cpf=52998224725&password=x')).status).toBe(403);
  });

  it('recusa usuário inativo com 403', async () => {
    conn.execute.mockResolvedValue([[user({ active: 0 })]]);
    expect((await login('?cpf=52998224725&password=x')).status).toBe(403);
  });

  it('autentica usuário aprovado e ativo, sem expor a senha', async () => {
    conn.execute.mockResolvedValue([[user({ role: 'dev' })]]);
    const res = await login('?cpf=52998224725&password=x');
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toMatchObject({ id: '1', role: 'dev', active: true, first_login: false });
    expect(body).not.toHaveProperty('password');
    expect(conn.end).toHaveBeenCalled();
  });
});
