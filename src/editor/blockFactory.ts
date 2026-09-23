import { bi, emptyI18n } from '../core/i18n';
import type { Block, BlockType, Section } from '../schema/v4';

/** Id novo de bloco (`b_…`); seções e itens usam o mesmo sorteio com outro prefixo. */
export function newBlockId(): string {
  const rnd = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  return `b_${rnd.replace(/-/g, '').slice(0, 12)}`;
}
const newId = newBlockId;

export function newSectionId(): string {
  return `s_${newBlockId().slice(2)}`;
}

/**
 * Dá ids novos a uma seção copiada e aos blocos dela (no lugar). Devolve
 * antigo → novo dos blocos, para quem guarda referências a eles (a prévia do
 * projeto na Home aponta blocos pelo id).
 */
export function renewSectionIds(section: Section): Map<string, string> {
  const map = new Map<string, string>();
  section.id = newSectionId();
  for (const b of section.blocks) {
    const novo = newBlockId();
    if (!map.has(b.id)) map.set(b.id, novo);
    b.id = novo;
  }
  return map;
}

/**
 * Ids novos para a cópia de um item de coleção (colar, Ctrl+D): o item, as
 * seções e os blocos. Sem isso a cópia de um projeto dividia os ids de seção
 * e bloco com o original. A prévia do projeto é remapeada junto.
 */
export function renewItemIds<T extends { id: string; sections?: Section[]; preview?: { items: { ref: string }[] } }>(item: T, collection: string): T {
  item.id = `${collection.slice(0, 4)}_${newBlockId().slice(2)}`;
  const map = new Map<string, string>();
  for (const s of item.sections ?? []) for (const [a, b] of renewSectionIds(s)) if (!map.has(a)) map.set(a, b);
  for (const it of item.preview?.items ?? []) it.ref = map.get(it.ref) ?? it.ref;
  return item;
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
