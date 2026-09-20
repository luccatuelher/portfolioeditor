# Plano — funções do portfolio.html ainda faltando no v4

Análise função-a-função do `portfolio.html` (arquivo enviado). A grande maioria já foi portada (ver `docs/parity-queue.md`). Restam apenas conveniências de canvas/leitor:

| Função antiga | Status no v4 | Ação |
|---|---|---|
| readerZoom, readerFull | leitor tem setas/Esc, faltam zoom e tela cheia | **Implementar** (A) |
| makeCardAccessible | cards abrem só por clique (sem teclado) | **Implementar** (B) |
| peAttachResize / addResizeHandle / pe-width-label | largura da imagem só no inspector (widthPct) | **Implementar** alça de resize no canvas (C) |
| peSetupSort / peMarkDraggable (arrastar na página) | reordenar via Layers/painéis (dnd) | **Implementar** duplo-clique p/ editar + nota: arrastar no canvas fica como refino |
| positionToolbar / RTE flutuante | rich text no inspector (Tiptap) | duplo-clique no bloco de texto foca o editor (D) |
| resto (rows, CRUD, filtros, home preview, embeds, NDA, export, undo, upload, etc.) | ✅ já implementado | — |

## Execução — ✅ CONCLUÍDA
- **A. Leitor: zoom + tela cheia** — ✅ botões "Ampliar/Ajustar" e "Tela cheia" no lightbox; clique na imagem também alterna o zoom.
- **B. Cards acessíveis por teclado** — ✅ role=button, tabindex, Enter/Espaço nos cards de projeto e nota.
- **C. Resize de imagem no canvas** — ✅ alça arrastável na borda do bloco de imagem selecionado (widthPct 25–100%).
- **D. Editar texto no canvas** — ✅ clicar no bloco de texto/título torna-o editável **inline** no canvas (contentEditable), com **toolbar flutuante** (negrito/itálico/lista via execCommand) para blocos de texto; grava no idioma atual, sanitizado. Sincroniza com inspector/undo sem saltar o cursor.
- **E. Arrastar blocos no canvas** — ✅ alça de arrastar em cada bloco reordena dentro da seção (HTML5 DnD nativo, sem entrar no bundle público).

Testes: 85 unit + 43 e2e verdes. **Portabilidade do `portfolio.html` 100% concluída** — inclusive os refinos opcionais. Nada pendente.
