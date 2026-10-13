import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST as criar } from '@/app/api/usuarios/criar/route';
import { apiRequest, installFakeDb, PASSWORD_OK, type FakeDb } from '../helpers/auth';

vi.mock('@/lib/db', () => ({ executeQuery: vi.fn(), getPool: vi.fn() }));

const valid = {
  name: 'Maria Souza',
  email: 'Maria@Exemplo.com',
  cpf: '529.982.247-25',
  phone: '(11) 99999-8888',
  creci: '12345-F',
  password: PASSWORD_OK,
};

const post = (body: unknown, options: Parameters<typeof apiRequest>[2] = {}) =>
  criar(apiRequest('/api/usuarios/criar', 'POST', { body, ...options }));

describe('POST /api/usuarios/criar (cadastro público)', () => {
  let db: FakeDb;
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    db = installFakeDb([{ match: /FROM auth_attempts/, result: [{ attempts: 0 }] }]);
  });

  it('grava sempre vendedor/pending/first_login=1, ignorando role, status, active e first_login do corpo (CA-25)', async () => {
    const res = await post({
      ...valid,
      role: 'dev',
      status: 'approved',
      active: true,
      first_login: false,
    });
    expect(res.status).toBe(201);
    const [insert] = db.where(/INSERT INTO users/);
    expect(insert.sql).toContain("'vendedor', 'pending'");
    expect(insert.sql).toContain(', 1)');
    expect(insert.params).not.toContain('dev');
    expect(insert.params).not.toContain('approved');
  });

  it('normaliza CPF, telefone e e-mail e grava hash scrypt, não a senha', async () => {
    await post(valid);
    const [insert] = db.where(/INSERT INTO users/);
    expect(insert.params.slice(0, 5)).toEqual([
      'Maria Souza',
      'maria@exemplo.com',
      '52998224725',
      '11999998888',
      '12345-F',
    ]);
    expect(String(insert.params[5]).startsWith('scrypt$v1$')).toBe(true);
    expect(insert.params).not.toContain(PASSWORD_OK);
  });

  it('a resposta não traz id, hash nem dados da conta (CA-36)', async () => {
    const res = await post(valid);
    const body = await res.json();
    expect(Object.keys(body)).toEqual(['message']);
  });

  it('senha curta, igual ao CPF ou comum: 400 sem inserir (CA-19)', async () => {
    for (const password of ['curta1', '529.982.247-25', '12345678', 'senha123']) {
      expect((await post({ ...valid, password })).status).toBe(400);
    }
    expect(db.where(/INSERT INTO users/)).toHaveLength(0);
  });

  it('valida os dados obrigatórios', async () => {
    for (const patch of [
      { name: '' },
      { email: 'sem-arroba' },
      { cpf: '111.111.111-11' },
      { phone: '123' },
    ]) {
      expect((await post({ ...valid, ...patch })).status).toBe(400);
    }
    expect((await post(undefined)).status).toBe(400);
  });

  it('CPF ou e-mail duplicado: 409 (RN-12)', async () => {
    db = installFakeDb([
      { match: /FROM auth_attempts/, result: [{ attempts: 0 }] },
      {
        match: /INSERT INTO users/,
        result: () => {
          throw Object.assign(new Error('dup'), { code: 'ER_DUP_ENTRY' });
        },
      },
    ]);
    expect((await post(valid)).status).toBe(409);
  });

  it('6º cadastro do mesmo IP na hora: 429 (CA-13)', async () => {
    db = installFakeDb([
      { match: /FROM auth_attempts/, result: [{ attempts: 5, oldest_age: 10 }] },
    ]);
    const res = await post(valid);
    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).not.toBeNull();
    expect(db.where(/INSERT INTO users/)).toHaveLength(0);
  });

  it('rejeita origem externa (CSRF)', async () => {
    expect((await post(valid, { origin: 'https://evil.example' })).status).toBe(403);
    expect(db.calls).toHaveLength(0);
  });
});
