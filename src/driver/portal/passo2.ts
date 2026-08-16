import type { Page } from 'playwright';
import type { Empresa } from '../../core/empresas/index.ts';
import type { Nota } from '../../core/nota.ts';
import { clicar, esperarPassoCarregar, preencherNativo, selecionarDropdownFiltravel } from './pagina.ts';
import { SELETORES } from './seletores.ts';

/**
 * Passo 2 — local da prestação, códigos de tributação, descrição e IBS/CBS.
 *
 * Tudo que é dropdown aqui usa o fallback de UI por padrão (clicar, digitar,
 * clicar na opção) — é o comportamento documentado nas skills para Município
 * e códigos de tributação, e o PLANO.md manda assumir o mesmo para o bloco
 * IBS/CBS, cujos ids ainda nem foram confirmados em produção.
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

  // Os radios de IBS/CBS (preencher/compra gov/destinatário) ficam no Passo 1
  // (inventário 16/08/2026). Aqui restam os dropdowns do bloco — só quando o
  // perfil pede o preenchimento.
  const ibs = p2.ibsCbs;
  if (!ibs.preencher) return;
  await selecionarDropdownFiltravel(page, s.ibsCbsItemNbs!, ibs.itemNbs);
  await selecionarDropdownFiltravel(page, s.ibsCbsCodigoIndicadorOperacao!, ibs.codigoIndicadorOperacao);
  await selecionarDropdownFiltravel(page, s.ibsCbsSituacaoTributaria!, ibs.codigoSituacaoTributaria);
  await selecionarDropdownFiltravel(page, s.ibsCbsClassificacaoTributaria!, ibs.codigoClassificacaoTributaria);
}

export async function avancarPasso2(page: Page): Promise<void> {
  await clicar(page, SELETORES.passo2.avancar!);
  await esperarPassoCarregar(page);
}
