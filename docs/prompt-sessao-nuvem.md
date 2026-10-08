# Prompt — loop de melhoria contínua do portfólio (sessão na nuvem)

> **Como usar:** abra uma sessão do Claude Code na nuvem apontando para este
> repositório e cole como prompt: *"Leia `docs/prompt-sessao-nuvem.md` e siga
> tudo o que está lá."* — ou cole o documento inteiro, da seção 1 em diante.
> Ele reúne o que antes estava espalhado na memória local da sessão (que não
> vai para a nuvem).

---

## 1. Sua tarefa

Avalie o código do portfólio (editor + site publicado) como um todo e faça
**uma melhoria contínua por rodada**: escolher a próxima melhoria de maior
valor, implementar, testar (typecheck, vitest, e2e relevante), rodar
`npm run build:editor`, commitar e seguir para a próxima rodada **sem parar
nem consultar o Lucca**. Depois de cada rodada, um relatório curto em
português (seção 5, passo 9). Pare só se ele pedir.

## 2. Comece por aqui — estado em 30/09/2026

- A rodada 85 está **feita e na `master`** (`4ad2717`): as 8 listas
  arrastáveis reordenam pelo teclado (`src/editor/listaOrdenavel.ts`).
  Guardas: `e2e/f68-reordenar-teclado.spec.ts` e `test/lista-ordenavel.test.ts`.
  397 testes unitários passam.
- O Lucca autorizou **commitar direto na `master`** (`portfolioeditor`) e na
  `main` (`portfolio`), sempre; sem PR (ver `CLAUDE.md`). Faça `git push` ao
  fim de cada rodada. Ele também mexe na `master` entre as sessões: sempre
  `git pull --rebase origin master` antes de começar e antes de dar push.
- **Ambiente da nuvem:** `npx playwright install` não funciona; o Chromium
  está em `/opt/pw-browsers/chromium`. Use um `playwright.local.config.ts`
  (fora do git, em `.git/info/exclude`) que importa `playwright.config` e põe
  `launchOptions.executablePath: '/opt/pw-browsers/chromium'`.
- O `e2e/f7b` precisa do `dist-editor`: rode `npm run build:editor` antes.

## 3. O projeto

- **O quê:** editor visual do portfólio **bilíngue (PT/EN)** de storyboard do
  Lucca Tuelher, e o site que ele publica. O site sai como **um
  `index.html` autocontido** (imagens em data URL), feito para o **GitHub
  Pages**, mais arquivos ao lado quando preciso (`compartilhar.jpg`,
  `cv.pdf`). O Lucca usa o editor **standalone** `dist-editor/editor.html`
  (aberto do disco); o rascunho vive no IndexedDB do navegador.
- **Pilha:** React 19, Vite, TypeScript, zod (só no editor), immer,
  dnd-kit, Tiptap. Testes: Vitest (+ jsdom quando preciso) e Playwright
  (Chromium). axe-core só em desenvolvimento.
- **Mapa:**
  - `src/schema/v4.ts` — o formato dos dados (zod); `defaults.ts`.
  - `src/migrate/` — site antigo (v3) → v4; `repair.ts`, `upgrade.ts`.
  - `src/state/store.ts` + `src/editor/useDocument.ts` — documento com
    desfazer/refazer por patches e transações.
  - `src/editor/` — editor (Editor.tsx, Inspector.tsx, painéis, diálogos).
  - `src/renderer/` — o site (usado no canvas do editor **e** no site
    publicado): `blocks.tsx`, `Page.tsx`, `Site.tsx`, `Header.tsx`,
    `styles.css`, `ui.ts` (textos da interface), `theme.ts`.
  - `src/publish/` — publicação: `publicSnapshot` → `buildPayload` →
    `assemble` (+ `prerender`, `nda`, `preflight`, `peso`, `imagemSocial`).
  - `src/dev/site-entry.tsx` — o runtime do site publicado.
  - `src/core/` — módulos puros (links, visibilidade, camposTexto,
    contraste, miniaturas, dimensões de imagem…).
  - `fixtures/` — `template-v3.json` (exemplo principal) e
    `legacy-synthetic-v3.json` (tem NDA e rascunhos).

## 4. Comandos

```bash
npm ci
npx playwright install --with-deps chromium
npm run typecheck
npm test                 # vitest, ~30 s
npm run e2e              # playwright, ~1,5 min; servidor Vite na porta 5199
npm run gen:shell        # regera src/publish/site-shell.html (runtime do site)
npm run gen:preview      # regera src/editor/preview.generated.css
npm run build:editor     # dist-editor/editor.html (roda gen:shell + gen:preview antes)
PUBLISH_FIXTURE=template-v3.json node scripts/publish.mjs   # site de exemplo em dist/site.html
```

O Playwright sobe o servidor com `npm run dev -- --port 5199` e reaproveita
um que já esteja rodando. Se ele falhar ao subir (no Windows falhava), suba
antes em segundo plano: `node node_modules/vite/bin/vite.js --port 5199 --strictPort`.

## 5. Cada rodada, passo a passo

1. **Escolher** a melhoria de maior valor para quem usa: o Lucca no editor
   ou quem visita o site (recrutador, cliente, celular, rede lenta, leitor
   de tela, visitante em inglês). Fontes boas: sondagens (auditoria axe,
   contraste, "todo controle faz efeito", medições de tempo e peso), o que
   uma guarda nova revela, e a seção 10. Nada especulativo: com evidência.
2. **Diagnosticar com evidência** — reproduzir, medir (antes/depois com
   números), olhar no navegador.
3. **Corrigir a causa**, com **um mecanismo só** (seção 7) — não remendo
   caso a caso.
4. **Guarda:** teste que falha sem a correção. **Confirme** revertendo a
   correção por um instante e vendo o teste falhar.
5. **Regenerar** o que é gerado: `npm run gen:shell` se o runtime do site
   mudou (renderer, `site-entry`, `publish`/`core` usados por ele) —
   `test/site-shell` falha se esquecer; `npm run gen:preview` se o CSS do
   site mudou.
6. **Testar tudo:** `npm run typecheck`, `npm test`, `npm run e2e`. Descarte
   as mudanças em `e2e/__screenshots__/` (`git checkout -- e2e/__screenshots__`).
7. `npm run build:editor`.
8. **Commit em português.** Título = o resultado para quem usa. Corpo: o
   problema (com números), o que mudou, as guardas. Última linha:
   `Co-Authored-By: Claude <noreply@anthropic.com>` (ou a linha de
   atribuição que a sessão indicar). Sem identidade no git:
   `git -c user.name="Lucca Tuelher" -c user.email="luccatuelher@yahoo.com" commit …`.
9. **Relatório ao Lucca** em português simples: o que estava errado, o que
   mudou, números medidos, testes (quantos passam), e que a próxima rodada
   começa. Sem jargão desnecessário.
10. Próxima rodada.

## 6. Preferências do Lucca (regras)

- **Correção estrutural, não remendo:** perguntar "que classe de bug é essa
  e onde mais aparece?"; um mecanismo + um teste de guarda.
- **Comportamento universal:** mudou como um elemento se comporta? Vale para
  todos os equivalentes, em todas as páginas (blocos, itens de coleção,
  quadros de storyboard, cabeçalho).
- **Escolher em vez de digitar:** listas com sugestões; nada de campo falso.
- **Nenhum controle sem efeito** (guarda `f67`).
- Selos "★ Destaque", "Rascunho" e "NDA" dos cards são **só do editor**.
- Site no **GitHub Pages**, sem domínio próprio; endereço do site e
  analytics são opcionais.
- **Sempre** `npm run build:editor` ao terminar.
- Relatórios em português, com números medidos; nada de pedir permissão
  entre rodadas.

## 7. Mecanismos únicos — use estes, não reinvente

- **Links internos** pelo id (`src/core/links.ts`: `hrefPublico`,
  `rotaCanonica`, `linksDoDocumento`, `problemaDoLink`).
- **Transação** no histórico: ação de várias etapas = 1 desfazer
  (`doc.transacao`); `semHistorico` para registro técnico.
- **Textos bilíngues** numa lista só (`src/core/camposTexto.ts`, `CampoId`):
  canvas, Traduções e conferência usam ela. Campo bilíngue novo entra em
  `camposDoBloco` (ou em `FORA_DE_PROPOSITO` do teste, com o porquê).
- **Foco num campo**: `irParaCampo(alvo, campo)` (`src/editor/focoCampo.ts`).
- **Textos da interface do site** só por `useUi()/textoUi` (`src/renderer/ui.ts`).
- **Avisos e perguntas**: `useAvisos()` (`src/editor/avisos.tsx`) — nada de
  alert/confirm/prompt.
- **Vai para o site?** `src/core/visibilidade.ts`: `vaiProSite`, `aberto`,
  `paginaVaiProSite`, `blocosQueVaoProSite`. Nada de `visibility === …` solto.
  A conferência recebe o documento inteiro quando o NDA é publicado.
- **Imagens no IndexedDB** uma por registro; poda só na abertura.
- **Rascunho protegido**: `src/editor/armazenamento.ts` (pede armazenamento
  persistente; faixa + backup).
- **Tamanho das imagens** pelo cabeçalho: `src/core/dimensoesImagem.ts`
  (`completarDimensoes` na migração, no editor e na publicação).
- **Ordem do `index.html`**: Home pré-renderizada em PT e EN (script
  `ESCOLHER_IDIOMA` no `<head>`, mesma regra de `initialVisitorLang`) →
  dados → fotos da Home uma por `<script>__IMG__()` → runtime `module async`
  → demais imagens → NDA cifrado. O runtime lê `window.__ASSETS__` ao vivo.
- **Miniaturas** para grades (`src/core/miniaturas.ts`, `<id>-mini`, só ao
  publicar pelo editor); **um resolvedor** `resolverDoMapa`.
- **Pacote NDA** binário: `selarPacoteNda`/`abrirPacoteNda`.
- **Imagem de compartilhamento**: `compartilhar.jpg` ao lado
  (`src/publish/imagemSocial.ts`); a imagem de SEO não vai embutida.
- **Cor de texto legível**: `legivel()` gera `--ink-pale-texto` e
  `--accent-texto`; no editor, texto secundário = `--ed-texto-2`.
- **Escala tipográfica**: todo `font-size` do site é
  `calc(… * var(--escala-texto, 1))` (títulos também `* var(--escala-titulos, 1)`).
- **Card que abre algo** sem ser link: `TituloQueAbre` (o título é o
  `<button>`) — nada de `role="button"` com botões dentro.
- **Endereço que não existe**: `resolveRoute` → `naoEncontrado`; página
  `NaoEncontrado` (com a senha do NDA ali, se for o caso).
- **Enviar ao portfólio** (`src/editor/githubSite.ts` + `EnviarSiteModal`): o botão ao lado de "Baixar site" grava `index.html` e `compartilhar.jpg` na `main` do repositório do site pela API do GitHub (token só no navegador, `portfolio-v4:github-site`; sem ele, tenta o token do backup). Pula arquivo idêntico (sha de blob do git), `index.html` por último. O caminho de gerar o site é o mesmo do "Baixar site" (`gerarSite(senha, 'baixar' | 'enviar')`).
- **Download** de arquivo gerado: `baixarArquivo()` (Editor.tsx).
- **Auditoria axe nos e2e**: `auditarAcessibilidade(page, onde)` de
  `e2e/helpers/axe.ts`.

## 8. Guardas que já existem — não enfraqueça; estenda

Unitários (`test/`): `campos-texto-cobertura` (preenche todo bilíngue
opcional pelo schema), `visibilidade`, `ui-dicionario`, `contrast` (CSS do
site sem cor de texto crua), `editor-contraste` (4,5:1 nos painéis),
`tema-com-efeito` (toda variável do Tema usada; font-size escalado),
`site-shell` (runtime embutido em dia), `preview-css` (gerado em dia; nada
antes do `@import`), `renderer` (CSS sem `!important`), `assemble`,
`miniaturas`, `imagem-social`, `nda-pacote`, `preflight-nda`, `peso`.

E2E (`e2e/`): `f58-site-inteiro` (toda rota × idioma: sem erro, um `h1`,
contraste medido, axe, espaço das imagens), `f59-editor-inteiro` (toda
página/elemento/aba + axe), `f61`/`f62`/`f65` (o que aparece antes do
runtime; servidor que pausa o arquivo), `f64` (miniaturas ponta a ponta),
`f66` (compartilhar.jpg), `f67-controles-com-efeito` (todo campo do
Inspector, Tema e fichas muda o canvas — exceções listadas com o porquê),
`f34`/`f56` (janelas: modal de verdade + axe).

## 9. Armadilhas conhecidas

- **Runtime desatualizado:** mudou o site e não rodou `gen:shell` → o editor
  publica o runtime antigo (e `test/site-shell` falha). Rode antes do e2e.
- Build do Vite **dentro** do Vitest precisa de `NODE_ENV=production`
  (o `test` muda o React embutido).
- `playwright.config` usa `storageState: e2e/fixtures/navegador-com-backup.json`
  (backup "recente") para a faixa de proteção não entrar nos testes; quem
  precisa do navegador limpo usa `test.use({ storageState: { cookies: [], origins: [] } })`.
- E2E **sem internet**: a config bloqueia todo host fora do localhost
  (`--host-resolver-rules`).
- **Esc no editor seleciona o elemento pai** — não use Esc entre campos num
  teste; tire o foco (`blur`).
- Antes do runtime existem **duas Homes pré-renderizadas** (uma escondida):
  seletores nessa fase precisam de `:visible`.
- CSS do site: sem `!important`; no `editor.css`, **nenhuma regra antes do
  `@import`** da prévia (senão a prévia de tablet/celular some, sem erro).
- `npm run build:editor` sobrescreve `dist/site.html` com o site **sem
  dados**; para ver o exemplo, republique (comando na seção 4).
- Download no navegador: teste pelo Playwright (`waitForEvent('download')`);
  o arquivo baixado vem sem extensão — salve como `.html` para abrir.
- Vitest silencia `console.log`: para sondar, grave num arquivo temporário.
- `.tb-btn` é estilo da barra **escura**; dentro de `.modal` o secundário
  tem regra própria clara.
- (Só no Windows) `git stash`/`checkout` devolve arquivos com CRLF, e o
  heredoc do Bash come barras invertidas — código com regex, escreva com a
  ferramenta de edição de arquivo.

## 10. Ideias para as próximas rodadas

Feitas nas rodadas 87–89: folha de impressão (item 4 antigo), miniaturas no
NDA (item 1), arrastar cards na Home (guarda), mover bloco entre seções.

Avaliadas e **descartadas com evidência** (não refazer sem fato novo):
- *Canvas do editor com fotos inteiras*: no backup real são 20 imagens, só 6
  acima de 1200 px, ~55 MB decodificadas no pior caso — sem problema.
- *`srcset` por largura*: o site é um arquivo só com as imagens embutidas;
  mais tamanhos só deixariam o arquivo maior (todo visitante baixa tudo).
- *Masonry da galeria*: a galeria é a grade de 12 colunas com largura por
  item; no conteúdo real são 2 itens iguais — nada a equilibrar.
- *Vitest ~30 s*: hoje roda em ~10 s neste ambiente.
- *`f67` `SO_NOS_CARDS` conferidos na lista*: os 3 campos funcionam; a
  navegação extra deixaria o e2e lento e instável por ganho pequeno.

Ainda em aberto (só com pedido do Lucca):
- Prévia por rota ao compartilhar (OG por projeto): exigiria páginas-ponte
  por rota e links compartilháveis diferentes do `#rota` de hoje.
- Arrastar blocos entre seções no painel **Layers** (Alt+↑/↓ e Inspector já
  cruzam seções).

## 11. Histórico recente (rodadas 64–84)

| Rodada | Commit | O que mudou |
|---|---|---|
| 64 | `5dc8474` | Fotos com tamanho real (width/height): o site não pula |
| 65 | `6ea0362` | Fotos da Home primeiro (38,6 s → 0,4 s num site de 8 MB em 4G lenta) |
| 66 | `07e5878` | Runtime `async`: link direto para projeto 40 s → 1,8 s |
| 67 | `64c1206` | Pacote NDA binário: imagens NDA ~25% menores |
| 68 | `2262f91` | Rascunho protegido da limpeza do navegador |
| 69 | `fe1bcca` | Legenda nos quadros do storyboard e no bloco Imagem |
| 70 | `e88658e` | Conferência antes de publicar vê o NDA; e2e sem internet |
| 71 | `b84185a` | Texto do site sempre legível (cinza e destaque ajustados no texto) |
| 72 | `9b22d27` | Auditoria axe em toda rota do site; menos movimento |
| 73 | `e200de8` | Editor acessível: contraste, nomes dos campos, regiões |
| 74 | `4bdf5fd` | Cards sem botão dentro de botão (`TituloQueAbre`) |
| 75 | `7936837` | Endereço quebrado diz que não encontrou; NDA pede a senha ali |
| 76 | `662c1ab` | Miniaturas para cards e grades |
| 77 | `eabace8` | Home já chega no idioma de quem visita |
| 78 | `b71f64a` | Botões secundários das janelas visíveis de novo |
| 79 | `97188f4` | Nenhum texto claro demais nos painéis do editor |
| 80 | `0e6ca43` | Guarda do runtime embutido em dia |
| 81 | `45061fc` | Imagem ao compartilhar o link funciona (`compartilhar.jpg`) |
| 82 | `925ed6f` | Tema: tamanho do texto, contraste entre tamanhos e Destaque 2 com efeito |
| 83 | `f84d629` | Guarda: todo campo do Inspector faz efeito; NDA no menu |
| 84 | `4abdda2` | Guarda estendida ao Tema e às fichas; data da nota; nome do vídeo |
| 85 | `4ad2717` | Listas do editor reordenam pelo teclado (↑/↓, Espaço, Esc) |
| 86 | `a649112` | Site abre a rota do endereço de agora, mesmo se ele mudar durante o boot (o `f62` deixa de falhar 1 em 3) |
| 87 | `1b02e3a` / `0f9af28` | Print stylesheet: "Save as PDF" of any page prints without menu, flags, lightbox or dark background; videos print as name + address |
| 88 | `90b28dc` | NDA thumbnails; images used only as a card cover ship without the full photo (public file and NDA package); NDA package stays self-contained |
| 89 | `02b2253` / `25a3386` | Alt+↑/↓ and Subir/Descer move a block across sections; selection follows (also on undo); Home card drag guarded by e2e |
