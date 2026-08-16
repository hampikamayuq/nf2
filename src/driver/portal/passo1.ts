import type { Page } from 'playwright';
import type { Empresa } from '../../core/empresas/index.ts';
import type { Nota } from '../../core/nota.ts';
import { hojeBR, somenteDigitos } from './formatos.ts';
import { clicar, esperarPassoCarregar, marcarCheckbox, preencherNativo, selecionarDropdownFiltravel } from './pagina.ts';
import { SELETORES } from './seletores.ts';

/**
 * Passo 1 — competência, regime SN, IBS/CBS e tomador (layout real conferido
 * pelo inventário de 16/08/2026: os radios de IBS/CBS moram AQUI, e os campos
 * de endereço só aparecem depois de marcar "Informar endereço").
 *
 * A Data de Competência é SEMPRE hoje, calculada aqui na hora de preencher —
 * nunca vem da planilha, nunca retroage (PLANO.md seção 3). `dataAtendimento`
 * da nota só aparece na descrição do serviço, no Passo 2.
 */
export async function preencherPasso1(page: Page, nota: Nota, empresa: Empresa): Promise<void> {
  const s = SELETORES.passo1;

  await preencherNativo(page, s.dataCompetencia!, hojeBR());

  if (empresa.passo1.regimeApuracaoSN) {
    await selecionarDropdownFiltravel(page, s.regimeApuracaoSN!, empresa.passo1.regimeApuracaoSN);
  }

  // IBS/CBS: os radios ficam no Passo 1 do portal; o perfil guarda o bloco em
  // `passo2.ibsCbs` (o dado é o mesmo — só a tela em que ele entra mudou).
  const ibs = empresa.passo2.ibsCbs;
  if (ibs.preencher) {
    await clicar(page, s.ibsCbsPreencherSim!);
    await clicar(page, ibs.compraGovernamental ? s.compraGovSim! : s.compraGovNao!);
    await clicar(page, ibs.destinatarioProprioAdquirente ? s.destinatarioAdquirenteSim! : s.destinatarioAdquirenteNao!);
  } else {
    await clicar(page, s.ibsCbsPreencherNao!);
  }

  const tomador = nota.tomador;
  switch (tomador.tipo) {
    case 'cpf':
      await clicar(page, s.tomadorBrasil!);
      await preencherNativo(page, s.cpfTomador!, somenteDigitos(tomador.cpf));
      // A pesquisa puxa o nome do cadastro — roundtrip com o servidor.
      await clicar(page, s.pesquisarCpf!);
      await esperarPassoCarregar(page);
      await marcarCheckbox(page, s.informarEndereco!, true);
      await preencherNativo(page, s.cepTomador!, somenteDigitos(tomador.cep));
      // A busca do CEP preenche logradouro/bairro/município — outro roundtrip.
      await clicar(page, s.buscarCep!);
      await esperarPassoCarregar(page);
      await preencherNativo(page, s.numeroEndereco!, tomador.numero);
      break;
    case 'estrangeiro-residente':
      await clicar(page, s.tomadorExterior!);
      if (tomador.nif) {
        await clicar(page, s.nifInformadoSim!);
        await preencherNativo(page, s.nifTomador!, tomador.nif);
      } else {
        await clicar(page, s.nifInformadoNao!);
        await selecionarDropdownFiltravel(page, s.motivoNaoInformacaoNIF!, 'Dispensado do NIF');
      }
      await preencherNativo(page, s.nomeTomador!, tomador.nome);
      break;
    case 'turista':
      await clicar(page, s.tomadorExterior!);
      await clicar(page, s.nifInformadoNao!);
      await selecionarDropdownFiltravel(page, s.motivoNaoInformacaoNIF!, 'Não exigência do NIF');
      await preencherNativo(page, s.nomeTomador!, tomador.nome);
      await selecionarDropdownFiltravel(page, s.paisTomador!, tomador.pais);
      break;
    case 'nao-informado':
      await clicar(page, s.tomadorNaoInformado!);
      break;
  }
}

export async function avancarPasso1(page: Page): Promise<void> {
  await clicar(page, SELETORES.passo1.avancar!);
  await esperarPassoCarregar(page);
}
