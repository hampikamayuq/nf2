import type { Page } from 'playwright';
import type { Empresa } from '../../core/empresas/index.ts';
import type { Nota } from '../../core/nota.ts';
import { hojeBR, somenteDigitos } from './formatos.ts';
import { clicar, esperarPassoCarregar, preencherNativo, selecionarDropdownFiltravel } from './pagina.ts';
import { SELETORES } from './seletores.ts';

/** Texto visível de cada caso especial no dropdown "sem CPF" do portal. */
const TEXTO_CASO_ESPECIAL: Record<string, string> = {
  'estrangeiro-residente': 'Estrangeiro residente',
  turista: 'Turista',
  'nao-informado': 'Não informado',
};

/**
 * Passo 1 — competência e tomador.
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

  const tomador = nota.tomador;
  switch (tomador.tipo) {
    case 'cpf':
      await preencherNativo(page, s.cpfTomador!, somenteDigitos(tomador.cpf));
      await preencherNativo(page, s.cepTomador!, somenteDigitos(tomador.cep));
      await preencherNativo(page, s.numeroEndereco!, tomador.numero);
      break;
    case 'estrangeiro-residente':
      await selecionarDropdownFiltravel(page, s.casosEspeciais!, TEXTO_CASO_ESPECIAL[tomador.tipo]!);
      await preencherNativo(page, s.nomeTomador!, tomador.nome);
      if (tomador.nif) {
        await preencherNativo(page, s.nifTomador!, tomador.nif);
      }
      break;
    case 'turista':
      await selecionarDropdownFiltravel(page, s.casosEspeciais!, TEXTO_CASO_ESPECIAL[tomador.tipo]!);
      await preencherNativo(page, s.nomeTomador!, tomador.nome);
      await selecionarDropdownFiltravel(page, s.paisTomador!, tomador.pais);
      break;
    case 'nao-informado':
      await selecionarDropdownFiltravel(page, s.casosEspeciais!, TEXTO_CASO_ESPECIAL[tomador.tipo]!);
      break;
  }
}

export async function avancarPasso1(page: Page): Promise<void> {
  await clicar(page, SELETORES.passo1.avancar!);
  await esperarPassoCarregar(page);
}
