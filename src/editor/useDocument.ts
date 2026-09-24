import { useRef, useSyncExternalStore } from 'react';
import { createStore, type Store } from '../state/store';
import type { AssetMeta, Block, Page, PortfolioV4, Section } from '../schema/v4';
import { findBlock, findSection, getSections, type BlockRef, type CollectionName, type Container, type SectionRef } from './paths';
import { bi, emptyI18n } from '../core/i18n';
import { reorderArray } from '../core/array';
import { newBlockId, newSectionId, renewSectionIds } from './blockFactory';
import { rotuloDaMudanca } from './historyLabel';
import { columnIds, computeRowColumns, detachBlock, placeBlock, rowHeadId, unstackBlock, type DropZone } from './gridOps';

export interface DocApi {
  store: Store<PortfolioV4>;
  state: PortfolioV4;
  updateBlock(ref: BlockRef, recipe: (block: Block) => void, groupKey?: string): void;
  updateSection(ref: SectionRef, recipe: (section: Section) => void, groupKey?: string): void;
  updatePage(pageId: string, recipe: (page: Page) => void, groupKey?: string): void;
  updateTheme(recipe: (theme: PortfolioV4['theme']) => void, groupKey?: string): void;
  updateSite(recipe: (site: PortfolioV4['site']) => void, groupKey?: string): void;
  setAssetMeta(id: string, meta: AssetMeta): void;
  moveBlock(ref: BlockRef, dir: -1 | 1): void;
  reorderBlocks(ref: SectionRef, from: number, to: number): void;
  insertBlock(ref: SectionRef, block: Block, atIndex?: number): void;
  /** Insere logo abaixo de um bloco (mesma coluna se ele divide a linha), mantendo a largura. */
  insertBelow(ref: BlockRef, block: Block): void;
  deleteBlock(ref: BlockRef): void;
  duplicateBlock(ref: BlockRef): BlockRef | null;
  addItem(collection: CollectionName): string;
  deleteItem(collection: CollectionName, id: string): void;
  reorderItems(collection: CollectionName, from: number, to: number): void;
  reorderSections(container: Container, from: number, to: number): void;
  /** Move (id existente) ou insere (bloco novo) relativo a um alvo; cria grids por zona. */
  dropBlock(container: Container, source: string | Block, targetId: string, zone: DropZone): void;
  /** Move/insere um bloco no fim de uma seção (largura cheia). */
  dropBlockInSection(container: Container, source: string | Block, sectionId: string): void;
  /** Tira o bloco da linha/coluna em que está e o põe numa linha só dele (largura cheia), logo depois. */
  blockOwnRow(ref: BlockRef): void;
  /** Alinhamento da linha a que o bloco pertence. */
  setRowAlign(ref: BlockRef, align: 'start' | 'center' | 'end' | 'between'): void;
  /** Largura de um bloco — aplicada à coluna inteira (pilha). */
  setBlockSpan(ref: BlockRef, span: number, groupKey?: string): void;
  addSection(container: Container, atIndex?: number): string | null;
  /** Insere uma seção pronta (colar) no índice dado. */
  insertSection(container: Container, section: Section, atIndex?: number): void;
  /** Insere um item pronto (colar) logo após `afterId` (ou no fim). */
  insertItem(collection: CollectionName, item: PortfolioV4['collections'][CollectionName][number], afterId?: string): void;
  deleteSection(container: Container, sectionId: string): void;
  duplicateSection(container: Container, sectionId: string): void;
  updateItem<K extends CollectionName>(collection: K, id: string, recipe: (item: PortfolioV4['collections'][K][number]) => void, groupKey?: string): void;
  addPage(title: string): string;
  /** Duplica uma página inteira (conteúdo, ajustes e SEO), com ids novos. */
  duplicatePage(pageId: string): string | null;
  deletePage(pageId: string): void;
  toggleNav(pageId: string): void;
  /** Reordena páginas pelo id (a ordem do array é a ordem nas listas). */
  movePage(fromId: string, toId: string): void;
  setItemVisibility(collection: 'projects' | 'blog' | 'gallery' | 'sketches', id: string, vis: PortfolioV4['collections']['projects'][number]['visibility']): void;
  setProjectFeatured(id: string, featured: boolean): void;
  undo(): void;
  redo(): void;
  canUndo: boolean;
  canRedo: boolean;
  /** O que o próximo desfazer/refazer muda ("texto de Título"), ou null. */
  undoLabel: string | null;
  redoLabel: string | null;
}

/**
 * Cópia profunda de um valor do RASCUNHO do Immer. structuredClone não funciona
 * em proxies (era o motivo de duplicar bloco/seção/página falhar em silêncio).
 */
function cloneDraft<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Retira um bloco de qualquer seção (reequilibrando a linha que ele deixou). */
function takeBlock(secs: Section[], id: string): Block | undefined {
  for (const s of secs) {
    const b = detachBlock(s.blocks, id);
    if (b) return b;
  }
  return undefined;
}

export function useDocument(initial: PortfolioV4): DocApi {
  // Ref (não useMemo): o React pode descartar um memo e recriar o store,
  // o que perderia o histórico de undo e as inscrições.
  const held = useRef<{ init: PortfolioV4; store: Store<PortfolioV4> } | null>(null);
  if (!held.current || held.current.init !== initial) {
    held.current = { init: initial, store: createStore(initial, { limit: 200 }) };
  }
  const store = held.current.store;
  const state = useSyncExternalStore(store.subscribe, store.getState, store.getState);

  return {
    store,
    state,
    updateBlock(ref, recipe, groupKey) {
      store.update((d) => {
        const b = findBlock(d, ref);
        if (b) recipe(b);
      }, groupKey ? { groupKey } : undefined);
    },
    updateSection(ref, recipe, groupKey) {
      store.update((d) => {
        const s = findSection(d, ref);
        if (s) recipe(s);
      }, groupKey ? { groupKey } : undefined);
    },
    updatePage(pageId, recipe, groupKey) {
      store.update((d) => {
        const p = d.pages.find((x) => x.id === pageId);
        if (p) recipe(p);
      }, groupKey ? { groupKey } : undefined);
    },
    updateTheme(recipe, groupKey) {
      store.update((d) => recipe(d.theme), groupKey ? { groupKey } : undefined);
    },
    updateSite(recipe, groupKey) {
      store.update((d) => recipe(d.site), groupKey ? { groupKey } : undefined);
    },
    setAssetMeta(id, meta) {
      store.update((d) => {
        d.assets[id] = meta;
      });
    },
    moveBlock(ref, dir) {
      store.update((d) => {
        const s = findSection(d, ref);
        if (!s) return;
        const i = s.blocks.findIndex((b) => b.id === ref.blockId);
        const j = i + dir;
        if (i < 0 || j < 0 || j >= s.blocks.length) return;
        unstackBlock(s.blocks, ref.blockId); // quem se move sai da pilha sem desmontá-la
        const [moved] = s.blocks.splice(i, 1);
        s.blocks.splice(j, 0, moved!);
      });
    },
    reorderBlocks(ref, from, to) {
      store.update((d) => {
        const s = findSection(d, ref);
        if (!s || from === to || !s.blocks[from]) return;
        unstackBlock(s.blocks, s.blocks[from]!.id);
        reorderArray(s.blocks, from, to);
      });
    },
    insertBelow(ref, block) {
      store.update((d) => {
        const s = findSection(d, ref);
        if (!s) return;
        placeBlock(s.blocks, block, ref.blockId, 'bottom', { keepSpan: true });
      });
    },
    insertBlock(ref, block, atIndex) {
      store.update((d) => {
        const s = findSection(d, ref);
        if (!s) return;
        const i = atIndex ?? s.blocks.length;
        s.blocks.splice(Math.max(0, Math.min(i, s.blocks.length)), 0, block);
      });
    },
    deleteBlock(ref) {
      store.update((d) => {
        const s = findSection(d, ref);
        // Mesmo caminho do arrastar: reequilibra a linha / promove o próximo da pilha.
        if (s) detachBlock(s.blocks, ref.blockId);
      });
    },
    duplicateBlock(ref) {
      let created: BlockRef | null = null;
      store.update((d) => {
        const s = findSection(d, ref);
        if (!s) return;
        const i = s.blocks.findIndex((b) => b.id === ref.blockId);
        if (i < 0) return;
        const clone = cloneDraft(s.blocks[i]!);
        clone.id = newBlockId();
        // Logo abaixo do original (mesma coluna se ele divide a linha), com a mesma largura.
        placeBlock(s.blocks, clone, ref.blockId, 'bottom', { keepSpan: true });
        created = { container: ref.container, sectionId: ref.sectionId, blockId: clone.id };
      });
      return created;
    },
    addItem(collection) {
      const id = `${collection.slice(0, 4)}_${newBlockId().slice(2)}`;
      store.update((d) => {
        const order = d.collections[collection].length;
        if (collection === 'projects') {
          d.collections.projects.push({ id, visibility: 'draft', order, featured: false, title: bi('Novo projeto', 'New project'), description: emptyI18n(), thumb: { url: '', alt: emptyI18n() }, meta: {}, sections: [] });
        } else if (collection === 'blog') {
          d.collections.blog.push({ id, visibility: 'draft', order, title: bi('Nova nota', 'New note'), date: emptyI18n(), excerpt: emptyI18n(), thumb: { url: '', alt: emptyI18n() }, sections: [] });
        } else if (collection === 'gallery') {
          d.collections.gallery.push({ id, visibility: 'public', order, image: { url: '', alt: emptyI18n() }, caption: emptyI18n(), span: 1 });
        } else {
          d.collections.sketches.push({ id, visibility: 'public', order, image: { url: '', alt: emptyI18n() }, span: 1 });
        }
      });
      return id;
    },
    deleteItem(collection, id) {
      store.update((d) => {
        const arr = d.collections[collection] as { id: string; order: number }[];
        const i = arr.findIndex((x) => x.id === id);
        if (i >= 0) arr.splice(i, 1);
        arr.forEach((it, n) => (it.order = n));
      });
    },
    reorderItems(collection, from, to) {
      store.update((d) => {
        const arr = d.collections[collection] as { id: string; order: number }[];
        reorderArray(arr, from, to);
        arr.forEach((it, i) => (it.order = i));
      });
    },
    reorderSections(container, from, to) {
      store.update((d) => {
        const secs = getSections(d, container);
        if (secs) reorderArray(secs, from, to);
      });
    },
    dropBlock(container, source, targetId, zone) {
      store.update((d) => {
        const secs = getSections(d, container);
        if (!secs || source === targetId) return;
        const block = typeof source === 'string' ? takeBlock(secs, source) : source;
        const target = secs.find((s) => s.blocks.some((b) => b.id === targetId));
        if (block && target) placeBlock(target.blocks, block, targetId, zone);
      });
    },
    dropBlockInSection(container, source, sectionId) {
      store.update((d) => {
        const secs = getSections(d, container);
        if (!secs?.some((s) => s.id === sectionId)) return;
        const block = typeof source === 'string' ? takeBlock(secs, source) : source;
        if (!block) return;
        // Mantém a largura (elementos não mudam de tamanho ao mudar de lugar).
        block.stack = undefined;
        block.rowAlign = undefined;
        secs.find((s) => s.id === sectionId)!.blocks.push(block);
      });
    },
    blockOwnRow(ref) {
      store.update((d) => {
        const s = findSection(d, ref);
        if (!s) return;
        const i = s.blocks.findIndex((b) => b.id === ref.blockId);
        if (i < 0) return;
        const linha = computeRowColumns(s.blocks).find((r) => r.some((c) => c.includes(i)));
        const fim = linha ? Math.max(...linha.flat()) : i;
        const b = detachBlock(s.blocks, ref.blockId);
        if (!b) return;
        b.span = 12;
        // Depois do que sobrou da linha (sem ele, o último dela está em fim - 1).
        s.blocks.splice(fim, 0, b);
      });
    },
    setRowAlign(ref, align) {
      store.update((d) => {
        const s = findSection(d, ref);
        if (!s) return;
        const head = rowHeadId(s.blocks, ref.blockId);
        for (const b of s.blocks) if (b.id === head) b.rowAlign = align === 'start' ? undefined : align;
      });
    },
    setBlockSpan(ref, span, groupKey) {
      store.update((d) => {
        const s = findSection(d, ref);
        if (!s) return;
        const ids = columnIds(s.blocks, ref.blockId);
        for (const b of s.blocks) if (ids.includes(b.id) && b.span !== span) b.span = span;
      }, groupKey ? { groupKey } : undefined);
    },
    addSection(container, atIndex) {
      const id = newSectionId();
      let ok = false;
      store.update((d) => {
        const secs = getSections(d, container);
        if (!secs) return;
        const i = atIndex ?? secs.length;
        secs.splice(Math.max(0, Math.min(i, secs.length)), 0, { id, style: { width: 'normal' }, blocks: [] });
        ok = true;
      });
      return ok ? id : null;
    },
    insertSection(container, section, atIndex) {
      store.update((d) => {
        const secs = getSections(d, container);
        if (!secs) return;
        const i = atIndex ?? secs.length;
        secs.splice(Math.max(0, Math.min(i, secs.length)), 0, section);
      });
    },
    insertItem(collection, item, afterId) {
      store.update((d) => {
        const arr = d.collections[collection] as { id: string; order: number }[];
        const i = afterId ? arr.findIndex((x) => x.id === afterId) : -1;
        arr.splice(i >= 0 ? i + 1 : arr.length, 0, item as { id: string; order: number });
        arr.forEach((it, n) => (it.order = n));
      });
    },
    deleteSection(container, sectionId) {
      store.update((d) => {
        const secs = getSections(d, container);
        const i = secs?.findIndex((s) => s.id === sectionId) ?? -1;
        if (secs && i >= 0) secs.splice(i, 1);
      });
    },
    duplicateSection(container, sectionId) {
      store.update((d) => {
        const secs = getSections(d, container);
        const i = secs?.findIndex((s) => s.id === sectionId) ?? -1;
        if (!secs || i < 0) return;
        const clone = cloneDraft(secs[i]!);
        renewSectionIds(clone);
        secs.splice(i + 1, 0, clone);
      });
    },
    updateItem(collection, id, recipe, groupKey) {
      store.update((d) => {
        const item = d.collections[collection].find((x) => x.id === id);
        if (item) recipe(item as PortfolioV4['collections'][typeof collection][number]);
      }, groupKey ? { groupKey } : undefined);
    },
    addPage(title) {
      const slug = (title || 'pagina').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'pagina';
      const id = `page_${newBlockId().slice(2)}`;
      store.update((d) => {
        let uniqueSlug = slug;
        let n = 1;
        while (d.pages.some((p) => p.slug === uniqueSlug)) uniqueSlug = `${slug}-${++n}`;
        d.pages.push({
          id,
          slug: uniqueSlug,
          title: { pt: title || 'Nova página', en: title || 'New page' },
          kind: 'static',
          visibility: 'public',
          sections: [{ id: newSectionId(), style: { width: 'normal' }, blocks: [] }],
        });
        d.site.nav.push(id);
      });
      return id;
    },
    duplicatePage(pageId) {
      const id = `page_${newBlockId().slice(2)}`;
      let ok = false;
      store.update((d) => {
        const i = d.pages.findIndex((p) => p.id === pageId);
        const src = d.pages[i];
        if (!src || src.kind !== 'static') return;
        const copy = cloneDraft(src);
        copy.id = id;
        copy.sections.forEach(renewSectionIds);
        copy.title = { pt: `${src.title.pt} (cópia)`, en: `${src.title.en} (copy)` };
        let slug = `${src.slug || 'pagina'}-copia`;
        let n = 1;
        while (d.pages.some((p) => p.slug === slug)) slug = `${src.slug || 'pagina'}-copia-${++n}`;
        copy.slug = slug;
        d.pages.splice(i + 1, 0, copy);
        ok = true;
      });
      return ok ? id : null;
    },
    deletePage(pageId) {
      store.update((d) => {
        if (['home', 'project-detail', 'blog-detail'].includes(pageId)) return; // páginas estruturais
        d.pages = d.pages.filter((p) => p.id !== pageId);
        d.site.nav = d.site.nav.filter((n) => n !== pageId);
      });
    },
    movePage(fromId, toId) {
      store.update((d) => {
        reorderArray(d.pages, d.pages.findIndex((p) => p.id === fromId), d.pages.findIndex((p) => p.id === toId));
      });
    },
    toggleNav(pageId) {
      store.update((d) => {
        const i = d.site.nav.indexOf(pageId);
        if (i >= 0) d.site.nav.splice(i, 1);
        else if (pageId === 'home') d.site.nav.unshift(pageId); // Home abre o menu
        else d.site.nav.push(pageId);
      });
    },
    setItemVisibility(collection, id, vis) {
      store.update((d) => {
        const item = d.collections[collection].find((x) => x.id === id);
        if (item) item.visibility = vis;
      });
    },
    setProjectFeatured(id, featured) {
      store.update((d) => {
        const p = d.collections.projects.find((x) => x.id === id);
        if (p) p.featured = featured;
      });
    },
    undo: () => store.undo(),
    redo: () => store.redo(),
    canUndo: store.canUndo(),
    canRedo: store.canRedo(),
    // Desfazer: a entrada descreve o que foi feito, lido no estado de agora.
    undoLabel: store.peekUndo() ? rotuloDaMudanca(state, store.peekUndo()!.patches) : null,
    // Refazer: o que ela refaria — os caminhos existem no estado de antes.
    redoLabel: store.peekRedo() ? rotuloDaMudanca(state, store.peekRedo()!.patches) : null,
  };
}

export type { Container };
