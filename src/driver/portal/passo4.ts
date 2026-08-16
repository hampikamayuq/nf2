import type { Page } from 'playwright';
import { clicar, contarSeletor, esperarPassoCarregar } from './pagina.ts';
import { extrairChaveAcesso, extrairNumeroNota, montarResumo, type ResumoNota } from './raspagem.ts';
import { SELETORES } from './seletores.ts';

/**
 * Passo 4 — o resumo e o botão irreversível.
 *
 * O dry-run termina aqui: raspa a mesma tela que a pessoa revisaria e PARA.
 * `clicarEmitir` só é chamado pelo driver depois de `--confirm` + "sim".
 */
export async function rasparResumoPasso4(page: Page): Promise<ResumoNota> {
  const s = SELETORES.passo4;
  const temContainer = (await contarSeletor(page, s.resumo!)) > 0;
  const texto = temContainer
    ? await page.locator(s.resumo!.seletor).first().innerText()
    : await page.evaluate(() => document.body?.innerText ?? '');
  return montarResumo(texto);
}

export interface ResultadoEmissao {
  chaveAcesso: string;
  numeroNota: string;
}

/** Clica em "Emitir NFS-e" e raspa chave de acesso + número da tela de sucesso. */
export async function clicarEmitir(page: Page): Promise<ResultadoEmissao> {
  await clicar(page, SELETORES.passo4.emitir!);
  await esperarPassoCarregar(page);

  const texto = await page.evaluate(() => document.body?.innerText ?? '');
  const chaveAcesso = extrairChaveAcesso(texto);
  const numeroNota = extrairNumeroNota(texto);

  if (!chaveAcesso || !numeroNota) {
    throw new Error(
      'Cliquei em "Emitir NFS-e" mas não achei chave de acesso (50 dígitos) e número na tela seguinte. ' +
        'A nota PODE ter sido emitida — confira no portal antes de tentar de novo ' +
        '(o ledger fica em in_progress justamente para este caso). ' +
        `Começo do texto da tela: ${JSON.stringify(texto.slice(0, 300))}`
    );
  }
  return { chaveAcesso, numeroNota };
}
