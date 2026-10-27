import type { UserRole } from './UserRole';
import type { UserStatus } from './UserStatus';

export type User = {
  id: string;
  name: string;
  email: string;
  cpf: string;
  phone?: string;
  creci?: string;
  role: UserRole;
  status: UserStatus;
  active?: boolean;
  password?: string;
  theme_preference?: 'light' | 'dark';
  first_login?: boolean; // senha provisória: precisa trocar antes de usar o sistema
  createdAt: Date;
  updatedAt: Date;
};
