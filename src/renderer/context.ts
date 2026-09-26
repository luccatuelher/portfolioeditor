import { createContext, useContext } from 'react';
import type { ImageRef, PortfolioV4 } from '../schema/v4';

export type Lang = 'pt' | 'en';

/** Resolve um ImageRef (assetId ou url) numa URL utilizável pelo <img>. */
/**
 * Endereço de uma imagem. `uso: 'miniatura'` = a imagem aparece em grade
 * (card, galeria, quadro): vale a miniatura, se houver (ver core/miniaturas).
 */
export type AssetResolver = (ref: ImageRef, uso?: 'miniatura') => string;

export interface RenderContextValue {
  data: PortfolioV4;
  lang: Lang;
  resolveAsset: AssetResolver;
  /** Overlay de edição ligado (F3). No render público é false. */
  editing: boolean;
  /** Id do bloco selecionado no editor (destaca no canvas). */
  selectedId?: string;
  /** Navegação por slug (no editor/preview). */
  onNavigate?: (slug: string) => void;
  /** Abre o leitor/lightbox (storyboard, galeria, sketches). */
  onOpenLightbox?: (items: LightItem[], index: number) => void;
  /** Editor: edição inline no canvas (texto rich / título) grava no idioma atual. */
  /** Site publicado: há conteúdo NDA trancado; `unlock` devolve null (ok) ou a mensagem de erro. */
  nda?: { locked: boolean; unlock: (password: string) => Promise<string | null> };
  /** Editor: embeds viram capa estática (sem player). */
  posterEmbeds?: boolean;
  /** Editor: largura do bloco no grid (1–12) pela alça do canvas. */
  onSetSpan?: (blockId: string, span: number) => void;
  /** Editor: largura de um elemento do cabeçalho (layout grid). */
  onSetHeaderSpan?: (el: 'brand' | 'nav' | 'lang', span: number) => void;
  /** Tela sendo vista no editor: a alça de largura escreve só nela. */
  device?: 'desktop' | 'tablet' | 'mobile';
  /** Editor: altera a prévia (popup da Home) de um projeto; `init` é a prévia padrão se ainda não houver. */
  onEditPreview?: (projectId: string, recipe: (pv: import('../schema/v4').HomePreview) => void) => void;
  /** Editor: item de coleção selecionado (destaque no canvas). */
  selectedItemId?: string;
  /** Editor: largura de um item de coleção ou quadro de storyboard na grade. */
  onSetItemSpan?: (target: { coll: 'projects' | 'blog' | 'gallery' | 'sketches'; id: string } | { blockId: string; frame: number }, span: number) => void;
  onInlineText?: (blockId: string, value: string, kind: 'text' | 'heading') => void;
}

export interface LightItem {
  src: string;
  alt: string;
  crop?: import('../schema/v4').ImageCrop;
  /** Legenda visível (galeria), embaixo da imagem no visualizador. */
  caption?: string;
}

export const RenderContext = createContext<RenderContextValue | null>(null);

export function useRender(): RenderContextValue {
  const ctx = useContext(RenderContext);
  if (!ctx) throw new Error('useRender() precisa estar dentro de <RenderContext.Provider>.');
  return ctx;
}
