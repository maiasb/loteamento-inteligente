import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RATE_LIMITS, checkRateLimit, recordAttempt } from '@/lib/auth/rate-limit';
import { installFakeDb } from '../helpers/auth';

vi.mock('@/lib/db', () => ({ executeQuery: vi.fn(), getPool: vi.fn() }));

describe('limite de tentativas no banco', () => {
  beforeEach(() => vi.clearAllMocks());

  it('permite abaixo do máximo', async () => {
    installFakeDb([{ match: /FROM auth_attempts/, result: [{ attempts: 4, oldest_age: 100 }] }]);
    expect(await checkRateLimit(RATE_LIMITS.loginCpf, '52998224725')).toEqual({
      allowed: true,
      retryAfter: 0,
    });
  });

  it('bloqueia no máximo e calcula o Retry-After pela tentativa mais antiga (CA-11)', async () => {
    installFakeDb([{ match: /FROM auth_attempts/, result: [{ attempts: 5, oldest_age: 300 }] }]);
    expect(await checkRateLimit(RATE_LIMITS.loginCpf, '52998224725')).toEqual({
      allowed: false,
      retryAfter: 600,
    });
  });

  it('usa janela em segundos e guarda só o hash do CPF/IP (CA-12, CA-14)', async () => {
    const db = installFakeDb([{ match: /FROM auth_attempts/, result: [{ attempts: 0 }] }]);
    await checkRateLimit(RATE_LIMITS.loginIp, '203.0.113.9');
    await recordAttempt(RATE_LIMITS.loginIp, '203.0.113.9');
    const [select] = db.where(/FROM auth_attempts/);
    expect(select.sql).toContain('INTERVAL ? SECOND');
    expect(select.params[2]).toBe(15 * 60);
    for (const call of db.calls) {
      expect(JSON.stringify(call.params)).not.toContain('203.0.113.9');
    }
  });

  it('as janelas e máximos seguem a spec', () => {
    expect(RATE_LIMITS.loginCpf).toMatchObject({ max: 5, windowSeconds: 900 });
    expect(RATE_LIMITS.loginIp).toMatchObject({ max: 20, windowSeconds: 900 });
    expect(RATE_LIMITS.registerIp).toMatchObject({ max: 5, windowSeconds: 3600 });
    expect(RATE_LIMITS.resetRequestCpf).toMatchObject({ max: 3, windowSeconds: 3600 });
    expect(RATE_LIMITS.resetRequestIp).toMatchObject({ max: 10, windowSeconds: 3600 });
  });
});
