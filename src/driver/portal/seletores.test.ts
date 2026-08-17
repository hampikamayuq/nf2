import { describe, expect, it } from 'vitest';
import { entradasDoPasso, entradasNaoConfirmadas, SELETORES, VERSAO_MAPA, type NomePasso } from './seletores.ts';

const PASSOS: NomePasso[] = ['passo1', 'passo2', 'passo3', 'passo4'];

describe('mapa de seletores', () => {
  it('tem versão datada (para o doctor reportar contra qual mapa rodou)', () => {
    expect(VERSAO_MAPA).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('todas as entradas têm seletor por id ou por name+value (radios com id duplicado no portal) e descrição', () => {
    for (const passo of PASSOS) {
      for (const { nome, entrada } of entradasDoPasso(passo)) {
        expect(entrada.seletor, `${passo}.${nome}`).toMatch(/^(#\w|input\[name=|button\[type=)/);
        expect(entrada.descricao.length, `${passo}.${nome}`).toBeGreaterThan(0);
      }
    }
  });

  it('não repete seletor entre entradas diferentes (o Avançar é o MESMO #btnAvancar em todos os passos)', () => {
    const vistos = new Map<string, string>();
    for (const passo of PASSOS) {
      for (const { nome, entrada } of entradasDoPasso(passo)) {
        const anterior = vistos.get(entrada.seletor);
        if (anterior) {
          const nomeAnterior = anterior.split('.')[1];
          expect(nomeAnterior, `${entrada.seletor} repetido em ${anterior} e ${passo}.${nome}`).toBe(nome);
        }
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

  it('CST e classificação do IBS/CBS moram no mapa do Passo 3 e seguem não confirmados (risco #4 do PLANO)', () => {
    const naoConfirmados = entradasNaoConfirmadas().map((e) => `${e.passo}.${e.nome}`);
    expect(Object.keys(SELETORES.passo3)).toContain('ibsCbsSituacaoTributaria');
    expect(naoConfirmados).toContain('passo3.ibsCbsSituacaoTributaria');
    expect(naoConfirmados).toContain('passo3.ibsCbsClassificacaoTributaria');
  });

  it('Passos 1 e 2 inteiros confirmados pelos inventários reais de 16–17/08/2026', () => {
    for (const passo of ['passo1', 'passo2'] as const) {
      for (const { nome, entrada } of entradasDoPasso(passo)) {
        expect(entrada.confirmado, `${passo}.${nome}`).toBe(true);
      }
    }
  });

  it('passos 3–4 seguem aguardando inventário (nenhuma entrada confirmada ainda)', () => {
    for (const passo of ['passo3', 'passo4'] as const) {
      for (const { nome, entrada } of entradasDoPasso(passo)) {
        expect(entrada.confirmado, `${passo}.${nome}`).toBe(false);
      }
    }
  });
});
