import type { Page } from 'playwright';
import { contarSeletor } from './pagina.ts';
import { entradasDoPasso, type EntradaSeletor, type NomePasso } from './seletores.ts';

export interface DiagnosticoSeletor {
  passo: NomePasso;
  nome: string;
  seletor: string;
  descricao: string;
  encontrado: boolean;
  confirmado: boolean;
  opcional: boolean;
}

/**
 * Verifica, na página atual, quais seletores de um passo resolvem.
 * Não preenche nada, não clica em nada — só conta. Quem navega entre os
 * passos é o comando `nf doctor` (que avança com um rascunho descartável).
 */
export async function verificarPasso(page: Page, passo: NomePasso): Promise<DiagnosticoSeletor[]> {
  const diagnosticos: DiagnosticoSeletor[] = [];
  for (const { nome, entrada } of entradasDoPasso(passo)) {
    const quantos = await contarSeletor(page, entrada);
    diagnosticos.push({
      passo,
      nome,
      seletor: entrada.seletor,
      descricao: entrada.descricao,
      encontrado: quantos > 0,
      confirmado: entrada.confirmado,
      opcional: entrada.opcional ?? false,
    });
  }
  return diagnosticos;
}

/** Falhou de verdade = não resolveu e não é opcional. É o que decide o exit code do doctor. */
export function falhasReais(diagnosticos: DiagnosticoSeletor[]): DiagnosticoSeletor[] {
  return diagnosticos.filter((d) => !d.encontrado && !d.opcional);
}

export function formatarDiagnostico(d: DiagnosticoSeletor): string {
  const estado = d.encontrado ? 'ok    ' : d.opcional ? 'ausente (opcional)' : 'QUEBROU';
  const aviso = d.confirmado ? '' : '  [id nunca confirmado em produção]';
  return `  ${estado}  ${d.nome}  ${d.seletor}${aviso}`;
}

export type { EntradaSeletor };
