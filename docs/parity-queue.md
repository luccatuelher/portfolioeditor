# Fila de paridade com o site antigo

Funções do site antigo (`portfolio.html` / legado) a trazer para o v4. Comparado em 2026-09-18.

## ✅ Feitas nesta rodada
1. **Importar backup do app antigo (v3)** no editor — o botão Importar migra na hora (`parseBackup` → `migrate`).
2. **Salvar edições localmente** — autosave no IndexedDB (doc + imagens); sobrevive ao recarregar (`useLocalDraft` + `loadLocalDraft`).
3. **Filtro de projetos por categoria** (Todos / Profissionais / Pessoais) para o visitante.
4. **Metadados no detalhe do projeto** — tag, ano, cliente, papel, categoria, competências, contribuição, créditos, sequência, formato, processo.
5. **Telefone no contato** (link `tel:`).
6. **Enviar/trocar imagem** no bloco de imagem (upload + compressão WebP no navegador).
7. **CRUD de itens de coleção** — criar/editar/excluir projeto, nota, imagem de galeria e sketch; inspector de item com título/descrição/data/resumo/ficha técnica/legenda/alt/visibilidade/destaque, selecionável pelo painel Páginas e pela tabela Dados.
8. **Upload de thumb/imagem de item** — capa de projeto/nota e imagem de galeria/sketch (banner da Home também, por ser um bloco de imagem). *Falta: imagem do bloco de contato.*

## ✅ Também feitas (2ª rodada)
9. **Preview de projeto na Home (popup inline)** — clicar no card abre a prévia com as seções do projeto + "Ir para o projeto" + fechar; toggle "Prévia inline" no inspector do bloco de coleção.
10. **Reordenar seções** por arrastar (dnd nas Layers).
11. **Reordenar itens** — arrastar projetos e notas (painel Páginas); setas ↑/↓ na galeria e sketches (painel Dados).
12. **Cabeçalho no editor** — nome/role/nav no canvas; clicar edita o site (nome/função) no inspector.
13. **Criar elementos de forma intuitiva** — botão "＋ Adicionar bloco" inline no canvas, em cada seção.
14. **Contato completo** — telefone, CV (rótulo + link), foto (upload) e redes sociais (adicionar/remover) no inspector.

## ✅ Também feitas (3ª rodada — fila de baixa prioridade)
15. **Home-visible granular** — cada seção do projeto tem "Ocultar na prévia da Home" (inspector da seção); a prévia da Home respeita isso. Somado ao "destaque" que escolhe quais projetos entram na Home.
16. **Galeria dedicada (masonry)** — a coleção de galeria agora usa layout em colunas (masonry) com lightbox.
17. **NDA no nav com cadeado 🔒** — a página NDA aparece no menu (site e editor) com cadeado; navegável no editor pelo painel Páginas.
18. **Badges de estado nos cards do editor** — Destaque / Rascunho / NDA nos cards de projeto, nota, galeria e sketch.
19. **Arrastar galeria/sketches** — alça de arrastar no painel Dados (dnd-kit), além do drag de projetos/notas e seções.

## ⏳ Refinos opcionais restantes
- Reordenar por drag **na prévia da Home** direto no canvas (hoje via painéis/inspector).
- Masonry com balanceamento de colunas mais fino.

> ⚠️ Ao mudar renderer/schema, rode `npm run gen:shell` para o botão "Baixar site" seguir válido (o `build:editor` já faz via prebuild).

## Observações
- O caminho mais rápido para o usuário recuperar TODO o conteúdo antigo (textos + imagens) é **Importar** o backup do app antigo — isso já traz projetos, imagens, galeria, sketches, notas e textos migrados.
- A fila acima é sobre reconstruir as *ferramentas de edição/apresentação* que ficaram faltando no editor v4.
