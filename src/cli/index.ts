#!/usr/bin/env node
import { Command } from 'commander';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { catalogoDaEmpresa } from '../core/catalogo/index.ts';
import { empresaPorSlug } from '../core/empresas/index.ts';
import { DuplicidadeError, Ledger } from '../core/ledger/ledger.ts';
import { montarNota, type Nota } from '../core/nota.ts';
import type { EmissorDriver } from '../driver/emissor.ts';
import {
  falhasReais,
  formatarDiagnostico,
  formatarElemento,
  inventariarPagina,
  verificarPasso,
  type DiagnosticoSeletor,
} from '../driver/portal/doctor.ts';
import { PortalDriver } from '../driver/portal/driver.ts';
import { hojeBR, somenteDigitos } from '../driver/portal/formatos.ts';
import { esperarPassoCarregar } from '../driver/portal/pagina.ts';
import { avancarPasso1, preencherPasso1 } from '../driver/portal/passo1.ts';
import { avancarPasso2, preencherPasso2 } from '../driver/portal/passo2.ts';
import { avancarPasso3, preencherPasso3 } from '../driver/portal/passo3.ts';
import { VERSAO_MAPA } from '../driver/portal/seletores.ts';
import { urlFixture } from '../driver/portal/fixtures.ts';
import {
  PORTAL_BASE,
  abrirComStorageState,
  abrirNavegadorEnsaio,
  comoPaginaMinima,
  conectarPorCdp,
  exportarSessao,
  garantirSessaoAtiva,
  verificarLogin,
  type SessaoNavegador,
} from '../driver/sessao.ts';
import { lerPlanilha } from './planilha.ts';

const CDP_URL_PADRAO = 'http://localhost:9222';
const LEDGER_PADRAO = 'data/ledger.db';
const LEDGER_ENSAIO = 'data/ledger-ensaio.db';

const AVISO_ENSAIO =
  'MODO ENSAIO — rodando contra as fixtures locais (HTML sintético dos 4 passos). Nada toca o portal.';

function dormir(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Confirmação por stdin que funciona tanto no terminal quanto com entrada
 * canalizada (`printf 'sim' | nf emitir ...`): linhas que chegam antes da
 * pergunta ficam na fila em vez de se perder, e stdin fechado vira resposta
 * vazia — ou seja, recusa. Na dúvida, nunca emite.
 */
function criarConfirmador() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const fila: string[] = [];
  let pendente: ((linha: string) => void) | null = null;
  let fechado = false;

  rl.on('line', (linha) => {
    if (pendente) {
      const resolver = pendente;
      pendente = null;
      resolver(linha);
    } else {
      fila.push(linha);
    }
  });
  rl.on('close', () => {
    fechado = true;
    if (pendente) {
      const resolver = pendente;
      pendente = null;
      resolver('');
    }
  });

  return {
    perguntar(prompt: string): Promise<string> {
      const antecipada = fila.shift();
      if (antecipada !== undefined) {
        console.log(`${prompt}${antecipada}`);
        return Promise.resolve(antecipada);
      }
      if (fechado) return Promise.resolve('');
      process.stdout.write(prompt);
      return new Promise((resolve) => {
        pendente = resolve;
      });
    },
    fechar(): void {
      rl.close();
    },
  };
}

interface OpcoesSessao {
  cdpUrl: string;
  storageState?: string;
}

/** Abre a sessão (CDP por padrão; storage-state no modo container) já posicionada no portal e com login conferido. */
async function abrirSessaoLogada(opts: OpcoesSessao): Promise<SessaoNavegador> {
  const sessao = opts.storageState ? await abrirComStorageState(opts.storageState) : await conectarPorCdp(opts.cdpUrl);
  if (opts.storageState) {
    await sessao.page.goto(PORTAL_BASE, { waitUntil: 'domcontentloaded' });
  }
  try {
    await garantirSessaoAtiva(comoPaginaMinima(sessao.page));
  } catch (err) {
    await sessao.encerrar();
    throw err;
  }
  return sessao;
}

const program = new Command();
program.name('nf').description('CLI de emissão de NFS-e da clínica Qara');

const auth = program.command('auth').description('Gerencia a sessão do gov.br (login é sempre humano)');

auth
  .command('status')
  .description('Confere se a sessão está logada, sem alterar nada')
  .option('--cdp-url <url>', 'Chrome já aberto com --remote-debugging-port (ver docs/FASE1-SETUP.md)', CDP_URL_PADRAO)
  .option('--storage-state <arquivo>', 'Em vez de CDP, verifica uma sessão já exportada (modo container)')
  .action(async (opts: { cdpUrl: string; storageState?: string }) => {
    const sessao = opts.storageState
      ? await abrirComStorageState(opts.storageState)
      : await conectarPorCdp(opts.cdpUrl);
    try {
      // conectarPorCdp já entrega uma aba no portal; abrirComStorageState entrega
      // uma página em branco de propósito (não é dela decidir para onde navegar),
      // então quem precisa checar login no portal navega explicitamente aqui.
      if (opts.storageState) {
        await sessao.page.goto(PORTAL_BASE, { waitUntil: 'domcontentloaded' });
      }
      const resultado = await verificarLogin(comoPaginaMinima(sessao.page));
      console.log(JSON.stringify(resultado, null, 2));
      if (!resultado.logado) {
        process.exitCode = 1;
      }
    } finally {
      await sessao.encerrar();
    }
  });

auth
  .command('login')
  .description('Espera você logar na janela do Chrome de setup e exporta a sessão (nunca loga sozinho)')
  .option('--cdp-url <url>', 'Chrome já aberto com --remote-debugging-port (ver docs/FASE1-SETUP.md)', CDP_URL_PADRAO)
  .option('--out <arquivo>', 'Onde salvar a sessão exportada, para uso no modo container', 'sessions/storage-state.json')
  .option('--timeout <segundos>', 'Quanto tempo esperar pelo login', '300')
  .action(async (opts: { cdpUrl: string; out: string; timeout: string }) => {
    const timeoutMs = Number(opts.timeout) * 1000;
    const sessao = await conectarPorCdp(opts.cdpUrl);
    try {
      console.log(`Aguardando login em ${sessao.page.url()} (até ${opts.timeout}s)...`);
      const inicio = Date.now();
      let resultado = await verificarLogin(comoPaginaMinima(sessao.page));
      while (!resultado.logado) {
        if (Date.now() - inicio > timeoutMs) {
          console.error(`Login não detectado em ${opts.timeout}s. Rode de novo depois de logar.`);
          process.exitCode = 1;
          return;
        }
        await dormir(2000);
        resultado = await verificarLogin(comoPaginaMinima(sessao.page));
      }

      console.log(`Login detectado${resultado.cnpj ? ` — CNPJ ${resultado.cnpj}` : ''}. Exportando sessão...`);
      await exportarSessao(sessao.context, opts.out);
      console.log(`Sessão exportada em ${opts.out} (permissão 600).`);
    } finally {
      await sessao.encerrar();
    }
  });

program
  .command('validar')
  .description('Valida uma planilha de notas linha a linha, sem abrir o navegador')
  .requiredOption('--planilha <arquivo>', 'Caminho do XLSX ou CSV')
  .action(async (opts: { planilha: string }) => {
    const linhas = await lerPlanilha(opts.planilha);
    if (linhas.length === 0) {
      console.log('Planilha sem linhas de dados.');
      return;
    }

    let comErro = 0;
    for (const { numeroLinha, dados } of linhas) {
      const resultado = montarNota(dados, numeroLinha);
      if (resultado.ok) {
        const { nota } = resultado;
        const valor = (nota.servico.valorCentavos / 100).toFixed(2);
        console.log(`linha ${numeroLinha}: OK — ${nota.empresa} · ${nota.tomador.tipo} · ${nota.servico.codigo} · R$ ${valor}`);
      } else {
        comErro++;
        console.log(`linha ${numeroLinha}: ERRO`);
        for (const erro of resultado.erros) console.log(`  - ${erro}`);
      }
    }

    console.log('');
    console.log(`${linhas.length - comErro}/${linhas.length} linhas válidas.`);
    if (comErro > 0) {
      process.exitCode = 1;
    }
  });

program
  .command('doctor')
  .description('Percorre os 4 passos do wizard num rascunho descartável e confere se cada seletor ainda resolve. Nunca emite.')
  .option('--empresa <slug>', 'Perfil usado para preencher o rascunho de teste (qara | cg)', 'qara')
  .option('--cdp-url <url>', 'Chrome já aberto com --remote-debugging-port', CDP_URL_PADRAO)
  .option('--storage-state <arquivo>', 'Em vez de CDP, usa uma sessão exportada (modo container)')
  .option('--ensaio', 'Roda contra as fixtures locais, sem sessão e sem portal (teste do fluxo)', false)
  .option(
    '--descobrir',
    'Não verifica nem preenche: inventaria os campos da página ATUAL da aba do portal (ids, rótulos, botões, opções de dropdown — nunca valores digitados). Avance manualmente no Chrome e rode em cada passo.',
    false
  )
  .action(async (opts: { empresa: string; cdpUrl: string; storageState?: string; ensaio: boolean; descobrir: boolean }) => {
    if (opts.descobrir) {
      const sessao = opts.ensaio ? await abrirNavegadorEnsaio() : await conectarPorCdp(opts.cdpUrl);
      try {
        if (opts.ensaio) {
          await sessao.page.goto(urlFixture('passo1.html'), { waitUntil: 'domcontentloaded' });
        }
        console.log(`nf doctor --descobrir — inventário da página atual (nada é preenchido nem clicado)`);
        console.log(`URL: ${sessao.page.url()}`);
        console.log('');
        const elementos = await inventariarPagina(sessao.page);
        for (const e of elementos) console.log(formatarElemento(e));
        console.log('');
        console.log(`${elementos.length} elemento(s). Cole esta saída para calibrar src/driver/portal/seletores.ts.`);
      } finally {
        await sessao.encerrar();
      }
      return;
    }
    const empresa = empresaPorSlug(opts.empresa);
    // Rascunho 100% sintético: tomador "não informado", primeiro serviço do
    // catálogo, atendimento hoje. Nenhum dado de paciente entra aqui.
    const item = catalogoDaEmpresa(opts.empresa)[0];
    if (!item) {
      throw new Error(`Catálogo da empresa "${opts.empresa}" está vazio.`);
    }
    const resultado = montarNota(
      { empresa: opts.empresa, dataAtendimento: hojeBR(), tipoTomador: 'nao-informado', codigoServico: item.codigo },
      0
    );
    if (!resultado.ok) {
      throw new Error(`Nota sintética do doctor inválida: ${resultado.erros.join('; ')}`);
    }
    const nota = resultado.nota;

    console.log(`nf doctor — mapa de seletores versão ${VERSAO_MAPA}, empresa ${empresa.slug}`);
    console.log('Abre um rascunho de teste, passo a passo, e NUNCA clica em "Emitir NFS-e".');
    if (opts.ensaio) console.log(AVISO_ENSAIO);
    console.log('');

    const sessao = opts.ensaio ? await abrirNavegadorEnsaio() : await abrirSessaoLogada(opts);
    const urlInicio = opts.ensaio ? urlFixture('passo1.html') : `${PORTAL_BASE}/DPS/Pessoas`;
    const urlSaida = opts.ensaio ? 'about:blank' : PORTAL_BASE;
    const todos: DiagnosticoSeletor[] = [];
    let interrompidoEm: string | undefined;
    try {
      const { page } = sessao;
      await page.goto(urlInicio, { waitUntil: 'domcontentloaded' });
      await esperarPassoCarregar(page);

      const etapas = [
        { passo: 'passo1' as const, preencherEAvancar: async () => { await preencherPasso1(page, nota, empresa); await avancarPasso1(page); } },
        { passo: 'passo2' as const, preencherEAvancar: async () => { await preencherPasso2(page, nota, empresa); await avancarPasso2(page); } },
        { passo: 'passo3' as const, preencherEAvancar: async () => { await preencherPasso3(page, nota, empresa); await avancarPasso3(page); } },
        { passo: 'passo4' as const, preencherEAvancar: undefined },
      ];

      for (const etapa of etapas) {
        const diagnosticos = await verificarPasso(page, etapa.passo);
        todos.push(...diagnosticos);
        console.log(`${etapa.passo}:`);
        for (const d of diagnosticos) console.log(formatarDiagnostico(d));
        if (!etapa.preencherEAvancar) break;
        try {
          await etapa.preencherEAvancar();
        } catch (err) {
          interrompidoEm = etapa.passo;
          console.log('');
          console.log(`Não consegui preencher/avançar o ${etapa.passo}: ${err instanceof Error ? err.message : String(err)}`);
          console.log('Os passos seguintes ficaram sem verificação nesta rodada.');
          break;
        }
      }
    } finally {
      // Abandona o rascunho voltando para o painel — nada foi emitido.
      await sessao.page.goto(urlSaida, { waitUntil: 'domcontentloaded' }).catch(() => {});
      await sessao.encerrar();
    }

    const quebrados = falhasReais(todos);
    console.log('');
    if (quebrados.length === 0 && !interrompidoEm) {
      console.log('Todos os seletores obrigatórios resolveram. Pode rodar o lote.');
    } else {
      if (quebrados.length > 0) {
        console.log(`${quebrados.length} seletor(es) obrigatório(s) quebrado(s) — corrija src/driver/portal/seletores.ts antes de emitir:`);
        for (const d of quebrados) console.log(`  - ${d.passo}.${d.nome}: ${d.seletor} (${d.descricao})`);
      }
      process.exitCode = 1;
    }
  });

program
  .command('emitir')
  .description('Preenche o wizard para cada nota da planilha. Padrão: dry-run (para no resumo do Passo 4). Só emite com --confirm + "sim".')
  .requiredOption('--planilha <arquivo>', 'Caminho do XLSX ou CSV')
  .option('--linha <numero>', 'Só a linha N da planilha (o mesmo número que aparece no Excel)')
  .option('--confirm', 'Habilita emissão de verdade (ainda pede "sim" nota a nota, diante do resumo)', false)
  .option('--cdp-url <url>', 'Chrome já aberto com --remote-debugging-port', CDP_URL_PADRAO)
  .option('--storage-state <arquivo>', 'Em vez de CDP, usa uma sessão exportada (modo container)')
  .option('--ledger <arquivo>', 'Banco do ledger', LEDGER_PADRAO)
  .option('--ensaio', 'Roda contra as fixtures locais, sem sessão e sem portal (teste do fluxo; ledger separado)', false)
  .action(async (opts: { planilha: string; linha?: string; confirm: boolean; cdpUrl: string; storageState?: string; ledger: string; ensaio: boolean }) => {
    const linhas = await lerPlanilha(opts.planilha);
    const selecionadas = opts.linha ? linhas.filter((l) => l.numeroLinha === Number(opts.linha)) : linhas;
    if (selecionadas.length === 0) {
      console.error(opts.linha ? `Linha ${opts.linha} não existe na planilha.` : 'Planilha sem linhas de dados.');
      process.exitCode = 1;
      return;
    }

    // Valida TUDO antes de abrir o navegador — nada de descobrir erro na nota 7.
    const notas: Array<{ numeroLinha: number; nota: Nota }> = [];
    let comErro = 0;
    for (const { numeroLinha, dados } of selecionadas) {
      const resultado = montarNota(dados, numeroLinha);
      if (resultado.ok) {
        notas.push({ numeroLinha, nota: resultado.nota });
      } else {
        comErro++;
        console.log(`linha ${numeroLinha}: ERRO`);
        for (const erro of resultado.erros) console.log(`  - ${erro}`);
      }
    }
    if (comErro > 0) {
      console.error(`\n${comErro} linha(s) inválida(s). Corrija a planilha — nenhum navegador foi aberto.`);
      process.exitCode = 1;
      return;
    }

    if (opts.ensaio) console.log(AVISO_ENSAIO);
    const sessao = opts.ensaio ? await abrirNavegadorEnsaio() : await abrirSessaoLogada(opts);
    try {
      if (!opts.ensaio) {
        // A sessão logada é de UM CNPJ; recusa notas de outra empresa antes de preencher qualquer coisa.
        const login = await verificarLogin(comoPaginaMinima(sessao.page));
        if (login.cnpj) {
          const cnpjSessao = somenteDigitos(login.cnpj);
          const foraDaSessao = notas.filter(({ nota }) => empresaPorSlug(nota.empresa).cnpj !== cnpjSessao);
          if (foraDaSessao.length > 0) {
            const linhasErradas = foraDaSessao.map((n) => n.numeroLinha).join(', ');
            console.error(
              `A sessão logada é do CNPJ ${login.cnpj}, mas a(s) linha(s) ${linhasErradas} são de outra empresa. ` +
                'Emita essas notas com a sessão da empresa certa.'
            );
            process.exitCode = 1;
            return;
          }
        } else {
          console.log('Aviso: não consegui ler o CNPJ da sessão na tela — confira se está logado na empresa certa.');
        }
      }

      const driver: EmissorDriver = opts.ensaio
        ? new PortalDriver(sessao.page, { urlInicioDps: urlFixture('passo1.html'), urlAbandono: 'about:blank' })
        : new PortalDriver(sessao.page);

      if (!opts.confirm) {
        for (const { numeroLinha, nota } of notas) {
          console.log(`\n=== linha ${numeroLinha} — dry-run (nada será emitido) ===`);
          const resumo = await driver.prepararNota(nota);
          console.log(resumo.textoCompleto);
          await driver.abandonar();
        }
        console.log('\nDry-run concluído: nenhuma nota foi emitida. Rode com --confirm para emitir.');
        return;
      }

      // No ensaio, um banco separado por padrão: chave/número de fixture nunca
      // podem se misturar com o ledger das notas reais.
      const caminhoLedger = opts.ensaio && opts.ledger === LEDGER_PADRAO ? LEDGER_ENSAIO : opts.ledger;
      mkdirSync(dirname(caminhoLedger), { recursive: true });
      const ledger = new Ledger(caminhoLedger);
      const confirmador = criarConfirmador();
      try {
        for (const { numeroLinha, nota } of notas) {
          console.log(`\n=== linha ${numeroLinha} ===`);
          let registroId: number;
          try {
            registroId = ledger.inserirPendente(nota).id;
          } catch (err) {
            if (err instanceof DuplicidadeError) {
              console.log(`Pulada: ${err.message}`);
              continue;
            }
            throw err;
          }

          let resumo;
          try {
            resumo = await driver.prepararNota(nota);
          } catch (err) {
            // Falha ANTES do clique: nada foi emitido — registra como failed
            // (libera a chave natural) e segue para a próxima nota.
            ledger.marcarEmProgresso(registroId);
            ledger.marcarFalha(registroId, err instanceof Error ? err.message : String(err));
            await driver.abandonar().catch(() => {});
            console.error(`Falha ao preencher (nada foi emitido): ${err instanceof Error ? err.message : String(err)}`);
            process.exitCode = 1;
            continue;
          }
          console.log(resumo.textoCompleto);
          console.log('');
          const resposta = (await confirmador.perguntar('Emitir esta nota? (digite "sim" para emitir) ')).trim().toLowerCase();
          if (resposta !== 'sim') {
            // Recusa vira `failed` (não `pending`): libera a chave natural para uma nova tentativa futura.
            ledger.marcarEmProgresso(registroId);
            ledger.marcarFalha(registroId, 'Recusada na confirmação — nada foi emitido.');
            await driver.abandonar();
            console.log('Ok, não emiti. Rascunho abandonado.');
            continue;
          }

          // A intenção vira in_progress ANTES do clique irreversível: se o
          // processo morrer no meio, sobra rastro para conciliar, nunca silêncio.
          ledger.marcarEmProgresso(registroId);
          try {
            const emitida = await driver.emitir();
            ledger.marcarEmitida(registroId, emitida.chaveAcesso, emitida.numeroNota);
            console.log(`Emitida — número ${emitida.numeroNota}, chave ${emitida.chaveAcesso}`);
          } catch (err) {
            // Depois do clique o estado é DESCONHECIDO: fica in_progress de
            // propósito, para `nf conciliar` (Fase 6) resolver contra o portal.
            console.error(
              `Falha após o clique de emissão (registro ${registroId} segue in_progress no ledger): ` +
                (err instanceof Error ? err.message : String(err))
            );
            process.exitCode = 1;
            return;
          }
        }
      } finally {
        confirmador.fechar();
        ledger.close();
      }
    } finally {
      await sessao.encerrar();
    }
  });

try {
  await program.parseAsync(process.argv);
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
}
