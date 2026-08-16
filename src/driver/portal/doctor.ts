import type { Page } from 'playwright';
import { contarSeletor } from './pagina.ts';
import { entradasDoPasso, type EntradaSeletor, type NomePasso } from './seletores.ts';

export interface DiagnosticoSeletor {
  passo: NomePasso;
  nome: string;
  seletor: string;
  descricao: string;
  encontrado: boolean;
  confirmado: boolean;
  opcional: boolean;
}

/**
 * Verifica, na página atual, quais seletores de um passo resolvem.
 * Não preenche nada, não clica em nada — só conta. Quem navega entre os
 * passos é o comando `nf doctor` (que avança com um rascunho descartável).
 */
export async function verificarPasso(page: Page, passo: NomePasso): Promise<DiagnosticoSeletor[]> {
  const diagnosticos: DiagnosticoSeletor[] = [];
  for (const { nome, entrada } of entradasDoPasso(passo)) {
    const quantos = await contarSeletor(page, entrada);
    diagnosticos.push({
      passo,
      nome,
      seletor: entrada.seletor,
      descricao: entrada.descricao,
      encontrado: quantos > 0,
      confirmado: entrada.confirmado,
      opcional: entrada.opcional ?? false,
    });
  }
  return diagnosticos;
}

/** Falhou de verdade = não resolveu e não é opcional. É o que decide o exit code do doctor. */
export function falhasReais(diagnosticos: DiagnosticoSeletor[]): DiagnosticoSeletor[] {
  return diagnosticos.filter((d) => !d.encontrado && !d.opcional);
}

export function formatarDiagnostico(d: DiagnosticoSeletor): string {
  const estado = d.encontrado ? 'ok    ' : d.opcional ? 'ausente (opcional)' : 'QUEBROU';
  const aviso = d.confirmado ? '' : '  [id nunca confirmado em produção]';
  return `  ${estado}  ${d.nome}  ${d.seletor}${aviso}`;
}

export type { EntradaSeletor };

export interface ElementoInventariado {
  tag: string;
  id: string;
  name: string;
  type: string;
  /** Texto visível de botões/links/radios — nunca o valor digitado em campos. */
  texto: string;
  rotulo: string;
  visivel: boolean;
  /** Primeiras opções de um <select> — ajuda a calibrar o texto digitado nos dropdowns. */
  opcoes?: string[];
}

/**
 * Inventaria os campos da página ATUAL (modo `nf doctor --descobrir`):
 * ids, names, rótulos, textos de botão e opções de dropdown. Não navega,
 * não preenche, não clica — e nunca lê valor digitado em campo (LGPD).
 * É a ferramenta de calibração do mapa: rode em cada passo do wizard
 * (avançando manualmente no Chrome) e compare com seletores.ts.
 */
export async function inventariarPagina(page: Page): Promise<ElementoInventariado[]> {
  return page.evaluate(() => {
    const resultado: Array<{
      tag: string;
      id: string;
      name: string;
      type: string;
      texto: string;
      rotulo: string;
      visivel: boolean;
      opcoes?: string[];
    }> = [];
    const els = document.querySelectorAll('input, select, textarea, button, a, [role="combobox"]');
    for (const el of Array.from(els)) {
      const tag = el.tagName.toLowerCase();
      const id = el.id ?? '';
      const name = el.getAttribute('name') ?? '';
      const type = el.getAttribute('type') ?? '';

      const ehAcao = tag === 'button' || tag === 'a' || type === 'submit' || type === 'button';
      const ehMarcavel = type === 'radio' || type === 'checkbox';
      let texto = '';
      if (ehAcao) {
        texto = (el.textContent || (el as HTMLInputElement).value || '').trim().slice(0, 60);
      } else if (ehMarcavel) {
        texto = (el.getAttribute('value') ?? '').slice(0, 60);
      }

      // Links sem id são quase sempre menu/navegação — só interessam os de ação do wizard.
      if (tag === 'a' && !id && !/avan[cç]|emitir|prosseguir|continuar|voltar|salvar|concluir/i.test(texto)) {
        continue;
      }

      let rotulo = '';
      if (id) {
        const label = document.querySelector(`label[for="${CSS.escape(id)}"]`);
        rotulo = label?.textContent?.trim().slice(0, 60) ?? '';
      }
      if (!rotulo) {
        rotulo = el.closest('label')?.textContent?.trim().slice(0, 60) ?? '';
      }

      if (!id && !name && !texto) continue;

      const item: (typeof resultado)[number] = {
        tag,
        id,
        name,
        type,
        texto,
        rotulo,
        visivel: (el as HTMLElement).offsetParent !== null,
      };
      if (el instanceof HTMLSelectElement) {
        item.opcoes = Array.from(el.options)
          .slice(0, 12)
          .map((o) => o.label.trim().slice(0, 60));
      }
      resultado.push(item);
    }
    return resultado;
  });
}

export function formatarElemento(e: ElementoInventariado): string {
  const partes = [`[${e.tag}${e.type ? `:${e.type}` : ''}]`];
  partes.push(e.id ? `#${e.id}` : '(sem id)');
  if (e.name) partes.push(`name=${e.name}`);
  if (e.rotulo) partes.push(`rotulo="${e.rotulo}"`);
  if (e.texto) partes.push(`texto="${e.texto}"`);
  if (!e.visivel) partes.push('(oculto)');
  const linha = `  ${partes.join('  ')}`;
  if (!e.opcoes || e.opcoes.length === 0) return linha;
  return `${linha}\n${e.opcoes.map((o) => `      · ${o}`).join('\n')}`;
}
