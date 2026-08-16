import type { Page } from 'playwright';
import type { EntradaSeletor } from './seletores.ts';

/**
 * Mecânica de interação com o portal — as três operações que as skills
 * provaram em produção, agora em um lugar só:
 *
 * 1. preencher por setter nativo + eventos `input`/`change` (o `page.fill()`
 *    puro historicamente não dispara a validação do portal);
 * 2. clicar com fallback por JS (as skills relatam `page.click()` travando
 *    em "Avançar" — o spike da Fase 1 decide qual caminho é o normal, mas o
 *    fallback fica de pé de qualquer forma);
 * 3. dropdown filtrável por UI: clicar no controle, digitar, clicar na opção
 *    (Município, códigos de tributação, PIS/COFINS, Regime e IBS/CBS não
 *    respondem a `setSel`/JS puro).
 */

const TIMEOUT_CLIQUE_MS = 5_000;
const TIMEOUT_OPCAO_MS = 10_000;

export class SeletorNaoEncontradoError extends Error {
  constructor(
    public readonly entrada: EntradaSeletor,
    detalhe: string
  ) {
    super(
      `Seletor não resolveu: ${entrada.seletor} (${entrada.descricao}). ${detalhe} ` +
        'Rode `nf doctor` para ver tudo que quebrou e corrija src/driver/portal/seletores.ts.'
    );
    this.name = 'SeletorNaoEncontradoError';
  }
}

/** Preenche input/textarea/select com setter nativo + eventos — o método que já emite nota hoje. */
export async function preencherNativo(page: Page, entrada: EntradaSeletor, valor: string): Promise<void> {
  const ok = await page.evaluate(
    ([seletor, val]) => {
      const el = document.querySelector(seletor as string);
      if (!el) return false;
      const proto =
        el instanceof HTMLTextAreaElement
          ? HTMLTextAreaElement.prototype
          : el instanceof HTMLSelectElement
            ? HTMLSelectElement.prototype
            : el instanceof HTMLInputElement
              ? HTMLInputElement.prototype
              : null;
      if (!proto) return false;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
      if (!setter) return false;
      setter.call(el, val as string);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    },
    [entrada.seletor, valor] as const
  );
  if (!ok) {
    throw new SeletorNaoEncontradoError(entrada, 'O campo não existe na página ou não é input/textarea/select.');
  }
}

/**
 * Clica com o Playwright; se travar/expirar, cai para o clique por JS
 * (querySelector → `.click()`, ou busca por texto visível quando a entrada
 * tem `texto` — o mesmo caminho que as skills usam hoje).
 */
export async function clicar(page: Page, entrada: EntradaSeletor): Promise<void> {
  try {
    await page.locator(entrada.seletor).first().click({ timeout: TIMEOUT_CLIQUE_MS });
    return;
  } catch {
    // segue para o fallback por JS
  }

  const ok = await page.evaluate(
    ([seletor, texto]) => {
      let el: Element | null = null;
      try {
        el = document.querySelector(seletor as string);
      } catch {
        el = null;
      }
      if (!el && texto) {
        const candidatos = Array.from(document.querySelectorAll('button, a, input[type="submit"], input[type="button"]'));
        el =
          candidatos.find((c) => {
            const rotulo = c instanceof HTMLInputElement ? c.value : (c.textContent ?? '');
            return rotulo.trim() === texto;
          }) ?? null;
      }
      if (!(el instanceof HTMLElement)) return false;
      el.click();
      return true;
    },
    [entrada.seletor, entrada.texto ?? ''] as const
  );
  if (!ok) {
    throw new SeletorNaoEncontradoError(entrada, 'Nem o clique do Playwright nem o fallback por JS acharam o elemento.');
  }
}

/**
 * Dropdown estilizado/filtrável: clica no controle para abrir, digita o
 * texto, clica na opção que o contém. É o fallback de UI documentado nas
 * skills — aqui ele é o caminho PADRÃO para toda entrada com `fallbackUi`.
 */
export async function selecionarDropdownFiltravel(page: Page, entrada: EntradaSeletor, texto: string): Promise<void> {
  await clicar(page, entrada);
  await page.keyboard.type(texto, { delay: 30 });

  const opcao = page
    .locator(`${entrada.seletor} li, .select2-results__option, [role="option"]`)
    .filter({ hasText: texto })
    .first();
  try {
    await opcao.click({ timeout: TIMEOUT_OPCAO_MS });
  } catch {
    throw new SeletorNaoEncontradoError(
      entrada,
      `Abriu o controle e digitou "${texto}", mas nenhuma opção com esse texto apareceu para clicar.`
    );
  }
}

/** Espera a navegação/re-render pós-Avançar assentar antes de mexer no passo seguinte. */
export async function esperarPassoCarregar(page: Page): Promise<void> {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(500);
}

/** Quantos elementos o seletor resolve agora — base do `nf doctor`. */
export async function contarSeletor(page: Page, entrada: EntradaSeletor): Promise<number> {
  try {
    return await page.locator(entrada.seletor).count();
  } catch {
    return 0;
  }
}
