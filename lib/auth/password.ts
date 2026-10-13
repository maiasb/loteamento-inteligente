import { randomBytes, randomInt, scrypt, timingSafeEqual, type ScryptOptions } from 'crypto';

// Formato: scrypt$v1$N=<N>,r=<r>,p=<p>$<sal base64url>$<hash base64url>
// Os parâmetros ficam no próprio valor para poder aumentar o custo no futuro sem quebrar hashes antigos.
const FORMAT_PREFIX = 'scrypt';
const FORMAT_VERSION = 'v1';
const PARAMS = { N: 2 ** 16, r: 8, p: 1 } as const;
const SALT_BYTES = 16;
const KEY_BYTES = 64;
const MAX_N = 2 ** 20;

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

const COMMON_PASSWORDS = new Set([
  '12345678',
  '123456789',
  '1234567890',
  '123123123',
  '11111111',
  '00000000',
  '87654321',
  'abc12345',
  'senha123',
  'senha1234',
  'password',
  'password1',
  'qwertyui',
  'qwerty123',
  'iloveyou',
  'admin123',
  'mudar123',
  'valedoscarajas',
]);

interface ScryptParams {
  N: number;
  r: number;
  p: number;
}

function scryptAsync(
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password.normalize('NFKC'), salt, keylen, options, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

function optionsFor({ N, r, p }: ScryptParams): ScryptOptions {
  return { N, r, p, maxmem: 128 * r * (N + p + 1) + 1024 * 1024 };
}

function parseHash(stored: string): { params: ScryptParams; salt: Buffer; key: Buffer } | null {
  const parts = stored.split('$');
  if (parts.length !== 5 || parts[0] !== FORMAT_PREFIX || parts[1] !== FORMAT_VERSION) return null;
  const match = /^N=(\d+),r=(\d+),p=(\d+)$/.exec(parts[2]);
  if (!match) return null;
  const params = { N: Number(match[1]), r: Number(match[2]), p: Number(match[3]) };
  const validN = Number.isInteger(Math.log2(params.N)) && params.N >= 2 ** 10 && params.N <= MAX_N;
  if (!validN || params.r < 1 || params.r > 16 || params.p < 1 || params.p > 4) return null;
  const salt = Buffer.from(parts[3], 'base64url');
  const key = Buffer.from(parts[4], 'base64url');
  if (salt.length < 8 || key.length < 16) return null;
  return { params, salt, key };
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const key = await scryptAsync(password, salt, KEY_BYTES, optionsFor(PARAMS));
  const params = `N=${PARAMS.N},r=${PARAMS.r},p=${PARAMS.p}`;
  return [
    FORMAT_PREFIX,
    FORMAT_VERSION,
    params,
    salt.toString('base64url'),
    key.toString('base64url'),
  ].join('$');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parsed = parseHash(stored);
  if (!parsed) return false;
  const key = await scryptAsync(
    password,
    parsed.salt,
    parsed.key.length,
    optionsFor(parsed.params)
  );
  return key.length === parsed.key.length && timingSafeEqual(key, parsed.key);
}

// Hash válido que nunca confere com nenhuma senha: usado quando o CPF não existe, para que a
// resposta leve o mesmo tempo que uma senha errada de uma conta real.
export const DUMMY_PASSWORD_HASH = [
  FORMAT_PREFIX,
  FORMAT_VERSION,
  `N=${PARAMS.N},r=${PARAMS.r},p=${PARAMS.p}`,
  Buffer.alloc(SALT_BYTES, 7).toString('base64url'),
  Buffer.alloc(KEY_BYTES, 9).toString('base64url'),
].join('$');

/** Política de senha (RN-19b). Devolve a mensagem de erro ou null se a senha é aceitável. */
export function validatePasswordPolicy(password: unknown, cpf?: string): string | null {
  if (typeof password !== 'string') return 'Senha inválida.';
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `A senha deve ter no mínimo ${PASSWORD_MIN_LENGTH} caracteres.`;
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return `A senha deve ter no máximo ${PASSWORD_MAX_LENGTH} caracteres.`;
  }
  const cpfDigits = cpf?.replace(/\D/g, '');
  if (cpfDigits && password.replace(/\D/g, '') === cpfDigits) {
    return 'A senha não pode ser igual ao CPF.';
  }
  if (COMMON_PASSWORDS.has(password.toLowerCase()) || /^(.)\1+$/.test(password)) {
    return 'Essa senha é muito comum. Escolha outra.';
  }
  return null;
}

// Sem caracteres ambíguos (0/O, 1/l/I), para ditar por telefone ou WhatsApp.
const TEMP_ALPHABET = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Senha temporária aleatória (CSPRNG), com 14 caracteres (~80 bits). */
export function generateTemporaryPassword(length = 14): string {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += TEMP_ALPHABET[randomInt(TEMP_ALPHABET.length)];
  }
  return result;
}
