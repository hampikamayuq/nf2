/**
 * Mapa de seletores do wizard de emissão (Portal Nacional, /DPS).
 *
 * É deliberadamente UM arquivo: quando o portal mudar (e ele muda), o
 * conserto acontece aqui e em nenhum outro lugar — as page objects e o
 * `nf doctor` leem deste mapa, nunca de strings soltas.
 *
 * `confirmado: false` marca os ids que ainda não foram verificados contra o
 * portal de produção (risco #4 da seção 11 do PLANO.md — em especial todo o
 * bloco IBS/CBS, recente demais para as skills terem os ids). O `nf doctor`
 * existe exatamente para transformar esses palpites em fato na máquina da
 * clínica, sem emitir nada.
 */

export const VERSAO_MAPA = '2026-08-16';

export type NomePasso = 'passo1' | 'passo2' | 'passo3' | 'passo4';

export interface EntradaSeletor {
  seletor: string;
  descricao: string;
  /** false = id nunca visto em produção; o doctor destaca e é o primeiro lugar a corrigir quando quebrar. */
  confirmado: boolean;
  /**
   * Dropdown estilizado/filtrável que historicamente NÃO responde a
   * `fill()`/setter nativo (Município, Códigos de tributação, PIS/COFINS,
   * Regime, e todo o bloco IBS/CBS). A page object usa o fallback de UI:
   * clicar no controle, digitar, clicar na opção.
   */
  fallbackUi?: boolean;
  /** Só aparece em algumas empresas/tipos de tomador — o doctor não reprova se não resolver. */
  opcional?: boolean;
  /** Texto visível do elemento — usado no fallback de clique por JS quando o seletor CSS não resolve. */
  texto?: string;
}

export const SELETORES: Record<NomePasso, Record<string, EntradaSeletor>> = {
  // Passo 1 — /DPS/Pessoas: competência, tomador, endereço.
  passo1: {
    dataCompetencia: {
      seletor: '#DataCompetencia',
      descricao: 'Data de Competência (sempre hoje — preenchida pelo driver, nunca pela planilha)',
      confirmado: true, // verificado pelo spike da Fase 1
    },
    regimeApuracaoSN: {
      seletor: '#RegimeApuracaoSN',
      descricao: 'Regime de Apuração dos Tributos no Simples Nacional (só QARA)',
      confirmado: false,
      fallbackUi: true,
      opcional: true,
    },
    cpfTomador: {
      seletor: '#Tomador_Inscricao',
      descricao: 'CPF do tomador',
      confirmado: false,
    },
    casosEspeciais: {
      seletor: '#TomadorCasoEspecial',
      descricao: 'Casos especiais — tomador sem CPF (estrangeiro residente | turista | não informado)',
      confirmado: false,
      fallbackUi: true,
      opcional: true,
    },
    nomeTomador: {
      seletor: '#Tomador_Nome',
      descricao: 'Nome do tomador (só nos casos sem CPF)',
      confirmado: false,
      opcional: true,
    },
    nifTomador: {
      seletor: '#Tomador_Nif',
      descricao: 'NIF do tomador estrangeiro residente',
      confirmado: false,
      opcional: true,
    },
    paisTomador: {
      seletor: '#Tomador_Pais',
      descricao: 'País do turista',
      confirmado: false,
      fallbackUi: true,
      opcional: true,
    },
    cepTomador: {
      seletor: '#Tomador_Endereco_Cep',
      descricao: 'CEP do tomador',
      confirmado: false,
    },
    numeroEndereco: {
      seletor: '#Tomador_Endereco_Numero',
      descricao: 'Número do endereço do tomador',
      confirmado: false,
    },
    avancar: {
      seletor: '#btnAvancarPasso1',
      descricao: 'Botão Avançar do Passo 1',
      confirmado: false,
      texto: 'Avançar',
    },
  },

  // Passo 2 — Serviço: local, códigos de tributação, descrição, IBS/CBS.
  passo2: {
    municipioPrestacao: {
      seletor: '#LocalPrestacao_Municipio',
      descricao: 'Município de prestação do serviço',
      confirmado: false,
      fallbackUi: true,
    },
    codigoTributacaoNacional: {
      seletor: '#Servico_CodigoTributacaoNacional',
      descricao: 'Código de Tributação Nacional (04.01.01)',
      confirmado: false,
      fallbackUi: true,
    },
    codigoTributacaoComplementar: {
      seletor: '#Servico_CodigoTributacaoComplementar',
      descricao: 'Código de Tributação Complementar (04.01.01.001)',
      confirmado: false,
      fallbackUi: true,
    },
    descricaoServico: {
      seletor: '#Servico_Descricao',
      descricao: 'Descrição do serviço (template do catálogo, com CRM/RQE e data do atendimento)',
      confirmado: false,
    },
    // Bloco IBS/CBS — Reforma Tributária, obrigatório desde 01/08/2026.
    // Nenhum id confirmado em produção ainda (as próprias skills admitem isso);
    // radios Sim/Não são entradas separadas para a page object clicar direto no certo.
    ibsCbsPreencherSim: {
      seletor: '#IbsCbs_Preencher_Sim',
      descricao: 'IBS/CBS: "Deseja preencher?" = Sim',
      confirmado: false,
    },
    ibsCbsPreencherNao: {
      seletor: '#IbsCbs_Preencher_Nao',
      descricao: 'IBS/CBS: "Deseja preencher?" = Não',
      confirmado: false,
      opcional: true,
    },
    ibsCbsCompraGovSim: {
      seletor: '#IbsCbs_CompraGovernamental_Sim',
      descricao: 'IBS/CBS: compra governamental = Sim',
      confirmado: false,
      opcional: true,
    },
    ibsCbsCompraGovNao: {
      seletor: '#IbsCbs_CompraGovernamental_Nao',
      descricao: 'IBS/CBS: compra governamental = Não',
      confirmado: false,
    },
    ibsCbsDestinatarioAdquirenteSim: {
      seletor: '#IbsCbs_DestinatarioAdquirente_Sim',
      descricao: 'IBS/CBS: destinatário é o próprio adquirente = Sim',
      confirmado: false,
    },
    ibsCbsDestinatarioAdquirenteNao: {
      seletor: '#IbsCbs_DestinatarioAdquirente_Nao',
      descricao: 'IBS/CBS: destinatário é o próprio adquirente = Não',
      confirmado: false,
      opcional: true,
    },
    ibsCbsItemNbs: {
      seletor: '#IbsCbs_ItemNbs',
      descricao: 'IBS/CBS: Item NBS (123012100 — Serviços de clínica médica)',
      confirmado: false,
      fallbackUi: true,
    },
    ibsCbsCodigoIndicadorOperacao: {
      seletor: '#IbsCbs_CodigoIndicadorOperacao',
      descricao: 'IBS/CBS: código indicador da operação (030101)',
      confirmado: false,
      fallbackUi: true,
    },
    ibsCbsSituacaoTributaria: {
      seletor: '#IbsCbs_CodigoSituacaoTributaria',
      descricao: 'IBS/CBS: CST (000 — tributação integral)',
      confirmado: false,
      fallbackUi: true,
    },
    ibsCbsClassificacaoTributaria: {
      seletor: '#IbsCbs_CodigoClassificacaoTributaria',
      descricao: 'IBS/CBS: classificação tributária (000001)',
      confirmado: false,
      fallbackUi: true,
    },
    avancar: {
      seletor: '#btnAvancarPasso2',
      descricao: 'Botão Avançar do Passo 2',
      confirmado: false,
      texto: 'Avançar',
    },
  },

  // Passo 3 — Valores e tributação: é o passo que difere entre as duas empresas.
  passo3: {
    valorServico: {
      seletor: '#Valores_ValorServico',
      descricao: 'Valor do serviço (R$)',
      confirmado: false,
    },
    pisCofinsSituacaoTributaria: {
      seletor: '#Valores_PisCofins_SituacaoTributaria',
      descricao: 'PIS/COFINS: situação tributária (QARA: 07 Isenta; CG: 01 alíquota básica)',
      confirmado: false,
      fallbackUi: true,
    },
    pisCofinsTipoRetencao: {
      seletor: '#Valores_PisCofins_TipoRetencao',
      descricao: 'PIS/COFINS: tipo de retenção (não retidos)',
      confirmado: false,
      fallbackUi: true,
    },
    tipoValorTributos: {
      seletor: '#Valores_TipoValorTributos',
      descricao: 'Valor aproximado dos tributos (QARA: alíquota SN; CG: configurar percentuais)',
      confirmado: false,
      fallbackUi: true,
    },
    percentualFederal: {
      seletor: '#Valores_PercentualFederal',
      descricao: 'Percentual federal (só quando "configurar percentuais" — CG: 11,33)',
      confirmado: false,
      opcional: true,
    },
    percentualEstadual: {
      seletor: '#Valores_PercentualEstadual',
      descricao: 'Percentual estadual (CG: 0)',
      confirmado: false,
      opcional: true,
    },
    percentualMunicipal: {
      seletor: '#Valores_PercentualMunicipal',
      descricao: 'Percentual municipal (CG: 0)',
      confirmado: false,
      opcional: true,
    },
    issqnRegimeEspecial: {
      seletor: '#Valores_IssqnRegimeEspecial',
      descricao: 'ISSQN: Regime Especial de Tributação (CG: 6 — Sociedade de Profissionais)',
      confirmado: false,
      fallbackUi: true,
      opcional: true,
    },
    avancar: {
      seletor: '#btnAvancarPasso3',
      descricao: 'Botão Avançar do Passo 3',
      confirmado: false,
      texto: 'Avançar',
    },
  },

  // Passo 4 — resumo (a tela que a pessoa revisaria) e o botão irreversível.
  passo4: {
    resumo: {
      seletor: '#Resumo',
      descricao: 'Container do resumo da nota (é o que o dry-run raspa e mostra)',
      confirmado: false,
    },
    emitir: {
      seletor: '#btnEmitir',
      descricao: 'Botão "Emitir NFS-e" — NUNCA clicado sem --confirm + "sim" na tela',
      confirmado: false,
      texto: 'Emitir NFS-e',
    },
  },
};

/** Lista as entradas de um passo com nome, para o doctor iterar e reportar uma a uma. */
export function entradasDoPasso(passo: NomePasso): Array<{ nome: string; entrada: EntradaSeletor }> {
  return Object.entries(SELETORES[passo]).map(([nome, entrada]) => ({ nome, entrada }));
}

/** Entradas ainda não confirmadas em produção — o doctor as destaca no relatório. */
export function entradasNaoConfirmadas(): Array<{ passo: NomePasso; nome: string; entrada: EntradaSeletor }> {
  const passos: NomePasso[] = ['passo1', 'passo2', 'passo3', 'passo4'];
  return passos.flatMap((passo) =>
    entradasDoPasso(passo)
      .filter(({ entrada }) => !entrada.confirmado)
      .map(({ nome, entrada }) => ({ passo, nome, entrada }))
  );
}
