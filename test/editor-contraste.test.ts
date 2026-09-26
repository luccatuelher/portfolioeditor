import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { contrastRatio } from '../src/core/contrast';

/**
 * Guarda estática do contraste do editor: toda cor de TEXTO (color: #…) do
 * editor.css tem de ler bem sobre os fundos claros dos painéis e janelas
 * (#f4f2ec e #fff) — 4,5:1. A auditoria no navegador (axe) só vê o que está
 * na tela no teste; cinzas claros escapavam em telas que ela não abre
 * (#8a867c nos trechos de tradução, #b8b4ab na alça de arrastar…).
 *
 * Ficam de fora as regras de contexto ESCURO, onde texto claro é o certo.
 */
const CONTEXTO_ESCURO = [
  /\.tb-/, // barra do topo
  /\.editor-topbar/,
  /\.lang-toggle/,
  /\.aviso/, // bolhas de aviso (fundo escuro)
  /\.pe-toolbar/, // barra de formatação
  /\.pe-act/, // ícones de ação sobre a imagem
  /\.edit-badge/, // selos coloridos
  /\.tree-row\.sel/, // cor derivada da marca (color-mix) — medida pelo axe
  /\.primary/, // botão na cor da marca
];
const FUNDOS_CLAROS = ['#f4f2ec', '#ffffff'];

describe('contraste do texto no editor (CSS)', () => {
  it('nenhuma cor de texto abaixo de 4,5:1 sobre os painéis claros', () => {
    const css = readFileSync('src/editor/editor.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const ruins: string[] = [];
    // Regras simples "seletores { declarações }" (as de dentro de @media também casam).
    for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const seletor = m[1]!.trim();
      if (CONTEXTO_ESCURO.some((re) => re.test(seletor))) continue;
      for (const c of m[2]!.matchAll(/(?:^|[;\s])color:\s*(#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3})\b/g)) {
        const cor = c[1]!;
        const pior = Math.min(...FUNDOS_CLAROS.map((f) => contrastRatio(cor, f) ?? 21));
        // Muito claro (quase branco) é texto sobre fundo escuro/colorido declarado na própria regra.
        if (pior < 4.5 && pior > 1.6) ruins.push(`${seletor.slice(0, 60)} → ${cor} (${pior.toFixed(2)}:1)`);
      }
    }
    expect(ruins).toEqual([]);
  });
});
