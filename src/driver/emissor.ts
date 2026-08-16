import type { Nota } from '../core/nota.ts';
import type { ResumoNota } from './portal/raspagem.ts';

export interface ResultadoEmissao {
  chaveAcesso: string;
  numeroNota: string;
}

/**
 * A fronteira entre o domínio e o "como emitir" (PLANO.md seção 4).
 *
 * Hoje a única implementação é o PortalDriver (Playwright sobre o wizard).
 * O destino natural é um adaptador da API oficial (ADN/SEFIN, certificado
 * A1) — que implementa esta MESMA interface sem tocar em core, ledger,
 * planilha ou CLI.
 */
export interface EmissorDriver {
  /**
   * Dry-run: preenche os passos 1–3 de verdade, chega ao Passo 4 e raspa o
   * resumo — a mesma tela que a pessoa revisaria — e PARA ali. Não emite.
   */
  prepararNota(nota: Nota): Promise<ResumoNota>;

  /**
   * Emite a nota preparada por `prepararNota`. Irreversível. Só o comando
   * `nf emitir` chama, depois de `--confirm` + "sim" digitado na tela.
   */
  emitir(): Promise<ResultadoEmissao>;

  /** Sai do rascunho sem emitir (fim de dry-run, erro, ou desistência). */
  abandonar(): Promise<void>;
}
