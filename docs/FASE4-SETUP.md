# Fase 4 — calibrar os seletores e emitir a primeira nota (PC da clínica)

A Fase 4 entregou o wizard inteiro em código: page objects dos 4 passos,
o mapa de seletores versionado (`src/driver/portal/seletores.ts`), o
`nf doctor` e o `nf emitir` com dry-run por padrão. O que falta é o que só
o portal de produção responde: **quais ids estão certos**. Quase todos os
seletores do mapa estão marcados `confirmado: false` — são palpites
estruturados a partir das skills, esperando esta calibração. Não é defeito,
é o desenho: o doctor existe para transformar palpite em fato sem emitir nada.

Pré-requisito: o Chrome de setup aberto e logado (passos 1–3 de
`docs/FASE1-SETUP.md`).

## 1. Rode o doctor

```
npm run nf -- doctor --empresa qara
```

Ele abre um rascunho de teste (tomador "não informado", nenhum dado de
paciente), confere seletor a seletor em cada passo, avança até o Passo 4 e
**para antes do botão de emitir** — nunca emite nada. A saída mostra `ok` /
`QUEBROU` por campo, com `[id nunca confirmado em produção]` nos palpites.

## 2. Corrija o mapa

Para cada `QUEBROU`: inspecione o campo no portal (F12 → botão direito →
Inspecionar), copie o `id` real e ajuste a entrada correspondente em
`src/driver/portal/seletores.ts`, virando `confirmado: true`. É UM arquivo;
nenhuma page object precisa mudar. Repita o doctor até fechar sem quebra.

Dois detalhes que podem morder:

- **Dropdowns filtráveis** (Município, códigos de tributação, PIS/COFINS,
  Regime, bloco IBS/CBS): o driver clica, digita o valor do perfil e clica
  na opção que contém o texto digitado. Se o portal filtrar por um texto
  diferente do que está no perfil (`src/core/empresas/*.json`), ajuste o
  valor no JSON — é dado, não código.
- Se um passo nem preencher (o doctor avisa "não consegui avançar"), os
  passos seguintes ficam sem verificação naquela rodada. Corrija o que
  quebrou e rode de novo.

## 3. Primeira nota real — dry-run primeiro

Monte uma planilha com UMA linha real (cabeçalho em
`examples/planilha-exemplo.xlsx`) e rode **sem** `--confirm`:

```
npm run nf -- emitir --planilha minha.xlsx --linha 2
```

Ele valida a planilha, confere que a sessão logada é da empresa certa
(CNPJ), preenche os 4 passos de verdade, imprime o resumo do Passo 4 — a
mesma tela que você revisaria — e abandona o rascunho. Nada é emitido.

## 4. Emitir de verdade

Quando o resumo do dry-run estiver certo:

```
npm run nf -- emitir --planilha minha.xlsx --linha 2 --confirm
```

Mesmo com `--confirm` ele mostra o resumo e só emite depois de você digitar
`sim`. A chave de acesso e o número vão para o ledger (`data/ledger.db`,
fora do git). Emitir a mesma nota de novo (mesma empresa + tomador + data +
serviço + valor) é recusado com a explicação de qual registro já existe.

Se algo falhar **depois** do clique de emissão, o registro fica
`in_progress` de propósito: a nota pode ter saído — confira no portal antes
de tentar de novo (a conciliação automática é a Fase 6).

## O que registrar de volta

- A saída completa do `nf doctor` das duas empresas (sem dado de paciente).
- Os ids corrigidos — para o mapa virar `confirmado: true` no repositório.
- O texto exato das opções dos dropdowns, se algum valor de perfil precisou
  mudar (em especial o bloco IBS/CBS, seção 3 do PLANO.md).
