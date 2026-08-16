import { describe, expect, it } from 'vitest';
import { entradasDoPasso, entradasNaoConfirmadas, SELETORES, VERSAO_MAPA, type NomePasso } from './seletores.ts';

const PASSOS: NomePasso[] = ['passo1', 'passo2', 'passo3', 'passo4'];

describe('mapa de seletores', () => {
  it('tem versão datada (para o doctor reportar contra qual mapa rodou)', () => {
    expect(VERSAO_MAPA).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('todas as entradas têm seletor por id e descrição', () => {
    for (const passo of PASSOS) {
      for (const { nome, entrada } of entradasDoPasso(passo)) {
        expect(entrada.seletor, `${passo}.${nome}`).toMatch(/^#\w/);
        expect(entrada.descricao.length, `${passo}.${nome}`).toBeGreaterThan(0);
      }
    }
  });

  it('não repete seletor entre entradas (uma quebra = um lugar para corrigir)', () => {
    const vistos = new Map<string, string>();
    for (const passo of PASSOS) {
      for (const { nome, entrada } of entradasDoPasso(passo)) {
        expect(vistos.get(entrada.seletor), `${entrada.seletor} repetido em ${vistos.get(entrada.seletor)} e ${passo}.${nome}`).toBeUndefined();
        vistos.set(entrada.seletor, `${passo}.${nome}`);
      }
    }
  });

  it('botões de navegação/emissão têm texto para o fallback de clique por JS', () => {
    expect(SELETORES.passo1.avancar?.texto).toBe('Avançar');
    expect(SELETORES.passo2.avancar?.texto).toBe('Avançar');
    expect(SELETORES.passo3.avancar?.texto).toBe('Avançar');
    expect(SELETORES.passo4.emitir?.texto).toBe('Emitir NFS-e');
  });

  it('o bloco IBS/CBS inteiro segue marcado como não confirmado em produção (risco #4 do PLANO)', () => {
    const naoConfirmados = entradasNaoConfirmadas().map((e) => `${e.passo}.${e.nome}`);
    for (const nome of Object.keys(SELETORES.passo2).filter((n) => n.startsWith('ibsCbs'))) {
      expect(naoConfirmados).toContain(`passo2.${nome}`);
    }
  });

  it('só a data de competência está confirmada até agora (verificada pelo spike da Fase 1)', () => {
    const confirmados = PASSOS.flatMap((passo) =>
      entradasDoPasso(passo)
        .filter(({ entrada }) => entrada.confirmado)
        .map(({ nome }) => `${passo}.${nome}`)
    );
    expect(confirmados).toEqual(['passo1.dataCompetencia']);
  });
});
