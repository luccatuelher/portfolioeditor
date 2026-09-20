import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { pick } from '../renderer/text';
import type { GalleryItem, SketchItem, Visibility } from '../schema/v4';
import type { CollectionName, Selection } from './paths';
import type { DocApi } from './useDocument';

const VIS_OPTS: { value: Visibility; label: string }[] = [
  { value: 'public', label: 'Público' },
  { value: 'draft', label: 'Rascunho' },
  { value: 'nda', label: 'NDA' },
];

function VisSelect({ value, onChange }: { value: Visibility; onChange: (v: Visibility) => void }): React.ReactElement {
  return (
    <select className={`data-vis vis-${value}`} value={value} onChange={(e) => onChange(e.target.value as Visibility)}>
      {VIS_OPTS.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

function SortableImgRow({ doc, collection, item, label, onSelect }: { doc: DocApi; collection: 'gallery' | 'sketches'; item: GalleryItem | SketchItem; label: string; onSelect: (s: Selection) => void }): React.ReactElement {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  return (
    <tr ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}>
      <td><span className="tree-grip" {...attributes} {...listeners} title="Arraste para reordenar">⠿</span></td>
      <td><button type="button" className="data-name" onClick={() => onSelect({ kind: 'item', collection, itemId: item.id })}>{label || item.id}</button></td>
      <td><VisSelect value={item.visibility} onChange={(v) => doc.setItemVisibility(collection, item.id, v)} /></td>
    </tr>
  );
}

/** Painel de dados das coleções: editar, reordenar (arrastar), visibilidade, destaque. */
export function DataPanel({ doc, onSelect }: { doc: DocApi; onSelect: (s: Selection) => void }): React.ReactElement {
  const c = doc.state.collections;
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const sel = (collection: CollectionName, id: string): void => onSelect({ kind: 'item', collection, itemId: id });
  const nameBtn = (collection: CollectionName, id: string, label: string): React.ReactElement => (
    <button type="button" className="data-name" onClick={() => sel(collection, id)}>{label || id}</button>
  );
  const onDragEnd = (collection: 'gallery' | 'sketches', ids: string[]) => (e: DragEndEvent): void => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    doc.reorderItems(collection, ids.indexOf(String(active.id)), ids.indexOf(String(over.id)));
  };

  return (
    <div className="panel data-panel">
      <div className="panel-h">Projetos</div>
      <table className="data-table">
        <colgroup><col /><col className="dc-feat" /><col className="dc-vis" /></colgroup>
        <thead><tr><th>Título</th><th title="Destaque na Home">★</th><th>Visib.</th></tr></thead>
        <tbody>
          {c.projects.map((p) => (
            <tr key={p.id}>
              <td>{nameBtn('projects', p.id, pick(p.title, 'pt'))}</td>
              <td><input type="checkbox" checked={p.featured} onChange={(e) => doc.updateItem('projects', p.id, (it) => void (it.featured = e.target.checked))} /></td>
              <td><VisSelect value={p.visibility} onChange={(v) => doc.setItemVisibility('projects', p.id, v)} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" className="add-block-btn additem" onClick={() => sel('projects', doc.addItem('projects'))}>＋ Projeto</button>

      <div className="panel-h">Notas</div>
      <table className="data-table">
        <colgroup><col /><col className="dc-vis" /></colgroup>
        <tbody>
          {c.blog.map((b) => (
            <tr key={b.id}>
              <td>{nameBtn('blog', b.id, pick(b.title, 'pt'))}</td>
              <td><VisSelect value={b.visibility} onChange={(v) => doc.setItemVisibility('blog', b.id, v)} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" className="add-block-btn additem" onClick={() => sel('blog', doc.addItem('blog'))}>＋ Nota</button>

      <div className="panel-h">Galeria</div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd('gallery', c.gallery.map((g) => g.id))}>
        <SortableContext items={c.gallery.map((g) => g.id)} strategy={verticalListSortingStrategy}>
          <table className="data-table">
            <colgroup><col className="dc-grip" /><col /><col className="dc-vis" /></colgroup>
            <tbody>
              {c.gallery.map((g) => <SortableImgRow key={g.id} doc={doc} collection="gallery" item={g} label={pick(g.caption, 'pt')} onSelect={onSelect} />)}
            </tbody>
          </table>
        </SortableContext>
      </DndContext>
      <button type="button" className="add-block-btn additem" onClick={() => sel('gallery', doc.addItem('gallery'))}>＋ Imagem na galeria</button>

      <div className="panel-h">Sketches</div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd('sketches', c.sketches.map((s) => s.id))}>
        <SortableContext items={c.sketches.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          <table className="data-table">
            <colgroup><col className="dc-grip" /><col /><col className="dc-vis" /></colgroup>
            <tbody>
              {c.sketches.map((s) => <SortableImgRow key={s.id} doc={doc} collection="sketches" item={s} label={pick(s.image.alt, 'pt')} onSelect={onSelect} />)}
            </tbody>
          </table>
        </SortableContext>
      </DndContext>
      <button type="button" className="add-block-btn additem" onClick={() => sel('sketches', doc.addItem('sketches'))}>＋ Sketch</button>
    </div>
  );
}
