import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Lang, RenderContextValue } from '../renderer/context';
import { RenderContext } from '../renderer/context';
import { PageView } from '../renderer/Page';
import { SiteHeader } from '../renderer/Header';
import { defaultPreview } from '../renderer/preview';
import { DEFAULT_HEADER, headerSpan, type HeaderElement } from '../schema/v4';
import { detachBlock, placeBlock } from './gridOps';
import { pick } from '../renderer/text';
import { styleVars } from '../renderer/css';
import { mapResolver } from '../renderer/dataUrlResolver';
import { themeToCssVars } from '../renderer/theme';
import { siteFrame } from '../renderer/siteFrame';
import { themeFontUrls } from '../renderer/fonts';
import { buildBackup, parseBackup, type Backup } from './backup';
import siteShell from '../publish/site-shell.html?raw';
import { assembleSiteHtml } from '../publish/assemble';
import { buildPublishPayload } from '../publish/buildPayload';
import { runPreflight } from '../publish/preflight';
import type { MigratedAsset } from '../migrate/migrate';
import { importImage } from '../assets/importImage';
import { makeFavicon } from '../assets/favicon';
import { assetIdFromContent } from '../core/ids';
import { emptyI18n } from '../core/i18n';
import { makeDefaultBlock } from './blockFactory';
import { FloatingToolbar } from './FloatingToolbar';
import { sanitizeInlineHtml } from './sanitize';
import type { Block, BlogItem, Page, PortfolioV4, ProjectItem, Section } from '../schema/v4';
import { Inspector } from './Inspector';
import { LayersPanel } from './LayersPanel';
import { PagesPanel } from './PagesPanel';
import { ThemePanel } from './ThemePanel';
import { DataPanel } from './DataPanel';
import { findSection, getSections, locateBlock, parentOf, sameContainer, type CollectionName, type Container, type Selection } from './paths';
import type { DropZone } from './gridOps';
import { reorderArray } from '../core/array';
import { AddBlockPopup, ElementsPalette } from './ElementsPalette';
import { SECTION_PRESETS } from './sectionPresets';
import { VersionsModal } from './VersionsModal';
import { NdaPasswordModal } from './NdaPasswordModal';
import { saveVersion } from './versions';
import { CropModal } from './CropModal';
import type { ImageCrop, ImageRef } from '../schema/v4';
import { LangFlag } from '../renderer/Flags';
import { useDocument } from './useDocument';
import { useLocalDraft, type SaveStatus } from './useLocalDraft';

export interface EditorProps {
  initial: PortfolioV4;
  /** assetId → data URL (imagens). Mutável via importação de backup. */
  assets: Record<string, string>;
  /** Chamado ao importar um backup (a raiz remonta o editor). */
  onImport?: (backup: Backup) => void;
  /** Adiciona uma imagem ao mapa de assets (data URL) sem remontar o editor. */
  onAddAsset?: (id: string, dataUrl: string) => void;
  persist?: boolean;
  /** Aviso exibido no topo (ex.: rascunho recuperado com ajustes). */
  notice?: string;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

function newBlockId(): string {
  const rnd = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  return `b_${rnd.replace(/-/g, '').slice(0, 12)}`;
}

type Clip =
  | { kind: 'block'; block: Block }
  | { kind: 'section'; section: Section }
  | { kind: 'item'; coll: CollectionName; item: PortfolioV4['collections'][CollectionName][number] };

/** Fotografa a seleção para a área de transferência interna do editor. */
function copySelection(doc: PortfolioV4, sel: NonNullable<Selection>): Clip | null {
  if (sel.kind === 'block') {
    const b = findSection(doc, sel.ref)?.blocks.find((x) => x.id === sel.ref.blockId);
    return b ? { kind: 'block', block: structuredClone(b) } : null;
  }
  if (sel.kind === 'section') {
    const s = findSection(doc, sel.ref);
    return s ? { kind: 'section', section: structuredClone(s) } : null;
  }
  if (sel.kind === 'item') {
    const it = doc.collections[sel.collection].find((x) => x.id === sel.itemId);
    return it ? { kind: 'item', coll: sel.collection, item: structuredClone(it) } : null;
  }
  return null;
}

type DragSource =
  | { kind: 'block'; id: string }
  | { kind: 'new'; type: Block['type'] }
  | { kind: 'item'; coll: CollectionName; id: string }
  | { kind: 'frame'; blockId: string; idx: number }
  | { kind: 'header'; el: HeaderElement }
  | { kind: 'nav'; pageId: string }
  | { kind: 'pv'; project: string; ref: string };

function resolveView(doc: PortfolioV4, c: Container): { page: Page; item?: ProjectItem | BlogItem } {
  if (c.on === 'page') return { page: doc.pages.find((p) => p.id === c.pageId) ?? doc.pages[0]! };
  const page = doc.pages.find((p) => p.id === `${c.collection === 'projects' ? 'project' : 'blog'}-detail`)!;
  const item = c.collection === 'projects' ? doc.collections.projects.find((i) => i.id === c.itemId) : doc.collections.blog.find((i) => i.id === c.itemId);
  return item ? { page, item } : { page };
}

export function Editor({ initial, assets, onImport, onAddAsset, persist = true, notice }: EditorProps): React.ReactElement {
  const [showNotice, setShowNotice] = useState(!!notice);
  // Avisos da última publicação ("Baixar site"), mostrados na barra de aviso.
  const [publishNotice, setPublishNotice] = useState<string | null>(null);
  const doc = useDocument(initial);
  const resolveAsset = useMemo(() => mapResolver(assets), [assets]);
  const saveStatus = useLocalDraft(doc.state, assets, persist);

  const uploadImage = useCallback(
    async (file: File): Promise<string> => {
      let r: Awaited<ReturnType<typeof importImage>>;
      try {
        r = await importImage(file, { maxSide: 2400 });
      } catch (err) {
        // Um único aviso para todo envio de imagem (canvas, inspector, tema…); quem chamou simplesmente não segue.
        alert(`Não consegui usar essa imagem: ${err instanceof Error ? err.message : String(err)}`);
        return new Promise<string>(() => {});
      }
      const dataUrl = await blobToDataUrl(r.blob);
      const id = assetIdFromContent(dataUrl);
      onAddAsset?.(id, dataUrl);
      doc.setAssetMeta(id, { mime: 'image/webp', w: r.w, h: r.h, alt: emptyI18n() });
      return id;
    },
    [doc, onAddAsset],
  );
  const uploadFavicon = useCallback(
    async (file: File): Promise<void> => {
      let dataUrl: string;
      try {
        dataUrl = await makeFavicon(file);
      } catch (err) {
        alert(`Não consegui usar essa imagem como ícone: ${err instanceof Error ? err.message : String(err)}`);
        return;
      }
      const id = assetIdFromContent(dataUrl);
      onAddAsset?.(id, dataUrl);
      doc.setAssetMeta(id, { mime: 'image/png', w: 128, h: 128, alt: emptyI18n() });
      doc.updateSite((s) => void (s.favicon = { assetId: id, alt: emptyI18n() }));
    },
    [doc, onAddAsset],
  );
  const [container, setContainer] = useState<Container>({ on: 'page', pageId: 'home' });
  const [selection, setSelection] = useState<Selection>(null);
  const [lang, setLang] = useState<Lang>('pt');
  const [leftTab, setLeftTab] = useState<'pages' | 'layers' | 'theme' | 'data'>('layers');
  // Largura do canvas: ver o site como no tablet/celular (usa o mesmo CSS responsivo do site).
  const [device, setDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const backupRef = useRef<(() => void) | null>(null);
  const clipboard = useRef<Clip | null>(null);
  const drag = useRef<DragSource | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const pendingPick = useRef<((assetId: string) => void) | null>(null);
  // Recortador aberto: imagem atual, trava de proporção e como gravar o resultado.
  // Popup de "＋ Adicionar bloco": seção de destino e posição na tela.
  const [addMenu, setAddMenu] = useState<{ sectionId: string; x: number; y: number } | null>(null);
  const [cropping, setCropping] = useState<{ image: ImageRef; lock?: number; apply: (c: ImageCrop | undefined) => void } | null>(null);
  // Guias de alinhamento: enquanto arrasta, o canvas mostra as 12 colunas da grade.
  const [dragging, setDragging] = useState(false);
  const [showVersions, setShowVersions] = useState(false);

  const { page, item } = resolveView(doc.state, container);
  const favSrc = doc.state.site.favicon ? resolveAsset(doc.state.site.favicon) : '';
  useEffect(() => {
    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!favSrc) {
      link?.remove();
      return;
    }
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = favSrc;
  }, [favSrc]);
  const selectedId = selection?.kind === 'block' ? selection.ref.blockId : undefined;
  const docRef = useRef(doc);
  docRef.current = doc;

  /** Seleciona um item da lista de Dados E leva o canvas até onde ele aparece. */
  const abrirItem = useCallback(
    (s: Selection) => {
      setSelection(s);
      if (!s || s.kind !== 'item') return;
      if (s.collection === 'projects' || s.collection === 'blog') {
        setContainer({ on: 'item', collection: s.collection, itemId: s.itemId });
        return;
      }
      // Galeria e sketches não têm página própria: vai para a página que os lista.
      const pagina = docRef.current.state.pages.find((p) =>
        p.sections.some((sec) => sec.blocks.some((b) => b.type === 'collection' && b.content.collection === s.collection)),
      );
      if (pagina) setContainer({ on: 'page', pageId: pagina.id });
    },
    [],
  );

  const openContainer = useCallback((c: Container) => {
    setContainer(c);
    setSelection(c.on === 'item' ? { kind: 'item', collection: c.collection, itemId: c.itemId } : null);
  }, []);

  useEffect(() => {
    const s = doc.state;
    const gone = container.on === 'page' ? !s.pages.some((p) => p.id === container.pageId) : !s.collections[container.collection].some((i) => i.id === container.itemId);
    if (gone) openContainer({ on: 'page', pageId: 'home' });
  }, [doc.state, container, openContainer]);

  useEffect(() => {
    if (selection?.kind !== 'block') return;
    const el = document.querySelector<HTMLElement>(`.editor-canvas [data-block-id="${CSS.escape(selection.ref.blockId)}"]`);
    const wrap = el?.closest('.editor-canvas-wrap');
    if (!el || !wrap) return;
    const r = el.getBoundingClientRect();
    const w = wrap.getBoundingClientRect();
    if (r.bottom < w.top + 40 || r.top > w.bottom - 40) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [selection]);

  // Fontes do tema que não vêm de fábrica: carrega do Google Fonts (senão o navegador cai numa genérica).
  const fontUrls = themeFontUrls(doc.state.theme.fonts).join('|');
  useEffect(() => {
    document.querySelectorAll('link[data-theme-font]').forEach((l) => l.remove());
    for (const href of fontUrls ? fontUrls.split('|') : []) {
      const l = document.createElement('link');
      l.rel = 'stylesheet';
      l.href = href;
      l.setAttribute('data-theme-font', '');
      document.head.appendChild(l);
    }
  }, [fontUrls]);

  /** Abre o seletor de arquivo e entrega o assetId da imagem enviada. */
  const pickImage = useCallback((apply: (assetId: string) => void) => {
    pendingPick.current = apply;
    fileInput.current?.click();
  }, []);
  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const f = e.target.files?.[0];
    e.target.value = '';
    const apply = pendingPick.current;
    pendingPick.current = null;
    if (f && apply) void uploadImage(f).then(apply);
  };

  /** Navegação dentro do canvas (menu, cards de projeto/nota). */
  const navigate = useCallback(
    (route: string) => {
      const m = route.match(/^(project|blog)\/(.+)$/);
      if (m) {
        openContainer({ on: 'item', collection: m[1] === 'project' ? 'projects' : 'blog', itemId: m[2]! });
        return;
      }
      const p = docRef.current.state.pages.find((x) => x.slug === route || x.id === route) ?? docRef.current.state.pages.find((x) => x.id === 'home');
      if (p) openContainer({ on: 'page', pageId: p.id });
    },
    [openContainer],
  );

  /** Altera a prévia (popup da Home) de um projeto, criando-a a partir da padrão se preciso. */
  const editPreview = useCallback((projectId: string, recipe: (pv: NonNullable<ProjectItem['preview']>) => void) => {
    docRef.current.updateItem('projects', projectId, (it) => {
      const p = it as ProjectItem;
      p.preview ??= defaultPreview(p);
      recipe(p.preview);
    });
  }, []);

  /** Adiciona um elemento da paleta: após o bloco selecionado, na seção selecionada ou na última seção. */
  const addElement = useCallback(
    (type: Block['type']) => {
      const d = docRef.current;
      const block = makeDefaultBlock(type);
      let sectionId = selection?.kind === 'block' || selection?.kind === 'section' ? selection.ref.sectionId : undefined;
      if (selection && (selection.kind === 'block' || selection.kind === 'section') && !sameContainer(selection.ref.container, container)) sectionId = undefined;
      const secs = getSections(d.state, container) ?? [];
      sectionId ??= secs[secs.length - 1]?.id ?? d.addSection(container) ?? undefined;
      if (!sectionId) return;
      const ref = { container, sectionId };
      if (selection?.kind === 'block' && sameContainer(selection.ref.container, container)) d.insertBelow(selection.ref, block);
      else d.insertBlock(ref, block);
      const bref = { container, sectionId, blockId: block.id };
      setSelection({ kind: 'block', ref: bref });
      if (type === 'image') pickImage((aid) => docRef.current.updateBlock(bref, (b) => { if (b.type === 'image') { b.content.image.assetId = aid; b.content.image.url = undefined; } }));
    },
    [selection, container, pickImage],
  );

  /** Insere uma seção pronta depois da seção selecionada (ou no fim da página). */
  const addSectionPreset = useCallback(
    (presetId: string) => {
      const preset = SECTION_PRESETS.find((p) => p.id === presetId);
      if (!preset) return;
      const d = docRef.current;
      const secs = getSections(d.state, container) ?? [];
      const selSec = selection && (selection.kind === 'block' || selection.kind === 'section') && sameContainer(selection.ref.container, container) ? selection.ref.sectionId : undefined;
      const at = selSec ? secs.findIndex((s) => s.id === selSec) + 1 : secs.length;
      const sec = preset.make();
      d.insertSection(container, sec, at);
      setSelection({ kind: 'section', ref: { container, sectionId: sec.id } });
    },
    [container, selection],
  );

  /** Remove o que está selecionado (bloco, seção ou item). `ask` confirma o que tem conteúdo. */
  const removeSelection = (sel: NonNullable<Selection>, ask: boolean): void => {
    const d = docRef.current;
    if (sel.kind === 'block') d.deleteBlock(sel.ref);
    else if (sel.kind === 'section') {
      const sec = findSection(d.state, sel.ref);
      if (ask && sec?.blocks.length && !confirm('Excluir esta seção e seus blocos?')) return;
      d.deleteSection(sel.ref.container, sel.ref.sectionId);
    } else if (sel.kind === 'item') {
      if (ask && !confirm('Excluir este item?')) return;
      d.deleteItem(sel.collection, sel.itemId);
      if (container.on === 'item' && container.itemId === sel.itemId) openContainer({ on: 'page', pageId: 'home' });
    } else return;
    setSelection(null);
  };

  /** Cola o conteúdo da área de transferência perto da seleção atual (sempre com ids novos). */
  const pasteClip = (clip: Clip): void => {
    const d = docRef.current;
    if (clip.kind === 'item') {
      const it = structuredClone(clip.item);
      it.id = `${clip.coll.slice(0, 4)}_${newBlockId().slice(2)}`;
      const after = selection?.kind === 'item' && selection.collection === clip.coll ? selection.itemId : clip.item.id;
      d.insertItem(clip.coll, it, after);
      setSelection({ kind: 'item', collection: clip.coll, itemId: it.id });
      return;
    }
    const secs = getSections(d.state, container) ?? [];
    const selSec = selection && (selection.kind === 'block' || selection.kind === 'section') && sameContainer(selection.ref.container, container) ? selection.ref.sectionId : undefined;
    if (clip.kind === 'section') {
      const s = structuredClone(clip.section);
      s.id = `s_${newBlockId().slice(2)}`;
      s.blocks.forEach((b) => (b.id = newBlockId()));
      const i = selSec ? secs.findIndex((x) => x.id === selSec) + 1 : secs.length;
      d.insertSection(container, s, i);
      setSelection({ kind: 'section', ref: { container, sectionId: s.id } });
      return;
    }
    const b = structuredClone(clip.block);
    b.id = newBlockId();
    const sectionId = selSec ?? secs[secs.length - 1]?.id ?? d.addSection(container) ?? undefined;
    if (!sectionId) return;
    const secRef = { container, sectionId };
    if (selection?.kind === 'block' && sameContainer(selection.ref.container, container)) d.insertBelow(selection.ref, b);
    else d.insertBlock(secRef, b);
    setSelection({ kind: 'block', ref: { container, sectionId, blockId: b.id } });
  };

  // Atalhos: um único listener que sempre lê o estado mais recente (sem re-registrar a cada render).
  const onKeyRef = useRef<(e: KeyboardEvent) => void>(() => {});
  onKeyRef.current = (e: KeyboardEvent): void => {
    const t = e.target as HTMLElement | null;
    // Digitando/escolhendo num campo: os atalhos de texto são do próprio campo.
    const typing = !!t?.closest?.('input, textarea, select, [contenteditable="true"]');
    const mod = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();
    // Popup "adicionar bloco" / recortador abertos: só o Esc (fechar) importa aqui.
    if (addMenu || cropping) {
      if (e.key === 'Escape') setAddMenu(null);
      return;
    }
    if (mod && key === 's') {
      // Ctrl+S: baixa o backup (o rascunho já é salvo sozinho no navegador).
      e.preventDefault();
      backupRef.current?.();
      return;
    }
    if (mod && key === 'z') {
      if (typing) return; // undo nativo do campo
      e.preventDefault();
      if (e.shiftKey) doc.redo();
      else doc.undo();
      return;
    }
    if (mod && key === 'y') {
      if (typing) return;
      e.preventDefault();
      doc.redo();
      return;
    }
    // Duplicar (Ctrl+D): igual para bloco, seção e item — a cópia entra logo abaixo/depois.
    if (mod && key === 'd' && !typing && selection) {
      e.preventDefault();
      if (selection.kind === 'block') {
        const created = doc.duplicateBlock(selection.ref);
        if (created) setSelection({ kind: 'block', ref: created });
      } else {
        const clip = copySelection(doc.state, selection);
        if (clip) pasteClip(clip);
      }
      return;
    }
    // Copiar / recortar / colar / excluir: iguais para bloco, seção e item de coleção.
    if (mod && (key === 'c' || key === 'x') && !typing && selection) {
      const clip = copySelection(doc.state, selection);
      if (!clip) return;
      e.preventDefault();
      clipboard.current = clip;
      if (key === 'x') removeSelection(selection, false);
      return;
    }
    if (mod && key === 'v' && !typing && clipboard.current) {
      e.preventDefault();
      pasteClip(clipboard.current);
      return;
    }
    if (!typing && (e.key === 'Delete' || e.key === 'Backspace') && selection && selection.kind !== 'site' && selection.kind !== 'page') {
      e.preventDefault();
      removeSelection(selection, true);
      return;
    }
    if (e.key === 'Escape' && !typing) setSelection((s) => parentOf(s));
  };
  useEffect(() => {
    const onKey = (ev: KeyboardEvent): void => onKeyRef.current(ev);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const onCanvasClick = useCallback(
    (e: React.MouseEvent): void => {
      const el = e.target as HTMLElement;
      if (el.closest('.inline-edit')) return; // deixa o cursor/seleção do editável em paz
      const stop = (): void => {
        e.preventDefault();
        e.stopPropagation();
      };
      const d = docRef.current;
      const setImg = (img: { assetId?: string; url?: string }, aid: string): void => {
        img.assetId = aid;
        img.url = undefined;
      };

      // Ícones de ação no hover (editar / trocar imagem / excluir).
      const actBtn = el.closest('[data-act]');
      const actBox = actBtn?.closest('.pe-actions');
      if (actBtn && actBox) {
        stop();
        const act = actBtn.getAttribute('data-act');
        const target = actBox.getAttribute('data-target');
        const id = actBox.getAttribute('data-id')!;
        if (target === 'block') {
          const ref = locateBlock(d.state, container, id);
          if (!ref) return;
          if (act === 'delete') {
            removeSelection({ kind: 'block', ref }, false);
          } else {
            setSelection({ kind: 'block', ref });
            if (act === 'image') pickImage((aid) => docRef.current.updateBlock(ref, (b) => void (b.type === 'image' && setImg(b.content.image, aid))));
            if (act === 'crop') {
              const blk = findSection(d.state, ref)?.blocks.find((x) => x.id === ref.blockId);
              if (blk?.type === 'image') setCropping({ image: blk.content.image, apply: (c) => docRef.current.updateBlock(ref, (b) => void (b.type === 'image' && (b.content.image.crop = c))) });
            }
          }
        } else if (target === 'item') {
          const coll = actBox.getAttribute('data-coll') as CollectionName;
          if (act === 'delete') {
            removeSelection({ kind: 'item', collection: coll, itemId: id }, true);
          } else if (act === 'edit') {
            setSelection({ kind: 'item', collection: coll, itemId: id });
          } else if (act === 'crop') {
            const it = d.state.collections[coll].find((x) => x.id === id);
            if (it) {
              const isThumb = 'thumb' in it;
              setCropping({
                image: isThumb ? (it as { thumb: ImageRef }).thumb : (it as { image: ImageRef }).image,
                lock: isThumb ? 16 / 9 : undefined, // capas de card são sempre 16:9
                apply: (c) => docRef.current.updateItem(coll, id, (x) => { const img = 'thumb' in x ? x.thumb : x.image; img.crop = c; }),
              });
            }
          } else if (act === 'image') {
            pickImage((aid) =>
              docRef.current.updateItem(coll, id, (it) => {
                if ('thumb' in it) setImg(it.thumb, aid);
                else setImg(it.image, aid);
              }),
            );
          }
        } else if (target === 'pv') {
          const project = actBox.getAttribute('data-project')!;
          editPreview(project, (pv) => { pv.items = pv.items.filter((x) => x.ref !== id); });
        } else if (target === 'header') {
          const el = id as HeaderElement;
          if (act === 'hide') {
            d.updateSite((st) => {
              const h = (st.header ??= structuredClone(DEFAULT_HEADER));
              const hid = new Set(h.hidden ?? []);
              if (hid.has(el)) hid.delete(el);
              else hid.add(el);
              h.hidden = [...hid];
            });
          }
          setSelection({ kind: 'site' });
        } else if (target === 'frame') {
          const ref = locateBlock(d.state, container, id);
          const idx = Number(actBox.getAttribute('data-idx'));
          if (!ref) return;
          if (act === 'delete') d.updateBlock(ref, (b) => void (b.type === 'storyboard' && b.content.frames.splice(idx, 1)));
          else if (act === 'crop') {
            const blk = findSection(d.state, ref)?.blocks.find((x) => x.id === ref.blockId);
            const f = blk?.type === 'storyboard' ? blk.content.frames[idx] : undefined;
            if (f) setCropping({ image: f, apply: (c) => docRef.current.updateBlock(ref, (b) => { const fr = b.type === 'storyboard' ? b.content.frames[idx] : undefined; if (fr) fr.crop = c; }) });
          } else pickImage((aid) => docRef.current.updateBlock(ref, (b) => { const f = b.type === 'storyboard' ? b.content.frames[idx] : undefined; if (f) setImg(f, aid); }));
        }
        return;
      }

      // Tiles de "adicionar" dentro de blocos (galeria/sketches/storyboard/imagem vazia).
      const itemAdd = el.closest('[data-item-add]');
      if (itemAdd) {
        stop();
        const coll = itemAdd.getAttribute('data-item-add') as 'gallery' | 'sketches';
        pickImage((aid) => {
          const nid = docRef.current.addItem(coll);
          docRef.current.updateItem(coll, nid, (it) => setImg(it.image, aid));
        });
        return;
      }
      const frameAdd = el.closest('[data-frame-add]');
      if (frameAdd) {
        stop();
        const ref = locateBlock(d.state, container, frameAdd.getAttribute('data-frame-add')!);
        if (ref) pickImage((aid) => docRef.current.updateBlock(ref, (b) => void (b.type === 'storyboard' && b.content.frames.push({ assetId: aid, alt: emptyI18n() }))));
        return;
      }
      const blockUpload = el.closest('[data-block-upload]');
      if (blockUpload) {
        stop();
        const ref = locateBlock(d.state, container, blockUpload.getAttribute('data-block-upload')!);
        if (ref) {
          setSelection({ kind: 'block', ref });
          pickImage((aid) => docRef.current.updateBlock(ref, (b) => void (b.type === 'image' && setImg(b.content.image, aid))));
        }
        return;
      }

      // Menu do site: troca de página.
      const navEl = el.closest('[data-nav-page]');
      if (navEl) {
        stop();
        openContainer({ on: 'page', pageId: navEl.getAttribute('data-nav-page')! });
        return;
      }

      // Imagem da galeria/sketch: seleciona o próprio item (recortar, copiar, excluir, inspector).
      const imgItem = el.closest('[data-item-coll="gallery"], [data-item-coll="sketches"]');
      if (imgItem) {
        stop();
        setSelection({ kind: 'item', collection: imgItem.getAttribute('data-item-coll') as CollectionName, itemId: imgItem.getAttribute('data-item-id')! });
        return;
      }

      // Cards de projeto/nota, prévia e filtros: deixa o próprio componente agir (abrir prévia / página).
      if (el.closest('.project-card, .blog-item, .home-preview, .project-filter')) return;

      const addBtn = el.closest('[data-add-block]');
      if (addBtn) {
        e.preventDefault();
        e.stopPropagation();
        const sectionId = addBtn.getAttribute('data-add-block')!;
        const r = addBtn.getBoundingClientRect();
        setAddMenu({ sectionId, x: r.left + r.width / 2, y: r.bottom });
        return;
      }
      if (el.closest('[data-site-header]')) {
        e.preventDefault();
        setSelection({ kind: 'site' });
        return;
      }
      const blockEl = el.closest('[data-block-id]');
      if (blockEl) {
        e.preventDefault();
        e.stopPropagation();
        const ref = locateBlock(doc.state, container, blockEl.getAttribute('data-block-id')!);
        if (ref) setSelection({ kind: 'block', ref });
        return;
      }
      const secEl = el.closest('[data-section-id]');
      if (secEl) {
        e.preventDefault();
        setSelection({ kind: 'section', ref: { container, sectionId: secEl.getAttribute('data-section-id')! } });
      }
    },
    [doc.state, container, openContainer, pickImage],
  );

  // ------------------------------------------------------------ arrastar e soltar
  // Fontes: bloco (alça ⠿), elemento novo (paleta), item de coleção, quadro de storyboard.
  const marked = useRef<HTMLElement | null>(null);
  const mark = (el: HTMLElement | null, zone?: string): void => {
    if (marked.current && marked.current !== el) marked.current.removeAttribute('data-drop');
    marked.current = el;
    if (el && zone) el.setAttribute('data-drop', zone);
  };
  const dropTarget = (e: React.DragEvent): { el: HTMLElement; zone: string } | null => {
    const src = drag.current;
    const t = e.target as HTMLElement;
    if (!src) return null;
    if (src.kind === 'item') {
      const el = t.closest<HTMLElement>(`[data-item-coll="${src.coll}"]`);
      return el && el.getAttribute('data-item-id') !== src.id ? { el, zone: 'swap' } : null;
    }
    if (src.kind === 'pv') {
      const el = t.closest<HTMLElement>(`[data-pv-of="${src.project}"][data-pv-cell]`);
      if (!el || el.getAttribute('data-pv-cell') === src.ref) return null;
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      return { el, zone: x < 0.25 ? 'left' : x > 0.75 ? 'right' : (e.clientY - r.top) / r.height < 0.5 ? 'top' : 'bottom' };
    }
    if (src.kind === 'nav') {
      const el = t.closest<HTMLElement>('[data-nav-drag]');
      return el && el.getAttribute('data-nav-drag') !== src.pageId ? { el, zone: 'swap' } : null;
    }
    if (src.kind === 'header') {
      const el = t.closest<HTMLElement>('[data-header-el]');
      if (!el || el.getAttribute('data-header-el') === src.el) return null;
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      return { el, zone: x < 0.25 ? 'left' : x > 0.75 ? 'right' : (e.clientY - r.top) / r.height < 0.5 ? 'top' : 'bottom' };
    }
    if (src.kind === 'frame') {
      const el = t.closest<HTMLElement>(`[data-frame-block="${src.blockId}"]`);
      return el && Number(el.getAttribute('data-frame-idx')) !== src.idx ? { el, zone: 'swap' } : null;
    }
    const add = t.closest<HTMLElement>('[data-add-block]');
    if (add) return { el: add, zone: 'end' };
    const el = t.closest<HTMLElement>('[data-block-id]');
    if (!el || (src.kind === 'block' && el.getAttribute('data-block-id') === src.id)) return null;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    const zone: DropZone = x < 0.25 ? 'left' : x > 0.75 ? 'right' : y < 0.5 ? 'top' : 'bottom';
    return { el, zone };
  };

  const onCanvasDragStart = useCallback((e: React.DragEvent): void => {
    const t = e.target as HTMLElement;
    const h = t.closest('[data-drag-block]');
    const frame = t.closest('[data-frame-idx]');
    const it = t.closest('[data-item-id]');
    const pvEl = t.closest('[data-pv-cell]');
    const navEl = t.closest('[data-nav-drag]');
    const hdrEl = t.closest('[data-header-el]');
    if (pvEl) drag.current = { kind: 'pv', project: pvEl.getAttribute('data-pv-of')!, ref: pvEl.getAttribute('data-pv-cell')! };
    else if (navEl) drag.current = { kind: 'nav', pageId: navEl.getAttribute('data-nav-drag')! };
    else if (hdrEl) drag.current = { kind: 'header', el: hdrEl.getAttribute('data-header-el') as HeaderElement };
    else if (h) drag.current = { kind: 'block', id: h.getAttribute('data-drag-block')! };
    else if (frame) drag.current = { kind: 'frame', blockId: frame.getAttribute('data-frame-block')!, idx: Number(frame.getAttribute('data-frame-idx')) };
    else if (it) drag.current = { kind: 'item', coll: it.getAttribute('data-item-coll') as CollectionName, id: it.getAttribute('data-item-id')! };
    else return;
    setDragging(true);
    e.stopPropagation();
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', 'pe'); } catch { /* ignore */ }
  }, []);
  const onCanvasDragOver = (e: React.DragEvent): void => {
    const hit = dropTarget(e);
    if (!hit) return mark(null);
    e.preventDefault();
    e.dataTransfer.dropEffect = drag.current?.kind === 'new' ? 'copy' : 'move';
    mark(hit.el, hit.zone);
  };
  const onCanvasDrop = (e: React.DragEvent): void => {
    const hit = dropTarget(e);
    const src = drag.current;
    drag.current = null;
    setDragging(false);
    mark(null);
    if (!hit || !src) return;
    e.preventDefault();
    const d = docRef.current;
    if (src.kind === 'item') {
      const ids = d.state.collections[src.coll].map((x) => x.id);
      d.reorderItems(src.coll, ids.indexOf(src.id), ids.indexOf(hit.el.getAttribute('data-item-id')!));
      return;
    }
    if (src.kind === 'pv') {
      const to = hit.el.getAttribute('data-pv-cell')!;
      editPreview(src.project, (pv) => {
        const cells = pv.items.map((x) => ({ id: x.ref, span: x.span }));
        const moving = detachBlock(cells, src.ref);
        if (!moving) return;
        placeBlock(cells, moving, to, hit.zone as DropZone);
        pv.items = cells.map((c) => ({ ref: c.id, span: c.span }));
      });
      return;
    }
    if (src.kind === 'nav') {
      const to = hit.el.getAttribute('data-nav-drag')!;
      d.updateSite((st) => reorderArray(st.nav, st.nav.indexOf(src.pageId), st.nav.indexOf(to)));
      return;
    }
    if (src.kind === 'header') {
      const to = hit.el.getAttribute('data-header-el') as HeaderElement;
      // Mesmo sistema de grade das seções: lateral = mesma linha, topo/base = linha própria.
      d.updateSite((st) => {
        const h = (st.header ??= structuredClone(DEFAULT_HEADER));
        const cells = h.order.map((id) => ({ id, span: headerSpan(h, id) }));
        const moving = detachBlock(cells, src.el);
        if (!moving) return;
        placeBlock(cells, moving, to, hit.zone as DropZone);
        h.layout = 'grid';
        h.order = cells.map((c) => c.id as HeaderElement);
        h.spans = Object.fromEntries(cells.map((c) => [c.id, c.span]));
      });
      return;
    }
    if (src.kind === 'frame') {
      const ref = locateBlock(d.state, container, src.blockId);
      const to = Number(hit.el.getAttribute('data-frame-idx'));
      if (ref) d.updateBlock(ref, (b) => void (b.type === 'storyboard' && reorderArray(b.content.frames, src.idx, to)));
      return;
    }
    const source = src.kind === 'new' ? makeDefaultBlock(src.type) : src.id;
    const newId = typeof source === 'string' ? source : source.id;
    if (hit.zone === 'end') d.dropBlockInSection(container, source, hit.el.getAttribute('data-add-block')!);
    else d.dropBlock(container, source, hit.el.getAttribute('data-block-id')!, hit.zone as DropZone);
    const ref = locateBlock(docRef.current.store.getState(), container, newId);
    if (ref) {
      setSelection({ kind: 'block', ref });
      if (src.kind === 'new' && src.type === 'image') pickImage((aid) => docRef.current.updateBlock(ref, (b) => { if (b.type === 'image') { b.content.image.assetId = aid; b.content.image.url = undefined; } }));
    }
  };
  const onDragEnd = (): void => {
    drag.current = null;
    setDragging(false);
    mark(null);
  };

  const ctx: RenderContextValue = useMemo(
    () => ({
      data: doc.state,
      lang,
      resolveAsset,
      editing: true,
      posterEmbeds: true,
      selectedId,
      onNavigate: navigate,
      selectedItemId: selection?.kind === 'item' ? selection.itemId : undefined,
      onEditPreview: editPreview,
      // Redimensionar vale só para a TELA que está selecionada no topo: mexer
      // com o celular aberto não mexe no computador, e vice-versa.
      onSetHeaderSpan: (el, span) => {
        docRef.current.updateSite((st) => {
          const h = (st.header ??= structuredClone(DEFAULT_HEADER));
          h.layout = 'grid';
          if (device === 'tablet') h.spansTablet = { ...(h.spansTablet ?? {}), [el]: span };
          else if (device === 'mobile') h.spansMobile = { ...(h.spansMobile ?? {}), [el]: span };
          else h.spans = { ...(h.spans ?? DEFAULT_HEADER.spans), [el]: span };
        }, `hspan:${device}:${el}`);
      },
      onSetItemSpan: (target, span) => {
        const d = docRef.current;
        const campo = device === 'tablet' ? 'widthTablet' : device === 'mobile' ? 'widthMobile' : 'width';
        if ('coll' in target) {
          d.updateItem(target.coll, target.id, (it) => void ((it as Record<string, unknown>)[campo] = span), `ispan:${device}:${target.id}`);
          return;
        }
        const ref = locateBlock(d.state, container, target.blockId);
        const campoQuadro = device === 'tablet' ? 'spanTablet' : device === 'mobile' ? 'spanMobile' : 'span';
        if (ref) d.updateBlock(ref, (b) => { const f = b.type === 'storyboard' ? b.content.frames[target.frame] : undefined; if (f) (f as Record<string, unknown>)[campoQuadro] = span; }, `fspan:${device}:${target.blockId}:${target.frame}`);
      },
      onSetSpan: (blockId: string, span: number) => {
        const d = docRef.current;
        const ref = locateBlock(d.state, container, blockId);
        if (!ref) return;
        if (device === 'desktop') {
          d.setBlockSpan(ref, span, `span:${blockId}`);
          return;
        }
        const tela = device === 'tablet' ? 'tablet' : 'mobile';
        d.updateBlock(ref, (b) => void ((b.responsive ??= {})[tela] = { ...(b.responsive[tela] ?? {}), span }), `span:${device}:${blockId}`);
      },
      device,
      onInlineText: (blockId: string, value: string, kind: 'text' | 'heading') => {
        const d = docRef.current;
        const ref = locateBlock(d.state, container, blockId);
        if (!ref) return;
        d.updateBlock(
          ref,
          (b) => {
            if (kind === 'text' && b.type === 'text') b.content.html[lang] = sanitizeInlineHtml(value);
            else if (kind === 'heading' && b.type === 'heading') b.content.text[lang] = sanitizeInlineHtml(value).replace(/^<p>([\s\S]*)<\/p>$/, '$1');
          },
          `inline:${blockId}:${lang}`,
        );
      },
    }),
    [doc.state, container, lang, resolveAsset, selectedId, navigate, selection, editPreview, device],
  );

  // Onde estou: com um projeto/nota aberto, a trilha mostra a página de origem
  // e volta para ela num clique.
  const itemAberto = container.on === 'item' ? doc.state.collections[container.collection].find((i) => i.id === container.itemId) : undefined;
  const colecaoAberta = container.on === 'item' ? container.collection : undefined;
  // A página de origem é a que LISTA a coleção — a Home também mostra projetos
  // (os em destaque), então ela só vale como último recurso.
  const listamColecao = colecaoAberta
    ? doc.state.pages.filter((p) => p.sections.some((s) => s.blocks.some((b) => b.type === 'collection' && b.content.collection === colecaoAberta)))
    : [];
  const paginaDeOrigem = listamColecao.find((p) => p.id !== 'home') ?? listamColecao[0];
  const trilha = itemAberto
    ? {
        pai: paginaDeOrigem ? pick(paginaDeOrigem.title, lang) : colecaoAberta === 'projects' ? 'Projetos' : 'Notas',
        atual: pick(itemAberto.title, lang) || 'Sem título',
        voltar: () => openContainer({ on: 'page', pageId: paginaDeOrigem?.id ?? 'home' }),
      }
    : undefined;

  const frame = siteFrame(doc.state, resolveAsset);
  return (
    <div className="editor" style={styleVars(themeToCssVars(doc.state.theme))}>
      <TopBar doc={doc} lang={lang} onLang={setLang} pageTitle={pick(page.title, lang)} trilha={trilha} saveStatus={saveStatus} assets={assets} onImport={onImport} onPublished={setPublishNotice} device={device} onDevice={setDevice} onBackupRef={backupRef} onVersions={() => setShowVersions(true)} />
      {notice && showNotice ? (
        <div className="editor-notice" role="status">
          <span>{notice}</span>
          <button type="button" onClick={() => setShowNotice(false)} aria-label="Fechar aviso">✕</button>
        </div>
      ) : null}
      {publishNotice ? (
        <div className="editor-notice" role="status">
          <span>{publishNotice}</span>
          <button type="button" onClick={() => setPublishNotice(null)} aria-label="Fechar aviso">✕</button>
        </div>
      ) : null}
      <div className="editor-main">
        <div className="editor-left">
          <div className="left-tabs">
            <button type="button" className={leftTab === 'pages' ? 'active' : ''} onClick={() => setLeftTab('pages')}>Páginas</button>
            <button type="button" className={leftTab === 'layers' ? 'active' : ''} onClick={() => setLeftTab('layers')}>Layers</button>
            <button type="button" className={leftTab === 'theme' ? 'active' : ''} onClick={() => setLeftTab('theme')}>Tema</button>
            <button type="button" className={leftTab === 'data' ? 'active' : ''} onClick={() => setLeftTab('data')}>Dados</button>
          </div>
          {leftTab === 'pages' ? (
            <PagesPanel doc={doc} container={container} lang={lang} onOpen={openContainer} onSelect={setSelection} />
          ) : leftTab === 'theme' ? (
            <ThemePanel doc={doc} onUploadImage={uploadImage} onUploadFavicon={uploadFavicon} resolveAsset={resolveAsset} />
          ) : leftTab === 'data' ? (
            <DataPanel doc={doc} onSelect={abrirItem} />
          ) : (
            <LayersPanel doc={doc} page={page} item={item} lang={lang} selection={selection} onSelect={setSelection} />
          )}
          {leftTab === 'pages' || leftTab === 'layers' ? (
            <ElementsPalette onAdd={addElement} onAddSection={addSectionPreset} onDragStart={(type) => { drag.current = { kind: 'new', type }; setDragging(true); }} onDragEnd={onDragEnd} />
          ) : null}
        </div>

        <div className="editor-canvas-wrap">
          <div className={`editor-canvas pv-${device}${dragging ? ' dragging' : ''}`} onClickCapture={onCanvasClick} onDragStart={onCanvasDragStart} onDragOver={onCanvasDragOver} onDrop={onCanvasDrop} onDragEnd={onDragEnd} onDragLeave={(e) => { if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) mark(null); }}>
            <RenderContext.Provider value={ctx}>
              <div className={`site canvas-site${frame.className}`} style={styleVars(frame.vars)}>
                <SiteHeader data={doc.state} lang={lang} onLang={setLang} onNavigate={navigate} current={container.on === 'page' ? container.pageId : undefined} />
                <main className="container">
                  <PageView page={page} item={item} />
                </main>
              </div>
            </RenderContext.Provider>
          </div>
        </div>

        <Inspector doc={doc} selection={selection} onUploadImage={uploadImage} onSelect={setSelection} lang={lang} onLang={setLang} />
      </div>
      <FloatingToolbar fonts={doc.state.theme.fonts} colors={doc.state.theme.colors} />
      {addMenu ? (
        <AddBlockPopup
          x={addMenu.x}
          y={addMenu.y}
          onClose={() => setAddMenu(null)}
          onPick={(t) => {
            const block = makeDefaultBlock(t);
            const ref = { container, sectionId: addMenu.sectionId };
            doc.insertBlock(ref, block);
            const bref = { ...ref, blockId: block.id };
            setSelection({ kind: 'block', ref: bref });
            setAddMenu(null);
            if (t === 'image') pickImage((aid) => docRef.current.updateBlock(bref, (b) => { if (b.type === 'image') { b.content.image.assetId = aid; b.content.image.url = undefined; } }));
          }}
        />
      ) : null}
      {showVersions ? (
        <VersionsModal
          doc={doc.state}
          onClose={() => setShowVersions(false)}
          onRestore={onImport ? (restored) => onImport({ format: 'portfolio-v4-backup', version: 1, savedAt: new Date().toISOString(), doc: restored, assets }) : undefined}
        />
      ) : null}
      {cropping ? (
        <CropModal
          src={resolveAsset(cropping.image)}
          initial={cropping.image.crop}
          lockRatio={cropping.lock}
          onApply={(c) => { cropping.apply(c); setCropping(null); }}
          onClose={() => setCropping(null)}
        />
      ) : null}
      <input ref={fileInput} type="file" accept="image/*" hidden onChange={onPickFile} data-testid="pe-file" />
    </div>
  );
}

const STATUS_LABEL: Record<SaveStatus, string> = { idle: 'Salvo localmente', saving: 'Salvando…', saved: 'Salvo neste navegador', error: 'Falha ao salvar' };

/** Ícones do seletor de tela: monitor, tablet e celular desenhados (os glifos
 *  de caixinha não se distinguiam). */
function DeviceIcon({ kind }: { kind: 'desktop' | 'tablet' | 'mobile' }): React.ReactElement {
  const p = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };
  if (kind === 'desktop') {
    return (
      <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
        <rect x="2" y="3.5" width="16" height="10.5" rx="1.2" {...p} />
        <path d="M7 17h6M10 14v3" {...p} />
      </svg>
    );
  }
  if (kind === 'tablet') {
    return (
      <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
        <rect x="4" y="2.5" width="12" height="15" rx="1.6" {...p} />
        <path d="M8.8 15.2h2.4" {...p} />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
      <rect x="6" y="2" width="8" height="16" rx="1.6" {...p} />
      <path d="M9 4.2h2M9.2 15.6h1.6" {...p} />
    </svg>
  );
}

const DEVICES = [
  { id: 'desktop', label: 'Computador', curto: 'Computador' },
  { id: 'tablet', label: 'Tablet (768px)', curto: 'Tablet' },
  { id: 'mobile', label: 'Celular (390px)', curto: 'Celular' },
] as const;

function TopBar({ doc, lang, onLang, pageTitle, trilha, saveStatus, assets, onImport, onPublished, device, onDevice, onBackupRef, onVersions }: { doc: ReturnType<typeof useDocument>; lang: Lang; onLang: (l: Lang) => void; pageTitle: string; trilha?: { pai: string; atual: string; voltar: () => void }; saveStatus: SaveStatus; assets: Record<string, string>; onImport?: (b: Backup) => void; onPublished?: (msg: string | null) => void; device: 'desktop' | 'tablet' | 'mobile'; onDevice: (d: 'desktop' | 'tablet' | 'mobile') => void; onBackupRef?: { current: (() => void) | null }; onVersions?: () => void }): React.ReactElement {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pedirSenha, setPedirSenha] = useState(false);

  if (onBackupRef) onBackupRef.current = () => download();
  const download = (): void => {
    const backup = buildBackup(doc.state, assets);
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `portfolio-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const backup = parseBackup(await file.text());
      onImport?.(backup);
    } catch (err) {
      alert('Backup inválido: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  // Quantos itens confidenciais existem (0 = nem pergunta a senha).
  const itensNda = (['projects', 'blog', 'gallery', 'sketches'] as const)
    .reduce((n, k) => n + doc.state.collections[k].filter((i) => i.visibility === 'nda').length, 0);

  const publishSite = async (password?: string): Promise<void> => {
    const doc0 = doc.state;
    const migratedAssets: MigratedAsset[] = Object.entries(assets).map(([id, dataUrl]) => ({ id, dataUrl, mime: '' }));
    const payload = await buildPublishPayload({ data: doc0, assets: migratedAssets }, password);
    const pf = runPreflight(payload.publicData, { assetSizes: payload.assetSizes });
    if (pf.errors.length && !confirm(`Há ${pf.errors.length} bloqueio(s) no preflight:\n\n${pf.errors.join('\n')}\n\nBaixar mesmo assim?`)) return;
    const w = pf.warnings;
    onPublished?.(w.length ? `Site gerado. Vale revisar (${w.length}): ${w.slice(0, 6).join(' · ')}${w.length > 6 ? ` · e mais ${w.length - 6}` : ''}` : null);

    // Toda publicação vira um ponto de retorno (automático) no histórico.
    void saveVersion(`Publicado em ${new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}`, doc0, true).catch(() => {});

    const html = assembleSiteHtml(siteShell, payload);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'site.html';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <header className="editor-topbar">
      <div className="tb-left">
        <strong>Portfolio v4</strong>
        {trilha ? (
          <span className="tb-page">
            <button type="button" className="tb-voltar" onClick={trilha.voltar} title="Voltar para a lista">← {trilha.pai}</button>
            <span className="tb-sep">›</span>
            {trilha.atual}
          </span>
        ) : (
          <span className="tb-page">{pageTitle}</span>
        )}
      </div>
      <div className="tb-center">
        <button type="button" disabled={!doc.canUndo} onClick={doc.undo} title="Desfazer (Ctrl+Z)">↶</button>
        <button type="button" disabled={!doc.canRedo} onClick={doc.redo} title="Refazer (Ctrl+Shift+Z)">↷</button>
        <span className="tb-devices" role="group" aria-label="Ver em outra tela">
          {DEVICES.map((d) => (
            <button key={d.id} type="button" className={device === d.id ? 'on' : ''} aria-pressed={device === d.id} aria-label={`Ver como ${d.label}`} title={`Ver como ${d.label}`} onClick={() => onDevice(d.id)}>
              <DeviceIcon kind={d.id} />
            </button>
          ))}
        </span>
        {device !== 'desktop' ? (
          <button type="button" className="tb-device-back" onClick={() => onDevice('desktop')} title="Voltar para a largura de computador">
            {DEVICES.find((d) => d.id === device)!.curto} ✕
          </button>
        ) : null}
        <span className={`tb-status status-${saveStatus}`}>{STATUS_LABEL[saveStatus]}</span>
      </div>
      <div className="tb-right">
        <div className="lang-toggle">
          <button type="button" className={lang === 'pt' ? 'on' : ''} onClick={() => onLang('pt')} title="Português"><LangFlag lang="pt" /> PT</button>
          <button type="button" className={lang === 'en' ? 'on' : ''} onClick={() => onLang('en')} title="English"><LangFlag lang="en" /> EN</button>
        </div>
        <button type="button" className="tb-btn" onClick={onVersions} title="Histórico de versões salvas neste navegador">Versões</button>
        <button type="button" className="tb-btn" onClick={download} title="Baixar backup (doc + imagens)">Backup</button>
        <button type="button" className="tb-btn" onClick={() => fileRef.current?.click()} title="Importar backup">Importar</button>
        <button type="button" className="tb-btn primary" onClick={() => (itensNda ? setPedirSenha(true) : void publishSite())} title="Gerar o site.html pronto para subir">Baixar site</button>
        {pedirSenha ? (
          <NdaPasswordModal
            quantidade={itensNda}
            onCancel={() => setPedirSenha(false)}
            onConfirm={(senha) => { setPedirSenha(false); void publishSite(senha); }}
          />
        ) : null}
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={onFile} />
      </div>
    </header>
  );
}
