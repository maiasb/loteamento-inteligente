import type { NextResponse } from 'next/server';
import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { getPool } from '@/lib/db';
import { UserRole } from '@/types/UserRole';
import { errorResponse } from './request';
import { canManageAccount, countOtherActiveDevs } from './roles';
import type { SessionUser } from './session';

export type TargetAccount = {
  id: number;
  name: string;
  role: UserRole;
  status: string;
  active: boolean;
};

/** Converte id vindo do corpo/URL (número ou texto) em inteiro positivo, ou null. */
export function parseUserId(value: unknown): number | null {
  const id = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
  return typeof id === 'number' && Number.isSafeInteger(id) && id > 0 ? id : null;
}

/** Executa `work` numa transação; desfaz se lançar erro. */
export async function withTransaction<T>(
  work: (connection: PoolConnection) => Promise<T>
): Promise<T> {
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Trava a conta-alvo (FOR UPDATE) e confere a hierarquia (RN-14): 404 se não existe, 403 se o
 * ator não pode gerenciá-la (admin sobre dev, ou qualquer um sobre si mesmo, salvo allowSelf).
 */
export async function lockManageableTarget(
  connection: PoolConnection,
  actor: SessionUser,
  targetId: number,
  options: { allowSelf?: boolean } = {}
): Promise<{ target: TargetAccount } | { response: NextResponse }> {
  const [rows] = await connection.execute<RowDataPacket[]>(
    'SELECT id, name, role, status, active FROM users WHERE id = ? FOR UPDATE',
    [targetId]
  );
  const row = rows[0];
  if (!row) return { response: errorResponse('Usuário não encontrado', 404) };

  const target: TargetAccount = {
    id: Number(row.id),
    name: row.name,
    role: row.role as UserRole,
    status: row.status,
    active: Boolean(row.active),
  };

  if (!canManageAccount(actor, target, options)) {
    const message =
      actor.id === target.id
        ? 'Você não pode alterar a sua própria conta por aqui.'
        : 'Você não tem permissão para alterar esta conta.';
    return { response: errorResponse(message, 403) };
  }
  return { target };
}

/** 409 se a ação deixaria o sistema sem nenhum dev aprovado e ativo (o último dev é protegido). */
export async function guardLastActiveDev(
  connection: PoolConnection,
  target: TargetAccount
): Promise<NextResponse | null> {
  const isActiveDev = target.role === UserRole.DEV && target.status === 'approved' && target.active;
  if (!isActiveDev) return null;
  if ((await countOtherActiveDevs(connection, target.id)) > 0) return null;
  return errorResponse('Não é possível remover o último desenvolvedor ativo do sistema.', 409);
}
