/** Formatações que o portal espera — puras, testadas sem navegador. */

/**
 * Hoje em DD/MM/AAAA, no fuso local da máquina que roda o comando.
 * É a ÚNICA fonte da "Data de Competência" do Passo 1: nunca vem da
 * planilha, nunca retroage (ver PLANO.md seção 3).
 */
export function hojeBR(agora: Date = new Date()): string {
  const dia = String(agora.getDate()).padStart(2, '0');
  const mes = String(agora.getMonth() + 1).padStart(2, '0');
  return `${dia}/${mes}/${agora.getFullYear()}`;
}

/** Centavos → "1.234,56" (formato que o campo de valor do portal exibe). */
export function formatarValorBR(centavos: number): string {
  if (!Number.isInteger(centavos) || centavos < 0) {
    throw new Error(`Valor em centavos inválido: ${centavos}`);
  }
  const reais = Math.floor(centavos / 100);
  const resto = String(centavos % 100).padStart(2, '0');
  const milhares = reais.toLocaleString('pt-BR');
  return `${milhares},${resto}`;
}

/** Remove máscara de CNPJ/CPF para comparar com os perfis (que guardam só dígitos). */
export function somenteDigitos(texto: string): string {
  return texto.replace(/\D/g, '');
}
