import { z } from 'zod';

/**
 * Schema v4 do portfólio (Zod 4). Fonte única de verdade dos tipos.
 * Princípios: fluxo (não posição absoluta), grid de 12 colunas, todo texto
 * bilíngue, todo estilo por referência a tokens do tema.
 */

export const SCHEMA_VERSION = 4 as const;

// ------------------------------------------------------------------ primitivos
export const I18nSchema = z.strictObject({
  pt: z.string(),
  en: z.string(),
});

export const VisibilitySchema = z.enum(['public', 'draft', 'nda']);

/** Recorte não destrutivo: janela em frações da imagem original + proporção resultante (px). */
export const ImageCropSchema = z.strictObject({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  w: z.number().min(0.01).max(1),
  h: z.number().min(0.01).max(1),
  ar: z.number().positive(),
});

export const ImageRefSchema = z.strictObject({
  /** referência a um Blob no asset store (imagens importadas). */
  assetId: z.string().optional(),
  /** URL externa (http) ou caminho relativo (imagens não importadas). */
  url: z.string().optional(),
  alt: I18nSchema,
  /** Largura (colunas) quando a imagem é um item de grade, ex.: quadro de storyboard. */
  span: z.number().int().min(1).max(12).optional(),
  /** Largura própria no tablet e no celular (mesma régua). */
  spanTablet: z.number().int().min(1).max(12).optional(),
  spanMobile: z.number().int().min(1).max(12).optional(),
  crop: ImageCropSchema.optional(),
});

export const EmbedRefSchema = z.strictObject({
  provider: z.enum(['youtube', 'vimeo', 'speakerdeck']),
  /** URL, id cru ou <iframe> — resolvido por embedSource() no render. */
  ref: z.string(),
  options: z.record(z.string(), z.string()).optional(),
  /** Nome deste vídeo/apresentação ("Animatic", "Vídeo final"). Aparece na aba
   *  do carrossel da prévia; sem ele vale o nome do provedor. */
  label: I18nSchema.optional(),
});

// -------------------------------------------------------------------- estilo
/** Estilo de bloco/seção: apenas referências a tokens (sem cor/fonte hardcoded). */
export const BlockStyleSchema = z.strictObject({
  bg: z.string().optional(),
  paddingY: z.string().optional(),
  paddingX: z.string().optional(),
  textStyle: z.string().optional(),
  align: z.enum(['start', 'center', 'end']).optional(),
});

export const SectionStyleSchema = z.strictObject({
  bg: z.string().optional(),
  padding: z.string().optional(),
  width: z.enum(['full', 'wide', 'normal', 'narrow']).optional(),
  /** Espaços (em px de referência; escalam com a tela): entre colunas, entre linhas, acima e abaixo da seção. */
  gap: z.number().min(0).max(200).optional(),
  rowGap: z.number().min(0).max(200).optional(),
  spaceTop: z.number().min(0).max(400).optional(),
  spaceBottom: z.number().min(0).max(400).optional(),
});

// -------------------------------------------------------------------- blocos
/** Overrides por dispositivo: largura própria (e ocultar) no tablet e no celular. */
const breakpointSchema = z
  .strictObject({
    span: z.number().int().min(1).max(12).optional(),
    hidden: z.boolean().optional(),
  })
  .optional();

export const ResponsiveSchema = z.strictObject({
  tablet: breakpointSchema,
  mobile: breakpointSchema,
});

const blockBase = {
  id: z.string(),
  span: z.number().int().min(1).max(12),
  align: z.enum(['start', 'center', 'end']).optional(),
  visibility: VisibilitySchema,
  style: BlockStyleSchema.optional(),
  responsive: ResponsiveSchema.optional(),
  /** Empilhado embaixo do bloco anterior, na mesma coluna da grade. */
  stack: z.boolean().optional(),
  /** Alinhamento da LINHA inteira (guardado no 1º bloco da linha): posição do grupo na sobra da linha. */
  rowAlign: z.enum(['start', 'center', 'end', 'between']).optional(),
  /** Espaço próprio do elemento dentro da sua célula (px de referência): acima, direita, abaixo, esquerda. */
  pad: z.strictObject({ t: z.number().min(0).max(400).optional(), r: z.number().min(0).max(400).optional(), b: z.number().min(0).max(400).optional(), l: z.number().min(0).max(400).optional() }).optional(),
};

export const HeadingBlockSchema = z.strictObject({
  ...blockBase,
  type: z.literal('heading'),
  content: z.strictObject({ text: I18nSchema, level: z.number().int().min(1).max(4).optional() }),
});

export const TextBlockSchema = z.strictObject({
  ...blockBase,
  type: z.literal('text'),
  /** HTML rich por idioma (já sanitizado). */
  content: z.strictObject({ html: I18nSchema }),
});

export const ImageBlockSchema = z.strictObject({
  ...blockBase,
  type: z.literal('image'),
  content: z.strictObject({ image: ImageRefSchema, widthPct: z.number().min(25).max(100).optional() }),
});

export const EmbedBlockSchema = z.strictObject({
  ...blockBase,
  type: z.literal('embed'),
  content: EmbedRefSchema,
});

export const StoryboardBlockSchema = z.strictObject({
  ...blockBase,
  type: z.literal('storyboard'),
  content: z.strictObject({ label: I18nSchema.optional(), frames: z.array(ImageRefSchema) }),
});

export const CollectionBlockSchema = z.strictObject({
  ...blockBase,
  type: z.literal('collection'),
  content: z.strictObject({
    collection: z.enum(['projects', 'blog', 'gallery', 'sketches']),
    cols: z.number().int().min(1).max(6),
    /** 'nda' = só itens confidenciais (página NDA); os demais filtros nunca mostram NDA. */
    filter: z.enum(['all', 'featured', 'professional', 'personal', 'nda']).optional(),
    sort: z.enum(['manual', 'newest', 'oldest']).optional(),
    /** Mostra botões de filtro por categoria para o visitante (só projetos). */
    showFilter: z.boolean().optional(),
    /** Clicar num card abre a prévia inline (popup) em vez de navegar (Home). */
    preview: z.boolean().optional(),
    /** Espaço entre os itens (px de referência). */
    gap: z.number().min(0).max(200).optional(),
  }),
});

export const SpacerBlockSchema = z.strictObject({
  ...blockBase,
  type: z.literal('spacer'),
  content: z.strictObject({ size: z.enum(['s', 'm', 'l', 'xl']) }),
});

export const DividerBlockSchema = z.strictObject({
  ...blockBase,
  type: z.literal('divider'),
  content: z.strictObject({}),
});

export const ContactBlockSchema = z.strictObject({
  ...blockBase,
  type: z.literal('contact'),
  content: z.strictObject({
    heading: I18nSchema,
    body: I18nSchema,
    email: z.string(),
    phone: z.string(),
    cvLabel: I18nSchema,
    cvHref: z.string(),
    image: ImageRefSchema.optional(),
    socials: z.array(z.strictObject({ label: z.string(), href: z.string() })),
  }),
});

/** Botão/link (ex.: "Baixar CV"). */
export const ButtonBlockSchema = z.strictObject({
  ...blockBase,
  type: z.literal('button'),
  content: z.strictObject({
    label: I18nSchema,
    href: z.string(),
    variant: z.enum(['solid', 'outline', 'link']),
    /** Abre em nova aba. */
    newTab: z.boolean().optional(),
  }),
});

/** Placeholder para posicionamento em colunas (implementação plena em F4). */
export const ColumnsBlockSchema = z.strictObject({
  ...blockBase,
  type: z.literal('columns'),
  content: z.strictObject({ count: z.number().int().min(2).max(4) }),
});

export const BlockSchema = z.discriminatedUnion('type', [
  HeadingBlockSchema,
  TextBlockSchema,
  ImageBlockSchema,
  EmbedBlockSchema,
  StoryboardBlockSchema,
  CollectionBlockSchema,
  SpacerBlockSchema,
  DividerBlockSchema,
  ContactBlockSchema,
  ButtonBlockSchema,
  ColumnsBlockSchema,
]);

// ------------------------------------------------------------------- seções
export const SectionSchema = z.strictObject({
  id: z.string(),
  /** Nome livre exibido nas Layers (só editor). */
  name: z.string().optional(),
  style: SectionStyleSchema,
  blocks: z.array(BlockSchema),
  /** Oculta esta seção na prévia da Home (home-visible granular). */
  homeHidden: z.boolean().optional(),
});

// -------------------------------------------------------------------- páginas
/** SEO da página: o que aparece no Google e ao compartilhar o link. */
export const PageSeoSchema = z.strictObject({
  description: I18nSchema.optional(),
  image: ImageRefSchema.optional(),
});

export const PageSchema = z.strictObject({
  id: z.string(),
  slug: z.string(),
  title: I18nSchema,
  kind: z.enum(['static', 'template']),
  collection: z.enum(['projects', 'blog', 'gallery', 'sketches']).optional(),
  visibility: VisibilitySchema,
  seo: PageSeoSchema.optional(),
  sections: z.array(SectionSchema),
});

// ---------------------------------------------------------------------- tema
export const TextStyleSchema = z.strictObject({
  font: z.enum(['display', 'body', 'mono']),
  size: z.number(),
  weight: z.number(),
  tracking: z.number(),
  case: z.enum(['none', 'upper', 'lower', 'title']),
});

export const ThemeSchema = z.strictObject({
  colors: z.strictObject({
    bg: z.string(),
    surface: z.string(),
    ink: z.string(),
    inkSoft: z.string(),
    inkPale: z.string(),
    rule: z.string(),
    accent: z.string(),
    accent2: z.string(),
  }),
  fonts: z.strictObject({ display: z.string(), body: z.string(), mono: z.string() }),
  type: z.strictObject({ base: z.number(), ratio: z.number() }),
  textStyles: z.record(z.string(), TextStyleSchema),
  space: z.strictObject({ unit: z.number() }),
  radius: z.number(),
  grid: z.strictObject({ cols: z.literal(12), maxWidth: z.number(), gutter: z.number() }),
});

// -------------------------------------------------------------------- assets
export const AssetMetaSchema = z.strictObject({
  mime: z.string(),
  w: z.number(),
  h: z.number(),
  alt: I18nSchema,
});

// ------------------------------------------------------------ itens de coleção
const itemBase = { id: z.string(), visibility: VisibilitySchema, order: z.number() };

/**
 * Prévia do projeto na Home (popup): escolhe QUAIS blocos do projeto aparecem,
 * em que ordem e com que largura — só para o popup. O conteúdo vem sempre do
 * bloco original (`ref` = id do bloco nas sections do projeto).
 */
export const HomePreviewSchema = z.strictObject({
  items: z.array(z.strictObject({ ref: z.string(), span: z.number().int().min(1).max(12) })),
  /** Mostra a descrição do projeto no topo do popup (padrão: sim). */
  hideDescription: z.boolean().optional(),
});

export const ProjectItemSchema = z.strictObject({
  ...itemBase,
  featured: z.boolean(),
  homeOrder: z.number().optional(),
  /** Largura do card em 12 avos (mesma régua dos blocos). Sem valor: 12 / colunas. */
  width: z.number().int().min(1).max(12).optional(),
  /** Largura própria no tablet e no celular; sem valor, herdam a do computador. */
  widthTablet: z.number().int().min(1).max(12).optional(),
  widthMobile: z.number().int().min(1).max(12).optional(),
  title: I18nSchema,
  description: I18nSchema,
  thumb: ImageRefSchema,
  /** metadados livres bilíngues: tag, year, client, role, category, skills, etc. */
  meta: z.record(z.string(), I18nSchema),
  sections: z.array(SectionSchema),
  preview: HomePreviewSchema.optional(),
});

export const BlogItemSchema = z.strictObject({
  ...itemBase,
  title: I18nSchema,
  date: I18nSchema,
  excerpt: I18nSchema,
  width: z.number().int().min(1).max(12).optional(),
  widthTablet: z.number().int().min(1).max(12).optional(),
  widthMobile: z.number().int().min(1).max(12).optional(),
  thumb: ImageRefSchema,
  sections: z.array(SectionSchema),
});

export const GalleryItemSchema = z.strictObject({
  ...itemBase,
  image: ImageRefSchema,
  caption: I18nSchema,
  /** Legado (v3): colunas da coleção. A largura editável é `width`. */
  span: z.number().int().min(1).max(6),
  width: z.number().int().min(1).max(12).optional(),
  widthTablet: z.number().int().min(1).max(12).optional(),
  widthMobile: z.number().int().min(1).max(12).optional(),
});

export const SketchItemSchema = z.strictObject({
  ...itemBase,
  image: ImageRefSchema,
  span: z.number().int().min(1).max(6),
  width: z.number().int().min(1).max(12).optional(),
  widthTablet: z.number().int().min(1).max(12).optional(),
  widthMobile: z.number().int().min(1).max(12).optional(),
});

export const CollectionsSchema = z.strictObject({
  projects: z.array(ProjectItemSchema),
  blog: z.array(BlogItemSchema),
  gallery: z.array(GalleryItemSchema),
  sketches: z.array(SketchItemSchema),
});

// ----------------------------------------------------------------------- site
export const HeaderElementSchema = z.enum(['brand', 'nav', 'lang']);

/** Cabeçalho configurável: ordem dos elementos, ocultos e layout. */
export const HeaderConfigSchema = z.strictObject({
  order: z.array(HeaderElementSchema),
  hidden: z.array(z.enum(['brand', 'nav', 'lang', 'role'])).optional(),
  /** grid = grade de 12 colunas como as seções; split = 1º à esquerda e o resto à direita; row = em linha; stacked/centered = empilhado. */
  layout: z.enum(['grid', 'split', 'row', 'stacked', 'centered']),
  /** Largura (colunas de 12) de cada elemento no layout grid. */
  spans: z.record(z.string(), z.number().int().min(1).max(12)).optional(),
  /** Larguras próprias no tablet e no celular; sem valor, herdam a do computador. */
  spansTablet: z.record(z.string(), z.number().int().min(1).max(12)).optional(),
  spansMobile: z.record(z.string(), z.number().int().min(1).max(12)).optional(),
  /** Alinhamento de cada elemento dentro da sua célula (layout grid). */
  align: z.record(z.string(), z.enum(['start', 'center', 'end'])).optional(),
});

/** Área útil da página: margem de respiro (safe area) e largura máxima. */
export const PageLayoutSchema = z.strictObject({
  /** Margem de cada lado, em % da largura da tela. */
  margin: z.number().min(0).max(25),
  /** Largura máxima do conteúdo, em px. */
  maxWidth: z.number().min(600).max(4000),
});

/** Imagem de fundo do site: nas colunas laterais ou atrás de tudo. */
export const BackdropSchema = z.strictObject({
  image: ImageRefSchema,
  mode: z.enum(['sides', 'behind']),
  /** Véu da cor de fundo sobre a imagem (0 = imagem pura, 0.95 = quase só a cor). */
  veil: z.number().min(0).max(0.95),
});

export const SiteSchema = z.strictObject({
  name: I18nSchema,
  role: I18nSchema,
  locales: z.tuple([z.literal('pt'), z.literal('en')]),
  nav: z.array(z.string()),
  /** Dicionário i18n de strings de UI/chrome (label da barra, "Voltar", etc.). */
  ui: z.record(z.string(), I18nSchema),
  /** Overrides rich de texto por id de DOM (portado de meta.elementText do v3). */
  textOverrides: z.record(z.string(), I18nSchema).optional(),
  ndaPasswordHint: z.string().optional(),
  header: HeaderConfigSchema.optional(),
  layout: PageLayoutSchema.optional(),
  backdrop: BackdropSchema.optional(),
  /** Ícone da aba do navegador (favicon), quadrado. */
  favicon: ImageRefSchema.optional(),
  /** Snippet de analytics (Plausible/GA/Fathom) colado pelo usuário; vai cru no <head> do site publicado. */
  analytics: z.string().optional(),
  /** Endereço público do site (ex.: https://luccatuelher.com). Usado no link canônico,
   *  no og:url e para transformar a imagem social embutida num endereço que o
   *  WhatsApp/LinkedIn consigam buscar. */
  url: z.string().optional(),
});

// -------------------------------------------------------------------- top-level
export const PortfolioV4Schema = z.strictObject({
  schemaVersion: z.literal(SCHEMA_VERSION),
  theme: ThemeSchema,
  site: SiteSchema,
  assets: z.record(z.string(), AssetMetaSchema),
  collections: CollectionsSchema,
  pages: z.array(PageSchema),
});

// --------------------------------------------------------------------- tipos
export type I18n = z.infer<typeof I18nSchema>;
export type Visibility = z.infer<typeof VisibilitySchema>;
export type ImageRef = z.infer<typeof ImageRefSchema>;
export type ImageCrop = z.infer<typeof ImageCropSchema>;
export type EmbedRef = z.infer<typeof EmbedRefSchema>;
export type BlockStyle = z.infer<typeof BlockStyleSchema>;
export type Block = z.infer<typeof BlockSchema>;
export type BlockType = Block['type'];
export type Section = z.infer<typeof SectionSchema>;
export type Page = z.infer<typeof PageSchema>;
export type Theme = z.infer<typeof ThemeSchema>;
export type AssetMeta = z.infer<typeof AssetMetaSchema>;
export type ProjectItem = z.infer<typeof ProjectItemSchema>;
export type HomePreview = z.infer<typeof HomePreviewSchema>;
export type BlogItem = z.infer<typeof BlogItemSchema>;
export type GalleryItem = z.infer<typeof GalleryItemSchema>;
export type SketchItem = z.infer<typeof SketchItemSchema>;
export type Collections = z.infer<typeof CollectionsSchema>;
export type Site = z.infer<typeof SiteSchema>;
export type HeaderConfig = z.infer<typeof HeaderConfigSchema>;
export type PageLayout = z.infer<typeof PageLayoutSchema>;
export type Backdrop = z.infer<typeof BackdropSchema>;

export const DEFAULT_LAYOUT: PageLayout = { margin: 10, maxWidth: 2200 };
export type HeaderElement = z.infer<typeof HeaderElementSchema>;

export const DEFAULT_HEADER: HeaderConfig = { order: ['brand', 'lang', 'nav'], layout: 'grid', spans: { brand: 6, lang: 6, nav: 12 }, align: { lang: 'end', nav: 'end' } };

/** Largura padrão de um elemento do cabeçalho quando não definida. */
export const headerSpan = (cfg: HeaderConfig, el: string): number => cfg.spans?.[el] ?? DEFAULT_HEADER.spans?.[el] ?? 12;
export type PortfolioV4 = z.infer<typeof PortfolioV4Schema>;

/** Tema padrão, portado dos tokens CSS `:root` do v3 (legacy/index.html l.13). */
export function defaultTheme(): Theme {
  return {
    colors: {
      bg: '#F2EFE8',
      surface: '#E8E4DB',
      ink: '#1C1B18',
      inkSoft: '#5A574F',
      inkPale: '#A09C93',
      rule: '#C8C4BB',
      accent: '#C1440E',
      accent2: '#2D5A8E',
    },
    fonts: { display: 'DM Serif Display', body: 'DM Sans', mono: 'DM Mono' },
    type: { base: 16, ratio: 1.25 },
    textStyles: {
      display: { font: 'display', size: 3.2, weight: 400, tracking: -0.02, case: 'none' },
      label: { font: 'mono', size: 0.68, weight: 500, tracking: 0.15, case: 'upper' },
      body: { font: 'body', size: 1, weight: 300, tracking: 0, case: 'none' },
    },
    space: { unit: 8 },
    radius: 2,
    grid: { cols: 12, maxWidth: 1100, gutter: 24 },
  };
}
