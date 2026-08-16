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
  /**
   * Radio/checkbox estilizado que fica `display:none` no portal (o clique
   * visível é no label): o Playwright recusa clicar em elemento invisível,
   * então o clique vai DIRETO por JS (`el.click()`), como as skills fazem.
   */
  viaJs?: boolean;
}

export const SELETORES: Record<NomePasso, Record<string, EntradaSeletor>> = {
  // Passo 1 — /DPS/Pessoas: competência, regime SN, IBS/CBS (os radios ficam
  // AQUI, não no Passo 2 — confirmado pelo inventário de 16/08/2026), tomador
  // e endereço. Radios do portal têm ids duplicados (um por opção com o MESMO
  // id), então a seleção é por name+value.
  passo1: {
    dataCompetencia: {
      seletor: '#DataCompetencia',
      descricao: 'Data de Competência (sempre hoje — preenchida pelo driver, nunca pela planilha)',
      confirmado: true, // spike da Fase 1 + inventário 16/08/2026
    },
    regimeApuracaoSN: {
      seletor: '#SimplesNacional_RegimeApuracaoTributosSN',
      descricao: 'Regime de Apuração dos Tributos no Simples Nacional (select oculto/estilizado — só QARA)',
      confirmado: true,
      fallbackUi: true,
      opcional: true,
    },
    ibsCbsPreencherSim: {
      seletor: 'input[name="PreencherInfoIBSCBS"][value="1"]',
      descricao: 'IBS/CBS: "Deseja preencher?" = Sim (radio oculto, fica no Passo 1)',
      confirmado: true,
      viaJs: true,
    },
    ibsCbsPreencherNao: {
      seletor: 'input[name="PreencherInfoIBSCBS"][value="0"]',
      descricao: 'IBS/CBS: "Deseja preencher?" = Não',
      confirmado: true,
      viaJs: true,
      opcional: true,
    },
    compraGovSim: {
      seletor: 'input[name="EhCompraGovernamental"][value="1"]',
      descricao: 'IBS/CBS: compra governamental = Sim',
      confirmado: true,
      viaJs: true,
      opcional: true,
    },
    compraGovNao: {
      seletor: 'input[name="EhCompraGovernamental"][value="0"]',
      descricao: 'IBS/CBS: compra governamental = Não',
      confirmado: true,
      viaJs: true,
    },
    destinatarioAdquirenteSim: {
      seletor: 'input[name="DestinatarioEhOAdquirente"][value="1"]',
      descricao: 'IBS/CBS: destinatário é o próprio adquirente = Sim',
      confirmado: true,
      viaJs: true,
    },
    destinatarioAdquirenteNao: {
      seletor: 'input[name="DestinatarioEhOAdquirente"][value="0"]',
      descricao: 'IBS/CBS: destinatário é o próprio adquirente = Não',
      confirmado: true,
      viaJs: true,
      opcional: true,
    },
    tomadorBrasil: {
      seletor: 'input[name="Tomador.LocalDomicilio"][value="1"]',
      descricao: 'Tomador domiciliado no Brasil (caso CPF)',
      confirmado: true,
      viaJs: true,
    },
    tomadorExterior: {
      seletor: 'input[name="Tomador.LocalDomicilio"][value="2"]',
      descricao: 'Tomador domiciliado no Exterior (estrangeiro/turista)',
      confirmado: true,
      viaJs: true,
      opcional: true,
    },
    tomadorNaoInformado: {
      seletor: 'input[name="Tomador.LocalDomicilio"][value="0"]',
      descricao: 'Tomador/Adquirente não informado',
      confirmado: true,
      viaJs: true,
    },
    cpfTomador: {
      seletor: '#Tomador_Inscricao',
      descricao: 'CPF do tomador',
      confirmado: true,
    },
    pesquisarCpf: {
      seletor: '#btn_Tomador_Inscricao_pesquisar',
      descricao: 'Botão de pesquisa do CPF (puxa o nome do cadastro)',
      confirmado: true,
      opcional: true,
    },
    nomeTomador: {
      seletor: '#Tomador_Nome',
      descricao: 'Nome do tomador (preenchido pela pesquisa de CPF; manual nos casos sem CPF)',
      confirmado: true,
      opcional: true,
    },
    nifInformadoSim: {
      seletor: 'input[name="Tomador.NIFInformado"][value="1"]',
      descricao: 'Tomador do exterior: NIF informado = Sim',
      confirmado: true,
      viaJs: true,
      opcional: true,
    },
    nifInformadoNao: {
      seletor: 'input[name="Tomador.NIFInformado"][value="0"]',
      descricao: 'Tomador do exterior: NIF informado = Não',
      confirmado: true,
      viaJs: true,
      opcional: true,
    },
    nifTomador: {
      seletor: '#Tomador_NIF',
      descricao: 'NIF do tomador estrangeiro',
      confirmado: true,
      opcional: true,
    },
    motivoNaoInformacaoNIF: {
      seletor: '#Tomador_MotivoNaoInformacaoNIF',
      descricao: 'Motivo de não informação do NIF (Dispensado | Não exigência)',
      confirmado: true,
      fallbackUi: true,
      opcional: true,
    },
    paisTomador: {
      seletor: '#Tomador_EnderecoExterior_CodigoPais',
      descricao: 'País do tomador do exterior (select estilizado)',
      confirmado: true,
      fallbackUi: true,
      opcional: true,
    },
    informarEndereco: {
      seletor: '#Tomador_InformarEndereco',
      descricao: 'Checkbox "Informar endereço" — destrava os campos de CEP/número',
      confirmado: true,
      viaJs: true,
    },
    cepTomador: {
      seletor: '#Tomador_EnderecoNacional_CEP',
      descricao: 'CEP do tomador (aparece após marcar "Informar endereço")',
      confirmado: true,
    },
    buscarCep: {
      seletor: '#btn_Tomador_EnderecoNacional_CEP',
      descricao: 'Botão de busca do CEP (preenche logradouro/bairro/município)',
      confirmado: true,
      opcional: true,
    },
    numeroEndereco: {
      seletor: '#Tomador_EnderecoNacional_Numero',
      descricao: 'Número do endereço do tomador',
      confirmado: true,
    },
    avancar: {
      seletor: '#btnAvancar',
      descricao: 'Botão Avançar (submit — mesmo id em todos os passos)',
      confirmado: true,
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
    // Bloco IBS/CBS restante — os radios (preencher/compra gov/destinatário)
    // moraram no Passo 1 (inventário 16/08/2026); aqui ficam os dropdowns de
    // NBS/indicador/CST/classificação, ainda sem id confirmado.
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
      seletor: '#btnAvancar',
      descricao: 'Botão Avançar (mesmo id do Passo 1; a confirmar neste passo)',
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
      seletor: '#btnAvancar',
      descricao: 'Botão Avançar (mesmo id do Passo 1; a confirmar neste passo)',
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
