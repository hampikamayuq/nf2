import type { Page } from 'playwright';
import type { Empresa } from '../../core/empresas/index.ts';
import type { Nota } from '../../core/nota.ts';
import { clicar, esperarPassoCarregar, preencherNativo, selecionarDropdownFiltravel } from './pagina.ts';
import { SELETORES } from './seletores.ts';

/**
 * Passo 2 — /DPS/Servico (layout real conferido no inventário de
 * 17/08/2026): local da prestação, códigos de tributação, descrição e a
 * parte do IBS/CBS deste passo (NBS + indicador da operação). Os dropdowns
 * são selects atrás de select2 — o caminho nativo tenta primeiro; municípios
 * carregam por AJAX e caem no fallback de UI.
 */
export async function preencherPasso2(page: Page, nota: Nota, empresa: Empresa): Promise<void> {
  const s = SELETORES.passo2;
  const p2 = empresa.passo2;

  await selecionarDropdownFiltravel(page, s.municipioPrestacao!, p2.municipioPrestacao);
  await selecionarDropdownFiltravel(page, s.codigoTributacaoNacional!, p2.codigoTributacaoNacional);
  await selecionarDropdownFiltravel(page, s.codigoTributacaoComplementar!, p2.codigoTributacaoComplementar);

  const descricao = nota.observacao
    ? `${nota.servico.descricao}\n\n${nota.observacao}`
    : nota.servico.descricao;
  await preencherNativo(page, s.descricaoServico!, descricao);

  // Radios de IBS/CBS ficam no Passo 1; CST e classificação, no Passo 3.
  // Aqui: NBS + indicador da operação, só quando o perfil pede.
  const ibs = p2.ibsCbs;
  if (!ibs.preencher) return;
  await selecionarDropdownFiltravel(page, s.ibsCbsItemNbs!, ibs.itemNbs);
  await selecionarDropdownFiltravel(page, s.ibsCbsCodigoIndicadorOperacao!, ibs.codigoIndicadorOperacao);
}

export async function avancarPasso2(page: Page): Promise<void> {
  await clicar(page, SELETORES.passo2.avancar!);
  await esperarPassoCarregar(page);
}
