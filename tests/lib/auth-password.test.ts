import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import {
  DUMMY_PASSWORD_HASH,
  generateTemporaryPassword,
  hashPassword,
  validatePasswordPolicy,
  verifyPassword,
} from '@/lib/auth/password';

describe('hash de senha (scrypt)', () => {
  it('gera hashes diferentes para a mesma senha, com formato versionado (CA-15)', async () => {
    const [a, b] = await Promise.all([
      hashPassword('mesma-senha-1'),
      hashPassword('mesma-senha-1'),
    ]);
    expect(a).not.toBe(b);
    for (const hash of [a, b]) {
      expect(hash.startsWith('scrypt$v1$N=65536,r=8,p=1$')).toBe(true);
      expect(hash.split('$')).toHaveLength(5);
    }
  }, 30_000);

  it('confere a senha certa e recusa a errada', async () => {
    const hash = await hashPassword('Correta-123');
    expect(await verifyPassword('Correta-123', hash)).toBe(true);
    expect(await verifyPassword('correta-123', hash)).toBe(false);
    expect(await verifyPassword('', hash)).toBe(false);
  }, 30_000);

  it('não aceita formatos que não sejam scrypt (sem MD5 nem SHA-256)', async () => {
    const md5 = 'e10adc3949ba59abbe56e057f20f883e';
    const sha256 = '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92';
    expect(await verifyPassword('123456', md5)).toBe(false);
    expect(await verifyPassword('123456', sha256)).toBe(false);
    expect(
      await verifyPassword('x', 'scrypt$v1$N=3,r=8,p=2$AAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAA')
    ).toBe(false);
    expect(await verifyPassword('x', '')).toBe(false);
  });

  it('o hash dummy tem formato válido e nunca confere', async () => {
    expect(await verifyPassword('qualquer-coisa', DUMMY_PASSWORD_HASH)).toBe(false);
  });

  it('nenhum código de app/api ou lib/auth usa MD5 ou SHA-256 para senha (CA-18)', () => {
    const root = path.resolve(__dirname, '../..');
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.name.endsWith('.ts')) files.push(full);
      }
    };
    walk(path.join(root, 'app/api'));
    walk(path.join(root, 'lib/auth'));
    const withHash = files
      .filter((file) => /createHash\(/.test(fs.readFileSync(file, 'utf8')))
      .map((file) => path.relative(root, file));
    // Único uso de createHash: SHA-256 de token de sessão/código/chave de limite (alta entropia).
    expect(withHash).toEqual(['lib/auth/request.ts']);
    for (const file of files) {
      expect(fs.readFileSync(file, 'utf8').toLowerCase()).not.toContain('md5');
    }
  });
});

describe('política de senha (CA-19)', () => {
  it('recusa senha curta, longa, igual ao CPF ou comum', () => {
    expect(validatePasswordPolicy('curta1')).not.toBeNull();
    expect(validatePasswordPolicy('x'.repeat(129))).not.toBeNull();
    expect(validatePasswordPolicy('529.982.247-25', '52998224725')).not.toBeNull();
    expect(validatePasswordPolicy('52998224725', '52998224725')).not.toBeNull();
    expect(validatePasswordPolicy('12345678')).not.toBeNull();
    expect(validatePasswordPolicy('Senha123')).not.toBeNull();
    expect(validatePasswordPolicy('aaaaaaaaaa')).not.toBeNull();
    expect(validatePasswordPolicy(undefined)).not.toBeNull();
  });

  it('aceita senha boa sem exigir composição', () => {
    expect(validatePasswordPolicy('uma frase longa de senha')).toBeNull();
    expect(validatePasswordPolicy('abcdefgh', '52998224725')).toBeNull();
  });
});

describe('senha temporária (CA-22)', () => {
  it('tem ao menos 12 caracteres, é aleatória e nunca 123456', () => {
    const senhas = new Set(Array.from({ length: 50 }, () => generateTemporaryPassword()));
    expect(senhas.size).toBe(50);
    for (const senha of senhas) {
      expect(senha.length).toBeGreaterThanOrEqual(12);
      expect(senha).not.toBe('123456');
      expect(validatePasswordPolicy(senha)).toBeNull();
    }
  });
});
