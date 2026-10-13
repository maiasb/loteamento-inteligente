import { describe, expect, it } from 'vitest';
import {
  generateResetCode,
  hashResetCode,
  normalizeResetCode,
  resetCodeMatches,
} from '@/lib/auth/reset-code';

describe('código de redefinição', () => {
  it('tem formato XXXXX-XXXXX com 50 bits (10 símbolos de um alfabeto de 32)', () => {
    const codes = new Set(Array.from({ length: 200 }, () => generateResetCode()));
    expect(codes.size).toBe(200);
    for (const code of codes) {
      expect(code).toMatch(/^[2-9A-HJ-NP-Z]{5}-[2-9A-HJ-NP-Z]{5}$/);
      expect(normalizeResetCode(code)).toHaveLength(10);
    }
  });

  it('normaliza maiúsculas e separadores; recusa tamanho errado', () => {
    expect(normalizeResetCode('abcde-fghjk')).toBe('ABCDEFGHJK');
    expect(normalizeResetCode(' ABCDE FGHJK ')).toBe('ABCDEFGHJK');
    expect(normalizeResetCode('ABCDE')).toBeNull();
    expect(normalizeResetCode(12345)).toBeNull();
  });

  it('o hash é amarrado ao pedido e compara em tempo constante', () => {
    const hash = hashResetCode(7, 'ABCDEFGHJK');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toBe(hashResetCode(8, 'ABCDEFGHJK'));
    expect(resetCodeMatches(hash, hashResetCode(7, 'ABCDEFGHJK'))).toBe(true);
    expect(resetCodeMatches(hash, hashResetCode(7, 'ABCDEFGHJL'))).toBe(false);
    expect(resetCodeMatches(hash, 'curto')).toBe(false);
  });
});
