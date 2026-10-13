import { randomInt, timingSafeEqual } from 'crypto';
import { sha256Hex } from './request';

export const RESET_CODE_TTL_MINUTES = 15;
export const RESET_CODE_MAX_ATTEMPTS = 5;

// 32 símbolos (5 bits cada) sem I e O, para ditar por telefone. 10 símbolos = 50 bits.
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const CODE_LENGTH = 10;

/** Código de uso único (CSPRNG, 50 bits), no formato XXXXX-XXXXX. */
export function generateResetCode(): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) code += ALPHABET[randomInt(ALPHABET.length)];
  return `${code.slice(0, 5)}-${code.slice(5)}`;
}

/** Remove separadores/espaços e padroniza maiúsculas; null se não tiver o tamanho certo. */
export function normalizeResetCode(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const normalized = input.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return normalized.length === CODE_LENGTH ? normalized : null;
}

/** O hash é amarrado ao id do pedido: o mesmo código não vale em outro pedido. */
export function hashResetCode(requestId: number | string, normalizedCode: string): string {
  return sha256Hex(`reset:${requestId}:${normalizedCode}`);
}

export function resetCodeMatches(storedHash: string, expectedHash: string): boolean {
  const a = Buffer.from(storedHash, 'hex');
  const b = Buffer.from(expectedHash, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}
