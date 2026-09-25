import { describe, expect, it } from 'vitest';
import { migrate } from '../src/migrate/migrate';
import { camposDeTexto } from '../src/core/camposTexto';
import { loadFixture } from './helpers/fixtures';
import { z } from 'zod';
import { I18nSchema, PortfolioV4Schema } from '../src/schema/v4';

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

/**
 * Preenche, guiado pelo schema, todo campo bilíngue OPCIONAL que está vazio
 * (legenda, nome do vídeo, …). Os exemplos quase não usam esses campos: sem
 * isto, um opcional novo esquecido fora da lista passaria despercebido.
 */
function preencherOpcionais(valor: unknown, schema: z.ZodType): void {
  if (valor === undefined || valor === null) return;
  if (schema instanceof z.ZodOptional) return preencherOpcionais(valor, schema.unwrap() as z.ZodType);
  if (schema instanceof z.ZodDiscriminatedUnion) {
    const tipo = (valor as { type?: unknown }).type;
    const opcao = (schema.options as z.ZodObject[]).find((o) => (o.shape['type'] as z.ZodLiteral).value === tipo);
    if (opcao) preencherOpcionais(valor, opcao);
    return;
  }
  if (schema instanceof z.ZodArray && Array.isArray(valor)) {
    for (const x of valor) preencherOpcionais(x, schema.element as z.ZodType);
    return;
  }
  if (schema instanceof z.ZodObject && typeof valor === 'object') {
    const r = valor as Record<string, unknown>;
    for (const [k, s] of Object.entries(schema.shape as Record<string, z.ZodType>)) {
      if (r[k] === undefined && s instanceof z.ZodOptional && s.unwrap() === I18nSchema) r[k] = { pt: 'Preenchido', en: '' };
      else preencherOpcionais(r[k], s);
    }
  }
}

describe('lista única de textos bilíngues', () => {
  const casos = [
    ...['template-v3.json', 'legacy-synthetic-v3.json'].map((f) => [f, () => migrate(loadFixture(f)).data] as const),
    ['template-v3.json com todo bilíngue opcional preenchido', () => {
      const doc = migrate(loadFixture('template-v3.json')).data;
      preencherOpcionais(doc, PortfolioV4Schema);
      // O preenchimento pegou de verdade (ex.: legenda da imagem e do quadro).
      expect(JSON.stringify(doc)).toContain('"caption":{"pt":"Preenchido"');
      return doc;
    }] as const,
  ];
  for (const [nome, carregar] of casos) {
    it(`cobre todo texto bilíngue do documento (${nome})`, () => {
      const doc = carregar();
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
