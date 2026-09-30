# portfolioeditor — preferências do dono

- Pode commitar e dar push direto na `master`. Não precisa criar branch nem abrir PR, e não precisa pedir confirmação para isso.
- Isso vale para todas as sessões (nuvem inclusive) e sobrepõe o padrão de "desenvolver em branch separado" quando a tarefa não pedir um branch específico.
- **Autonomia total (pedido do Lucca, 30/09/2026):** fazer o processo inteiro sozinho, sem consultar entre as etapas — puxar a versão mais atual, aplicar, testar, commitar e publicar. Vale para os três repositórios: este (`master`), o site `luccatuelher/portfolio` (`main`, publicação em produção pelo GitHub Pages) e o backup `luccatuelher/portfolio-backup` (`main`). No fim, só relatar o que foi feito.

## Os três repositórios

- **Este** — o editor. Push na `master` publica o editor no GitHub Pages.
- **`luccatuelher/portfolio`** — o site no ar: `index.html` (autocontido) + `compartilhar.jpg`.
- **`luccatuelher/portfolio-backup`** (privado) — `portfolio-backup.json`, a versão mais atual do conteúdo. O editor do Lucca envia para lá sozinho (1 min depois de cada edição) e **carrega de lá sozinho** quando o arquivo muda por fora (ao abrir, ao voltar para a aba, a cada 3 min), guardando o que estava aberto em Versões.

Na nuvem, anexe os dois com `add_repo` e clone ao lado deste (`../portfolio`, `../portfolio-backup`).

## Fluxo

1. **Sempre começar pela versão mais atual:** `git pull` nos três. O conteúdo vem do backup, não dos fixtures.
2. **Código do editor:** testes (`npm run typecheck`, `npm test`, e2e relevante) → `npm run build:editor` → commit/push na `master`.
3. **Conteúdo ou layout do site:** editar o JSON do backup (formato `portfolio-v4-backup`; validar com `parseBackup`) →
   `CHROMIUM_PATH=/opt/pw-browsers/chromium npm run publicar:site` (gera `../portfolio/index.html` + `compartilhar.jpg` pelo mesmo caminho do "Baixar site") →
   commit/push na `main` do `portfolio` → gravar o mesmo backup em `../portfolio-backup/portfolio-backup.json` com `savedAt` novo e dar push (o editor do Lucca carrega sozinho).
4. Antes do push no backup, `git pull` de novo: se o Lucca editou nesse meio-tempo, reaplicar a mudança por cima da versão dele.
5. **CV** (o botão "Baixar CV" do site aponta para `cv.pdf`): editar `cv/cv.html` → `CHROMIUM_PATH=/opt/pw-browsers/chromium npm run gerar:cv` (gera `../portfolio/cv.pdf`, A4, uma página; falha se passar da página) → commit/push na `main` do `portfolio`. Fonte do conteúdo: o CV de ago/2025 do Drive + os projetos do portfólio; o LinkedIn não abre da nuvem (rede bloqueada) — o histórico novo precisa vir do Lucca (PDF do perfil no Drive).

**NDA:** a senha fica só no navegador do Lucca. Sem `PUBLISH_NDA_PASSWORD`, o `publicar:site` reaproveita o pacote cifrado do site no ar (a senha dos visitantes não muda); mudanças no conteúdo NDA só vão ao ar quando ele publicar pelo editor.
