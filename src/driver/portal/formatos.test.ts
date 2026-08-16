import { describe, expect, it } from 'vitest';
import { formatarValorBR, hojeBR, somenteDigitos } from './formatos.ts';

describe('hojeBR', () => {
  it('formata a data local como DD/MM/AAAA com zeros à esquerda', () => {
    expect(hojeBR(new Date(2026, 7, 16))).toBe('16/08/2026');
    expect(hojeBR(new Date(2026, 0, 5))).toBe('05/01/2026');
  });
});

describe('formatarValorBR', () => {
  it('formata centavos no padrão do portal (milhar com ponto, decimal com vírgula)', () => {
    expect(formatarValorBR(0)).toBe('0,00');
    expect(formatarValorBR(65000)).toBe('650,00');
    expect(formatarValorBR(123456)).toBe('1.234,56');
    expect(formatarValorBR(100000005)).toBe('1.000.000,05');
  });

  it('recusa valores que não são centavos inteiros não-negativos', () => {
    expect(() => formatarValorBR(-1)).toThrow(/inválido/);
    expect(() => formatarValorBR(10.5)).toThrow(/inválido/);
  });
});

describe('somenteDigitos', () => {
  it('remove máscara de CPF/CNPJ/CEP', () => {
    expect(somenteDigitos('44.697.695/0001-88')).toBe('44697695000188');
    expect(somenteDigitos('22041-012')).toBe('22041012');
  });
});
