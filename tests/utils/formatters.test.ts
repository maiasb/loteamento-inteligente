import { describe, expect, it } from 'vitest';
import {
  formatCPF,
  formatCurrency,
  formatPhone,
  parseCurrency,
  validateCPF,
} from '@/utils/formatters';

describe('formatCPF', () => {
  it('aplica a máscara progressivamente', () => {
    expect(formatCPF('529')).toBe('529');
    expect(formatCPF('529982')).toBe('529.982');
    expect(formatCPF('529982247')).toBe('529.982.247');
    expect(formatCPF('52998224725')).toBe('529.982.247-25');
  });

  it('ignora caracteres não numéricos e excesso de dígitos', () => {
    expect(formatCPF('529.982.247-25999')).toBe('529.982.247-25');
  });
});

describe('validateCPF', () => {
  it('aceita CPF válido, com ou sem máscara', () => {
    expect(validateCPF('52998224725')).toBe(true);
    expect(validateCPF('529.982.247-25')).toBe(true);
  });

  it('recusa dígito verificador errado, tamanho errado e sequências repetidas', () => {
    expect(validateCPF('52998224726')).toBe(false);
    expect(validateCPF('123')).toBe(false);
    expect(validateCPF('11111111111')).toBe(false);
  });

  it('aceita o CPF de desenvolvimento (pendência de segurança registrada)', () => {
    expect(validateCPF('99999999998')).toBe(true);
  });
});

describe('moeda', () => {
  it('formata em BRL e converte de volta', () => {
    expect(formatCurrency(1234.5)).toBe('1.234,50');
    expect(parseCurrency('1.234,50')).toBe(1234.5);
  });

  it('formatCurrency devolve vazio para valor inválido e parseCurrency devolve 0', () => {
    expect(formatCurrency('abc')).toBe('');
    expect(parseCurrency('abc')).toBe(0);
  });
});

describe('formatPhone', () => {
  it('formata fixo e celular', () => {
    expect(formatPhone('1133334444')).toBe('(11) 3333-4444');
    expect(formatPhone('11999998888')).toBe('(11) 99999-8888');
  });
});
