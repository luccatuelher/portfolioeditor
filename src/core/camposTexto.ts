import type { Block, BlogItem, I18n, PortfolioV4, ProjectItem, Section } from '../schema/v4';

/**
 * Os textos bilíngues do documento, num lugar só.
 *
 * Canvas ("sem EN"), lista de Traduções e aviso de publicação tinham cada um
 * a sua lista de campos — e cada lista cobria campos diferentes. Aqui fica a
 * única; o id de cada campo (`CampoId`) é o mesmo que o Inspector usa, para
 * uma lista poder levar o cursor direto ao campo certo.
 */

/** Id estável de um campo de texto: liga pendências, canvas e Inspector. */
export type CampoId =
  | 'site.name'
  | 'site.role'
  | 'title'
  | 'description'
  | 'excerpt'
  | 'caption'
  | 'image.alt'
  | 'seo.description'
  | `meta.${string}`
  | 'content.text'
  | 'content.html'
  | 'content.label'
  | 'content.heading'
  | 'content.body'
  | 'content.image.alt'
  | `frames.${number}.alt`;

export interface CampoDoBloco {
  campo: CampoId;
  rotulo: string;
  valor: I18n;
}

/** Os textos bilíngues que um bloco mostra no site. */
export function camposDoBloco(b: Block): CampoDoBloco[] {
  switch (b.type) {
    case 'heading': return [{ campo: 'content.text', rotulo: 'Título', valor: b.content.text }];
    case 'text': return [{ campo: 'content.html', rotulo: 'Texto', valor: b.content.html }];
    case 'button': return [{ campo: 'content.label', rotulo: 'Botão', valor: b.content.label }];
    case 'image': return [{ campo: 'content.image.alt', rotulo: 'Descrição da imagem', valor: b.content.image.alt }];
    // Nome da aba do vídeo no carrossel da prévia do projeto.
    case 'embed': return b.content.label ? [{ campo: 'content.label', rotulo: 'Nome do vídeo', valor: b.content.label }] : [];
    case 'storyboard': return b.content.frames.map((f, i) => ({ campo: `frames.${i}.alt` as const, rotulo: `Quadro ${i + 1} (descrição)`, valor: f.alt }));
    case 'contact': return [
      { campo: 'content.heading', rotulo: 'Contato (título)', valor: b.content.heading },
      { campo: 'content.body', rotulo: 'Contato (texto)', valor: b.content.body },
    ];
    default: return [];
  }
}

/** Campos da ficha técnica que são texto (ano, categoria e formato vêm de listas). */
export const FICHA_TEXTO: Record<string, string> = {
  tag: 'tag', client: 'cliente', role: 'papel', skills: 'competências', contribution: 'contribuição',
  credits: 'créditos', sequenceLabel: 'sequência', processNotes: 'processo',
};

type ContainerRef = { on: 'page'; pageId: string } | { on: 'item'; collection: 'projects' | 'blog'; itemId: string };

/** Onde o campo mora — o que selecionar para chegar a ele. */
export type Dono =
  | { tipo: 'site' }
  | { tipo: 'pagina'; pageId: string }
  | { tipo: 'item'; colecao: 'projects' | 'blog' | 'gallery' | 'sketches'; itemId: string }
  | { tipo: 'bloco'; container: ContainerRef; sectionId: string; blockId: string };

export interface CampoTexto extends CampoDoBloco {
  dono: Dono;
  /** "página Sobre", "projeto “A Travessia”". */
  lugar: string;
  /** Vai para o site (nada em rascunho no caminho). */
  publicado: boolean;
}

const nome = (v: I18n): string => v.pt || v.en;

/** Todos os campos de texto bilíngues do documento, com dono e se vão para o site. */
export function camposDeTexto(doc: PortfolioV4): CampoTexto[] {
  const out: CampoTexto[] = [];
  const blocos = (sections: Section[], container: ContainerRef, lugar: string, publicado: boolean): void => {
    for (const s of sections) {
      for (const b of s.blocks as Block[]) {
        const dono: Dono = { tipo: 'bloco', container, sectionId: s.id, blockId: b.id };
        for (const c of camposDoBloco(b)) out.push({ ...c, dono, lugar, publicado: publicado && b.visibility !== 'draft' });
      }
    }
  };

  out.push({ campo: 'site.name', rotulo: 'nome do site', valor: doc.site.name, dono: { tipo: 'site' }, lugar: 'cabeçalho', publicado: true });
  out.push({ campo: 'site.role', rotulo: 'função', valor: doc.site.role, dono: { tipo: 'site' }, lugar: 'cabeçalho', publicado: true });

  for (const p of doc.pages) {
    const lugar = `página ${nome(p.title) || p.slug}`;
    const publicado = p.visibility !== 'draft' || p.id === 'home';
    const dono: Dono = { tipo: 'pagina', pageId: p.id };
    if (p.kind === 'static') out.push({ campo: 'title', rotulo: 'nome', valor: p.title, dono, lugar, publicado });
    if (p.seo?.description) out.push({ campo: 'seo.description', rotulo: 'descrição de SEO', valor: p.seo.description, dono, lugar, publicado });
    blocos(p.sections, { on: 'page', pageId: p.id }, lugar, publicado);
  }
  for (const it of doc.collections.projects as ProjectItem[]) {
    const lugar = `projeto “${nome(it.title)}”`;
    const publicado = it.visibility !== 'draft';
    const dono: Dono = { tipo: 'item', colecao: 'projects', itemId: it.id };
    out.push({ campo: 'title', rotulo: 'título', valor: it.title, dono, lugar, publicado });
    out.push({ campo: 'description', rotulo: 'descrição', valor: it.description, dono, lugar, publicado });
    for (const [k, rotulo] of Object.entries(FICHA_TEXTO)) {
      const v = it.meta[k];
      if (v) out.push({ campo: `meta.${k}`, rotulo, valor: v, dono, lugar, publicado });
    }
    blocos(it.sections, { on: 'item', collection: 'projects', itemId: it.id }, lugar, publicado);
  }
  for (const it of doc.collections.blog as BlogItem[]) {
    const lugar = `nota “${nome(it.title)}”`;
    const publicado = it.visibility !== 'draft';
    const dono: Dono = { tipo: 'item', colecao: 'blog', itemId: it.id };
    out.push({ campo: 'title', rotulo: 'título', valor: it.title, dono, lugar, publicado });
    out.push({ campo: 'excerpt', rotulo: 'resumo', valor: it.excerpt, dono, lugar, publicado });
    blocos(it.sections, { on: 'item', collection: 'blog', itemId: it.id }, lugar, publicado);
  }
  for (const g of doc.collections.gallery) {
    const dono: Dono = { tipo: 'item', colecao: 'gallery', itemId: g.id };
    const publicado = g.visibility !== 'draft';
    out.push({ campo: 'caption', rotulo: 'legenda', valor: g.caption, dono, lugar: 'galeria', publicado });
    out.push({ campo: 'image.alt', rotulo: 'descrição da imagem', valor: g.image.alt, dono, lugar: 'galeria', publicado });
  }
  for (const s of doc.collections.sketches) {
    out.push({ campo: 'image.alt', rotulo: 'descrição da imagem', valor: s.image.alt, dono: { tipo: 'item', colecao: 'sketches', itemId: s.id }, lugar: 'sketch', publicado: s.visibility !== 'draft' });
  }
  return out;
}

/** Texto limpo (sem HTML, espaços normalizados) — o que a pessoa vê. */
export const textoLimpo = (s: string): string => s.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

/** O idioma `lang` está vazio e o outro não: é o que o canvas marca "sem EN"/"sem PT". */
export function faltaNoIdioma(v: I18n, lang: 'pt' | 'en'): boolean {
  const outro = lang === 'pt' ? 'en' : 'pt';
  return !textoLimpo(v[lang]) && !!textoLimpo(v[outro]);
}
