import type { Page } from 'playwright';
import { empresaPorSlug } from '../../core/empresas/index.ts';
import type { Nota } from '../../core/nota.ts';
import type { EmissorDriver, ResultadoEmissao } from '../emissor.ts';
import { PORTAL_BASE } from '../sessao.ts';
import { esperarPassoCarregar } from './pagina.ts';
import { avancarPasso1, preencherPasso1 } from './passo1.ts';
import { avancarPasso2, preencherPasso2 } from './passo2.ts';
import { avancarPasso3, preencherPasso3 } from './passo3.ts';
import { clicarEmitir, rasparResumoPasso4 } from './passo4.ts';
import type { ResumoNota } from './raspagem.ts';

export interface OpcoesPortalDriver {
  /** Onde começa o wizard. Nos testes aponta para as fixtures locais (file://). */
  urlInicioDps?: string;
  /** Para onde ir ao abandonar um rascunho sem emitir. */
  urlAbandono?: string;
}

/**
 * Implementação Playwright do EmissorDriver sobre o wizard de 4 passos do
 * Portal Nacional. Preencher e emitir são operações separadas de propósito:
 * `prepararNota` para no resumo (dry-run); `emitir` só existe para ser
 * chamado depois da confirmação humana.
 */
export class PortalDriver implements EmissorDriver {
  private readonly urlInicioDps: string;
  private readonly urlAbandono: string;
  private preparada = false;

  constructor(
    private readonly page: Page,
    opcoes: OpcoesPortalDriver = {}
  ) {
    this.urlInicioDps = opcoes.urlInicioDps ?? `${PORTAL_BASE}/DPS/Pessoas`;
    this.urlAbandono = opcoes.urlAbandono ?? PORTAL_BASE;
  }

  async prepararNota(nota: Nota): Promise<ResumoNota> {
    this.preparada = false;
    const empresa = empresaPorSlug(nota.empresa);

    await this.page.goto(this.urlInicioDps, { waitUntil: 'domcontentloaded' });
    await esperarPassoCarregar(this.page);

    await preencherPasso1(this.page, nota, empresa);
    await avancarPasso1(this.page);

    await preencherPasso2(this.page, nota, empresa);
    await avancarPasso2(this.page);

    await preencherPasso3(this.page, nota, empresa);
    await avancarPasso3(this.page);

    const resumo = await rasparResumoPasso4(this.page);
    this.preparada = true;
    return resumo;
  }

  async emitir(): Promise<ResultadoEmissao> {
    if (!this.preparada) {
      throw new Error('emitir() sem prepararNota() antes — o dry-run e a confirmação nunca podem ser pulados.');
    }
    this.preparada = false;
    return clicarEmitir(this.page);
  }

  async abandonar(): Promise<void> {
    this.preparada = false;
    await this.page.goto(this.urlAbandono, { waitUntil: 'domcontentloaded' });
  }
}
