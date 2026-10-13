import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { requireRole, requireUser } from '@/lib/auth/guard';
import { ADMIN_ROLES, DEV_ONLY } from '@/lib/auth/roles';
import { assertSameOrigin, getClientIp } from '@/lib/auth/request';
import { cleanupAuthData } from '@/lib/auth/session';
import { NextRequest } from 'next/server';
import { apiRequest, authed, installFakeDb, SESSION_TOKEN, sessionRule } from '../helpers/auth';

vi.mock('@/lib/db', () => ({ executeQuery: vi.fn(), getPool: vi.fn() }));

describe('requireUser', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.unstubAllEnvs());

  it('sem cookie responde 401 sem consultar o banco', async () => {
    const db = installFakeDb();
    const result = await requireUser(apiRequest('/api/x', 'GET'));
    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(401);
    expect(db.calls).toHaveLength(0);
  });

  it('sessão expirada, revogada ou desconhecida: 401 e cookie limpo (CA-06)', async () => {
    installFakeDb([{ match: /FROM user_sessions s JOIN users u/, result: [] }]);
    const result = (await requireUser(
      apiRequest('/api/x', 'GET', { cookie: 'qualquer' })
    )) as NextResponse;
    expect(result.status).toBe(401);
    expect(result.headers.get('set-cookie')).toMatch(/session=;.*Max-Age=0/i);
  });

  it('a consulta exige não revogada, dentro dos dois prazos e usuário aprovado e ativo (RN-03)', async () => {
    const db = installFakeDb([sessionRule()]);
    await requireUser(apiRequest('/api/x', 'GET', { cookie: SESSION_TOKEN }));
    const [lookup] = db.where(/FROM user_sessions s/);
    expect(lookup.sql).toContain('s.revoked_at IS NULL');
    expect(lookup.sql).toContain('s.idle_expires_at > NOW()');
    expect(lookup.sql).toContain('s.absolute_expires_at > NOW()');
    expect(lookup.sql).toContain("u.status = 'approved'");
    expect(lookup.sql).toContain('u.active = 1');
    expect(lookup.params).not.toContain(SESSION_TOKEN);
  });

  it('devolve o usuário e a sessão quando válida', async () => {
    installFakeDb([sessionRule({ role: 'admin' })]);
    const result = await requireUser(authed('/api/x', 'GET'));
    expect(result).not.toBeInstanceOf(NextResponse);
    expect(result).toMatchObject({
      sessionId: 10,
      user: { id: 1, role: 'admin', firstLogin: false },
    });
  });

  it('falha fechada: erro do banco vira 500, nunca sessão válida', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    installFakeDb([
      {
        match: /FROM user_sessions s/,
        result: () => {
          throw new Error('banco fora');
        },
      },
    ]);
    const result = (await requireUser(authed('/api/x', 'GET'))) as NextResponse;
    expect(result.status).toBe(500);
  });

  it('senha provisória: 403 PASSWORD_CHANGE_REQUIRED, salvo allowPasswordChange (CA-23)', async () => {
    installFakeDb([sessionRule({ first_login: 1 })]);
    const blocked = (await requireUser(authed('/api/x', 'GET'))) as NextResponse;
    expect(blocked.status).toBe(403);
    expect((await blocked.json()).code).toBe('PASSWORD_CHANGE_REQUIRED');
    const allowed = await requireUser(authed('/api/x', 'GET'), { allowPasswordChange: true });
    expect(allowed).not.toBeInstanceOf(NextResponse);
  });

  it('atualiza last_seen no máximo a cada 5 minutos (RN-06)', async () => {
    const recent = installFakeDb([sessionRule({ since_seen: 60 })]);
    await requireUser(authed('/api/x', 'GET'));
    expect(recent.where(/UPDATE user_sessions SET last_seen_at/)).toHaveLength(0);

    const stale = installFakeDb([sessionRule({ since_seen: 301 })]);
    await requireUser(authed('/api/x', 'GET'));
    expect(stale.where(/UPDATE user_sessions SET last_seen_at/)).toHaveLength(1);
  });

  it('aplica a checagem CSRF em métodos que mudam estado (CA-42)', async () => {
    const db = installFakeDb([sessionRule()]);
    const cross = (await requireUser(
      apiRequest('/api/x', 'POST', { cookie: SESSION_TOKEN, origin: 'https://evil.example' })
    )) as NextResponse;
    expect(cross.status).toBe(403);
    expect(db.calls).toHaveLength(0);
    const semOrigin = (await requireUser(
      apiRequest('/api/x', 'DELETE', { cookie: SESSION_TOKEN, origin: false })
    )) as NextResponse;
    expect(semOrigin.status).toBe(403);
    const ok = await requireUser(apiRequest('/api/x', 'PUT', { cookie: SESSION_TOKEN }));
    expect(ok).not.toBeInstanceOf(NextResponse);
  });
});

describe('requireRole', () => {
  beforeEach(() => vi.clearAllMocks());

  it('403 quando o papel (lido do banco) não está na lista; sucesso caso contrário', async () => {
    installFakeDb([sessionRule({ role: 'vendedor' })]);
    expect(((await requireRole(authed('/api/x', 'GET'), ADMIN_ROLES)) as NextResponse).status).toBe(
      403
    );

    installFakeDb([sessionRule({ role: 'admin' })]);
    expect(await requireRole(authed('/api/x', 'GET'), ADMIN_ROLES)).not.toBeInstanceOf(
      NextResponse
    );
    expect(((await requireRole(authed('/api/x', 'GET'), DEV_ONLY)) as NextResponse).status).toBe(
      403
    );

    installFakeDb([sessionRule({ role: 'dev' })]);
    expect(await requireRole(authed('/api/x', 'GET'), DEV_ONLY)).not.toBeInstanceOf(NextResponse);
  });

  it('sem sessão devolve 401, não 403', async () => {
    installFakeDb();
    expect(
      ((await requireRole(apiRequest('/api/x', 'GET'), ADMIN_ROLES)) as NextResponse).status
    ).toBe(401);
  });
});

describe('assertSameOrigin e getClientIp', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('métodos seguros passam; Sec-Fetch-Site same-origin passa; cross-site não', () => {
    expect(assertSameOrigin(apiRequest('/api/x', 'GET', { origin: false }))).toBeNull();
    expect(
      assertSameOrigin(
        apiRequest('/api/x', 'POST', {
          origin: false,
          headers: { 'sec-fetch-site': 'same-origin' },
        })
      )
    ).toBeNull();
    expect(
      assertSameOrigin(
        apiRequest('/api/x', 'POST', { headers: { 'sec-fetch-site': 'cross-site' } })
      )?.status
    ).toBe(403);
  });

  it('NEXT_PUBLIC_SITE_URL também é uma origem aceita', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://app.exemplo.com/');
    expect(
      assertSameOrigin(apiRequest('/api/x', 'POST', { origin: 'https://app.exemplo.com' }))
    ).toBeNull();
  });

  it('só confia em x-forwarded-for / x-real-ip na Vercel', () => {
    const forged = new NextRequest('http://localhost/api/x', {
      headers: { 'x-forwarded-for': '198.51.100.7, 10.0.0.1', 'x-real-ip': '198.51.100.8' },
    });
    expect(getClientIp(forged)).toBe('local');
    vi.stubEnv('VERCEL', '1');
    expect(getClientIp(forged)).toBe('198.51.100.7');
    const onlyReal = new NextRequest('http://localhost/api/x', {
      headers: { 'x-real-ip': '198.51.100.8' },
    });
    expect(getClientIp(onlyReal)).toBe('198.51.100.8');
    const invalid = new NextRequest('http://localhost/api/x', {
      headers: { 'x-forwarded-for': 'não-é-ip' },
    });
    expect(getClientIp(invalid)).toBe('unknown');
  });
});

describe('limpeza (CA-50)', () => {
  it('apaga sessões com mais de 30 dias e tentativas/pedidos com mais de 7 dias', async () => {
    const db = installFakeDb();
    await cleanupAuthData();
    const sql = db.calls.map((call) => call.sql).join('\n');
    expect(sql).toMatch(/DELETE FROM user_sessions.*INTERVAL 30 DAY/);
    expect(sql).toMatch(
      /DELETE FROM auth_attempts WHERE created_at < DATE_SUB\(NOW\(\), INTERVAL 7 DAY\)/
    );
    expect(sql).toMatch(/DELETE FROM password_reset_requests.*INTERVAL 7 DAY/);
  });
});

describe('contrato: toda rota de usuarios tem política (RN-09, CA-31 para usuarios/*)', () => {
  const PUBLIC = [
    'usuarios/login',
    'usuarios/logout',
    'usuarios/criar',
    'usuarios/senha/solicitar',
    'usuarios/senha/redefinir',
  ];

  const root = path.resolve(__dirname, '../../app/api/usuarios');
  const routes: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name === 'route.ts') routes.push(full);
    }
  };
  walk(root);

  it('encontra as rotas esperadas', () => {
    expect(routes.length).toBeGreaterThanOrEqual(17);
  });

  it.each(
    routes.map((file) => [path.relative(path.resolve(root, '..'), path.dirname(file)), file])
  )('%s declara política', (relative, file) => {
    const source = fs.readFileSync(file, 'utf8');
    if (PUBLIC.includes(relative)) {
      // Pública: ainda assim checa a origem (CSRF) em todo método que muda estado.
      expect(source).toContain('assertSameOrigin(request)');
    } else {
      expect(source).toMatch(/requireUser\(|requireRole\(/);
    }
  });

  it('as rotas antigas password/* não existem mais (CA-24)', () => {
    expect(fs.existsSync(path.resolve(root, '../password'))).toBe(false);
  });
});
