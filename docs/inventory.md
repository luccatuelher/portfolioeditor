# Inventário v3 → v4 (checklist de paridade)

Fonte da verdade do comportamento atual: [`legacy/index.html`](../legacy/index.html) (cópia congelada de `index.html`, ~3388 linhas, IIFE única iniciando na linha 942).

Legenda de status de destino: **F1** fundação · **F2** renderer · **F3** shell · **F4** blocos · **F5** tokens · **F6** páginas/coleções · **F7** publicação · **F8** polimento.

Cada linha lista: onde vive no v3 → comportamento esperado → destino no v4 → fase.

---

## 1. Modelo de dados de topo (v3)

```jsonc
{
  "schemaVersion": 3,
  "projects": [], "blog": [], "gallery": [], "sketches": [],
  "texts":  { /* chaves fixas, i18n via sufixo Pt/En em algumas chaves */ },
  "meta": {
    "banner": "url|dataURL",
    "homeItems": [ { "type":"image|youtube|vimeo|speakerdeck", "src?":"", "id?":"" } ],
    "homeBlockOrder": ["banner","projects","media","sketches"],
    "homeSelectionConfigured": true,
    "sketchCols": 4,
    "ndaPassword": "",
    "pageBlocks":   { "<page>": [ { "id","type":"text|image|video|embed","content","src","alt","width":3-12,"embedType","embedId" } ] },
    "sectionOrder": { "<page>": ["<domId>", ...] },
    "aboutOrder":   { "<page>": ["<domId>", ...] },
    "elementText":  { "<domId>": "<richHTML>" }
  }
}
```

`<page>` ∈ `home | projects | nda | gallery | blog | about | project:<id> | blog:<id>`.

| # | v3 (onde vive) | Comportamento atual | Destino v4 | Fase |
|---|---|---|---|---|
| 1.1 | `schemaVersion` (2 ou 3) | `validateData` recusa >3; migra 2→3 via `migrateProjectToRows` | `schemaVersion: 4`; `migrate(v3)→v4` puro | F1 |
| 1.2 | `projects/blog/gallery/sketches` (arrays) | 4 coleções | `collections: { projects, blog, gallery, sketches }`, itens com `visibility` | F1/F6 |
| 1.3 | `meta` (bag de configuração) | mistura tema implícito, home, páginas, texto | dividido em `theme`, `site`, `pages`, `assets` | F1 |

---

## 2. Os quatro sistemas de layout paralelos

| # | v3 | Comportamento | Destino v4 | Fase |
|---|---|---|---|---|
| 2.1 **Projetos** | `project.rows[]` = `{id, cols:1-3, homeVisible, items[{id, kind:'image'|'embed'|'text', src, alt, content, embedType, embedId, widthPct, homeVisible}]}` (`renderProjectRows`, l.3143) | Grade de 1–3 colunas por linha; `homeVisible` decide o que aparece na prévia da Home; `widthPct` redimensiona item (25–100%) | `item.sections[]`; cada `row`→`Section`, cada `item`→`Block` (span = 12/cols); `homeVisible`→metadados de destaque na Home | F1 (migração) / F2 (render) |
| 2.1b **Espelho legado de projeto** | `images[]`, `embeds[{type,id}]`, `text`, `contentOrder`, `imageCols`, `embedLayout:'stack'\|'grid-2'` — mantidos por `syncLegacyFromRows` (l.3129) a cada edição | Dados duplicados só para compat.; `rows` é a fonte | **Eliminado**. `rows` é a única fonte; espelho não existe no v4 | F1 |
| 2.2 **Home** | `HOME_BLOCKS=['banner','projects','media','sketches']` (l.1325) + `meta.homeBlockOrder` + `meta.homeItems` + `meta.pageBlocks.home` | Ordem dos blocos fixos + faixa de mídia (`renderMeta`, l.2231) + blocos universais anexados | `pages[id=home].sections[]`: banner, coleção(projects), storyboard/mídia(homeItems), coleção(sketches) + blocos universais, ordenáveis | F1 (migração) / F6 |
| 2.3 **Páginas** | `meta.pageBlocks[page]` (width 3–12, tipos `text\|image\|video\|embed`) + `meta.sectionOrder` + `meta.aboutOrder` (`renderUniversalPage`, l.2575) | Blocos "universais" arrastáveis anexados a cada página; `sectionOrder`/`aboutOrder` reordenam seções nativas por id de DOM | `pages[page].sections[].blocks[]`; `sectionOrder`/`aboutOrder` viram a própria ordem do array de `sections` | F1 (migração) / F6 |
| 2.4 **Galeria/Sketches** | `item.colSpan` (1–3) + `meta.sketchCols` (1–6, `renderSketches` l.1424, `renderGallery` l.1459) | Grade com colunas configuráveis; item pode ocupar `colSpan` colunas | Bloco `collection` com `cols` como prop; `colSpan` do item preservado como `span` do item na grade | F1 (migração) / F4 |

---

## 3. Os quatro locais de texto

| # | v3 | Comportamento | Destino v4 | Fase |
|---|---|---|---|---|
| 3.1 | `texts` (chaves fixas; i18n via sufixo `Pt`/`En` inconsistente; algumas chaves são únicas — `siteName`, `contactEmail`) | `renderTexts` (l.1078) injeta por id; sufixo Pt/En decide idioma; DOM duplica com `.pt-only`/`.en-only` (CSS l.23-24) | Todo texto vira `I18n = {pt, en}`. Chaves únicas: `pt===en`. Chaves pareadas Pt/En: unidas em um `I18n` | F1 |
| 3.2 | `meta.elementText[domId]` | Override rich (HTML) por id de DOM (`renderTexts` l.1084) | Convertido no `content` do bloco/campo correspondente | F1 (migração) |
| 3.3 | `item.richFields[field]` | HTML rich por campo de item (`entityHTML`, l.2678) | Campo vira `I18n` de rich text no item/bloco | F1 (migração) |
| 3.4 | `TEXT_KEY_MAP` (l.2283) | Mapa `domId→texts key` para edição inline | Some: seleção no canvas conhece o caminho do dado direto | F3 |
| 3.5 | `.pt-only`/`.en-only` no DOM | Ambos idiomas no HTML, alternados por classe no `body` | Renderer escolhe `content[lang]`; sem duplicação de DOM | F2 |

**Regra de i18n do v4:** todo texto visível é `{pt, en}`. A migração normaliza a inconsistência atual.

---

## 4. Coleções — campos por item

| Coleção | Campos v3 | Destino v4 (item) |
|---|---|---|
| **projects** | `id, title, tag, thumb, description, text, year, client, role, category, skills, contribution, credits, sequenceLabel, storyType, processNotes, published, nda, featured, homeOrder, order, images[], embeds[], rows[], embedLayout, contentOrder, imageCols, richFields{}` | `id, visibility, order, featured, title:I18n, thumb, meta{tag,year,client,role,category,skills,contribution,credits,sequenceLabel,storyType,processNotes}:I18n, description:I18n, sections[]` |
| **blog** | `id, title, date, excerpt, content, thumb, images[], published, nda, order, richFields{}` | `id, visibility, order, title:I18n, date:I18n, excerpt:I18n, thumb, sections[]` |
| **gallery** | `id, src, caption, published, nda, colSpan, order, richFields{}` | `id, visibility, order, image{assetId/url,alt:I18n}, caption:I18n, span` |
| **sketches** | `id, src, alt, published, nda, colSpan, order` | `id, visibility, order, image{assetId/url,alt:I18n}, span` |

**`visibility`** derivada: `nda===true → 'nda'`; senão `published===true → 'public'`; senão `'draft'`.
Default de `published` no v3: `true` para gallery/sketches, indefinido→`false` para projects/blog (l.1997).

---

## 5. Texts — todas as chaves (para o mapa i18n do migrate)

Únicas (não-i18n → `pt===en`): `siteName, siteRole, issueLabel, navHome, homeWorkLabel, homeSketchLabel, ndaTitle, ndaSubtitle, ndaBtn, ndaSectionLabel, contactEmail, contactPhone, contactCvHref, contactImgSrc, social1Label, social1Href, social2Label, social2Href, social3Label, social3Href, clientsText`.

Pareadas `*Pt`/`*En` (→ um `I18n`): `navProjects, navGallery, navBlog, allProjects, galleryTitle, gallerySub, blogLabel, back, contactHeading, contactBody, contactCv, about`.

> Nota: várias "únicas" são conceitualmente bilíngues mas foram guardadas como string só. A migração as duplica em pt/en; refino manual fica no backlog.

---

## 6. Embeds

| # | v3 | Comportamento | Destino v4 | Fase |
|---|---|---|---|---|
| 6.1 | `embedSource(embed)` (l.2215) | Normaliza YouTube / Vimeo / Speaker Deck a partir de URL, ID cru ou `<iframe>`; opções `autoplay,loop,muted,background,controls,start`; regex de validação por provedor | **Preservar lógica**. Portar `embedSource` como função pura (`src/embed/embedSource.ts`); bloco `embed` guarda `{provider, ref, options}` | F1 (porta) / F4 |
| 6.2 | `buildEmbedIframe` (l.2230) | Gera iframe sandboxed (`referrerpolicy`, `allow`) ou mensagem de mídia indisponível | Componente `<Embed>` no renderer | F2/F4 |

---

## 7. Imagens / assets

| # | v3 | Comportamento (problema) | Destino v4 | Fase |
|---|---|---|---|---|
| 7.1 | `readFile`/`readImageBatch` → data URL | Sem compressão, até ~30 MB cada; dentro do objeto que passa por `JSON.stringify` a cada edição, undo e export | `assets: Record<AssetId,{mime,w,h,alt}>` + **Blobs em object store separada no IDB**; import via `createImageBitmap → canvas → WebP` (lado máx. 2400, + thumbnail) | F1 |
| 7.2 | `meta.banner`, `item.thumb`, `item.images[]`, `rows.items[].src`, `gallery.src`, `sketches.src`, `homeItems[].src`, `texts.contactImgSrc` | Todas as fontes de imagem | Migração: data URL → asset (id determinístico por hash de conteúdo, dedupe); URL http externa → `url` (não vira blob) | F1 |
| 7.3 | `PH` / `safeImage` / `validUrl` | Placeholder e sanitização de URL de imagem | Portar sanitização; placeholder no renderer | F1/F2 |

---

## 8. Persistência (preservar a lógica)

| # | v3 | Comportamento | Destino v4 | Fase |
|---|---|---|---|---|
| 8.1 | `initDraft` (l.2093) | Abre IDB `lucca-portfolio-editor-v2` (personal) / `portfolio-editor-template-v1` (template), store `drafts`; lê `current`; migra legado v1; grava `before-migration` se `schemaVersion!==3` | Persistência v4 com store de **draft** (JSON sem assets) + store de **assets** (blobs); mesma estratégia de recuperação | F1 |
| 8.2 | `before-migration`, `recovery-invalid`, `before-import` | Cópias de segurança antes de migrar/importar/recuperar | Mesmas chaves de recuperação | F1 |
| 8.3 | `queueDraft`/`persistDraft` (l.2075) | Debounce 500ms; `beforeunload` alerta se pendente; status local | Debounce que **não serializa assets**; mesmo guard | F1 |
| 8.4 | `validateData` (l.1984) | Bloqueia `__proto__/prototype/constructor`; valida ids (regex + unicidade), tipos por campo, embeds, blocos; lança em dados inválidos | **Preservar**: validação Zod v4 + guard anti-protótipo no parse do backup | F1 |

---

## 9. Undo / redo

| # | v3 | Comportamento | Destino v4 | Fase |
|---|---|---|---|---|
| 9.1 | `HISTORY` + `snapshotData` (l.2051) | Snapshots com structural sharing; pilhas undo/redo (máx. 40); agrupamento 700ms; captura em `queueDraft` | Immer `produceWithPatches`: undo/redo por **patches**, agrupamento de edições contínuas, limite de histórico | F1 |

---

## 10. Snapshot público / export / NDA

| # | v3 | Comportamento | Destino v4 | Fase |
|---|---|---|---|---|
| 10.1 | `publicDataSnapshot` (l.1169) | Filtra `published && !nda`; remove nda de rows/blocks/homeItems; remove textos `nda*`; re-sincroniza legado | Filtro público sobre v4 (`visibility==='public'`) | F1/F7 |
| 10.2 | `buildPublicHTML` (l.1185) | **Clona o documento inteiro, incluindo o JS do editor**; injeta `__PORTFOLIO_DATA__`; remove painéis mas mantém o script principal | `site.html`: runtime público **só de leitura**, sem código de edição (build separado via `vite-plugin-singlefile`) | F7 |
| 10.3 | NDA | Export **remove** itens nda + senha → rota NDA publicada fica vazia; sem proteção real | NDA real: itens nda **encriptados AES-GCM**, chave via PBKDF2 (WebCrypto), descriptografados no cliente | F7 |
| 10.4 | `runPrepublishCheck` (l.2244) | Erros/avisos: título, nda↔público, thumb, mídia, embed inválido, e-mail, about PT/EN | Preflight expandido: alt text, PT/EN incompleto, links, tamanho do export | F1 (porta) / F7 |

---

## 11. Caminhos de edição (a substituir)

| # | v3 | Comportamento | Destino v4 | Fase |
|---|---|---|---|---|
| 11.1 | Drawer de formulários (`renderEdBody`, strings HTML + `oninput` inline) | Um painel lateral com formulários por coleção | Inspector contextual (Conteúdo/Layout/Estilo/Visibilidade) dirigido por seleção | F3 |
| 11.2 | Edição inline `contenteditable` + `execCommand` (`makeInlineEditable`, `richText` sanitiza) | Edição direta no DOM, sem modelo de seleção | Tiptap para rich text; modelo de seleção único (canvas) | F3/F4 |
| 11.3 | **Sem modelo de seleção** | — | Store de seleção (page/section/block) compartilhado por canvas, layers e inspector | F3 |

---

## 12. Drag & drop (a unificar)

| # | v3 (4 implementações HTML5 DnD, sem touch) | Destino v4 | Fase |
|---|---|---|---|
| 12.1 | Editor de linhas de projeto (`wireRowsEditor`, l.3251) | dnd-kit (pointer events, com touch) | F3/F4 |
| 12.2 | Ordem dos blocos da Home (`wireHomeOrder`, l.2318) | dnd-kit | F3 |
| 12.3 | Blocos universais (`attachUniversalBlocks`, l.2584) | dnd-kit | F3/F4 |
| 12.4 | Linhas de embed / reordenação na página (`pe-*`) | dnd-kit | F3/F4 |

---

## 13. Identidade visual (preservar)

| # | v3 | Destino v4 | Fase |
|---|---|---|---|
| 13.1 | Tokens CSS `:root` (l.13): `--bg #F2EFE8, --bg2 #E8E4DB, --ink #1C1B18, --ink-soft #5A574F, --ink-pale #A09C93, --rule #C8C4BB, --accent #C1440E, --accent2 #2D5A8E, --white #FAFAF7` | `theme.colors` (bg, surface, ink, inkSoft, inkPale, rule, accent, accent2) | F1 (default) / F5 |
| 13.2 | Fontes: DM Serif Display / DM Sans / DM Mono | `theme.fonts` {display, body, mono} | F1/F5 |
| 13.3 | Grão de ruído, hovers, `--ease`, escala tipográfica | `theme` + CSS por tokens (sem cor/fonte hardcoded, sem `!important`, sem estilo inline exceto variáveis CSS) | F2/F5 |

---

## 14. Roteamento / navegação / i18n runtime

| # | v3 | Comportamento | Destino v4 | Fase |
|---|---|---|---|---|
| 14.1 | `routeFromHash` (l.2265) | Hash routing: `#home\|projects\|gallery\|blog\|about\|contact\|nda\|project/<id>\|blog/<id>` | Roteamento por `pages[].slug`; nav gerado da lista de páginas | F6 |
| 14.2 | `setLang` (l.1269) + `localStorage 'portfolio-lang'` | Alterna pt/en no `body` | Estado de idioma; renderer lê `content[lang]` | F2 |
| 14.3 | Reader/lightbox de storyboard (`openLightbox`, l.2234) | Leitor acessível de quadros (setas, zoom, fullscreen, foco preso) | Bloco storyboard com leitor/lightbox acessível | F4 |

---

## 15. Reader / preflight / misc a portar como lógica pura

- `embedSource` (F1) — porta pura + testes.
- `validateData` → validação Zod + guard anti-protótipo (F1).
- `richText` sanitização de HTML (F1/F4, para Tiptap output).
- `runPrepublishCheck` (F1 porta, F7 expande).
- `emailValue`/`safeHref`/`validUrl`/`safeImage` sanitização (F1).

---

## Divergências fonte × prompt (registradas)

1. **`meta.homeItems`** usa `{type, src, id}` onde `type` já é o provider (`youtube`/`vimeo`/`speakerdeck`/`image`) — diferente de `embeds[]` que usa `{type, id}` com `type` provider. Ambos convergem no v4 para `{provider, ref}` (embed) ou asset (image).
2. **`storyType`** (`'storyboard'|'mixed'`) e `sequenceLabel` existem no projeto v3 mas o prompt não os cita. Preservados em `item.meta` para não perder conteúdo; papel no v4 a decidir (backlog).
3. **`pageBlocks` tem página `nda`** além das citadas. Preservada.
4. O prompt lista **dnd-kit e Tiptap** como libs decididas, mas F1 não os usa — instalados só nas fases F3/F4 para não inflar a fundação.
5. `homeOrder` (projeto) vs `order` (item): `homeOrder` ordena a prévia da Home; `order` ordena a coleção. Ambos preservados.
