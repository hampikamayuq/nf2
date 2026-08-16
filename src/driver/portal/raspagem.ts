/**
 * Raspagem de texto das telas do portal — funções puras sobre o innerText,
 * para o parsing ser testável sem navegador e sem fixture.
 */

export interface ResumoNota {
  /** O texto integral do resumo do Passo 4 — a mesma tela que a pessoa revisaria. */
  textoCompleto: string;
  emitente?: string;
  tomador?: string;
  competencia?: string;
  valor?: string;
}

/**
 * Extrai o valor de um campo rotulado, aceitando os dois layouts comuns:
 * "Rótulo: valor" na mesma linha, ou o rótulo numa linha e o valor na seguinte.
 */
export function extrairCampoRotulado(texto: string, rotulo: string): string | undefined {
  const linhas = texto
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i] as string;
    if (!linha.toLowerCase().startsWith(rotulo.toLowerCase())) continue;
    const mesmaLinha = linha.slice(rotulo.length).replace(/^\s*:?\s*/, '');
    if (mesmaLinha) return mesmaLinha;
    const proxima = linhas[i + 1];
    if (proxima) return proxima;
  }
  return undefined;
}

export function montarResumo(textoCompleto: string): ResumoNota {
  return {
    textoCompleto,
    emitente: extrairCampoRotulado(textoCompleto, 'Emitente'),
    tomador: extrairCampoRotulado(textoCompleto, 'Tomador'),
    competencia: extrairCampoRotulado(textoCompleto, 'Data de Competência'),
    valor: extrairCampoRotulado(textoCompleto, 'Valor'),
  };
}

/** Chave de acesso da NFS-e: 50 dígitos corridos (pode vir com espaços/pontos no meio na tela). */
export function extrairChaveAcesso(texto: string): string | undefined {
  const candidato = /(?:\d[\s.]?){50}/.exec(texto)?.[0];
  if (!candidato) return undefined;
  const digitos = candidato.replace(/\D/g, '');
  return digitos.length === 50 ? digitos : undefined;
}

/** Número da NFS-e na tela de sucesso (rótulo "Número..."), sem confundir com a chave. */
export function extrairNumeroNota(texto: string): string | undefined {
  const porRotulo = extrairCampoRotulado(texto, 'Número da NFS-e') ?? extrairCampoRotulado(texto, 'Número');
  if (!porRotulo) return undefined;
  const m = /[\d][\d./-]*/.exec(porRotulo);
  return m ? m[0] : undefined;
}
