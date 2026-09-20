# Sistema de largura por dispositivo

Pesquisa e decisões por trás de `src/renderer/responsive.ts`.

## O que os editores conhecidos fazem

| Editor | Modelo | O que vale a pena copiar |
|---|---|---|
| Webflow | Breakpoints em cascata: o valor desce do maior para o menor; cada breakpoint pode sobrescrever | A cascata evita reajustar a mesma coisa 3x; o indicador de "herdado × próprio" é essencial |
| Framer | Breakpoints com layout de pilha; elementos "empilham" no menor | Empilhar por padrão o que tem texto |
| Squarespace (Fluid Engine) | Grade separada para celular, arrastável | Garantir tamanho mínimo utilizável em vez de espremer a grade do desktop |
| Wix Studio | Grade + breakpoints + "escalar proporcionalmente" | Proporção preservada quando o dono montou o arranjo à mão |
| Cargo/Semplice | Colunas fluidas, quase sem controle fino | Simplicidade: poucos controles, bom padrão |

## Modelo adotado

1. **Cascata** — `celular ?? tablet ?? computador`. Ajustar o tablet já resolve o
   celular, salvo se o celular tiver valor próprio.
2. **Piso fluido** — um valor HERDADO nunca pode render um elemento menor que o
   mínimo confortável naquela tela (`MIN_WIDTH`: 150px para miniatura, 200px para
   card com texto). O piso arredonda para um divisor de 12, então a fila fecha.
3. **O explícito é sagrado** — largura arrastada com aquela tela selecionada
   passa intacta, mesmo abaixo do piso.
4. **Arranjo à mão ≠ grade automática** — blocos posicionados numa seção
   (`kind: 'block'`) não sofrem piso: uma fila de cinco logos continua com cinco
   no celular. Miniaturas e cards (`media`/`card`) sofrem, porque ninguém
   escolheu aquele tamanho para o celular — ele foi herdado.

## Onde aparece

- Canvas: a alça de largura escreve na tela selecionada no topo do editor.
- Inspector › Layout › Largura: uma linha por tela, dizendo se o valor é próprio,
  herdado (de quem) ou ajustado pelo piso, com `↺` para voltar ao herdado.
- Publicado: `--span` (computador), `--gc-t` (tablet), `--gc-m` (celular), lidos
  pelas media queries de `styles.css`.

## Coberto por testes

`test/responsive.test.ts` (cascata, piso, snap, limites) e
`e2e/f19-largura-por-dispositivo.spec.ts` (independência entre telas, cascata
visível no inspector, miniaturas legíveis no celular).
