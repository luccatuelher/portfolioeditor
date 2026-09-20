import type { Block, PortfolioV4, ProjectItem, BlogItem, Section } from '../schema/v4';

/**
 * Endereçamento de nós do documento v4. Um bloco/seção vive numa página OU nas
 * sections de um item de coleção — este é o "caminho único" que seleção, layers
 * e inspector compartilham para localizar e editar qualquer parte do site.
 */

export type CollectionName = 'projects' | 'blog' | 'gallery' | 'sketches';

export type Container =
  | { on: 'page'; pageId: string }
  | { on: 'item'; collection: 'projects' | 'blog'; itemId: string };

export interface SectionRef {
  container: Container;
  sectionId: string;
}
export interface BlockRef {
  container: Container;
  sectionId: string;
  blockId: string;
}

export type Selection =
  | { kind: 'page'; pageId: string }
  | { kind: 'section'; ref: SectionRef }
  | { kind: 'block'; ref: BlockRef }
  | { kind: 'item'; collection: CollectionName; itemId: string }
  | { kind: 'site' }
  | null;

export function sameContainer(a: Container, b: Container): boolean {
  if (a.on !== b.on) return false;
  if (a.on === 'page' && b.on === 'page') return a.pageId === b.pageId;
  if (a.on === 'item' && b.on === 'item') return a.collection === b.collection && a.itemId === b.itemId;
  return false;
}

/** Retorna o array de sections do container (na página ou no item). É mutável quando `doc` é um draft Immer. */
export function getSections(doc: PortfolioV4, c: Container): Section[] | undefined {
  if (c.on === 'page') return doc.pages.find((p) => p.id === c.pageId)?.sections;
  const coll: (ProjectItem | BlogItem)[] = c.collection === 'projects' ? doc.collections.projects : doc.collections.blog;
  return coll.find((it) => it.id === c.itemId)?.sections;
}

export function findSection(doc: PortfolioV4, ref: SectionRef): Section | undefined {
  return getSections(doc, ref.container)?.find((s) => s.id === ref.sectionId);
}

export function findBlock(doc: PortfolioV4, ref: BlockRef): Block | undefined {
  return findSection(doc, ref)?.blocks.find((b) => b.id === ref.blockId);
}

/** Dado um blockId e o container atual, descobre a seção que o contém. */
export function locateBlock(doc: PortfolioV4, container: Container, blockId: string): BlockRef | null {
  const sections = getSections(doc, container);
  if (!sections) return null;
  for (const s of sections) {
    if (s.blocks.some((b) => b.id === blockId)) return { container, sectionId: s.id, blockId };
  }
  return null;
}

/** Sobe um nível na hierarquia (bloco → seção → página/item/nada). */
export function parentOf(sel: Selection): Selection {
  if (!sel) return null;
  if (sel.kind === 'block') return { kind: 'section', ref: { container: sel.ref.container, sectionId: sel.ref.sectionId } };
  if (sel.kind === 'section') {
    return sel.ref.container.on === 'page'
      ? { kind: 'page', pageId: sel.ref.container.pageId }
      : { kind: 'item', collection: sel.ref.container.collection, itemId: sel.ref.container.itemId };
  }
  return null;
}
