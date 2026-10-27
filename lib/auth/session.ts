import { randomBytes } from 'crypto';
import type { NextRequest, NextResponse } from 'next/server';
import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { executeQuery, type QueryParam } from '@/lib/db';
import { UserRole } from '@/types/UserRole';
import { UserStatus } from '@/types/UserStatus';
import { sha256Hex } from './request';

export const SESSION_IDLE_SECONDS = 8 * 60 * 60;
export const SESSION_ABSOLUTE_SECONDS = 7 * 24 * 60 * 60;
// Atualiza last_seen no máximo a cada 5 minutos (RN-06) para não gravar em toda requisição.
const LAST_SEEN_REFRESH_SECONDS = 5 * 60;

/** Usuário da sessão, sempre lido do banco a cada requisição (papel, status e ativo atuais). */
export type SessionUser = {
  id: number;
  name: string;
  email: string;
  cpf: string;
  phone: string | null;
  creci: string | null;
  role: UserRole;
  status: UserStatus;
  active: boolean;
  /** true = senha provisória: só `me`, `senha` e `logout` são permitidos. */
  firstLogin: boolean;
  themePreference: 'light' | 'dark';
};

export type ActiveSession = {
  sessionId: number;
  user: SessionUser;
};

/** Formato enviado ao navegador (sem senha, hash nem token). */
export function toPublicUser(user: SessionUser) {
  return {
    id: String(user.id),
    name: user.name,
    email: user.email,
    cpf: user.cpf,
    phone: user.phone ?? '',
    creci: user.creci ?? '',
    role: user.role,
    status: user.status,
    active: user.active,
    first_login: user.firstLogin,
    theme_preference: user.themePreference,
  };
}

type Queryable = Pick<PoolConnection, 'execute'>;

export async function runQuery<T>(
  db: Queryable | undefined,
  sql: string,
  params: QueryParam[] = []
) {
  if (!db) return executeQuery<T>(sql, params);
  const [rows] = await db.execute(sql, params);
  return rows as T;
}

// Em produção o cookie é HTTPS-only e usa o prefixo __Host- (Secure, Path=/, sem Domain).
// Em desenvolvimento (http://localhost) o prefixo exigiria Secure, então usa nome simples.
export function sessionCookieName(): string {
  return process.env.NODE_ENV === 'production' ? '__Host-session' : 'session';
}

const isProduction = () => process.env.NODE_ENV === 'production';

export function generateSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashSessionToken(token: string): string {
  return sha256Hex(token);
}

export function readSessionToken(request: NextRequest): string | null {
  const value = request.cookies.get(sessionCookieName())?.value;
  return value && value.length <= 128 ? value : null;
}

export function setSessionCookie(response: NextResponse, token: string): void {
  response.cookies.set(sessionCookieName(), token, {
    httpOnly: true,
    secure: isProduction(),
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_ABSOLUTE_SECONDS,
  });
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(sessionCookieName(), '', {
    httpOnly: true,
    secure: isProduction(),
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

export async function createSession(
  userId: number,
  meta: { ip: string | null; userAgent: string | null },
  db?: Queryable
): Promise<string> {
  const token = generateSessionToken();
  await runQuery(
    db,
    `INSERT INTO user_sessions
       (user_id, token_hash, idle_expires_at, absolute_expires_at, ip, user_agent)
     VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? SECOND), DATE_ADD(NOW(), INTERVAL ? SECOND), ?, ?)`,
    [
      userId,
      hashSessionToken(token),
      SESSION_IDLE_SECONDS,
      SESSION_ABSOLUTE_SECONDS,
      meta.ip,
      meta.userAgent,
    ]
  );
  return token;
}

export function rowToSessionUser(row: RowDataPacket): SessionUser {
  return {
    id: Number(row.id),
    name: row.name,
    email: row.email,
    cpf: row.cpf,
    phone: row.phone ?? null,
    creci: row.creci ?? null,
    role: row.role as UserRole,
    status: row.status as UserStatus,
    active: Boolean(row.active),
    firstLogin: Boolean(row.first_login),
    themePreference: row.theme_preference === 'dark' ? 'dark' : 'light',
  };
}

/** Sessão válida (não revogada, dentro dos dois prazos, usuário aprovado e ativo) ou null. */
export async function findActiveSession(token: string): Promise<ActiveSession | null> {
  const rows = await executeQuery<RowDataPacket[]>(
    `SELECT s.id AS session_id, TIMESTAMPDIFF(SECOND, s.last_seen_at, NOW()) AS since_seen,
            u.id, u.name, u.email, u.cpf, u.phone, u.creci, u.role, u.status, u.active,
            u.first_login, u.theme_preference
       FROM user_sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ?
        AND s.revoked_at IS NULL
        AND s.idle_expires_at > NOW()
        AND s.absolute_expires_at > NOW()
        AND u.status = 'approved'
        AND u.active = 1`,
    [hashSessionToken(token)]
  );
  const row = rows[0];
  if (!row) return null;

  if (Number(row.since_seen) >= LAST_SEEN_REFRESH_SECONDS) {
    await executeQuery(
      `UPDATE user_sessions
          SET last_seen_at = NOW(),
              idle_expires_at = LEAST(DATE_ADD(NOW(), INTERVAL ? SECOND), absolute_expires_at)
        WHERE id = ?`,
      [SESSION_IDLE_SECONDS, row.session_id]
    );
  }

  return { sessionId: Number(row.session_id), user: rowToSessionUser(row) };
}

export async function revokeSessionByToken(token: string): Promise<void> {
  await executeQuery(
    'UPDATE user_sessions SET revoked_at = NOW() WHERE token_hash = ? AND revoked_at IS NULL',
    [hashSessionToken(token)]
  );
}

/** Revoga todas as sessões do usuário (desativação, exclusão, reset, troca de senha). */
export async function revokeUserSessions(userId: number, db?: Queryable): Promise<number> {
  const result = await runQuery<ResultSetHeader>(
    db,
    'UPDATE user_sessions SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL',
    [userId]
  );
  return result.affectedRows;
}

/** Limpeza oportunista (RN-28): sessões 30 dias, tentativas 7 dias, pedidos de redefinição 7 dias. */
export async function cleanupAuthData(): Promise<void> {
  await executeQuery(
    `DELETE FROM user_sessions
      WHERE absolute_expires_at < DATE_SUB(NOW(), INTERVAL 30 DAY)
         OR idle_expires_at < DATE_SUB(NOW(), INTERVAL 30 DAY)
         OR revoked_at < DATE_SUB(NOW(), INTERVAL 30 DAY)`
  );
  await executeQuery(
    'DELETE FROM auth_attempts WHERE created_at < DATE_SUB(NOW(), INTERVAL 7 DAY)'
  );
  await executeQuery(
    `DELETE FROM password_reset_requests
      WHERE closed_at < DATE_SUB(NOW(), INTERVAL 7 DAY)
         OR (status = 'open' AND created_at < DATE_SUB(NOW(), INTERVAL 7 DAY))
         OR (status = 'issued' AND expires_at < DATE_SUB(NOW(), INTERVAL 7 DAY))`
  );
}
