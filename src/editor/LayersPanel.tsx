import { useState } from 'react';
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Lang } from '../renderer/context';
import { pick } from '../renderer/text';
import type { Block, BlogItem, Page, ProjectItem, Section } from '../schema/v4';
import { ADDABLE_BLOCKS, makeDefaultBlock } from './blockFactory';
import type { Container, Selection } from './paths';
import type { DocApi } from './useDocument';
import { useTreeRename } from './TreeName';

import { TYPE_LABEL as BLOCK_LABELS } from '../renderer/preview';

function BlockRow({ doc, container, sectionId, block, selected, onSelect }: { doc: DocApi; container: Container; sectionId: string; block: Block; selected: boolean; onSelect: (s: Selection) => void }): React.ReactElement {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  const ref = { container, sectionId, blockId: block.id };
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }} className={`tree-row blk ${selected ? 'sel' : ''} ${block.visibility !== 'public' ? 'dim' : ''}`}>
      <span className="tree-grip" {...attributes} {...listeners} title="Arraste para reordenar">⠿</span>
      <button type="button" className="tree-main" onClick={() => onSelect({ kind: 'block', ref })}>
        <span className="tree-icon">◈</span>{BLOCK_LABELS[block.type] ?? block.type}
      </button>
      <button type="button" className="tree-eye" title="Visibilidade" onClick={() => doc.updateBlock(ref, (b) => void (b.visibility = b.visibility === 'public' ? 'draft' : 'public'))}>
        {block.visibility === 'public' ? '👁' : '⊘'}
      </button>
    </div>
  );
}

function AddBlock({ onAdd }: { onAdd: (t: Block['type']) => void }): React.ReactElement {
  const [open, setOpen] = useState(false);
  return (
    <div className="add-block">
      <button type="button" className="add-block-btn" onClick={() => setOpen((o) => !o)}>＋ Bloco</button>
      {open ? (
        <div className="add-block-menu">
          {ADDABLE_BLOCKS.map((b) => (
            <button key={b.type} type="button" onClick={() => { onAdd(b.type); setOpen(false); }}>{b.label}</button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SortableSection({ doc, container, section, index, selection, onSelect }: { doc: DocApi; container: Container; section: Section; index: number; selection: Selection; onSelect: (s: Selection) => void }): React.ReactElement {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id });
  const renome = useTreeRename(section.name ?? '', (v) => doc.updateSection({ container, sectionId: section.id }, (s) => void (s.name = v || undefined), `rename:${section.id}`));
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const selBlockId = selection?.kind === 'block' ? selection.ref.blockId : undefined;
  const selSectionId = selection?.kind === 'section' ? selection.ref.sectionId : undefined;

  const onBlockDragEnd = (e: DragEndEvent): void => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = section.blocks.findIndex((b) => b.id === active.id);
    const to = section.blocks.findIndex((b) => b.id === over.id);
    if (from >= 0 && to >= 0) doc.reorderBlocks({ container, sectionId: section.id }, from, to);
  };

  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }} className="tree-section">
      <div className={`tree-row sec ${selSectionId === section.id ? 'sel' : ''}`}>
        <span className="tree-grip" {...attributes} {...listeners} title="Arraste a seção">⠿</span>
        {renome.editando ? (
          renome.campo
        ) : (
          <button type="button" className="tree-main" onClick={() => onSelect({ kind: 'section', ref: { container, sectionId: section.id } })} onDoubleClick={renome.abrir}>
            <span className="tree-icon">▦</span>{section.name || `Seção ${index + 1}`}
          </button>
        )}
        <span className="tree-sec-actions">
          {renome.editando ? null : renome.botao}
          <button type="button" title="Duplicar seção" onClick={() => doc.duplicateSection(container, section.id)}>⧉</button>
          <button type="button" title="Excluir seção" onClick={() => { if (!section.blocks.length || confirm('Excluir esta seção e seus blocos?')) { doc.deleteSection(container, section.id); onSelect(null); } }}>✕</button>
        </span>
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onBlockDragEnd}>
        <SortableContext items={section.blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
          {section.blocks.map((b) => (
            <BlockRow key={b.id} doc={doc} container={container} sectionId={section.id} block={b} selected={selBlockId === b.id} onSelect={onSelect} />
          ))}
        </SortableContext>
      </DndContext>
      <AddBlock onAdd={(t) => {
        const block = makeDefaultBlock(t);
        doc.insertBlock({ container, sectionId: section.id }, block);
        onSelect({ kind: 'block', ref: { container, sectionId: section.id, blockId: block.id } });
      }} />
    </div>
  );
}

export function LayersPanel({ doc, page, item, lang, selection, onSelect }: { doc: DocApi; page: Page; item?: ProjectItem | BlogItem; lang: Lang; selection: Selection; onSelect: (s: Selection) => void }): React.ReactElement {
  const container: Container = item
    ? { on: 'item', collection: 'description' in item ? 'projects' : 'blog', itemId: item.id }
    : { on: 'page', pageId: page.id };
  const sections = item ? item.sections : page.sections;
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const onSectionDragEnd = (e: DragEndEvent): void => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = sections.findIndex((s) => s.id === active.id);
    const to = sections.findIndex((s) => s.id === over.id);
    if (from >= 0 && to >= 0) doc.reorderSections(container, from, to);
  };

  return (
    <div className="panel">
      <div className="panel-h">Layers · {item ? pick(item.title, lang) : pick(page.title, lang)}</div>
      <div className={`tree-row sec ${selection?.kind === 'site' ? 'sel' : ''}`}>
        <span className="tree-grip" aria-hidden="true" />
        <button type="button" className="tree-main" onClick={() => onSelect({ kind: 'site' })}>
          <span className="tree-icon">▭</span>Cabeçalho (todas as páginas)
        </button>
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onSectionDragEnd}>
        <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          {sections.map((s, i) => (
            <SortableSection key={s.id} doc={doc} container={container} section={s} index={i} selection={selection} onSelect={onSelect} />
          ))}
        </SortableContext>
      </DndContext>
      <button type="button" className="add-block-btn add-section" onClick={() => {
        const selIdx = selection?.kind === 'section' || selection?.kind === 'block' ? sections.findIndex((s) => s.id === selection.ref.sectionId) : -1;
        const id = doc.addSection(container, selIdx >= 0 ? selIdx + 1 : undefined);
        if (id) onSelect({ kind: 'section', ref: { container, sectionId: id } });
      }}>＋ Seção</button>
    </div>
  );
}
