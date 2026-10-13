import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as loginRoute from '@/app/api/usuarios/login/route';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { hashSessionToken } from '@/lib/auth/session';
import {
  apiRequest,
  installFakeDb,
  PASSWORD_OK,
  SESSION_TOKEN,
  type FakeDb,
  type SqlRule,
} from '../helpers/auth';

vi.mock('@/lib/db', () => ({ executeQuery: vi.fn(), getPool: vi.fn() }));
vi.mock('@/lib/auth/password', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/auth/password')>();
  return { ...original, verifyPassword: vi.fn(original.verifyPassword) };
});

const CPF = '52998224725';
let storedHash: string;

beforeAll(async () => {
  storedHash = await hashPassword(PASSWORD_OK);
});

const userRow = (overrides: Record<string, unknown> = {}) => ({
  id: 7,
  cpf: CPF,
  name: 'Maria',
  email: 'maria@exemplo.com',
  phone: '11999998888',
  creci: null,
  role: 'vendedor',
  status: 'approved',
  active: 1,
  first_login: 0,
  theme_preference: 'light',
  password: storedHash,
  ...overrides,
});

const loginRules = (user: Record<string, unknown> | null, attempts = 0): SqlRule[] => [
  { match: /FROM auth_attempts/, result: [{ attempts, oldest_age: 60 }] },
  { match: /FROM users WHERE cpf = \?/, result: user ? [user] : [] },
];

const post = (body: unknown, options: Parameters<typeof apiRequest>[2] = {}) =>
  loginRoute.POST(apiRequest('/api/usuarios/login', 'POST', { body, ...options }));

describe('POST /api/usuarios/login', () => {
  let db: FakeDb;
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => vi.unstubAllEnvs());

  it('login válido: 200, cookie HttpOnly/SameSite=Lax/Path=/ e corpo sem token, senha ou hash (CA-01)', async () => {
    db = installFakeDb(loginRules(userRow()));
    const res = await post({ cpf: '529.982.247-25', password: PASSWORD_OK });
    expect(res.status).toBe(200);

    const cookie = res.headers.get('set-cookie') ?? '';
    expect(cookie).toMatch(/^session=[A-Za-z0-9_-]{43};/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=lax/i);
    expect(cookie).toMatch(/Path=\//i);
    expect(cookie).not.toMatch(/Secure/i);
    expect(cookie).not.toMatch(/Domain=/i);

    const text = await res.text();
    const token = /^session=([^;]+)/.exec(cookie)![1];
    expect(text).not.toContain(token);
    expect(text).not.toContain(storedHash);
    expect(text).not.toContain(PASSWORD_OK);
    expect(JSON.parse(text).user).toMatchObject({ id: '7', role: 'vendedor', first_login: false });
    expect(JSON.parse(text).user).not.toHaveProperty('password');
  });

  it('em produção o cookie é __Host-session com Secure (CA-44)', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    installFakeDb(loginRules(userRow()));
    const res = await post({ cpf: CPF, password: PASSWORD_OK });
    const cookie = res.headers.get('set-cookie') ?? '';
    expect(cookie).toMatch(/^__Host-session=/);
    expect(cookie).toMatch(/Secure/i);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=lax/i);
    expect(cookie).toMatch(/Path=\//i);
  });

  it('GET não existe: o Next responde 405 (CA-02)', () => {
    expect((loginRoute as Record<string, unknown>).GET).toBeUndefined();
  });

  it('CPF inexistente e senha errada: mesma resposta 401, com verificação de hash nos dois casos (CA-03)', async () => {
    installFakeDb(loginRules(null));
    const semConta = await post({ cpf: CPF, password: 'qualquer-senha' });
    expect(vi.mocked(verifyPassword)).toHaveBeenCalledTimes(1);

    installFakeDb(loginRules(userRow()));
    const senhaErrada = await post({ cpf: CPF, password: 'senha-errada-1' });
    expect(vi.mocked(verifyPassword)).toHaveBeenCalledTimes(2);

    expect(semConta.status).toBe(401);
    expect(senhaErrada.status).toBe(401);
    expect(await semConta.json()).toEqual(await senhaErrada.json());
    expect(semConta.headers.get('set-cookie')).toBeNull();
  });

  it('falha registra tentativas por CPF e por IP, sem criar sessão', async () => {
    db = installFakeDb(loginRules(userRow()));
    await post({ cpf: CPF, password: 'senha-errada-1' });
    expect(db.where(/INSERT INTO auth_attempts/)).toHaveLength(2);
    expect(db.where(/INSERT INTO user_sessions/)).toHaveLength(0);
  });

  it.each([
    ['pending', { status: 'pending' }],
    ['rejected', { status: 'rejected' }],
    ['inativo', { active: 0 }],
  ])(
    'conta %s: 403 com senha correta, 401 genérico com senha errada (CA-04)',
    async (_nome, extra) => {
      db = installFakeDb(loginRules(userRow(extra)));
      const certa = await post({ cpf: CPF, password: PASSWORD_OK });
      expect(certa.status).toBe(403);
      expect(certa.headers.get('set-cookie')).toBeNull();
      expect(db.where(/INSERT INTO user_sessions/)).toHaveLength(0);

      const errada = await post({ cpf: CPF, password: 'senha-errada-1' });
      expect(errada.status).toBe(401);
      expect((await errada.json()).error).toBe('CPF ou senha inválidos');
    }
  );

  it('a sessão guarda só o hash do token (CA-05)', async () => {
    db = installFakeDb(loginRules(userRow()));
    const res = await post({ cpf: CPF, password: PASSWORD_OK });
    const token = /^session=([^;]+)/.exec(res.headers.get('set-cookie') ?? '')![1];
    const [insert] = db.where(/INSERT INTO user_sessions/);
    expect(insert.params).toContain(hashSessionToken(token));
    expect(JSON.stringify(insert.params)).not.toContain(token);
  });

  it('ignora cookie recebido: revoga a sessão antiga e emite token novo (CA-09)', async () => {
    db = installFakeDb(loginRules(userRow()));
    const res = await post({ cpf: CPF, password: PASSWORD_OK }, { cookie: SESSION_TOKEN });
    const novo = /^session=([^;]+)/.exec(res.headers.get('set-cookie') ?? '')![1];
    expect(novo).not.toBe(SESSION_TOKEN);
    const [revoke] = db.where(/UPDATE user_sessions SET revoked_at = NOW\(\) WHERE token_hash/);
    expect(revoke.params).toEqual([hashSessionToken(SESSION_TOKEN)]);
  });

  it('bloqueia com 429 e Retry-After mesmo com a senha correta (CA-11, CA-12)', async () => {
    db = installFakeDb(loginRules(userRow(), 99));
    const res = await post({ cpf: CPF, password: PASSWORD_OK });
    expect(res.status).toBe(429);
    expect(Number(res.headers.get('retry-after'))).toBeGreaterThan(0);
    expect(res.headers.get('set-cookie')).toBeNull();
    expect(db.where(/FROM users WHERE cpf/)).toHaveLength(0);
  });

  it('login bem-sucedido zera as falhas do CPF e registra last_login_at', async () => {
    db = installFakeDb(loginRules(userRow()));
    await post({ cpf: CPF, password: PASSWORD_OK });
    expect(db.where(/DELETE FROM auth_attempts WHERE kind/)).toHaveLength(1);
    expect(db.where(/SET last_login_at = NOW\(\)/)).toHaveLength(1);
  });

  it('valida entrada e rejeita origem externa (CSRF)', async () => {
    db = installFakeDb();
    expect((await post({ cpf: '123', password: 'x' })).status).toBe(400);
    expect((await post({ cpf: CPF })).status).toBe(400);
    expect((await post(undefined)).status).toBe(400);
    expect(
      (await post({ cpf: CPF, password: PASSWORD_OK }, { origin: 'https://evil.example' })).status
    ).toBe(403);
    expect(db.calls).toHaveLength(0);
  });

  it('não loga senha, hash nem token mesmo em erro (CA-49)', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    installFakeDb([
      {
        match: /FROM users WHERE cpf/,
        result: () => {
          throw new Error('falha simulada');
        },
      },
      { match: /FROM auth_attempts/, result: [{ attempts: 0 }] },
    ]);
    const res = await post({ cpf: CPF, password: PASSWORD_OK });
    expect(res.status).toBe(500);
    const logged = JSON.stringify(spy.mock.calls);
    expect(logged).not.toContain(PASSWORD_OK);
    expect(logged).not.toContain(storedHash);
  });
});
