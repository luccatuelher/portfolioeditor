import { describe, expect, it } from 'vitest';
import { migrate } from '../src/migrate/migrate';
import { camposDeTexto } from '../src/core/camposTexto';
import { loadFixture } from './helpers/fixtures';

/**
 * Guarda estrutural: todo texto bilíngue do documento está na lista única
 * (camposDeTexto) — que alimenta o "sem EN" do canvas, a lista de Traduções
 * e o aviso de publicação — ou está aqui embaixo, dito por quê. Um campo
 * bilíngue novo no schema que ninguém ligou às listas quebra este teste.
 *
 * O tipo entra no caminho (blocks[storyboard], pages[template]): a exceção de
 * um tipo não esconde o mesmo campo esquecido em outro.
 */
const FORA_DE_PROPOSITO: [RegExp, string][] = [
  [/^site\.ui\./, 'dicionário de rótulos da interface (tem padrão nos dois idiomas)'],
  [/\.meta\.(year|category|storyType)$/, 'vêm de listas prontas, traduzidas pelo site'],
  [/^collections\.blog\[\]\.date$/, 'data escolhida em lista, formatada por idioma'],
  [/\.thumb\.alt$/, 'capa do card: o card já é um link com o título (imagem decorativa)'],
  [/blocks\[contact\]\.content\.cvLabel$/, 'legado: o CV virou bloco Botão'],
  [/blocks\[storyboard\]\.content\.label$/, 'nome do storyboard (não aparece no site)'],
  [/^pages\[template\]\.title$/, 'modelo de detalhe: o site mostra o título do projeto/nota'],
  [/^pages\[[a-z]*\]\.seo\.image\.alt$/, 'imagem de compartilhamento: redes sociais não leem o alt'],
  [/^site\.(favicon|backdrop\.image)\.alt$/, 'ícone da aba e fundo: decorativos'],
];

const ehI18n = (v: unknown): v is { pt: string; en: string } =>
  !!v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).sort().join() === 'en,pt';

function tipoDe(x: unknown): string {
  if (!x || typeof x !== 'object') return '';
  const o = x as { type?: unknown; kind?: unknown };
  if (typeof o.type === 'string') return o.type;
  return o.kind === 'template' ? 'template' : '';
}

function todosOsI18n(no: unknown, caminho: string, out: { caminho: string; valor: object }[]): void {
  if (ehI18n(no)) {
    out.push({ caminho, valor: no });
    return;
  }
  if (Array.isArray(no)) {
    for (const x of no) todosOsI18n(x, `${caminho}[${tipoDe(x)}]`, out);
    return;
  }
  if (no && typeof no === 'object') {
    for (const [k, v] of Object.entries(no)) todosOsI18n(v, caminho ? `${caminho}.${k}` : k, out);
  }
}

describe('lista única de textos bilíngues', () => {
  for (const fixture of ['template-v3.json', 'legacy-synthetic-v3.json']) {
    it(`cobre todo texto bilíngue do documento (${fixture})`, () => {
      const doc = migrate(loadFixture(fixture)).data;
      const naLista = new Set<object>(camposDeTexto(doc).map((c) => c.valor));
      const encontrados: { caminho: string; valor: object }[] = [];
      todosOsI18n({ site: doc.site, pages: doc.pages, collections: doc.collections }, '', encontrados);
      const soltos = encontrados
        .filter((e) => !naLista.has(e.valor) && !FORA_DE_PROPOSITO.some(([re]) => re.test(e.caminho)))
        .map((e) => e.caminho);
      expect([...new Set(soltos)]).toEqual([]);
    });
  }
});
