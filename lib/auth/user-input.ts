import { validateCPF } from '@/utils/formatters';

export interface UserFields {
  name: string;
  email: string;
  cpf: string;
  phone: string;
  creci: string | null;
}

type ParseResult<T> = { ok: true; data: T } | { ok: false; error: string };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Valida os dados cadastrais vindos do corpo. Com `partial`, só valida os campos presentes
 * (edição); sem ele, nome, e-mail, CPF e telefone são obrigatórios.
 */
export function parseUserFields(body: Record<string, unknown>): ParseResult<UserFields>;
export function parseUserFields(
  body: Record<string, unknown>,
  partial: true
): ParseResult<Partial<UserFields>>;
export function parseUserFields(
  body: Record<string, unknown>,
  partial = false
): ParseResult<Partial<UserFields>> {
  const data: Partial<UserFields> = {};

  if (body.name !== undefined || !partial) {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (name.length < 2 || name.length > 100) return { ok: false, error: 'Nome inválido.' };
    data.name = name;
  }

  if (body.email !== undefined || !partial) {
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (email.length > 100 || !EMAIL_PATTERN.test(email)) {
      return { ok: false, error: 'E-mail inválido.' };
    }
    data.email = email;
  }

  if (body.cpf !== undefined || !partial) {
    const cpf = typeof body.cpf === 'string' ? body.cpf.replace(/\D/g, '') : '';
    if (!validateCPF(cpf)) return { ok: false, error: 'CPF inválido.' };
    data.cpf = cpf;
  }

  if (body.phone !== undefined || !partial) {
    const phone = typeof body.phone === 'string' ? body.phone.replace(/\D/g, '') : '';
    if (phone.length < 10 || phone.length > 11) return { ok: false, error: 'Telefone inválido.' };
    data.phone = phone;
  }

  if (body.creci !== undefined) {
    if (body.creci !== null && typeof body.creci !== 'string') {
      return { ok: false, error: 'CRECI inválido.' };
    }
    const creci = typeof body.creci === 'string' ? body.creci.trim() : '';
    if (creci.length > 50) return { ok: false, error: 'CRECI inválido.' };
    data.creci = creci || null;
  }

  if (!partial) data.creci ??= null;
  return { ok: true, data };
}
