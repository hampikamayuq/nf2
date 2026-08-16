import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium, type Browser, type Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { empresaPorSlug } from '../../core/empresas/index.ts';
import { montarNota, type LinhaPlanilha, type Nota } from '../../core/nota.ts';
import { falhasReais, verificarPasso } from './doctor.ts';
import { PortalDriver } from './driver.ts';
import { hojeBR } from './formatos.ts';
import { preencherPasso1 } from './passo1.ts';
import { preencherPasso3 } from './passo3.ts';

// --- Testes com navegador real: só rodam com RUN_BROWSER_TESTS=1 (não entram no CI). ---
// Mesmo padrão de sessao.test.ts:
//   RUN_BROWSER_TESTS=1 PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome npm run test:browser
const RODAR_TESTES_DE_NAVEGADOR = process.env.RUN_BROWSER_TESTS === '1';
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH;

const dirFixtures = join(fileURLToPath(new URL('.', import.meta.url)), 'fixtures');
const urlFixture = (nome: string) => pathToFileURL(join(dirFixtures, nome)).href;

/** CPF de teste válido pelo dígito verificador — não é de paciente. */
const CPF_TESTE = '529.982.247-25';

function nota(campos: LinhaPlanilha): Nota {
  const resultado = montarNota({ dataAtendimento: '01/08/2026', ...campos }, 1);
  if (!resultado.ok) {
    throw new Error(`Nota de teste inválida: ${resultado.erros.join('; ')}`);
  }
  return resultado.nota;
}

describe.skipIf(!RODAR_TESTES_DE_NAVEGADOR)('page objects contra as fixtures dos 4 passos (navegador real)', () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await chromium.launch({ headless: true, executablePath });
    page = await browser.newPage();
  });

  afterAll(async () => {
    await browser?.close();
  });

  it('dry-run completo da QARA (tomador CPF): passos 1–3 preenchem e o resumo do Passo 4 é raspado', async () => {
    const driver = new PortalDriver(page, { urlInicioDps: urlFixture('passo1.html'), urlAbandono: 'about:blank' });
    const resumo = await driver.prepararNota(
      nota({ empresa: 'qara', cpf: CPF_TESTE, cep: '22041-012', numero: '101', codigoServico: 'MIGUEL RJ' })
    );

    expect(page.url()).toContain('passo4.html');
    expect(resumo.emitente).toContain('QARA');
    expect(resumo.valor).toBe('R$ 650,00');
    expect(resumo.competencia).toBe('16/08/2026');

    const emitida = await driver.emitir();
    expect(emitida.chaveAcesso).toBe('12345678901234567890123456789012345678901234567890');
    expect(emitida.numeroNota).toBe('42');
  }, 60_000);

  it('dry-run completo da CG (percentuais + regime especial + tomador não informado) chega ao Passo 4', async () => {
    const driver = new PortalDriver(page, { urlInicioDps: urlFixture('passo1.html'), urlAbandono: 'about:blank' });
    const resumo = await driver.prepararNota(
      nota({ empresa: 'cg', tipoTomador: 'nao-informado', codigoServico: 'MIGUEL RJ' })
    );
    expect(page.url()).toContain('passo4.html');
    expect(resumo.textoCompleto).toContain('Emitente');

    await driver.abandonar();
    expect(page.url()).toBe('about:blank');
  }, 60_000);

  it('emitir() sem prepararNota() antes é recusado', async () => {
    const driver = new PortalDriver(page);
    await expect(driver.emitir()).rejects.toThrow(/prepararNota/);
  });

  it('Passo 1: competência é HOJE (nunca a data de atendimento) e CPF/CEP entram sem máscara', async () => {
    await page.goto(urlFixture('passo1.html'));
    await preencherPasso1(
      page,
      nota({ empresa: 'qara', cpf: CPF_TESTE, cep: '22041-012', numero: '101', codigoServico: 'DIEGO' }),
      empresaPorSlug('qara')
    );

    const valores = await page.evaluate(() => ({
      competencia: (document.getElementById('DataCompetencia') as HTMLInputElement).value,
      cpf: (document.getElementById('Tomador_Inscricao') as HTMLInputElement).value,
      cep: (document.getElementById('Tomador_Endereco_Cep') as HTMLInputElement).value,
      numero: (document.getElementById('Tomador_Endereco_Numero') as HTMLInputElement).value,
      regime: document.getElementById('RegimeApuracaoSN')?.getAttribute('data-valor'),
    }));
    expect(valores.competencia).toBe(hojeBR());
    expect(valores.cpf).toBe('52998224725');
    expect(valores.cep).toBe('22041012');
    expect(valores.numero).toBe('101');
    expect(valores.regime).toBe('1 - Alíquota efetiva do Simples Nacional');
  }, 30_000);

  it('Passo 3 da CG: regime especial, PIS/COFINS e percentuais vêm do perfil, via fallback de UI', async () => {
    await page.goto(urlFixture('passo3.html'));
    await preencherPasso3(
      page,
      nota({ empresa: 'cg', tipoTomador: 'nao-informado', codigoServico: 'MIGUEL RJ' }),
      empresaPorSlug('cg')
    );

    const valores = await page.evaluate(() => ({
      valor: (document.getElementById('Valores_ValorServico') as HTMLInputElement).value,
      issqn: document.getElementById('Valores_IssqnRegimeEspecial')?.getAttribute('data-valor'),
      pisSt: document.getElementById('Valores_PisCofins_SituacaoTributaria')?.getAttribute('data-valor'),
      tipoTributos: document.getElementById('Valores_TipoValorTributos')?.getAttribute('data-valor'),
      federal: (document.getElementById('Valores_PercentualFederal') as HTMLInputElement).value,
    }));
    expect(valores.valor).toBe('650,00');
    expect(valores.issqn).toBe('6 - Sociedade de profissionais');
    expect(valores.pisSt).toBe('1 - Alíquota básica');
    expect(valores.tipoTributos).toBe('2 - Configurar percentuais');
    expect(valores.federal).toBe('11,33');
  }, 30_000);

  it('doctor: todos os seletores obrigatórios resolvem nas fixtures (mapa e fixtures em sincronia)', async () => {
    const paginas = ['passo1.html', 'passo2.html', 'passo3.html', 'passo4.html'] as const;
    const passos = ['passo1', 'passo2', 'passo3', 'passo4'] as const;
    for (let i = 0; i < paginas.length; i++) {
      await page.goto(urlFixture(paginas[i]!));
      const diagnosticos = await verificarPasso(page, passos[i]!);
      expect(falhasReais(diagnosticos), `${passos[i]} deveria resolver tudo na fixture`).toEqual([]);
    }
  }, 30_000);

  it('doctor: numa página que não é o wizard, os seletores obrigatórios aparecem como quebrados', async () => {
    await page.goto('about:blank');
    const diagnosticos = await verificarPasso(page, 'passo1');
    const quebrados = falhasReais(diagnosticos).map((d) => d.nome);
    expect(quebrados).toContain('dataCompetencia');
    expect(quebrados).toContain('avancar');
  });
});
