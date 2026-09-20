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
