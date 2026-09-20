import type { Block, HomePreview, ProjectItem } from '../schema/v4';

/** Todos os blocos do projeto, na ordem das seções. */
export function projectBlocks(item: ProjectItem): Block[] {
  return item.sections.flatMap((s) => s.blocks);
}

/**
 * Prévia padrão (quando o projeto ainda não tem uma própria): todos os blocos
 * das seções não ocultas na Home, com a largura original, + a descrição.
 */
export function defaultPreview(item: ProjectItem): HomePreview {
  return {
    items: item.sections.filter((s) => !s.homeHidden).flatMap((s) => s.blocks.map((b) => ({ ref: b.id, span: b.span }))),
  };
}

export function effectivePreview(item: ProjectItem): HomePreview {
  return item.preview ?? defaultPreview(item);
}

/** Nome amigável de cada tipo de bloco (Layers, inspector, chips da prévia). */
export const TYPE_LABEL: Record<string, string> = {
  heading: 'Título', text: 'Texto', image: 'Imagem', embed: 'Vídeo', storyboard: 'Storyboard', collection: 'Coleção',
  spacer: 'Espaço', divider: 'Divisor', contact: 'Contato', button: 'Botão', columns: 'Colunas',
};

/** Rótulo curto de um bloco para os chips de seleção da prévia. */
export function blockLabel(b: Block): string {
  const clip = (s: string): string => {
    const t = s.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
    return t.length > 24 ? `${t.slice(0, 24)}…` : t;
  };
  let detail = '';
  if (b.type === 'text') detail = clip(b.content.html.pt || b.content.html.en);
  else if (b.type === 'heading') detail = clip(b.content.text.pt || b.content.text.en);
  else if (b.type === 'embed') detail = b.content.provider === 'speakerdeck' ? 'Speaker Deck' : b.content.provider === 'vimeo' ? 'Vimeo' : 'YouTube';
  else if (b.type === 'storyboard') detail = `${b.content.frames.length} quadros`;
  else if (b.type === 'button') detail = clip(b.content.label.pt);
  const base = TYPE_LABEL[b.type] ?? b.type;
  return detail ? `${base} · ${detail}` : base;
}
