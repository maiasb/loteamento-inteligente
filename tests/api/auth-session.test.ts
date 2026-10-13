import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET as me } from '@/app/api/usuarios/me/route';
import { POST as logout } from '@/app/api/usuarios/logout/route';
import { PUT as theme } from '@/app/api/usuarios/theme/route';
import { hashSessionToken } from '@/lib/auth/session';
import {
  apiRequest,
  authed,
  installFakeDb,
  SESSION_TOKEN,
  sessionRule,
  type FakeDb,
} from '../helpers/auth';

vi.mock('@/lib/db', () => ({ executeQuery: vi.fn(), getPool: vi.fn() }));

describe('GET /api/usuarios/me', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sem sessão: 401 (CA-10)', async () => {
    installFakeDb();
    expect((await me(apiRequest('/api/usuarios/me', 'GET'))).status).toBe(401);
  });

  it('com sessão: id, nome, papel, first_login e tema, sem senha (CA-10)', async () => {
    installFakeDb([sessionRule({ role: 'admin', theme_preference: 'dark' })]);
    const res = await me(authed('/api/usuarios/me', 'GET'));
    expect(res.status).toBe(200);
    const { user } = await res.json();
    expect(user).toMatchObject({
      id: '1',
      name: 'Maria',
      role: 'admin',
      first_login: false,
      theme_preference: 'dark',
    });
    expect(JSON.stringify(user)).not.toMatch(/password|hash|token/i);
  });

  it('funciona com senha provisória, para o front saber que precisa trocar', async () => {
    installFakeDb([sessionRule({ first_login: 1 })]);
    const res = await me(authed('/api/usuarios/me', 'GET'));
    expect(res.status).toBe(200);
    expect((await res.json()).user.first_login).toBe(true);
  });
});

describe('POST /api/usuarios/logout', () => {
  let db: FakeDb;
  beforeEach(() => vi.clearAllMocks());

  it('revoga a sessão no banco e limpa o cookie (CA-07)', async () => {
    db = installFakeDb();
    const res = await logout(apiRequest('/api/usuarios/logout', 'POST', { cookie: SESSION_TOKEN }));
    expect(res.status).toBe(200);
    expect(res.headers.get('set-cookie')).toMatch(/session=;.*Max-Age=0/i);
    const [revoke] = db.where(/SET revoked_at = NOW\(\) WHERE token_hash/);
    expect(revoke.params).toEqual([hashSessionToken(SESSION_TOKEN)]);
  });

  it('o mesmo cookie reenviado depois do logout resulta em 401 (CA-07)', async () => {
    installFakeDb([{ match: /FROM user_sessions s JOIN users u/, result: [] }]);
    expect((await me(authed('/api/usuarios/me', 'GET'))).status).toBe(401);
  });

  it('é idempotente: sem cookie também responde 200', async () => {
    db = installFakeDb();
    const res = await logout(apiRequest('/api/usuarios/logout', 'POST'));
    expect(res.status).toBe(200);
    expect(db.calls).toHaveLength(0);
  });

  it('rejeita origem externa (CSRF)', async () => {
    installFakeDb();
    const res = await logout(
      apiRequest('/api/usuarios/logout', 'POST', {
        cookie: SESSION_TOKEN,
        origin: 'https://evil.example',
      })
    );
    expect(res.status).toBe(403);
  });
});

describe('PUT /api/usuarios/theme', () => {
  beforeEach(() => vi.clearAllMocks());

  it('altera só o tema do usuário da sessão, ignorando userId do corpo (CA-30)', async () => {
    const db = installFakeDb([sessionRule({ id: 5 })]);
    const res = await theme(authed('/api/usuarios/theme', 'PUT', { theme: 'dark', userId: 99 }));
    expect(res.status).toBe(200);
    const [update] = db.where(/UPDATE users SET theme_preference/);
    expect(update.params).toEqual(['dark', 5]);
  });

  it('exige sessão e tema válido', async () => {
    installFakeDb();
    expect(
      (await theme(apiRequest('/api/usuarios/theme', 'PUT', { body: { theme: 'dark' } }))).status
    ).toBe(401);
    installFakeDb([sessionRule()]);
    expect((await theme(authed('/api/usuarios/theme', 'PUT', { theme: 'azul' }))).status).toBe(400);
  });
});
