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
  // Radios/checkboxes estilizados ficam display:none no portal — o Playwright
  // recusaria o clique por invisibilidade, então nem tenta: JS direto.
  if (!entrada.viaJs) {
    try {
      await page.locator(entrada.seletor).first().click({ timeout: TIMEOUT_CLIQUE_MS });
      return;
    } catch {
      // segue para o fallback por JS
    }
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
 * Marca um radio/checkbox estilizado E VERIFICA que pegou. O portal
 * intercepta o clique nesses controles (verificado ao vivo em 17/08/2026:
 * `el.click()` não marcava), então a sequência é: clique JS; se não pegou,
 * seta `checked` direto e dispara click/input/change para o framework da
 * página reagir; confere o estado no final e falha alto se continuar errado.
 */
async function marcarInput(page: Page, entrada: EntradaSeletor, desejado: boolean): Promise<void> {
  const resultado = await page.evaluate(
    ([seletor, valor]) => {
      let el: Element | null = null;
      try {
        el = document.querySelector(seletor as string);
      } catch {
        return 'nao-achou';
      }
      if (!(el instanceof HTMLInputElement)) return 'nao-achou';
      if (el.checked !== valor) el.click();
      if (el.checked !== valor) {
        el.checked = valor as boolean;
        el.dispatchEvent(new Event('click', { bubbles: true }));
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
      return el.checked === valor ? 'ok' : 'nao-pegou';
    },
    [entrada.seletor, desejado] as const
  );
  if (resultado === 'nao-achou') {
    throw new SeletorNaoEncontradoError(entrada, 'Radio/checkbox não encontrado na página.');
  }
  if (resultado === 'nao-pegou') {
    throw new SeletorNaoEncontradoError(
      entrada,
      'O radio/checkbox existe mas não aceitou a marcação nem por clique nem por checked+eventos.'
    );
  }
}

/** Seleciona um radio estilizado (sempre marcando — radio não desmarca). */
export async function marcarRadio(page: Page, entrada: EntradaSeletor): Promise<void> {
  await marcarInput(page, entrada, true);
}

/** Marca (ou desmarca) um checkbox de forma idempotente, com a mesma verificação do radio. */
export async function marcarCheckbox(page: Page, entrada: EntradaSeletor, desejado: boolean): Promise<void> {
  await marcarInput(page, entrada, desejado);
}

/**
 * Dropdown estilizado/filtrável. Caminho 1: se o alvo é um `<select>` (ainda
 * que oculto atrás do widget), seta a opção por value/texto com setter nativo
 * + change — é o `setSel` das skills. Caminho 2 (fallback de UI, também das
 * skills): clica no controle, digita, clica na opção que aparece.
 */
export async function selecionarDropdownFiltravel(page: Page, entrada: EntradaSeletor, texto: string): Promise<void> {
  const viaSelect = await page.evaluate(
    ([seletor, valor]) => {
      let el: Element | null = null;
      try {
        el = document.querySelector(seletor as string);
      } catch {
        return 'nao-achou';
      }
      if (!el) return 'nao-achou';
      if (!(el instanceof HTMLSelectElement)) return 'nao-e-select';
      const busca = (valor as string).toLowerCase();
      const opcoes = Array.from(el.options);
      const alvo = opcoes.find((o) => o.value === valor) ?? opcoes.find((o) => o.label.toLowerCase().includes(busca));
      if (!alvo) return 'sem-opcao';
      el.value = alvo.value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return 'ok';
    },
    [entrada.seletor, texto] as const
  );
  if (viaSelect === 'ok') return;
  if (viaSelect === 'sem-opcao') {
    throw new SeletorNaoEncontradoError(
      entrada,
      `O <select> existe mas nenhuma opção tem value nem texto correspondendo a "${texto}" — ajuste o valor no perfil da empresa.`
    );
  }

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
