import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET as listar, POST as criarPorAdmin } from '@/app/api/usuarios/route';
import { PUT as aprovar } from '@/app/api/usuarios/aprovar/route';
import { PUT as alterarRole } from '@/app/api/usuarios/role/route';
import { PUT as toggleActive } from '@/app/api/usuarios/toggle-active/route';
import { DELETE as excluir } from '@/app/api/usuarios/excluir/route';
import { PUT as atualizar } from '@/app/api/usuarios/atualizar/[id]/route';
import { POST as resetPassword } from '@/app/api/usuarios/reset-password/route';
import { GET as pedidos } from '@/app/api/usuarios/senha/pedidos/route';
import { POST as codigo } from '@/app/api/usuarios/senha/codigo/route';
import { verifyPassword } from '@/lib/auth/password';
import {
  apiRequest,
  authed,
  installFakeDb,
  PASSWORD_OK,
  sessionRule,
  type FakeDb,
  type SqlRule,
} from '../helpers/auth';

vi.mock('@/lib/db', () => ({ executeQuery: vi.fn(), getPool: vi.fn() }));

const target = (overrides: Record<string, unknown> = {}) => ({
  id: 20,
  name: 'Alvo',
  role: 'vendedor',
  status: 'approved',
  active: 1,
  ...overrides,
});

const targetRule = (row: Record<string, unknown> | null): SqlRule => ({
  match: /FROM users WHERE id = \? FOR UPDATE/,
  result: row ? [row] : [],
});
const otherDevs = (count: number): SqlRule => ({
  match: /WHERE role = 'dev' AND status = 'approved' AND active = 1 AND id <> \?/,
  result: Array.from({ length: count }, (_, i) => ({ id: 100 + i })),
});

const asAdmin = sessionRule({ id: 2, role: 'admin' });
const asDev = sessionRule({ id: 1, role: 'dev' });
const asSeller = sessionRule({ id: 3, role: 'vendedor' });

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('proteção das rotas de gestão de usuários (CA-27)', () => {
  const call = (name: string, req: ReturnType<typeof apiRequest>) => {
    const params = { params: Promise.resolve({ id: '20' }) };
    const handlers: Record<string, () => Promise<Response>> = {
      listar: () => listar(req),
      criar: () => criarPorAdmin(req),
      aprovar: () => aprovar(req),
      role: () => alterarRole(req),
      toggle: () => toggleActive(req),
      excluir: () => excluir(req),
      atualizar: () => atualizar(req, params),
      reset: () => resetPassword(req),
      pedidos: () => pedidos(req),
      codigo: () => codigo(req),
    };
    return handlers[name]();
  };

  const routes: Array<[string, string, string]> = [
    ['listar', 'GET', '/api/usuarios'],
    ['criar', 'POST', '/api/usuarios'],
    ['aprovar', 'PUT', '/api/usuarios/aprovar'],
    ['role', 'PUT', '/api/usuarios/role'],
    ['toggle', 'PUT', '/api/usuarios/toggle-active'],
    ['excluir', 'DELETE', '/api/usuarios/excluir'],
    ['atualizar', 'PUT', '/api/usuarios/atualizar/20'],
    ['reset', 'POST', '/api/usuarios/reset-password'],
    ['pedidos', 'GET', '/api/usuarios/senha/pedidos'],
    ['codigo', 'POST', '/api/usuarios/senha/codigo'],
  ];

  it.each(routes)(
    '%s: sem sessão 401, vendedor 403, sem tocar nos dados',
    async (name, method, url) => {
      const anonymous = installFakeDb();
      expect((await call(name, apiRequest(url, method, { body: {} }))).status).toBe(401);
      expect(anonymous.calls).toHaveLength(0);

      const seller = installFakeDb([asSeller]);
      expect((await call(name, authed(url, method, {}))).status).toBe(403);
      expect(seller.calls.filter((c) => !/FROM user_sessions/.test(c.sql))).toHaveLength(0);
    }
  );
});

describe('GET /api/usuarios', () => {
  it('admin lista os usuários sem senha', async () => {
    installFakeDb([
      asAdmin,
      { match: /FROM users ORDER BY/, result: [{ id: 1, name: 'A', active: 1, role: 'dev' }] },
    ]);
    const res = await listar(authed('/api/usuarios', 'GET'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([{ id: 1, name: 'A', active: true, role: 'dev' }]);
  });
});

describe('POST /api/usuarios (criação por admin/dev)', () => {
  const body = {
    name: 'Novo Usuário',
    email: 'novo@exemplo.com',
    cpf: '52998224725',
    phone: '11999998888',
    role: 'vendedor',
    password: PASSWORD_OK,
  };
  let db: FakeDb;

  it('admin cria vendedor e admin (201), aprovado e com troca de senha obrigatória', async () => {
    db = installFakeDb([asAdmin]);
    for (const role of ['vendedor', 'admin']) {
      expect((await criarPorAdmin(authed('/api/usuarios', 'POST', { ...body, role }))).status).toBe(
        201
      );
    }
    const [insert] = db.where(/INSERT INTO users/);
    expect(insert.sql).toContain("'approved'");
    expect(insert.sql).toContain(', 1)');
    expect(String(insert.params[6]).startsWith('scrypt$v1$')).toBe(true);
  });

  it('admin não cria dev (403); dev cria dev (201) (CA-26)', async () => {
    db = installFakeDb([asAdmin]);
    expect(
      (await criarPorAdmin(authed('/api/usuarios', 'POST', { ...body, role: 'dev' }))).status
    ).toBe(403);
    expect(db.where(/INSERT INTO users/)).toHaveLength(0);

    installFakeDb([asDev]);
    expect(
      (await criarPorAdmin(authed('/api/usuarios', 'POST', { ...body, role: 'dev' }))).status
    ).toBe(201);
  });

  it('valida papel e senha (400) e duplicidade (409)', async () => {
    installFakeDb([asAdmin]);
    expect(
      (await criarPorAdmin(authed('/api/usuarios', 'POST', { ...body, role: 'root' }))).status
    ).toBe(400);
    expect(
      (await criarPorAdmin(authed('/api/usuarios', 'POST', { ...body, password: '123' }))).status
    ).toBe(400);

    installFakeDb([
      asAdmin,
      {
        match: /INSERT INTO users/,
        result: () => {
          throw Object.assign(new Error('dup'), { code: 'ER_DUP_ENTRY' });
        },
      },
    ]);
    expect((await criarPorAdmin(authed('/api/usuarios', 'POST', body))).status).toBe(409);
  });
});

describe('hierarquia e proteção do último dev (CA-28)', () => {
  const mutations: Array<[string, () => Promise<Response>]> = [
    [
      'aprovar',
      () => aprovar(authed('/api/usuarios/aprovar', 'PUT', { idUsuario: 20, status: 'rejected' })),
    ],
    [
      'role',
      () => alterarRole(authed('/api/usuarios/role', 'PUT', { idUsuario: 20, role: 'vendedor' })),
    ],
    [
      'toggle',
      () =>
        toggleActive(authed('/api/usuarios/toggle-active', 'PUT', { userId: 20, active: false })),
    ],
    ['excluir', () => excluir(authed('/api/usuarios/excluir', 'DELETE', { userId: 20 }))],
    ['reset', () => resetPassword(authed('/api/usuarios/reset-password', 'POST', { userId: 20 }))],
  ];

  it.each(mutations)('%s: admin sobre conta dev é 403 e nada é gravado', async (_name, run) => {
    const db = installFakeDb([asAdmin, targetRule(target({ role: 'dev' }))]);
    expect((await run()).status).toBe(403);
    expect(db.where(/^(UPDATE|DELETE)/)).toHaveLength(0);
  });

  it.each(mutations)('%s: conta inexistente é 404', async (_name, run) => {
    installFakeDb([asAdmin, targetRule(null)]);
    expect((await run()).status).toBe(404);
  });

  it('ninguém altera a própria conta (papel, situação, ativação, exclusão, reset)', async () => {
    const own = target({ id: 1, role: 'dev' });
    const db = installFakeDb([asDev, targetRule(own), otherDevs(2)]);
    const self = [
      aprovar(authed('/api/usuarios/aprovar', 'PUT', { idUsuario: 1, status: 'rejected' })),
      alterarRole(authed('/api/usuarios/role', 'PUT', { idUsuario: 1, role: 'admin' })),
      toggleActive(authed('/api/usuarios/toggle-active', 'PUT', { userId: 1, active: false })),
      excluir(authed('/api/usuarios/excluir', 'DELETE', { userId: 1 })),
      resetPassword(authed('/api/usuarios/reset-password', 'POST', { userId: 1 })),
    ];
    for (const res of await Promise.all(self)) expect(res.status).toBe(403);
    expect(db.where(/^(UPDATE users|DELETE)/)).toHaveLength(0);
  });

  it('o último dev ativo não pode ser excluído, desativado, rejeitado nem rebaixado: 409', async () => {
    const db = installFakeDb([asDev, targetRule(target({ role: 'dev' })), otherDevs(0)]);
    const results = await Promise.all([
      excluir(authed('/api/usuarios/excluir', 'DELETE', { userId: 20 })),
      toggleActive(authed('/api/usuarios/toggle-active', 'PUT', { userId: 20, active: false })),
      aprovar(authed('/api/usuarios/aprovar', 'PUT', { idUsuario: 20, status: 'rejected' })),
      alterarRole(authed('/api/usuarios/role', 'PUT', { idUsuario: 20, role: 'admin' })),
    ]);
    for (const res of results) expect(res.status).toBe(409);
    expect(db.where(/^(UPDATE users|DELETE)/)).toHaveLength(0);
  });

  it('havendo outro dev ativo, o dev pode ser desativado (e as sessões dele revogadas)', async () => {
    const db = installFakeDb([asDev, targetRule(target({ role: 'dev' })), otherDevs(1)]);
    const res = await toggleActive(
      authed('/api/usuarios/toggle-active', 'PUT', { userId: 20, active: false })
    );
    expect(res.status).toBe(200);
    expect(db.where(/UPDATE user_sessions SET revoked_at = NOW\(\) WHERE user_id/)).toHaveLength(1);
  });

  it('admin não atribui o papel dev nem a um vendedor (403)', async () => {
    const db = installFakeDb([asAdmin, targetRule(target())]);
    const res = await alterarRole(
      authed('/api/usuarios/role', 'PUT', { idUsuario: 20, role: 'dev' })
    );
    expect(res.status).toBe(403);
    expect(db.where(/^UPDATE users/)).toHaveLength(0);
  });
});

describe('revogação de sessões e papel relido (CA-08)', () => {
  it('desativar, rejeitar e excluir revogam sessões; mudar o papel não revoga', async () => {
    let db = installFakeDb([asAdmin, targetRule(target())]);
    await toggleActive(authed('/api/usuarios/toggle-active', 'PUT', { userId: 20, active: false }));
    expect(db.where(/UPDATE user_sessions SET revoked_at/)).toHaveLength(1);

    db = installFakeDb([asAdmin, targetRule(target())]);
    await aprovar(authed('/api/usuarios/aprovar', 'PUT', { idUsuario: 20, status: 'rejected' }));
    expect(db.where(/UPDATE user_sessions SET revoked_at/)).toHaveLength(1);

    db = installFakeDb([asAdmin, targetRule(target())]);
    await excluir(authed('/api/usuarios/excluir', 'DELETE', { userId: 20 }));
    expect(db.where(/DELETE FROM users WHERE id/)).toHaveLength(1);

    db = installFakeDb([asAdmin, targetRule(target())]);
    const res = await alterarRole(
      authed('/api/usuarios/role', 'PUT', { idUsuario: 20, role: 'admin' })
    );
    expect(res.status).toBe(200);
    expect(db.where(/UPDATE user_sessions/)).toHaveLength(0);
  });

  it('aprovar (approved) não revoga sessões e reativar também não', async () => {
    const db = installFakeDb([asAdmin, targetRule(target({ status: 'pending' }))]);
    const res = await aprovar(
      authed('/api/usuarios/aprovar', 'PUT', { idUsuario: 20, status: 'approved' })
    );
    expect(res.status).toBe(200);
    expect(db.where(/UPDATE user_sessions/)).toHaveLength(0);
  });

  it('validações de entrada: status e papel inválidos', async () => {
    installFakeDb([asAdmin]);
    expect(
      (await aprovar(authed('/api/usuarios/aprovar', 'PUT', { idUsuario: 20, status: 'pending' })))
        .status
    ).toBe(400);
    expect(
      (await alterarRole(authed('/api/usuarios/role', 'PUT', { idUsuario: 20, role: 'root' })))
        .status
    ).toBe(400);
    expect(
      (
        await toggleActive(
          authed('/api/usuarios/toggle-active', 'PUT', { userId: 20, active: 'sim' })
        )
      ).status
    ).toBe(400);
  });
});

describe('PUT /api/usuarios/atualizar/[id] (CA-29)', () => {
  const run = (body: unknown, url = '/api/usuarios/atualizar/20') =>
    atualizar(authed(url, 'PUT', body), { params: Promise.resolve({ id: '20' }) });

  it('lê o corpo JSON e altera só nome, e-mail, CPF, telefone e CRECI', async () => {
    const db = installFakeDb([asAdmin, targetRule(target())]);
    const res = await run({ name: 'Novo Nome', cpf: '529.982.247-25', creci: '' });
    expect(res.status).toBe(200);
    const [update] = db.where(/^UPDATE users SET name/);
    expect(update.sql).toBe(
      'UPDATE users SET name = ?, cpf = ?, creci = ?, updated_at = NOW() WHERE id = ?'
    );
    expect(update.params).toEqual(['Novo Nome', '52998224725', null, 20]);
  });

  it.each(['password', 'role', 'status', 'active', 'first_login'])(
    'recusa %s no corpo com 400, sem gravar',
    async (field) => {
      const db = installFakeDb([asAdmin, targetRule(target())]);
      expect((await run({ name: 'Novo', [field]: 'x' })).status).toBe(400);
      expect(db.where(/^UPDATE users/)).toHaveLength(0);
    }
  );

  it('ignora campos na query string', async () => {
    const db = installFakeDb([asAdmin, targetRule(target())]);
    const res = await run({ name: 'Novo Nome' }, '/api/usuarios/atualizar/20?role=dev&password=x');
    expect(res.status).toBe(200);
    expect(db.where(/^UPDATE users SET name/)[0].sql).not.toMatch(/role|password/);
  });

  it('CPF ou e-mail duplicado: 409; admin sobre dev: 403; sem campos: 400', async () => {
    installFakeDb([
      asAdmin,
      targetRule(target()),
      {
        match: /^UPDATE users SET/,
        result: () => {
          throw Object.assign(new Error('dup'), { code: 'ER_DUP_ENTRY' });
        },
      },
    ]);
    expect((await run({ email: 'a@b.com' })).status).toBe(409);

    installFakeDb([asAdmin, targetRule(target({ role: 'dev' }))]);
    expect((await run({ name: 'Novo' })).status).toBe(403);

    installFakeDb([asAdmin]);
    expect((await run({})).status).toBe(400);
  });

  it('o admin pode editar os próprios dados cadastrais', async () => {
    const db = installFakeDb([asAdmin, targetRule(target({ id: 2, role: 'admin' }))]);
    expect((await run({ name: 'Meu Nome' })).status).toBe(200);
    expect(db.where(/^UPDATE users SET name/)).toHaveLength(1);
  });
});

describe('POST /api/usuarios/reset-password (CA-22)', () => {
  it('admin sobre vendedor: senha temporária aleatória, first_login=1, sessões e pedidos encerrados', async () => {
    const db = installFakeDb([asAdmin, targetRule(target())]);
    const first = await resetPassword(
      authed('/api/usuarios/reset-password', 'POST', { userId: 20 })
    );
    expect(first.status).toBe(200);
    const { temporaryPassword } = await first.json();
    expect(temporaryPassword.length).toBeGreaterThanOrEqual(12);
    expect(temporaryPassword).not.toBe('123456');

    const [update] = db.where(/^UPDATE users SET password = \?, first_login = 1/);
    expect(await verifyPassword(temporaryPassword, String(update.params[0]))).toBe(true);
    expect(String(update.params[0]).startsWith('scrypt$v1$')).toBe(true);
    expect(JSON.stringify(db.calls)).not.toContain(temporaryPassword);
    expect(db.where(/UPDATE user_sessions SET revoked_at/)).toHaveLength(1);
    expect(db.where(/UPDATE password_reset_requests SET status = 'cancelled'/)).toHaveLength(1);

    installFakeDb([asAdmin, targetRule(target())]);
    const second = await resetPassword(
      authed('/api/usuarios/reset-password', 'POST', { userId: 20 })
    );
    expect((await second.json()).temporaryPassword).not.toBe(temporaryPassword);
  });
});

describe('pedidos de redefinição e emissão de código (CA-55)', () => {
  it('admin não vê pedidos de contas dev; dev vê tudo', async () => {
    let db = installFakeDb([asAdmin, { match: /FROM password_reset_requests r/, result: [] }]);
    await pedidos(authed('/api/usuarios/senha/pedidos', 'GET'));
    expect(db.where(/FROM password_reset_requests r/)[0].sql).toContain("u.role <> 'dev'");

    db = installFakeDb([asDev, { match: /FROM password_reset_requests r/, result: [] }]);
    await pedidos(authed('/api/usuarios/senha/pedidos', 'GET'));
    expect(db.where(/FROM password_reset_requests r/)[0].sql).not.toContain("u.role <> 'dev'");
  });

  const pedido = (overrides: Record<string, unknown> = {}) => ({
    match: /FROM password_reset_requests r JOIN users u/,
    result: [
      {
        id: 5,
        status: 'open',
        still_valid: null,
        user_id: 20,
        name: 'Alvo',
        role: 'vendedor',
        ...overrides,
      },
    ],
  });

  it('emite o código uma única vez e guarda só o hash', async () => {
    const db = installFakeDb([asAdmin, pedido()]);
    const res = await codigo(authed('/api/usuarios/senha/codigo', 'POST', { requestId: 5 }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.code).toMatch(/^[2-9A-HJ-NP-Z]{5}-[2-9A-HJ-NP-Z]{5}$/);
    expect(body.expiresInMinutes).toBe(15);

    const [update] = db.where(/UPDATE password_reset_requests/);
    expect(update.sql).toContain("status = 'issued'");
    expect(update.sql).toContain('INTERVAL ? MINUTE');
    expect(update.params[0]).toMatch(/^[0-9a-f]{64}$/);
    expect(update.params).toContain(15);
    expect(JSON.stringify(db.calls)).not.toContain(body.code);
    expect(JSON.stringify(db.calls)).not.toContain(body.code.replace('-', ''));
  });

  it('admin emitindo para conta dev: 403 (RN-14); pedido encerrado ou inexistente: 404', async () => {
    const db = installFakeDb([asAdmin, pedido({ role: 'dev' })]);
    expect(
      (await codigo(authed('/api/usuarios/senha/codigo', 'POST', { requestId: 5 }))).status
    ).toBe(403);
    expect(db.where(/^UPDATE password_reset_requests/)).toHaveLength(0);

    installFakeDb([asAdmin, pedido({ status: 'used' })]);
    expect(
      (await codigo(authed('/api/usuarios/senha/codigo', 'POST', { requestId: 5 }))).status
    ).toBe(404);
    installFakeDb([asAdmin]);
    expect(
      (await codigo(authed('/api/usuarios/senha/codigo', 'POST', { requestId: 5 }))).status
    ).toBe(404);
  });

  it('ninguém emite código para o próprio pedido', async () => {
    installFakeDb([asAdmin, pedido({ user_id: 2, role: 'admin' })]);
    expect(
      (await codigo(authed('/api/usuarios/senha/codigo', 'POST', { requestId: 5 }))).status
    ).toBe(403);
  });
});
