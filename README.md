# Portfolio Editor v4

Editor visual do portfólio e o site que ele gera. Você monta as páginas
arrastando elementos num canvas que é o próprio site; ao terminar, o botão
**Baixar site** entrega um `index.html` único (dados, imagens e código juntos),
pronto para subir no GitHub Pages ou em qualquer hospedagem estática.

Stack: **Vite + React + TypeScript strict**, **Zod** (schema do documento),
**Immer** (estado com desfazer/refazer por patches), **Vitest** e **Playwright**.

> O app v3 original está congelado em [`legacy/index.html`](legacy/index.html);
> o editor v4 abre backups dele e migra na hora
> ([`docs/inventory.md`](docs/inventory.md) tem o mapeamento v3→v4).

## Usar o editor

Abra **`dist-editor/editor.html`** no navegador (é um arquivo só, funciona sem
servidor).

- **Rascunho:** salvo sozinho no próprio navegador a cada mudança. Para levar
  para outro computador ou guardar cópia, use **Backup** (ou `Ctrl+S`), que
  baixa um `.json` com o documento e as imagens; **Importar** abre esse arquivo.
- **Versões:** pontos de retorno com nome, guardados no navegador. Toda vez que
  você gera o site, uma versão automática é criada.
- **Painéis:** à esquerda, *Páginas*, *Layers* (a árvore da página), *Tema*
  (cores, fontes, escala, ícone da aba) e *Dados* (projetos, notas, galeria,
  sketches). À direita, o *Inspector* do que estiver selecionado; com nada
  selecionado, ele mostra os gestos e os atalhos do canvas.
- **Visibilidade:** cada item e cada elemento pode ser *Público*, *Rascunho* (só
  no editor) ou *NDA* (vai cifrado e só aparece no site depois da senha).

## Publicar no GitHub Pages

1. No editor, clique em **Baixar site**. Se houver itens ou elementos NDA, o
   editor pede a senha que vai cifrá-los. Ela não tem recuperação.
2. O arquivo baixado se chama **`index.html`**, que é o que o GitHub Pages abre
   sozinho no endereço do site.
3. No repositório do site: **Add file → Upload files**, arraste o `index.html`
   (ele substitui o anterior) e **Commit changes**. Em cerca de um minuto o site
   atualiza.

O aviso que aparece depois de baixar repete esses passos. Ele também lista os
arquivos que precisam subir junto (ex.: `cv.pdf`, quando o botão do CV aponta
para um arquivo) e alerta se o `index.html` passar de 25 MB, o limite do upload
pelo navegador do GitHub.

## Desenvolvimento

### Node

O Node desta máquina é o **LTS portátil** em
`%LOCALAPPDATA%\nodejs-portable\node-v24.21.0-win-x64`, no PATH do usuário. Se
um shell novo não achar `node`/`npm`:

```bash
export PATH="$LOCALAPPDATA/nodejs-portable/node-v24.21.0-win-x64:$PATH"
```

Sem `npm` no shell, todo script roda direto pelo Node
(`node node_modules/vitest/vitest.mjs run`, `node node_modules/vite/bin/vite.js …`).

### Comandos

```bash
npm install            # dependências
npm run typecheck      # tsc --noEmit (strict)
npm test               # Vitest: schema, migração, publicação, renderer, editor
npm run dev -- --port 5199 --strictPort   # servidor de desenvolvimento
npm run e2e            # Playwright (precisa do servidor acima já rodando)
npm run build:editor   # gera dist-editor/editor.html (roda gen:shell e gen:preview antes)
npm run publish        # gera dist/site.html pela linha de comando
npm run gen:fixtures   # regenera fixtures/template-v3.json a partir do legacy
```

- **Playwright:** a config tenta subir o servidor sozinha, mas neste ambiente é
  mais confiável deixá-lo ligado antes (`npm run dev -- --port 5199 --strictPort`
  em outro terminal). As capturas em `e2e/__screenshots__` são refeitas a cada
  execução e não são comparadas.
- **Build do editor:** `gen:shell` embute o runtime do site publicado no editor
  (`src/publish/site-shell.html`) e `gen:preview` gera o CSS das telas de
  tablet/celular do canvas. Sem eles, o editor gera sites com código antigo.
- **Publicar pela linha de comando:** `PUBLISH_INPUT=caminho/backup.json` escolhe
  o documento (padrão: `fixtures/template-v3.json`) e `PUBLISH_NDA_PASSWORD`, a
  senha do NDA.
- **Testar o arquivo final como ele é:** `node scripts/serve-static.cjs [porta]`
  serve a pasta sem transformar nada.

## Estrutura

```
editor.html · preview.html · site.html   # entradas do Vite (editor, pré-visualização, site)
dist-editor/editor.html   # editor pronto (um arquivo)
dist/site.html            # site gerado pelo `npm run publish`
src/
  schema/v4.ts            # schema Zod do documento + tipos + tema padrão
  migrate/                # v3→v4 (puro), upgrade de versões e reparo de rascunhos estragados
  state/store.ts          # Immer produceWithPatches + desfazer/refazer
  renderer/               # o site: páginas, blocos, cabeçalho, visualizador de imagem
  editor/                 # o editor: canvas, painéis, Inspector, diálogos, rascunho e versões
  publish/                # payload público, NDA cifrado (WebCrypto), preflight, montagem do HTML
  assets/                 # conexão IndexedDB, importImage (WebP) e favicon
  core/ · embed/          # utilitários puros (i18n, ids, sanitização, contraste, embeds)
  dev/                    # pontos de entrada (editor, pré-visualização, site publicado)
test/                     # Vitest
e2e/                      # Playwright (cada arquivo fNN cobre uma frente)
fixtures/                 # template-v3.json (gerado) + legacy-synthetic-v3.json
scripts/                  # gen-shell, gen-preview-css, publish, emit-site, serve-static, gen-fixtures
docs/                     # inventário v3→v4, sistema responsivo, benchmark do editor, backlog
legacy/index.html         # app v3 congelado (referência)
```

O histórico de cada mudança, com o porquê, está no `git log`.
