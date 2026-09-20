import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { pick } from '../renderer/text';
import { useTreeRename } from './TreeName';
import type { Lang } from '../renderer/context';
import type { BlogItem, Page, PortfolioV4, ProjectItem } from '../schema/v4';
import type { Container, Selection } from './paths';
import type { DocApi } from './useDocument';

type ListKind = 'featured' | 'projects' | 'nda' | 'blog';

/** Qual lista de itens uma página exibe (pela 1ª coleção de projetos/notas nela). */
function pageList(page: Page): ListKind | null {
  for (const s of page.sections) {
    for (const b of s.blocks) {
      if (b.type !== 'collection') continue;
      if (b.content.collection === 'blog') return 'blog';
      if (b.content.collection === 'projects') return b.content.filter === 'featured' ? 'featured' : b.content.filter === 'nda' ? 'nda' : 'projects';
    }
  }
  return null;
}

function itemsFor(doc: PortfolioV4, kind: ListKind): (ProjectItem | BlogItem)[] {
  if (kind === 'blog') return doc.collections.blog;
  const ps = doc.collections.projects;
  if (kind === 'featured') return ps.filter((p) => p.featured && p.visibility !== 'nda');
  if (kind === 'nda') return ps.filter((p) => p.visibility === 'nda');
  return ps.filter((p) => p.visibility !== 'nda');
}

function ItemRow({ doc, collection, item, lang, active, onOpen }: { doc: DocApi; collection: 'projects' | 'blog'; item: ProjectItem | BlogItem; lang: Lang; active: boolean; onOpen: () => void }): React.ReactElement {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const nome = pick(item.title, lang);
  const renome = useTreeRename(nome, (v) => doc.updateItem(collection, item.id, (it) => void (it.title[lang] = v), `rename:${item.id}`));
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }} className={`tree-row blk nested ${active ? 'sel' : ''}`}>
      <span className="tree-grip" {...attributes} {...listeners} title="Arraste para reordenar">⠿</span>
      {renome.editando ? (
        renome.campo
      ) : (
        <>
          <button type="button" className="tree-main" onClick={onOpen} onDoubleClick={renome.abrir}>
            <span className="tree-icon">{collection === 'projects' ? '▧' : '▤'}</span>{nome || item.id}
            {item.visibility !== 'public' ? <span className="badge">{item.visibility}</span> : null}
          </button>
          {renome.botao}
        </>
      )}
    </div>
  );
}

function PageRow({ doc, page, lang, active, onOpen, children }: { doc: DocApi; page: Page; lang: Lang; active: boolean; onOpen: () => void; children?: React.ReactNode }): React.ReactElement {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: page.id });
  const nome = pick(page.title, lang);
  const renome = useTreeRename(nome, (v) => doc.updatePage(page.id, (pg) => void (pg.title[lang] = v), `rename:${page.id}`));
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}>
      <div className={`tree-row pagerow ${active ? 'sel' : ''}`}>
        <span className="tree-grip" {...attributes} {...listeners} title="Arraste para reordenar as páginas">⠿</span>
        {renome.editando ? (
          renome.campo
        ) : (
          <>
            <button type="button" className="tree-main" onClick={onOpen} onDoubleClick={renome.abrir}>
              <span className="tree-icon">▤</span>{nome || page.id}
              {page.visibility === 'nda' ? <span className="badge">NDA</span> : null}
            </button>
            {renome.botao}
          </>
        )}
        <button type="button" className="tree-dup" title="Duplicar página" aria-label={`Duplicar página ${pick(page.title, lang)}`} onClick={() => doc.duplicatePage(page.id)}>⧉</button>
        {page.id !== 'home' ? (
          <button type="button" className="tree-del" title="Excluir página" aria-label={`Excluir página ${pick(page.title, lang)}`} onClick={() => { if (confirm('Excluir esta página?')) doc.deletePage(page.id); }}>✕</button>
        ) : null}
      </div>
      {children}
    </div>
  );
}

export function PagesPanel({ doc, container, lang, onOpen, onSelect }: { doc: DocApi; container: Container; lang: Lang; onOpen: (c: Container) => void; onSelect: (s: Selection) => void }): React.ReactElement {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const pages = doc.state.pages.filter((p) => p.kind === 'static');

  // Página "ativa": a aberta, ou — com um projeto/nota aberto — a página da lista dele.
  const openItem = container.on === 'item' ? doc.state.collections[container.collection].find((i) => i.id === container.itemId) : undefined;
  const itemKind: ListKind | null = container.on === 'item' ? (container.collection === 'blog' ? 'blog' : openItem?.visibility === 'nda' ? 'nda' : 'projects') : null;
  const activePageId = container.on === 'page' ? container.pageId : pages.find((p) => pageList(p) === itemKind)?.id;

  const openItemC = (collection: 'projects' | 'blog', id: string): void => {
    onOpen({ on: 'item', collection, itemId: id });
    onSelect({ kind: 'item', collection, itemId: id });
  };
  const onPagesEnd = (e: DragEndEvent): void => {
    if (e.over && e.active.id !== e.over.id) doc.movePage(String(e.active.id), String(e.over.id));
  };

  const nested = (page: Page): React.ReactNode => {
    const kind = pageList(page);
    if (!kind || page.id !== activePageId) return null;
    const coll = kind === 'blog' ? 'blog' : 'projects';
    const items = itemsFor(doc.state, kind);
    const all = doc.state.collections[coll].map((i) => i.id);
    const onEnd = (e: DragEndEvent): void => {
      if (e.over && e.active.id !== e.over.id) doc.reorderItems(coll, all.indexOf(String(e.active.id)), all.indexOf(String(e.over.id)));
    };
    return (
      <div className="tree-nested">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onEnd}>
          <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            {items.map((it) => (
              <ItemRow doc={doc} key={it.id} collection={coll} item={it} lang={lang} active={container.on === 'item' && container.itemId === it.id} onOpen={() => openItemC(coll, it.id)} />
            ))}
          </SortableContext>
        </DndContext>
        {kind === 'featured' ? (
          <>
            <p className="tree-hint">{items.length ? 'Só os projetos em destaque.' : 'Nenhum destaque ainda.'} Marque "Destaque na Home" no projeto.</p>
            <button
              type="button"
              className="add-block-btn additem"
              onClick={() => {
                const id = doc.addItem('projects');
                doc.setProjectFeatured(id, true);
                openItemC('projects', id);
              }}
            >
              ＋ Adicionar projeto
            </button>
          </>
        ) : (
          <button
            type="button"
            className="add-block-btn additem"
            onClick={() => {
              const id = doc.addItem(coll);
              if (kind === 'nda') doc.setItemVisibility('projects', id, 'nda');
              openItemC(coll, id);
            }}
          >
            ＋ {coll === 'blog' ? 'Adicionar nota' : kind === 'nda' ? 'Adicionar projeto NDA' : 'Adicionar projeto'}
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="panel">
      <div className="panel-h">Páginas</div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onPagesEnd}>
        <SortableContext items={pages.map((p) => p.id)} strategy={verticalListSortingStrategy}>
          {pages.map((p) => (
            <PageRow key={p.id} doc={doc} page={p} lang={lang} active={activePageId === p.id && container.on === 'page'} onOpen={() => { onOpen({ on: 'page', pageId: p.id }); onSelect({ kind: 'page', pageId: p.id }); }}>
              {nested(p)}
            </PageRow>
          ))}
        </SortableContext>
      </DndContext>
      <button type="button" className="add-block-btn newpage" onClick={() => { const t = prompt('Nome da nova página:'); if (t) onOpen({ on: 'page', pageId: doc.addPage(t) }); }}>＋ Nova página</button>
    </div>
  );
}
