import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST as trocarSenha } from '@/app/api/usuarios/senha/route';
import { POST as solicitar } from '@/app/api/usuarios/senha/solicitar/route';
import { POST as redefinir } from '@/app/api/usuarios/senha/redefinir/route';
import { GET as listarUsuarios } from '@/app/api/usuarios/route';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { hashResetCode } from '@/lib/auth/reset-code';
import { hashSessionToken } from '@/lib/auth/session';
import {
  apiRequest,
  authed,
  installFakeDb,
  PASSWORD_OK,
  SESSION_TOKEN,
  sessionRule,
  type FakeDb,
  type SqlRule,
} from '../helpers/auth';

vi.mock('@/lib/db', () => ({ executeQuery: vi.fn(), getPool: vi.fn() }));

const CPF = '52998224725';
const NEW_PASSWORD = 'nova-senha-segura-9';
let currentHash: string;

beforeAll(async () => {
  currentHash = await hashPassword(PASSWORD_OK);
});

let logSpies: Array<ReturnType<typeof vi.spyOn>>;
beforeEach(() => {
  vi.clearAllMocks();
  logSpies = (['error', 'log', 'warn', 'info'] as const).map((method) =>
    vi.spyOn(console, method).mockImplementation(() => {})
  );
});

const loggedText = () => JSON.stringify(logSpies.flatMap((spy) => spy.mock.calls));

const noAttempts: SqlRule = { match: /FROM auth_attempts/, result: [{ attempts: 0 }] };

describe('POST /api/usuarios/senha (troca da própria senha)', () => {
  const post = (body: unknown) => trocarSenha(authed('/api/usuarios/senha', 'POST', body));
  const passwordRow: SqlRule = {
    match: /^SELECT password FROM users/,
    result: () => [{ password: currentHash }],
  };
  let db: FakeDb;

  it('sem sessão: 401', async () => {
    installFakeDb();
    const res = await trocarSenha(
      apiRequest('/api/usuarios/senha', 'POST', {
        body: { currentPassword: PASSWORD_OK, newPassword: NEW_PASSWORD },
      })
    );
    expect(res.status).toBe(401);
  });

  it('sucesso: hash scrypt, first_login=0, sessões revogadas e sessão nova com token novo (CA-20)', async () => {
    db = installFakeDb([sessionRule({ id: 5 }), noAttempts, passwordRow]);
    const res = await post({ currentPassword: PASSWORD_OK, newPassword: NEW_PASSWORD });
    expect(res.status).toBe(200);

    const [update] = db.where(/^UPDATE users SET password = \?, first_login = 0/);
    expect(await verifyPassword(NEW_PASSWORD, String(update.params[0]))).toBe(true);
    expect(update.params[1]).toBe(5);
    expect(db.where(/UPDATE user_sessions SET revoked_at = NOW\(\) WHERE user_id/)).toHaveLength(1);

    const token = /^session=([^;]+)/.exec(res.headers.get('set-cookie') ?? '')![1];
    expect(token).not.toBe(SESSION_TOKEN);
    const [insert] = db.where(/INSERT INTO user_sessions/);
    expect(insert.params).toContain(hashSessionToken(token));
    expect(db.connection.commit).toHaveBeenCalled();
    expect(JSON.stringify(db.calls)).not.toContain(NEW_PASSWORD);
  });

  it('usuário com senha provisória pode trocar informando a provisória como senha atual', async () => {
    db = installFakeDb([sessionRule({ first_login: 1 }), noAttempts, passwordRow]);
    const res = await post({ currentPassword: PASSWORD_OK, newPassword: NEW_PASSWORD });
    expect(res.status).toBe(200);
  });

  it('senha atual errada: 403, conta como tentativa e nada é alterado (CA-20)', async () => {
    db = installFakeDb([sessionRule(), noAttempts, passwordRow]);
    const res = await post({ currentPassword: 'senha-errada-12', newPassword: NEW_PASSWORD });
    expect(res.status).toBe(403);
    expect(db.where(/INSERT INTO auth_attempts/)).toHaveLength(1);
    expect(db.where(/^UPDATE users/)).toHaveLength(0);
    expect(res.headers.get('set-cookie')).toBeNull();
  });

  it('nova senha fora da política: 400; igual à atual: 400 (CA-19, CA-20)', async () => {
    db = installFakeDb([sessionRule(), noAttempts, passwordRow]);
    for (const newPassword of ['curta', '52998224725', '12345678', PASSWORD_OK]) {
      expect((await post({ currentPassword: PASSWORD_OK, newPassword })).status).toBe(400);
    }
    expect(db.where(/^UPDATE users/)).toHaveLength(0);
  });

  it('userId no corpo ou na query é ignorado: altera sempre a conta da sessão (CA-21)', async () => {
    db = installFakeDb([sessionRule({ id: 5 }), noAttempts, passwordRow]);
    const res = await trocarSenha(
      authed('/api/usuarios/senha?userId=99', 'POST', {
        userId: 99,
        currentPassword: PASSWORD_OK,
        newPassword: NEW_PASSWORD,
      })
    );
    expect(res.status).toBe(200);
    expect(db.where(/^UPDATE users SET password/)[0].params[1]).toBe(5);
    expect(db.calls.some((call) => call.params.includes(99))).toBe(false);
  });

  it('limite de tentativas com a senha atual errada: 429', async () => {
    db = installFakeDb([
      sessionRule(),
      { match: /FROM auth_attempts/, result: [{ attempts: 5, oldest_age: 5 }] },
      passwordRow,
    ]);
    const res = await post({ currentPassword: PASSWORD_OK, newPassword: NEW_PASSWORD });
    expect(res.status).toBe(429);
    expect(db.where(/^SELECT password/)).toHaveLength(0);
  });

  it('com senha provisória, as demais rotas ficam bloqueadas (CA-23)', async () => {
    installFakeDb([sessionRule({ first_login: 1, role: 'admin' })]);
    const res = await listarUsuarios(authed('/api/usuarios', 'GET'));
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe('PASSWORD_CHANGE_REQUIRED');
  });

  it('não loga senha (CA-49, CA-60)', async () => {
    installFakeDb([
      sessionRule(),
      noAttempts,
      {
        match: /^SELECT password FROM users/,
        result: () => {
          throw new Error('falha simulada');
        },
      },
    ]);
    expect((await post({ currentPassword: PASSWORD_OK, newPassword: NEW_PASSWORD })).status).toBe(
      500
    );
    expect(loggedText()).not.toContain(PASSWORD_OK);
    expect(loggedText()).not.toContain(NEW_PASSWORD);
  });
});

describe('POST /api/usuarios/senha/solicitar', () => {
  const post = (body: unknown, options: Parameters<typeof apiRequest>[2] = {}) =>
    solicitar(apiRequest('/api/usuarios/senha/solicitar', 'POST', { body, ...options }));
  const body = { cpf: '529.982.247-25', email: 'Maria@Exemplo.com' };

  it('CPF+e-mail que conferem e CPF inexistente: corpo e status idênticos, sem código nem id (CA-52)', async () => {
    const existing = installFakeDb([
      noAttempts,
      { match: /FROM users\s+WHERE cpf = \? AND email = \?/, result: [{ id: 20 }] },
    ]);
    const found = await post(body);
    expect(existing.where(/INSERT INTO password_reset_requests/)).toHaveLength(1);

    installFakeDb([noAttempts]);
    const missing = await post(body);

    expect(found.status).toBe(200);
    expect(missing.status).toBe(200);
    const [foundBody, missingBody] = [await found.json(), await missing.json()];
    expect(foundBody).toEqual(missingBody);
    expect(Object.keys(foundBody)).toEqual(['message']);
  });

  it('só considera contas aprovadas e ativas; e-mail em minúsculas (CA-53, CA-59)', async () => {
    const db = installFakeDb([noAttempts]);
    await post(body);
    const [lookup] = db.where(/FROM users/);
    expect(lookup.sql).toContain("status = 'approved' AND active = 1");
    expect(lookup.params).toEqual([CPF, 'maria@exemplo.com']);
    expect(db.where(/INSERT INTO password_reset_requests/)).toHaveLength(0);
  });

  it('já existe pedido aberto: ignora o novo com a mesma resposta (CA-53)', async () => {
    installFakeDb([
      noAttempts,
      { match: /FROM users\s+WHERE cpf/, result: [{ id: 20 }] },
      {
        match: /INSERT INTO password_reset_requests/,
        result: () => {
          throw Object.assign(new Error('dup'), { code: 'ER_DUP_ENTRY' });
        },
      },
    ]);
    const res = await post(body);
    expect(res.status).toBe(200);
  });

  it('código vencido libera a vaga antes de criar o novo pedido', async () => {
    const db = installFakeDb([
      noAttempts,
      { match: /FROM users\s+WHERE cpf/, result: [{ id: 20 }] },
    ]);
    await post(body);
    const [expire] = db.where(/SET status = 'expired'/);
    expect(expire.sql).toContain("status = 'issued' AND expires_at <= NOW()");
  });

  it('limites por CPF e por IP: 429 (CA-54)', async () => {
    const db = installFakeDb([
      { match: /FROM auth_attempts/, result: [{ attempts: 10, oldest_age: 5 }] },
    ]);
    const res = await post(body);
    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).not.toBeNull();
    expect(db.where(/INSERT INTO password_reset_requests/)).toHaveLength(0);
  });

  it('valida entrada e origem', async () => {
    installFakeDb([noAttempts]);
    expect((await post({ cpf: '123', email: 'a@b.com' })).status).toBe(400);
    expect((await post({ cpf: CPF })).status).toBe(400);
    expect((await post(body, { origin: 'https://evil.example' })).status).toBe(403);
  });
});

describe('POST /api/usuarios/senha/redefinir', () => {
  const REQUEST_ID = 5;
  const CODE = 'ABCDE-FGHJK';
  const post = (body: unknown, options: Parameters<typeof apiRequest>[2] = {}) =>
    redefinir(apiRequest('/api/usuarios/senha/redefinir', 'POST', { body, ...options }));
  const valid = { cpf: '529.982.247-25', code: CODE, newPassword: NEW_PASSWORD };

  const issued = (overrides: Record<string, unknown> = {}): SqlRule => ({
    match: /FROM password_reset_requests r JOIN users u/,
    result: [
      {
        id: REQUEST_ID,
        user_id: 20,
        code_hash: hashResetCode(REQUEST_ID, 'ABCDEFGHJK'),
        ...overrides,
      },
    ],
  });
  let db: FakeDb;

  it('sucesso: hash scrypt, first_login=0, todas as sessões revogadas, código consumido (CA-56)', async () => {
    db = installFakeDb([noAttempts, issued()]);
    const res = await post(valid);
    expect(res.status).toBe(200);
    expect(Object.keys(await res.json())).toEqual(['message']);

    const [used] = db.where(/SET status = 'used'/);
    expect(used.sql).toContain("status = 'issued' AND expires_at > NOW()");
    const [update] = db.where(/^UPDATE users SET password = \?, first_login = 0/);
    expect(await verifyPassword(NEW_PASSWORD, String(update.params[0]))).toBe(true);
    expect(update.params[1]).toBe(20);
    expect(db.where(/UPDATE user_sessions SET revoked_at = NOW\(\) WHERE user_id/)).toHaveLength(1);
    expect(db.connection.commit).toHaveBeenCalled();
    expect(JSON.stringify(db.calls)).not.toContain(NEW_PASSWORD);
    expect(JSON.stringify(db.calls)).not.toContain('ABCDEFGHJK');
  });

  it('aceita o código sem hífen e em minúsculas', async () => {
    installFakeDb([noAttempts, issued()]);
    expect((await post({ ...valid, code: 'abcdefghjk' })).status).toBe(200);
  });

  it('segunda tentativa com o mesmo código falha: o pedido deixou de estar emitido (CA-56)', async () => {
    db = installFakeDb([
      noAttempts,
      issued(),
      { match: /SET status = 'used'/, result: { affectedRows: 0 } },
    ]);
    const res = await post(valid);
    expect(res.status).toBe(400);
    expect(db.where(/^UPDATE users/)).toHaveLength(0);

    installFakeDb([noAttempts]);
    expect((await post(valid)).status).toBe(400);
  });

  it('código errado, expirado, usado ou CPF inexistente: mesma resposta genérica (CA-57)', async () => {
    installFakeDb([noAttempts, issued()]);
    const errado = await post({ ...valid, code: 'ZZZZZ-ZZZZZ' });
    installFakeDb([noAttempts]);
    const inexistente = await post(valid);
    installFakeDb([noAttempts, issued()]);
    const malformado = await post({ ...valid, code: 'x' });

    for (const res of [errado, inexistente, malformado]) expect(res.status).toBe(400);
    const bodies = await Promise.all([errado.json(), inexistente.json(), malformado.json()]);
    expect(bodies[0]).toEqual(bodies[1]);
    expect(bodies[0]).toEqual(bodies[2]);
  });

  it('a busca só traz pedido emitido, dentro de 15 min e com menos de 5 erros (CA-57)', async () => {
    db = installFakeDb([noAttempts, issued()]);
    await post(valid);
    const [lookup] = db.where(/FROM password_reset_requests r JOIN users u/);
    expect(lookup.sql).toContain(
      "r.status = 'issued' AND r.expires_at > NOW() AND r.failed_attempts < ?"
    );
    expect(lookup.sql).toContain("u.status = 'approved' AND u.active = 1");
    expect(lookup.params).toEqual([CPF, 5]);
  });

  it('cada erro soma uma tentativa; na 5ª o código é invalidado (CA-57)', async () => {
    db = installFakeDb([noAttempts, issued({ failed_attempts: 4 })]);
    await post({ ...valid, code: 'ZZZZZ-ZZZZZ' });
    const [fail] = db.where(/SET status = IF\(failed_attempts \+ 1 >= \?/);
    expect(fail.sql).toContain("'expired'");
    expect(fail.sql.indexOf('failed_attempts = failed_attempts + 1')).toBeGreaterThan(
      fail.sql.indexOf('closed_at = IF')
    );
    expect(fail.params).toEqual([5, 5, REQUEST_ID]);
    expect(db.where(/^UPDATE users/)).toHaveLength(0);
    expect(db.where(/INSERT INTO auth_attempts/)).toHaveLength(2);
  });

  it('senha fora da política: 400 sem consumir o código (CA-58)', async () => {
    db = installFakeDb([noAttempts, issued()]);
    for (const newPassword of ['curta', '52998224725', '12345678']) {
      expect((await post({ ...valid, newPassword })).status).toBe(400);
    }
    expect(db.calls).toHaveLength(0);
  });

  it('CPF e e-mail corretos, sem código válido, nunca alteram a senha (CA-59, ataque P9)', async () => {
    db = installFakeDb([noAttempts, issued()]);
    for (const attempt of [
      { cpf: CPF, email: 'maria@exemplo.com', newPassword: NEW_PASSWORD },
      { cpf: CPF, userId: 20, newPassword: NEW_PASSWORD },
      { cpf: CPF, code: '', newPassword: NEW_PASSWORD },
    ]) {
      expect((await post(attempt)).status).toBe(400);
    }
    expect(db.where(/^UPDATE users/)).toHaveLength(0);
  });

  it('userId do corpo é ignorado: a conta vem do pedido localizado pelo CPF (CA-59)', async () => {
    db = installFakeDb([noAttempts, issued()]);
    await post({ ...valid, userId: 99, id: 99 });
    expect(db.where(/^UPDATE users SET password/)[0].params[1]).toBe(20);
  });

  it('limites por CPF/IP: 429 (CA-57)', async () => {
    db = installFakeDb([
      { match: /FROM auth_attempts/, result: [{ attempts: 99, oldest_age: 1 }] },
    ]);
    const res = await post(valid);
    expect(res.status).toBe(429);
    expect(db.where(/FROM password_reset_requests/)).toHaveLength(0);
  });

  it('rejeita origem externa (CSRF)', async () => {
    installFakeDb([noAttempts]);
    expect((await post(valid, { origin: 'https://evil.example' })).status).toBe(403);
  });

  it('código e senha nova não aparecem em nenhum console.* (CA-60)', async () => {
    installFakeDb([
      noAttempts,
      issued(),
      {
        match: /SET status = 'used'/,
        result: () => {
          throw new Error('falha simulada');
        },
      },
    ]);
    expect((await post(valid)).status).toBe(500);
    const logged = loggedText();
    expect(logged).not.toContain(NEW_PASSWORD);
    expect(logged).not.toContain('ABCDE');
    expect(logged).not.toContain('FGHJK');
  });
});
