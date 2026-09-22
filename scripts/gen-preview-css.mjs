// Gera as regras da PRÉVIA de tablet/celular do editor a partir das regras
// responsivas do próprio site. Rode com: npm run gen:preview
//
// Por quê: a prévia do editor mostra o site dentro de um canvas estreito, e não
// numa janela estreita — media query não dispara ali. Até aqui cada regra de
// celular era escrita DUAS vezes (uma em @media, outra como `.pv-mobile ...`),
// e as duas versões já saíram de sincronia na prática (o tablet ficou com 2
// colunas na prévia e 3 no site). Agora existe uma fonte só: o CSS do site.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Larguras que cada prévia representa (as mesmas do seletor do editor). */
const TELAS = [
  { classe: 'pv-tablet', largura: 768 },
  { classe: 'pv-mobile', largura: 390 },
];

/** Extrai os blocos `@media (...) { ... }` de primeiro nível. */
function lerMedia(css) {
  const blocos = [];
  const re = /@media([^{]+)\{/g;
  let m;
  while ((m = re.exec(css))) {
    const condicao = m[1].trim();
    let i = re.lastIndex;
    let nivel = 1;
    while (i < css.length && nivel > 0) {
      if (css[i] === '{') nivel++;
      else if (css[i] === '}') nivel--;
      i++;
    }
    blocos.push({ condicao, corpo: css.slice(re.lastIndex, i - 1) });
    re.lastIndex = i;
  }
  return blocos;
}

/** A condição vale para uma tela desta largura? (só min/max-width) */
function valePara(condicao, largura) {
  if (!/width/.test(condicao)) return false; // hover, prefers-*, print: não são largura
  const max = [...condicao.matchAll(/max-width:\s*(\d+)px/g)].map((x) => +x[1]);
  const min = [...condicao.matchAll(/min-width:\s*(\d+)px/g)].map((x) => +x[1]);
  return max.every((v) => largura <= v) && min.every((v) => largura >= v);
}

/**
 * Converte unidades de janela para pixels da prévia.
 *
 * No site, `vw` é a largura da JANELA. Dentro do editor a prévia é um canvas
 * estreito numa janela larga — 3vw ali daria 45px em vez dos ~12px que o
 * celular teria. Como a largura da prévia é fixa e conhecida, dá para trocar
 * a unidade pelo valor exato.
 */
function converterVw(css, largura) {
  return css.replace(/(\d*\.?\d+)vw/g, (todo, n) => `${Math.round((parseFloat(n) / 100) * largura * 100) / 100}px`);
}

/** Prefixa cada seletor com a classe da prévia, para valer só dentro dela. */
function prefixar(corpo, classe) {
  // Comentários fora: senão o texto deles seria confundido com seletor.
  const limpo = corpo.replace(/\/\*[\s\S]*?\*\//g, '');
  return limpo.replace(/(^|\})([^{}@]+)\{/g, (todo, fecha, seletores) => {
    const alvo = seletores
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => {
        // `.site { ... }` vira `.pv-tablet .site`; o resto também é descendente.
        if (s.startsWith(':root') || s.startsWith('html') || s.startsWith('body')) return `.${classe}`;
        return `.${classe} ${s}`;
      })
      .join(', ');
    return `${fecha}\n${alvo} {`;
  });
}

const fontes = ['src/renderer/styles.css', 'src/dev/site-entry.css'];
const blocos = fontes.flatMap((f) => lerMedia(readFileSync(resolve(root, f), 'utf8')).map((b) => ({ ...b, fonte: f })));

let saida = `/* GERADO por scripts/gen-preview-css.mjs — não edite à mão.
   As regras de tablet/celular da PRÉVIA do editor saem das mesmas @media do
   site, para as duas nunca saírem de sincronia. Rode: npm run gen:preview */\n`;

for (const tela of TELAS) {
  const aplicaveis = blocos.filter((b) => valePara(b.condicao, tela.largura));
  saida += `\n/* ---------- ${tela.classe} (${tela.largura}px) ---------- */\n`;
  for (const b of aplicaveis) {
    saida += `/* de ${b.fonte}: @media ${b.condicao} */\n${converterVw(prefixar(b.corpo.trim(), tela.classe), tela.largura)}\n`;
  }
}

writeFileSync(resolve(root, 'src/editor/preview.generated.css'), saida, 'utf8');
const n = TELAS.map((t) => `${t.classe}: ${blocos.filter((b) => valePara(b.condicao, t.largura)).length} blocos`).join(' · ');
console.log(`✓ src/editor/preview.generated.css (${n})`);
