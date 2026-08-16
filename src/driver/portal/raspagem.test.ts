import { describe, expect, it } from 'vitest';
import { extrairCampoRotulado, extrairChaveAcesso, extrairNumeroNota, montarResumo } from './raspagem.ts';

const CHAVE = '12345678901234567890123456789012345678901234567890';

describe('extrairCampoRotulado', () => {
  it('acha "Rótulo: valor" na mesma linha', () => {
    expect(extrairCampoRotulado('Emitente: QARA LTDA\nValor: R$ 650,00', 'Valor')).toBe('R$ 650,00');
  });

  it('acha o valor na linha seguinte ao rótulo', () => {
    expect(extrairCampoRotulado('Data de Competência\n16/08/2026\nOutra coisa', 'Data de Competência')).toBe('16/08/2026');
  });

  it('ignora maiúsculas/minúsculas do rótulo e retorna undefined quando não há', () => {
    expect(extrairCampoRotulado('valor: 10', 'Valor')).toBe('10');
    expect(extrairCampoRotulado('nada aqui', 'Valor')).toBeUndefined();
  });
});

describe('montarResumo', () => {
  it('extrai os campos rotulados e preserva o texto integral', () => {
    const texto = [
      'Emitente: QARA SERVICOS MEDICOS LTDA',
      'Tomador: Não informado',
      'Data de Competência: 16/08/2026',
      'Valor: R$ 650,00',
    ].join('\n');
    const resumo = montarResumo(texto);
    expect(resumo.textoCompleto).toBe(texto);
    expect(resumo.emitente).toBe('QARA SERVICOS MEDICOS LTDA');
    expect(resumo.tomador).toBe('Não informado');
    expect(resumo.competencia).toBe('16/08/2026');
    expect(resumo.valor).toBe('R$ 650,00');
  });
});

describe('extrairChaveAcesso', () => {
  it('acha a chave de 50 dígitos corridos', () => {
    expect(extrairChaveAcesso(`Chave de Acesso: ${CHAVE}`)).toBe(CHAVE);
  });

  it('aceita a chave exibida em grupos separados por espaço ou ponto', () => {
    const grupos = CHAVE.match(/.{5}/g)!.join(' ');
    expect(extrairChaveAcesso(`Chave: ${grupos}\nNúmero da NFS-e: 42`)).toBe(CHAVE);
    expect(extrairChaveAcesso(`Chave: ${CHAVE.match(/.{10}/g)!.join('.')}`)).toBe(CHAVE);
  });

  it('retorna undefined quando não há 50 dígitos', () => {
    expect(extrairChaveAcesso('Número da NFS-e: 42')).toBeUndefined();
    expect(extrairChaveAcesso(CHAVE.slice(0, 49))).toBeUndefined();
  });
});

describe('extrairNumeroNota', () => {
  it('lê o número pelo rótulo, sem confundir com a chave', () => {
    expect(extrairNumeroNota(`Chave de Acesso: ${CHAVE}\nNúmero da NFS-e: 42`)).toBe('42');
  });

  it('aceita o rótulo curto "Número"', () => {
    expect(extrairNumeroNota('Número: 1.234')).toBe('1.234');
  });

  it('retorna undefined sem rótulo de número', () => {
    expect(extrairNumeroNota(`só a chave ${CHAVE}`)).toBeUndefined();
  });
});
