import type { NextResponse } from 'next/server';
import type { RowDataPacket } from 'mysql2/promise';
import { executeQuery } from '@/lib/db';
import { errorResponse, sha256Hex } from './request';

export type RateLimitRule = {
  kind: string;
  max: number;
  windowSeconds: number;
};

const FIFTEEN_MINUTES = 15 * 60;
const ONE_HOUR = 60 * 60;

// Contadores no banco (a Vercel é serverless: memória do processo não serve). Cada tentativa
// que conta é uma linha em auth_attempts; a janela é deslizante.
export const RATE_LIMITS = {
  loginCpf: { kind: 'login_cpf', max: 5, windowSeconds: FIFTEEN_MINUTES },
  loginIp: { kind: 'login_ip', max: 20, windowSeconds: FIFTEEN_MINUTES },
  registerIp: { kind: 'register_ip', max: 5, windowSeconds: ONE_HOUR },
  passwordChange: { kind: 'password_change', max: 5, windowSeconds: FIFTEEN_MINUTES },
  resetRequestCpf: { kind: 'reset_req_cpf', max: 3, windowSeconds: ONE_HOUR },
  resetRequestIp: { kind: 'reset_req_ip', max: 10, windowSeconds: ONE_HOUR },
  resetCodeCpf: { kind: 'reset_code_cpf', max: 10, windowSeconds: FIFTEEN_MINUTES },
  resetCodeIp: { kind: 'reset_code_ip', max: 20, windowSeconds: FIFTEEN_MINUTES },
} satisfies Record<string, RateLimitRule>;

export type RateLimitStatus = {
  allowed: boolean;
  /** Segundos até a tentativa mais antiga sair da janela (0 se permitido). */
  retryAfter: number;
};

function subjectHash(rule: RateLimitRule, subject: string): string {
  return sha256Hex(`${rule.kind}:${subject}`);
}

export async function checkRateLimit(
  rule: RateLimitRule,
  subject: string
): Promise<RateLimitStatus> {
  const rows = await executeQuery<RowDataPacket[]>(
    `SELECT COUNT(*) AS attempts, TIMESTAMPDIFF(SECOND, MIN(created_at), NOW()) AS oldest_age
       FROM auth_attempts
      WHERE kind = ? AND subject_hash = ?
        AND created_at > DATE_SUB(NOW(), INTERVAL ? SECOND)`,
    [rule.kind, subjectHash(rule, subject), rule.windowSeconds]
  );
  const attempts = Number(rows[0]?.attempts ?? 0);
  if (attempts < rule.max) return { allowed: true, retryAfter: 0 };
  const age = Number(rows[0]?.oldest_age ?? 0);
  return { allowed: false, retryAfter: Math.max(1, rule.windowSeconds - age) };
}

export async function recordAttempt(rule: RateLimitRule, subject: string): Promise<void> {
  await executeQuery('INSERT INTO auth_attempts (kind, subject_hash) VALUES (?, ?)', [
    rule.kind,
    subjectHash(rule, subject),
  ]);
}

export async function clearAttempts(rule: RateLimitRule, subject: string): Promise<void> {
  await executeQuery('DELETE FROM auth_attempts WHERE kind = ? AND subject_hash = ?', [
    rule.kind,
    subjectHash(rule, subject),
  ]);
}

/** Confere várias regras de uma vez; devolve a pior espera (ou allowed=true). */
export async function checkRateLimits(
  checks: Array<[RateLimitRule, string]>
): Promise<RateLimitStatus> {
  let retryAfter = 0;
  for (const [rule, subject] of checks) {
    const status = await checkRateLimit(rule, subject);
    if (!status.allowed) retryAfter = Math.max(retryAfter, status.retryAfter);
  }
  return { allowed: retryAfter === 0, retryAfter };
}

export function rateLimitedResponse(
  retryAfter: number,
  message = 'Muitas tentativas. Tente novamente em alguns minutos.'
): NextResponse {
  return errorResponse(message, 429, { retryAfter }, { 'Retry-After': String(retryAfter) });
}
