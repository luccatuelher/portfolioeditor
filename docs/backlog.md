# Backlog

Itens fora do escopo da fase atual, anotados para não virar scope creep.

## Migração / dados (refino pós-F1)
- **Preferência home-visible por linha/item** (`row.homeVisible`, `item.homeVisible`): o conteúdo (imagens/textos/embeds) é preservado nas `sections` do projeto, mas o flag granular de "aparece na prévia da Home" não é carregado. Redesenhar na F6 junto do bloco `collection` da Home (prévia de projeto). — F6
- **`richFields` por idioma**: no v3 são um HTML rich por campo, sem idioma. Na migração viram I18n duplicado (pt=en) no campo correspondente. Rever para permitir rich de fato por idioma no editor. — F4/F5
- **`storyType` / `sequenceLabel`**: preservados em `item.meta`, mas seu papel no v4 (ex.: escolher automaticamente bloco `storyboard` vs `image`) ainda não é usado. — F4
- **`contentOrder` / `imageCols` / `embedLayout`** (espelho legado): ignorados na migração (a fonte é `rows`). Confirmar que nenhum projeto real dependia só do espelho sem `rows` — a fixture sintética cobre esse caminho. — F1 (verificação)
- **w/h dos assets**: a migração grava `w:0,h:0` (pura, sem decodificar). O pipeline `importImage` preenche as dimensões reais ao materializar os Blobs. Definir passo de "backfill" das dimensões ao ingerir os data URLs migrados. — F1/F2

## Renderer / editor
- **Sanitização de rich text sem DOM**: `richText` do v3 depende de DOM. Portar um sanitizador isomórfico (ou usar o schema do Tiptap) antes de aceitar rich text de entrada não confiável fora do browser. — F4
- **Bloco `columns`**: schema mínimo (`{count}`); implementação plena (colunas aninhando blocos) na F4. — F4
- **Bloco `contact`**: hoje concentra e-mail/telefone/CV/sociais. Avaliar quebrar em blocos menores reutilizáveis. — F4

## Publicação
- **NDA real** (AES-GCM + PBKDF2 via WebCrypto), export `site.html` sem JS de edição, meta/OG por página, preflight expandido. — F7
- **`ndaPasswordHint`**: hoje só sinaliza que havia senha; definir fluxo de derivação de chave. — F7

## Deferrals após F3–F8 (tudo abaixo é refino, não bloqueio)
Feito e testado: dnd-kit (reordenar blocos), Tiptap (rich no inspector), paleta de adicionar bloco, copiar/colar, persistência IDB no editor com status, undo/redo por patches, tokens globais (F5), CRUD de páginas + tabela de dados (F6), publicação single-file + NDA AES-GCM/PBKDF2 + meta/OG + preflight (F7), overrides mobile (span/ocultar) + lazy/decoding + estados vazios + a11y básica (F8).

Refinos pendentes:
- **srcset responsivo**: o pipeline gera 1 tamanho + thumb por asset; variantes por largura (srcset) exigem gerar múltiplos tamanhos no import. `loading=lazy`/`decoding=async`/`width`/`height` já entram.
- **Reordenar blocos entre seções** (hoje: dentro da seção via dnd + setas). Arrastar seções inteiras.
- **OG por rota**: o `site.html` é SPA single-file → OG a nível de site. Per-rota exige pré-render por rota.
- **Edição inline no canvas** (contentEditable/Tiptap direto no bloco); hoje rich é no inspector, duplo-clique abre a seleção.
- **Edição do chrome do site** (nome/role/nav, `site.ui`, `textOverrides`) e de `contact.socials`/imagem e frames de storyboard pelo inspector.
- **Recuperação de rascunho no editor**: persistência é escrita-apenas no preview; carregar `current`/`before-migration` no app de produção.
- **Bloco `columns`** com aninhamento real de blocos.
- **Overrides mobile de ordem** (hoje: span + ocultar).
- **Backfill de w/h dos assets** ao materializar data URLs migrados (migração grava 0/0).

## Infra
- **Node portátil**: máquina sem admin; Node LTS foi instalado via ZIP em `%LOCALAPPDATA%\nodejs-portable`. Se o PATH de usuário for limpo, reconfigurar. Ver `README.md`.
- **dnd-kit / Tiptap**: libs decididas mas ainda não instaladas (entram em F3/F4) para não inflar a fundação.
- **Artefatos de build** `editor.html` / `site.html` (`vite-plugin-singlefile`): configurar quando houver renderer (F2+).
