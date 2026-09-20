import { bi, emptyI18n } from '../core/i18n';
import type { Block, BlockType } from '../schema/v4';

function newId(): string {
  const rnd = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  return `b_${rnd.replace(/-/g, '').slice(0, 12)}`;
}

/** Bloco padrão para inserção pela paleta de "adicionar bloco". */
export function makeDefaultBlock(type: BlockType): Block {
  const base = { id: newId(), span: 12, visibility: 'public' as const };
  switch (type) {
    case 'heading':
      return { ...base, type, content: { text: bi('Novo título', 'New heading') } };
    case 'text':
      return { ...base, type, content: { html: bi('<p>Escreva aqui…</p>', '<p>Write here…</p>') } };
    case 'image':
      return { ...base, type, span: 6, content: { image: { url: '', alt: emptyI18n() } } };
    case 'embed':
      return { ...base, type, span: 12, content: { provider: 'youtube', ref: '' } };
    case 'storyboard':
      return { ...base, type, content: { frames: [] } };
    case 'collection':
      return { ...base, type, content: { collection: 'projects', cols: 3 } };
    case 'spacer':
      return { ...base, type, content: { size: 'm' } };
    case 'divider':
      return { ...base, type, content: {} };
    case 'contact':
      return {
        ...base, type,
        content: { heading: bi('Contato', 'Contact'), body: emptyI18n(), email: '', phone: '', cvLabel: bi('CV'), cvHref: '#', socials: [] },
      };
    case 'button':
      return { ...base, type, span: 4, content: { label: bi('Baixar CV', 'Download CV'), href: '', variant: 'solid' } };
    case 'columns':
      return { ...base, type, content: { count: 2 } };
    default:
      return { ...base, type: 'divider', content: {} };
  }
}

export const ADDABLE_BLOCKS: { type: BlockType; label: string }[] = [
  { type: 'heading', label: 'Título' },
  { type: 'text', label: 'Texto' },
  { type: 'image', label: 'Imagem' },
  { type: 'embed', label: 'Vídeo/Embed' },
  { type: 'storyboard', label: 'Storyboard' },
  { type: 'collection', label: 'Coleção' },
  { type: 'spacer', label: 'Espaço' },
  { type: 'divider', label: 'Divisor' },
  { type: 'button', label: 'Botão' },
];
