import type { Page } from 'playwright';
import type { Empresa } from '../../core/empresas/index.ts';
import type { Nota } from '../../core/nota.ts';
import { formatarValorBR } from './formatos.ts';
import { clicar, esperarPassoCarregar, preencherNativo, selecionarDropdownFiltravel } from './pagina.ts';
import { SELETORES } from './seletores.ts';

/**
 * Passo 3 — valores e tributação: é o passo que difere entre as duas
 * empresas, e por isso vem inteiro do perfil (JSON), não de `if`s aqui.
 */
export async function preencherPasso3(page: Page, nota: Nota, empresa: Empresa): Promise<void> {
  const s = SELETORES.passo3;
  const p3 = empresa.passo3;

  await preencherNativo(page, s.valorServico!, formatarValorBR(nota.servico.valorCentavos));

  if (p3.issqnRegimeEspecial) {
    await selecionarDropdownFiltravel(page, s.issqnRegimeEspecial!, p3.issqnRegimeEspecial);
  }

  await selecionarDropdownFiltravel(page, s.pisCofinsSituacaoTributaria!, p3.pisCofinsSituacaoTributaria);
  await selecionarDropdownFiltravel(page, s.pisCofinsTipoRetencao!, p3.pisCofinsTipoRetencao);
  await selecionarDropdownFiltravel(page, s.tipoValorTributos!, p3.tipoValorTributos);

  // CST e classificação tributária do IBS/CBS não estão no Passo 2 real —
  // a hipótese (a confirmar no inventário deste passo) é que vivem aqui.
  const ibs = empresa.passo2.ibsCbs;
  if (ibs.preencher) {
    await selecionarDropdownFiltravel(page, s.ibsCbsSituacaoTributaria!, ibs.codigoSituacaoTributaria);
    await selecionarDropdownFiltravel(page, s.ibsCbsClassificacaoTributaria!, ibs.codigoClassificacaoTributaria);
  }

  if (p3.percentuais) {
    await preencherNativo(page, s.percentualFederal!, p3.percentuais.federal);
    await preencherNativo(page, s.percentualEstadual!, p3.percentuais.estadual);
    await preencherNativo(page, s.percentualMunicipal!, p3.percentuais.municipal);
  }
}

export async function avancarPasso3(page: Page): Promise<void> {
  await clicar(page, SELETORES.passo3.avancar!);
  await esperarPassoCarregar(page);
}
