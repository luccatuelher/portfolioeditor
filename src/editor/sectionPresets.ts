import { bi, emptyI18n } from '../core/i18n';
import type { Block, Section } from '../schema/v4';

function uid(p: string): string {
  const rnd = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  return `${p}_${rnd.replace(/-/g, '').slice(0, 12)}`;
}
const base = (span: number): { id: string; span: number; visibility: 'public' } => ({ id: uid('b'), span, visibility: 'public' });

/**
 * Seções prontas (como a "section library" do Squarespace/Wix/Framer): em vez de
 * montar bloco a bloco, insere uma seção inteira já composta e pronta para editar.
 */
export interface SectionPreset {
  id: string;
  label: string;
  hint: string;
  make: () => Section;
}

const section = (blocks: Block[], width: Section['style']['width'] = 'normal'): Section => ({ id: uid('s'), style: { width }, blocks });

export const SECTION_PRESETS: SectionPreset[] = [
  {
    id: 'hero',
    label: 'Capa',
    hint: 'Imagem larga + título e texto por cima da dobra',
    make: () =>
      section(
        [
          { ...base(12), type: 'image', content: { image: { url: '', alt: emptyI18n() } } },
          { ...base(12), type: 'heading', content: { text: bi('Seu título aqui', 'Your title here'), level: 1 } },
          { ...base(12), type: 'text', content: { html: bi('<p>Uma linha sobre o projeto ou sobre você.</p>', '<p>One line about the project or about you.</p>') } },
        ],
        'wide',
      ),
  },
  {
    id: 'text-image',
    label: 'Texto + imagem',
    hint: 'Duas colunas: texto à esquerda, imagem à direita',
    make: () =>
      section([
        { ...base(6), type: 'text', content: { html: bi('<p>Escreva aqui…</p>', '<p>Write here…</p>') } },
        { ...base(6), type: 'image', content: { image: { url: '', alt: emptyI18n() } } },
      ]),
  },
  {
    id: 'three-images',
    label: '3 imagens',
    hint: 'Três imagens lado a lado (4/12 cada)',
    make: () =>
      section([
        { ...base(4), type: 'image', content: { image: { url: '', alt: emptyI18n() } } },
        { ...base(4), type: 'image', content: { image: { url: '', alt: emptyI18n() } } },
        { ...base(4), type: 'image', content: { image: { url: '', alt: emptyI18n() } } },
      ]),
  },
  {
    id: 'video',
    label: 'Vídeo + descrição',
    hint: 'Vídeo grande com um título e um texto abaixo',
    make: () =>
      section([
        { ...base(12), type: 'heading', content: { text: bi('Nome do vídeo', 'Video name'), level: 3 } },
        { ...base(12), type: 'embed', content: { provider: 'youtube', ref: '' } },
        { ...base(12), type: 'text', content: { html: bi('<p>O que este vídeo mostra.</p>', '<p>What this video shows.</p>') } },
      ]),
  },
  {
    id: 'gallery',
    label: 'Galeria',
    hint: 'Grade com as imagens da sua galeria',
    make: () =>
      section([
        { ...base(12), type: 'heading', content: { text: bi('Galeria', 'Gallery'), level: 2 } },
        { ...base(12), type: 'collection', content: { collection: 'gallery', cols: 3 } },
      ]),
  },
  {
    id: 'cta',
    label: 'Chamada',
    hint: 'Título, texto curto e um botão (ex.: falar comigo)',
    make: () =>
      section(
        [
          { ...base(12), type: 'heading', content: { text: bi('Vamos trabalhar juntos', "Let's work together"), level: 2 } },
          { ...base(12), type: 'text', content: { html: bi('<p>Disponível para novos projetos.</p>', '<p>Available for new projects.</p>') } },
          { ...base(4), type: 'button', content: { label: bi('Falar comigo', 'Get in touch'), href: 'mailto:', variant: 'solid' } },
        ],
        'narrow',
      ),
  },
];

/**
 * Modelos de página (como os tipos de página do Adobe Portfolio ao criar uma):
 * a página já nasce com as seções prontas certas, em vez de vazia.
 */
export interface PageTemplate {
  id: string;
  label: string;
  hint: string;
  /** Nome provisório (o campo de renomear já abre com ele). */
  title: string;
  presets: string[];
}

export const PAGE_TEMPLATES: PageTemplate[] = [
  { id: 'blank', label: 'Em branco', hint: 'Uma seção vazia', title: 'Nova página', presets: [] },
  { id: 'project', label: 'Projeto', hint: 'Capa, texto + imagem e três imagens', title: 'Novo projeto', presets: ['hero', 'text-image', 'three-images'] },
  { id: 'gallery', label: 'Galeria', hint: 'Título e a grade da galeria', title: 'Galeria', presets: ['gallery'] },
  { id: 'video', label: 'Vídeo', hint: 'Vídeo grande com título e descrição', title: 'Vídeo', presets: ['video'] },
  { id: 'about', label: 'Sobre', hint: 'Texto + imagem e uma chamada para contato', title: 'Sobre', presets: ['text-image', 'cta'] },
  { id: 'contact', label: 'Contato', hint: 'Chamada com botão de e-mail', title: 'Contato', presets: ['cta'] },
];

/** Seções novas (ids novos a cada chamada) de um modelo de página. */
export function pageTemplateSections(t: PageTemplate): Section[] {
  return t.presets.map((id) => SECTION_PRESETS.find((p) => p.id === id)!.make());
}
