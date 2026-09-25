import { asArray, asBool, asNumber, asObject, asString, isObject, safeClone } from '../core/access';
import { assetIdFromContent, makeIdFactory } from '../core/ids';
import { classifyImageSrc } from '../core/images';
import { dimensoesDaImagem } from '../core/dimensoesImagem';
import { bi, emptyI18n, type I18n } from '../core/i18n';
import { sanitizeHtml } from '../core/sanitizeHtml';
import { normalizeProjectRows, type NormRow } from './legacy';
import {
  defaultTheme,
  SCHEMA_VERSION,
  type AssetMeta,
  type Block,
  type BlogItem,
  type GalleryItem,
  type ImageRef,
  type Page,
  type PortfolioV4,
  type ProjectItem,
  type Section,
  type SketchItem,
  type Visibility,
} from '../schema/v4';

export interface MigratedAsset {
  id: string;
  /** data: URL original; a materializar em Blob/WebP pelo pipeline de assets. */
  dataUrl: string;
  mime: string;
}

export interface MigrationResult {
  data: PortfolioV4;
  /** data URLs a ingerir no asset store (dedupe por id). */
  assets: MigratedAsset[];
}

const EMBED_PROVIDERS = ['youtube', 'vimeo', 'speakerdeck'] as const;
type Provider = (typeof EMBED_PROVIDERS)[number];

/** Campos de texto (single-string) de um projeto v3 preservados em `item.meta`. */
export const PROJECT_META_FIELDS = [
  'tag', 'year', 'client', 'role', 'category', 'skills',
  'contribution', 'credits', 'sequenceLabel', 'storyType', 'processNotes',
] as const;

/** Chaves de `texts` pareadas Pt/En que viram um único I18n. */
export const PAIRED_TEXT_KEYS = [
  'navProjects', 'navGallery', 'navBlog', 'allProjects', 'galleryTitle',
  'gallerySub', 'blogLabel', 'back', 'contactHeading', 'contactBody', 'contactCv', 'about',
] as const;

/** Chaves de `texts` single-string que entram no dicionário `site.ui`. */
export const SINGLE_UI_KEYS = [
  'issueLabel', 'navHome', 'homeWorkLabel', 'homeSketchLabel',
  'ndaTitle', 'ndaSubtitle', 'ndaBtn', 'ndaSectionLabel', 'clientsText',
] as const;

class Ctx {
  readonly id = makeIdFactory();
  readonly assets = new Map<string, MigratedAsset>();
  readonly assetsMeta: Record<string, AssetMeta> = {};

  /** Converte uma fonte de imagem v3 em ImageRef, registrando asset se for data URL. */
  imageRef(src: unknown, alt: I18n): ImageRef | null {
    const c = classifyImageSrc(src);
    if (c.kind === 'empty') return null;
    if (c.kind === 'url') return { url: c.src, alt };
    const id = assetIdFromContent(c.src);
    if (!this.assets.has(id)) {
      this.assets.set(id, { id, dataUrl: c.src, mime: c.mime ?? 'image/png' });
      const d = dimensoesDaImagem(c.src);
      this.assetsMeta[id] = { mime: c.mime ?? 'image/png', w: d?.w ?? 0, h: d?.h ?? 0, alt };
    }
    return { assetId: id, alt };
  }
}

function provider(type: unknown): Provider {
  const t = String(type ?? '').toLowerCase();
  return (EMBED_PROVIDERS as readonly string[]).includes(t) ? (t as Provider) : 'youtube';
}

function visibilityOf(item: Record<string, unknown>, publishedDefault: boolean): Visibility {
  if (asBool(item['nda'])) return 'nda';
  const published = item['published'] === undefined ? publishedDefault : asBool(item['published']);
  return published ? 'public' : 'draft';
}

/** I18n a partir de par Pt/En em `texts`. */
function pairedI18n(texts: Record<string, unknown>, base: string): I18n {
  return { pt: asString(texts[`${base}Pt`]), en: asString(texts[`${base}En`]) };
}

/**
 * Overrides rich de texto por id de DOM (meta.elementText do v3). Chaves com
 * sufixo `::pt`/`::en` viram o idioma correspondente; as demais duplicam pt/en.
 * Preservado integralmente para não perder formatação inline.
 */
function buildTextOverrides(meta: Record<string, unknown>): Record<string, I18n> | undefined {
  const elementText = asObject(meta['elementText']);
  const keys = Object.keys(elementText);
  if (!keys.length) return undefined;
  const out: Record<string, I18n> = {};
  for (const key of keys) {
    const value = sanitizeHtml(elementText[key]);
    if (!value) continue;
    const m = key.match(/^(.*)::(pt|en)$/);
    if (m) {
      const base = m[1]!;
      const lang = m[2] as 'pt' | 'en';
      out[base] = out[base] ?? emptyI18n();
      out[base][lang] = value;
    } else {
      out[key] = bi(value);
    }
  }
  return Object.keys(out).length ? out : undefined;
}

/** Dicionário i18n de UI, garantindo que nenhum texto de chrome se perca. */
function buildUiDict(texts: Record<string, unknown>): Record<string, I18n> {
  const ui: Record<string, I18n> = {};
  for (const k of SINGLE_UI_KEYS) {
    const v = asString(texts[k]);
    if (v) ui[k] = bi(v);
  }
  for (const base of PAIRED_TEXT_KEYS) {
    const pair = pairedI18n(texts, base);
    if (pair.pt || pair.en) ui[base] = pair;
  }
  return ui;
}

const spanForCols = (cols: number): number => (cols <= 1 ? 12 : cols === 2 ? 6 : 4);

function section(id: string, blocks: Block[], width: Section['style']['width'] = 'normal'): Section {
  return { id, style: width ? { width } : {}, blocks };
}

// ------------------------------------------------------------ construtores de bloco
// Recebem `id` já resolvido (preservado do v3 quando existir).
function textBlock(id: string, html: I18n, span: number, vis: Visibility): Block {
  return { id, type: 'text', span, visibility: vis, content: { html } };
}
function headingBlock(id: string, text: I18n, span: number, vis: Visibility): Block {
  return { id, type: 'heading', span, visibility: vis, content: { text } };
}
function imageBlock(id: string, ref: ImageRef, span: number, vis: Visibility, widthPct?: number): Block {
  const content = widthPct !== undefined ? { image: ref, widthPct } : { image: ref };
  return { id, type: 'image', span, visibility: vis, content };
}
function embedBlock(id: string, prov: Provider, ref: string, span: number, vis: Visibility): Block {
  return { id, type: 'embed', span, visibility: vis, content: { provider: prov, ref } };
}
function collectionBlock(
  id: string, name: 'projects' | 'blog' | 'gallery' | 'sketches', cols: number,
  filter?: 'all' | 'featured' | 'professional' | 'personal' | 'nda', showFilter?: boolean, preview?: boolean,
): Block {
  const content = {
    collection: name,
    cols,
    ...(filter ? { filter } : {}),
    ...(showFilter ? { showFilter: true } : {}),
    ...(preview ? { preview: true } : {}),
  };
  return { id, type: 'collection', span: 12, visibility: 'public', content };
}

// -------------------------------------------------------------- linhas → seções
function rowsToSections(ctx: Ctx, rows: NormRow[], basePath: string): Section[] {
  return rows.map((row, ri): Section => {
    const span = spanForCols(row.cols);
    const blocks = row.items
      .map((item, ii): Block | null => {
        const path = `${basePath}/row/${ri}/item/${ii}`;
        const id = ctx.id(item.rawId, path);
        if (item.kind === 'image') {
          const ref = ctx.imageRef(item.src, bi(item.alt ?? ''));
          return ref ? imageBlock(id, ref, span, 'public', item.widthPct) : null;
        }
        if (item.kind === 'embed') {
          const ref = asString(item.embedId);
          return ref ? embedBlock(id, provider(item.embedType), ref, span, 'public') : null;
        }
        const html = sanitizeHtml(item.content);
        return html ? textBlock(id, bi(html), span, 'public') : null;
      })
      .filter((b): b is Block => b !== null);
    return section(ctx.id(row.rawId, `${basePath}/row/${ri}`), blocks);
  });
}

// -------------------------------------------- blocos universais (meta.pageBlocks)
function universalBlocks(ctx: Ctx, rawBlocks: unknown[], basePath: string): Block[] {
  return rawBlocks
    .map((raw, i): Block | null => {
      if (!isObject(raw)) return null;
      const type = raw['type'];
      const span = Math.max(3, Math.min(12, asNumber(raw['width'], 12) || 12));
      const vis: Visibility = asBool(raw['nda']) ? 'nda' : raw['published'] === false ? 'draft' : 'public';
      const id = ctx.id(raw['id'], `${basePath}/ub/${i}`);
      if (type === 'text') {
        const html = sanitizeHtml(raw['content']);
        return html ? textBlock(id, bi(html), span, vis) : null;
      }
      if (type === 'image') {
        const ref = ctx.imageRef(raw['src'], emptyI18n());
        return ref ? imageBlock(id, ref, span, vis) : null;
      }
      // 'video' | 'embed'
      const ref = asString(raw['embedId']);
      if (!ref) return null;
      const prov = raw['type'] === 'video' ? provider(raw['embedType']) : provider(raw['embedType'] ?? 'speakerdeck');
      return embedBlock(id, prov, ref, span, vis);
    })
    .filter((b): b is Block => b !== null);
}

// ----------------------------------------------------------------- coleções
function migrateProject(ctx: Ctx, raw: unknown, index: number): ProjectItem {
  const p = asObject(raw);
  const id = ctx.id(p['id'], `project/${index}`);
  const rows = normalizeProjectRows(p);
  const sections = rowsToSections(ctx, rows, `project/${id}`);
  const meta: Record<string, I18n> = {};
  for (const f of PROJECT_META_FIELDS) {
    const v = asString(p[f]);
    if (v) meta[f] = bi(v);
  }
  const thumb = ctx.imageRef(p['thumb'], bi(asString(p['title']))) ?? { url: '', alt: emptyI18n() };
  const item: ProjectItem = {
    id,
    visibility: visibilityOf(p, false),
    order: asNumber(p['order'], index),
    featured: asBool(p['featured']),
    title: bi(asString(p['title'])),
    description: bi(asString(p['description'])),
    thumb,
    meta,
    sections,
  };
  if (p['homeOrder'] !== undefined) item.homeOrder = asNumber(p['homeOrder']);
  return item;
}

function migrateBlog(ctx: Ctx, raw: unknown, index: number): BlogItem {
  const b = asObject(raw);
  const id = ctx.id(b['id'], `blog/${index}`);
  const blocks: Block[] = [];
  const content = sanitizeHtml(b['content']);
  if (content) blocks.push(textBlock(ctx.id(undefined, `blog/${id}/text`), bi(content), 12, 'public'));
  asArray(b['images']).forEach((src, i) => {
    const ref = ctx.imageRef(src, emptyI18n());
    if (ref) blocks.push(imageBlock(ctx.id(undefined, `blog/${id}/img/${i}`), ref, 12, 'public'));
  });
  const thumb = ctx.imageRef(b['thumb'], bi(asString(b['title']))) ?? { url: '', alt: emptyI18n() };
  return {
    id,
    visibility: visibilityOf(b, false),
    order: asNumber(b['order'], index),
    title: bi(asString(b['title'])),
    date: bi(asString(b['date'])),
    excerpt: bi(asString(b['excerpt'])),
    thumb,
    sections: blocks.length ? [section(ctx.id(undefined, `blog/${id}/sec`), blocks, 'normal')] : [],
  };
}

function migrateGallery(ctx: Ctx, raw: unknown, index: number): GalleryItem {
  const g = asObject(raw);
  const id = ctx.id(g['id'], `gallery/${index}`);
  const ref = ctx.imageRef(g['src'], bi(asString(g['caption']))) ?? { url: '', alt: emptyI18n() };
  return {
    id,
    visibility: visibilityOf(g, true),
    order: asNumber(g['order'], index),
    image: ref,
    caption: bi(asString(g['caption'])),
    span: Math.max(1, Math.min(3, asNumber(g['colSpan'], 1) || 1)),
  };
}

function migrateSketch(ctx: Ctx, raw: unknown, index: number): SketchItem {
  const s = asObject(raw);
  const id = ctx.id(s['id'], `sketch/${index}`);
  const ref = ctx.imageRef(s['src'], bi(asString(s['alt']))) ?? { url: '', alt: emptyI18n() };
  return {
    id,
    visibility: visibilityOf(s, true),
    order: asNumber(s['order'], index),
    image: ref,
    span: Math.max(1, Math.min(3, asNumber(s['colSpan'], 1) || 1)),
  };
}

// ------------------------------------------------------------------- páginas
function buildPages(ctx: Ctx, meta: Record<string, unknown>, texts: Record<string, unknown>): Page[] {
  const pageBlocks = asObject(meta['pageBlocks']);
  const ub = (page: string, base: string): Block[] => universalBlocks(ctx, asArray(pageBlocks[page]), base);
  const sketchCols = Math.max(1, Math.min(6, asNumber(meta['sketchCols'], 4) || 4));

  // ---- Home
  const homeSections: Section[] = [];
  const bannerRef = ctx.imageRef(meta['banner'], emptyI18n());
  const order = asArray(meta['homeBlockOrder']).filter((x): x is string => typeof x === 'string');
  const homeOrder = order.length ? order : ['banner', 'projects', 'media', 'sketches'];
  for (const key of homeOrder) {
    if (key === 'banner' && bannerRef) {
      homeSections.push(
        section(ctx.id(undefined, 'home/banner'), [imageBlock(ctx.id(undefined, 'home/banner/img'), bannerRef, 12, 'public')], 'full'),
      );
    } else if (key === 'projects') {
      homeSections.push(
        section(ctx.id(undefined, 'home/projects'), [
          headingBlock(ctx.id(undefined, 'home/projects/h'), bi(asString(texts['homeWorkLabel'])), 12, 'public'),
          collectionBlock(ctx.id(undefined, 'home/projects/col'), 'projects', 3, 'featured', false, true),
        ]),
      );
    } else if (key === 'media') {
      const frames: ImageRef[] = [];
      const mediaBlocks: Block[] = [];
      asArray(meta['homeItems']).forEach((it, i) => {
        const o = asObject(it);
        if (o['type'] === 'image') {
          const ref = ctx.imageRef(o['src'], emptyI18n());
          if (ref) frames.push(ref);
        } else {
          const ref = asString(o['id']);
          if (ref) mediaBlocks.push(embedBlock(ctx.id(undefined, `home/media/${i}`), provider(o['type']), ref, 12, 'public'));
        }
      });
      if (frames.length) {
        mediaBlocks.unshift({
          id: ctx.id(undefined, 'home/media/story'),
          type: 'storyboard',
          span: 12,
          visibility: 'public',
          content: { frames },
        });
      }
      if (mediaBlocks.length) homeSections.push(section(ctx.id(undefined, 'home/media'), mediaBlocks, 'full'));
    } else if (key === 'sketches') {
      homeSections.push(
        section(ctx.id(undefined, 'home/sketches'), [
          headingBlock(ctx.id(undefined, 'home/sketches/h'), bi(asString(texts['homeSketchLabel'])), 12, 'public'),
          collectionBlock(ctx.id(undefined, 'home/sketches/col'), 'sketches', sketchCols),
        ]),
      );
    }
  }
  const homeUniversal = ub('home', 'home');
  if (homeUniversal.length) homeSections.push(section(ctx.id(undefined, 'home/universal'), homeUniversal));

  return [
    { id: 'home', slug: '', title: bi('Home'), kind: 'static', visibility: 'public', sections: homeSections },
    {
      id: 'projects', slug: 'projects', title: pairedI18n(texts, 'navProjects'), kind: 'static', visibility: 'public',
      sections: [
        section(ctx.id(undefined, 'projects/main'), [
          headingBlock(ctx.id(undefined, 'projects/h'), pairedI18n(texts, 'allProjects'), 12, 'public'),
          collectionBlock(ctx.id(undefined, 'projects/col'), 'projects', 3, 'all', true),
          ...ub('projects', 'projects'),
        ]),
      ],
    },
    {
      id: 'gallery', slug: 'gallery', title: pairedI18n(texts, 'navGallery'), kind: 'static', visibility: 'public',
      sections: [
        section(ctx.id(undefined, 'gallery/main'), [
          headingBlock(ctx.id(undefined, 'gallery/h'), pairedI18n(texts, 'galleryTitle'), 12, 'public'),
          collectionBlock(ctx.id(undefined, 'gallery/col'), 'gallery', 3),
          ...ub('gallery', 'gallery'),
        ]),
      ],
    },
    {
      id: 'blog', slug: 'blog', title: pairedI18n(texts, 'navBlog'), kind: 'static', visibility: 'public',
      sections: [
        section(ctx.id(undefined, 'blog/main'), [
          headingBlock(ctx.id(undefined, 'blog/h'), pairedI18n(texts, 'blogLabel'), 12, 'public'),
          collectionBlock(ctx.id(undefined, 'blog/col'), 'blog', 3),
          ...ub('blog', 'blog'),
        ]),
      ],
    },
    {
      id: 'about', slug: 'about', title: bi('Sobre', 'About'), kind: 'static', visibility: 'public',
      sections: [
        section(ctx.id(undefined, 'about/main'), [
          textBlock(ctx.id(undefined, 'about/bio'), pairedI18n(texts, 'about'), 12, 'public'),
          ...(asString(texts['clientsText'])
            ? [textBlock(ctx.id(undefined, 'about/clients'), bi(asString(texts['clientsText'])), 12, 'public')]
            : []),
          ...ub('about', 'about'),
        ], 'narrow'),
      ],
    },
    buildContactPage(ctx, texts),
    {
      id: 'nda', slug: 'nda', title: bi('NDA'), kind: 'static', visibility: 'nda',
      sections: [
        section(ctx.id(undefined, 'nda/main'), [
          headingBlock(ctx.id(undefined, 'nda/h'), bi(asString(texts['ndaTitle'])), 12, 'public'),
          collectionBlock(ctx.id(undefined, 'nda/col'), 'projects', 3, 'nda'),
          ...ub('nda', 'nda'),
        ]),
      ],
    },
    // Templates de detalhe: o layout vem daqui; o conteúdo são as sections do item.
    { id: 'project-detail', slug: 'project/:id', title: bi('Projeto', 'Project'), kind: 'template', collection: 'projects', visibility: 'public', sections: [] },
    { id: 'blog-detail', slug: 'blog/:id', title: bi('Nota', 'Note'), kind: 'template', collection: 'blog', visibility: 'public', sections: [] },
  ];
}

function buildContactPage(ctx: Ctx, texts: Record<string, unknown>): Page {
  const socials: { label: string; href: string }[] = [];
  for (const n of [1, 2, 3]) {
    const label = asString(texts[`social${n}Label`]);
    const href = asString(texts[`social${n}Href`]);
    if (label || href) socials.push({ label, href });
  }
  const image = ctx.imageRef(texts['contactImgSrc'], emptyI18n());
  const block: Block = {
    id: ctx.id(undefined, 'contact/block'),
    type: 'contact',
    span: 12,
    visibility: 'public',
    content: {
      heading: pairedI18n(texts, 'contactHeading'),
      body: pairedI18n(texts, 'contactBody'),
      email: asString(texts['contactEmail']),
      phone: asString(texts['contactPhone']),
      cvLabel: pairedI18n(texts, 'contactCv'),
      cvHref: asString(texts['contactCvHref']),
      socials,
      ...(image ? { image } : {}),
    },
  };
  return {
    id: 'contact', slug: 'contact', title: bi('Contato', 'Contact'), kind: 'static', visibility: 'public',
    sections: [section(ctx.id(undefined, 'contact/main'), [block])],
  };
}

// ------------------------------------------------------------------- entrada
/**
 * Migração pura e determinística v3 → v4. IDs de entidades existentes são
 * preservados; data URLs viram assets (dedupe por conteúdo). Não usa DOM,
 * `Math.random` nem `Date.now`: a mesma entrada gera a mesma saída.
 */
export function migrate(input: unknown): MigrationResult {
  const root = safeClone(asObject(input));
  const ctx = new Ctx();
  const texts = asObject(root['texts']);
  const meta = asObject(root['meta']);

  const collections = {
    projects: asArray(root['projects']).map((r, i) => migrateProject(ctx, r, i)),
    blog: asArray(root['blog']).map((r, i) => migrateBlog(ctx, r, i)),
    gallery: asArray(root['gallery']).map((r, i) => migrateGallery(ctx, r, i)),
    sketches: asArray(root['sketches']).map((r, i) => migrateSketch(ctx, r, i)),
  };

  const pages = buildPages(ctx, meta, texts);
  const textOverrides = buildTextOverrides(meta);

  const data: PortfolioV4 = {
    schemaVersion: SCHEMA_VERSION,
    theme: defaultTheme(),
    site: {
      name: bi(asString(texts['siteName'])),
      role: bi(asString(texts['siteRole'])),
      locales: ['pt', 'en'],
      nav: ['home', 'projects', 'gallery', 'blog', 'about', 'contact'],
      ui: buildUiDict(texts),
      ...(textOverrides ? { textOverrides } : {}),
      ...(asString(meta['ndaPassword']) ? { ndaPasswordHint: '' } : {}),
    },
    assets: ctx.assetsMeta,
    collections,
    pages,
  };

  return { data, assets: [...ctx.assets.values()] };
}
