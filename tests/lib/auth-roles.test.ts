import { describe, expect, it } from 'vitest';
import { UserRole } from '@/types/UserRole';
import { canAssignRole, canManageAccount } from '@/lib/auth/roles';

const dev = { id: 1, role: UserRole.DEV };
const admin = { id: 2, role: UserRole.ADMIN };
const admin2 = { id: 3, role: UserRole.ADMIN };
const seller = { id: 4, role: UserRole.VENDEDOR };

describe('hierarquia de contas (RN-14)', () => {
  it('vendedor não gerencia ninguém', () => {
    expect(canManageAccount(seller, admin)).toBe(false);
  });

  it('admin gerencia vendedor e outro admin, mas não dev', () => {
    expect(canManageAccount(admin, seller)).toBe(true);
    expect(canManageAccount(admin, admin2)).toBe(true);
    expect(canManageAccount(admin, dev)).toBe(false);
  });

  it('dev gerencia qualquer outra conta', () => {
    expect(canManageAccount(dev, admin)).toBe(true);
    expect(canManageAccount(dev, { id: 9, role: UserRole.DEV })).toBe(true);
  });

  it('ninguém gerencia a si mesmo, salvo edição cadastral (allowSelf)', () => {
    expect(canManageAccount(dev, dev)).toBe(false);
    expect(canManageAccount(admin, admin)).toBe(false);
    expect(canManageAccount(admin, admin, { allowSelf: true })).toBe(true);
    expect(canManageAccount(seller, seller, { allowSelf: true })).toBe(false);
  });

  it('admin só atribui vendedor/admin; dev atribui qualquer papel', () => {
    expect(canAssignRole(UserRole.ADMIN, UserRole.DEV)).toBe(false);
    expect(canAssignRole(UserRole.ADMIN, UserRole.ADMIN)).toBe(true);
    expect(canAssignRole(UserRole.DEV, UserRole.DEV)).toBe(true);
    expect(canAssignRole(UserRole.VENDEDOR, UserRole.VENDEDOR)).toBe(false);
  });
});
