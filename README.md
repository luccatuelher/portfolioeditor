# Portfolio Editor v4

Reescrita do núcleo (modelo de dados, migração, assets, persistência, estado) do
editor de portfólio, rumo a uma UX estilo Figma/Framer. Stack: **Vite + React +
TypeScript strict**, **Zod** (schema), **Immer** (estado + undo/redo por patches).

> O app v3 original está congelado em [`legacy/index.html`](legacy/index.html) e é a
> **fonte da verdade do comportamento atual**. O mapeamento v3→v4 está em
> [`docs/inventory.md`](docs/inventory.md).

## Requisitos: Node

Esta máquina **não tem Node no PATH do sistema** (sem admin). Instalamos o **Node
LTS portátil** em `%LOCALAPPDATA%\nodejs-portable\node-v24.21.0-win-x64` e o
adicionamos ao **PATH de usuário**. Se um shell novo não achar `node`:

```bash
export PATH="$LOCALAPPDATA/nodejs-portable/node-v24.21.0-win-x64:$PATH"
```

## Scripts

```bash
npm install          # dependências
npm test             # Vitest (migração, roundtrip, store, persistência, assets, embed)
npm run typecheck    # tsc --noEmit (strict)
npm run gen:fixtures # regenera fixtures/template-v3.json via jsdom + fake-indexeddb
```

## Estrutura (F0 + F1)

```
legacy/index.html        # app v3 congelado (referência)
docs/inventory.md        # checklist de paridade v3→v4
docs/backlog.md          # itens fora de escopo da fase atual
fixtures/                # template-v3.json (gerado) + legacy-synthetic-v3.json (sintético)
scripts/gen-fixtures.mjs # carrega o legacy em jsdom e extrai APP.data
src/
  core/                  # i18n, hash, ids, imagens, acessores seguros
  embed/embedSource.ts   # porta pura do normalizador de embeds do v3
  schema/v4.ts           # schema Zod v4 + tipos + tema padrão
  migrate/               # migrate(v3)→v4 puro/determinístico + normalização de legado
  assets/                # conexão IndexedDB + importImage (WebP) + favicon
  state/store.ts         # Immer produceWithPatches + undo/redo
test/                    # Vitest
```

## Fases

Ver o prompt do projeto. **Status: F0 + F1 concluídas.** F2+ pendem de aprovação.
