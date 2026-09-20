# Benchmark de editores de site → backlog deste editor

Estudo de Framer, Webflow, Squarespace (Fluid Engine), Wix Studio e editores de
portfólio (Cargo, Semplice, Adobe Portfolio, Format). Documento de trabalho:
cada item diz **o que eles fazem**, **como está aqui** e **o que fazer**, com
esforço (P/M/G) e impacto para um portfólio de storyboard bilíngue.

## Padrões que todos têm e que já existem aqui

| Padrão | Como está aqui |
|---|---|
| Canvas WYSIWYG com seleção → inspector contextual | ✅ `Editor.tsx` + `Inspector.tsx` |
| Árvore de camadas | ✅ `LayersPanel` (seções, blocos, cabeçalho) |
| Grade de 12 colunas com arrastar/soltar e zonas | ✅ `gridOps.ts` (linhas, colunas, pilhas) |
| Tokens globais (cor/fonte/escala) | ✅ `ThemePanel` + `theme.ts` |
| Undo/redo agrupado por gesto | ✅ `state/store.ts` (patches do Immer) |
| Autosave local + backup manual | ✅ `useLocalDraft` + Backup/Importar |
| Biblioteca de elementos (arrastar para o canvas) | ✅ `ElementsPalette` |
| Recorte não destrutivo de imagem | ✅ `CropModal` + `ImageRef.crop` |
| Coleções/CMS (projetos, notas, galeria) | ✅ `collections` + bloco `collection` |
| Área protegida por senha | ✅ NDA cifrado (AES-GCM/PBKDF2) |
| Publicar em 1 clique | ✅ "Baixar site" (single-file, offline) |

## Lacunas (ordenadas por impacto/esforço)

### 1. Pré-visualização responsiva no editor — P, impacto alto
Framer mostra breakpoints lado a lado; Webflow tem seletor desktop/tablet/mobile.
**Aqui:** existem overrides de celular (`responsive.mobile`: largura + ocultar) mas
**não há como vê-los** — o canvas é sempre largura fixa. Editar às cegas.
**Fazer:** seletor de largura do canvas (Desktop / Tablet 768 / Celular 390) que
reaproveita o CSS responsivo real do site. Sem novo schema.

### 2. Seções prontas (section library) — M, impacto alto
Squarespace/Wix/Framer inserem seções completas (hero, sobre, galeria, CTA).
**Aqui:** só blocos isolados; montar uma página do zero é trabalhoso.
**Fazer:** presets que inserem uma seção inteira já composta (hero, texto+imagem,
galeria 3 col., chamada com botão). Reusa `makeDefaultBlock` + `insertSection`.

### 3. SEO por página — P/M, impacto alto (portfólio é vitrine)
Webflow/Framer: título, descrição e imagem social por página.
**Aqui:** só título de aba (agora por página) e OG do site inteiro.
**Fazer:** `page.seo {description, image}` + `<meta>` no publicado (home) e
atualização de `description` ao trocar de rota. Campos no inspector da página.

### 4. Duplicar página — P, impacto médio
Padrão em todos. **Aqui:** duplica seção e bloco, mas não página.
**Fazer:** `duplicatePage` + botão no painel Páginas.

### 5. Guias de alinhamento/snapping — G, impacto médio · FEITO
Fluid Engine/Framer mostram guias ao arrastar. **Aqui:** a grade de 12 colunas já
"snapa" por construção; guias visuais dariam confiança, mas custo alto. **Adiar.**

### 6. Histórico de versões (nomeado) — M/G, impacto médio · FEITO
Framer/Webflow guardam versões publicadas. **Aqui:** undo/redo + backup manual +
cópia de recuperação. **Adiar** (backup já cobre o essencial offline).

### 7. Formulário de contato — G, impacto baixo aqui
Precisa de servidor; o site é um arquivo offline. **Não fazer** (e-mail/links bastam).

### 8. Analytics — P, impacto baixo/médio · FEITO
**Fazer depois:** campo para colar um snippet (Plausible/GA) no `<head>` publicado.

### 9. Acessibilidade e checagem de publicação — P, já parcial · FEITO
Preflight já avisa alt/links/tamanho. **Depois:** contraste de cor dos tokens.

## Execução desta rodada
1, 2, 3, 4 + atalho Ctrl+S (backup) — o resto fica anotado acima.

## Execução (2026-09-19)

- [x] 1. Pré-visualização responsiva (desktop / tablet 768px / celular 412px) na barra superior.
- [x] 2. Biblioteca de seções prontas (6 modelos) na caixa de Elementos.
- [x] 3. SEO por página (descrição + imagem social) usado no site publicado.
- [x] 4. Duplicar página (ícone no hover, em Páginas) + Ctrl+D para bloco/seção.
- [x] 5. Ctrl+S baixa o backup.

Correções encontradas na verificação:

- `structuredClone` não funciona em rascunho do Immer — duplicar bloco/seção/página
  falhava em silêncio. Agora usa `cloneDraft` (JSON).
- A caixa de Elementos (sticky no rodapé do painel) cresceu com as seções prontas e
  cobria os botões das Layers em telas baixas: virou grade de 2 colunas com
  `max-height: 45vh` e rolagem.

Cobertura: 118 testes unitários + 46 e2e (novo `e2e/f15-duplicar-e-preview.spec.ts`).

## Execução (2026-09-19, segunda rodada) — o que faltava

- [x] 5. **Guias de alinhamento.** Ao arrastar (da paleta ou movendo um bloco), o
  canvas mostra as 12 colunas da grade e contorna a seção alvo. Some ao soltar.
  Só CSS sobre `--grid-cols`/`--g0`, então acompanha o tema sem duplicar contas.
- [x] 6. **Histórico de versões.** Botão "Versões" na barra: salvar um ponto de
  retorno com nome, restaurar e apagar. Guarda só o documento (as imagens ficam
  no mapa de assets, que é aditivo), até 20 versões neste navegador; publicar
  grava uma automática, e restaurar grava outra antes de trocar. As automáticas
  são descartadas primeiro quando estoura o teto. O Backup (.json) continua
  sendo a cópia completa para levar embora — está dito na própria janela.
- [x] 8. **Analytics.** Campo no painel Tema para colar o snippet
  (Plausible/GA/Fathom); entra cru no `<head>` do site publicado e em nenhum
  outro lugar. Recusa snippet que feche `</head>`/`</html>`.
- [x] 9. **Contraste.** O painel Tema calcula a razão WCAG dos 6 pares de cor que
  o leitor vê juntos e marca em amarelo (só texto grande) ou vermelho (baixo).

Não feito, por decisão: **7. Formulário de contato** — exige servidor, e o site é
um arquivo único offline.

Cobertura ao fim desta rodada: 128 testes unitários (novos: `contrast`,
`versions`, analytics em `assemble`) e 50 e2e (novo
`e2e/f16-guias-versoes-tema.spec.ts`).
