import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { UserRole } from '@/types/UserRole';

/** admin e dev. */
export const ADMIN_ROLES: readonly UserRole[] = [UserRole.ADMIN, UserRole.DEV];
/** Somente dev. */
export const DEV_ONLY: readonly UserRole[] = [UserRole.DEV];

export function isUserRole(value: unknown): value is UserRole {
  return value === UserRole.DEV || value === UserRole.ADMIN || value === UserRole.VENDEDOR;
}

type Account = {
  id: number;
  role: UserRole;
};

/**
 * Hierarquia de contas (RN-14). Só admin/dev gerenciam contas; admin não mexe em contas dev.
 * `allowSelf` vale apenas para a edição de dados cadastrais: ninguém altera o próprio papel,
 * situação, ativação, senha por reset, nem exclui a si mesmo.
 */
export function canManageAccount(
  actor: Account,
  target: Account,
  { allowSelf = false }: { allowSelf?: boolean } = {}
): boolean {
  if (!ADMIN_ROLES.includes(actor.role)) return false;
  if (actor.id === target.id) return allowSelf;
  if (target.role === UserRole.DEV) return actor.role === UserRole.DEV;
  return true;
}

/** Papéis que o ator pode atribuir: admin só vendedor/admin; dev qualquer um. */
export function canAssignRole(actorRole: UserRole, newRole: UserRole): boolean {
  if (actorRole === UserRole.DEV) return true;
  if (actorRole === UserRole.ADMIN) return newRole !== UserRole.DEV;
  return false;
}

/**
 * Quantos outros devs aprovados e ativos existem além de `userId`. Deve ser chamado dentro de
 * uma transação: as linhas ficam travadas (FOR UPDATE) até o commit, o que impede dois pedidos
 * simultâneos de remover os dois últimos devs.
 */
export async function countOtherActiveDevs(
  connection: Pick<PoolConnection, 'execute'>,
  userId: number
): Promise<number> {
  const [rows] = await connection.execute<RowDataPacket[]>(
    `SELECT id FROM users
      WHERE role = 'dev' AND status = 'approved' AND active = 1 AND id <> ?
      FOR UPDATE`,
    [userId]
  );
  return rows.length;
}
