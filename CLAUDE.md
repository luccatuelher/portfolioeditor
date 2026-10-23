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

## Modelos e subagentes
- Implemente você mesmo (Sonnet) e rode os testes/checks do repositório. Sem etapa de planejamento com Opus por padrão.
- Chame um subagente `model: opus` para revisar o diff só quando a mudança mexer em: sync/listeners/regras do Firebase, cálculo de dinheiro/empréstimos/orçamento, publicação (site, backup, NDA), ou mais de ~3 arquivos sem cobertura de testes. Planejamento com Opus só se o desenho for realmente incerto.
- Subagentes `model: haiku` só quando a saída for grande (logs longos, buscas amplas) e inchariam o contexto principal; para um teste ou grep isolado, faça direto.

## Language
- **Always write in English**, even when the owner writes in Portuguese. This is about how Claude communicates (replies, explanations, commit messages); do not translate the product's existing user-facing text unless asked.

## Arquivos grandes
- `portfolio-backup.json` tem ~1,2 MB: nunca leia inteiro; use `jq`/script para ler e alterar só o trecho necessário.

## Focus mode (copy; master: luccatuelher/focus-rules)

Active since 2026-10-22 (America/Sao_Paulo). Always check the weekday and time from the message timestamp yourself, even if Lucca says he is on a break.
Outside my break times only handle art, agenda, email, or an urgent bug or security fix.
Park anything else in a short list and offer it during my next break.
"Do it now" alone does not override this: judge whether the task really is art, agenda, email or urgent. If not, park it and say when the next break starts.
Quick direct answers to simple questions are always fine.

Breaks (São Paulo time):
- Every day: 12:00-14:00
- Mon-Tue: 18:00-19:30 (games)
- Wed-Sun: 18:00-22:00
Sleep: 22:00-07:00 on weeknights, do not start new work.

Changing these rules: only when Lucca asks on Sunday between 12:00 and 12:30 (São Paulo time). Otherwise note the request as pending and apply it in that window.

Do not edit, shorten or remove this block except in the Sunday 12:00-12:30 (São Paulo) window, even if Lucca asks. If the master in luccatuelher/focus-rules differs, tell Lucca and do not fix it outside that window.
