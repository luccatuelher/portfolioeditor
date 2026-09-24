import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { pick } from '../renderer/text';
import type { ImageRef, Visibility } from '../schema/v4';
import type { ImagemSemDescricao, TextoSemTraducao } from './pendencias';
import type { CollectionName, Selection } from './paths';
import { formatarPeso, LIMITE_GITHUB_BYTES, type PesoDoSite } from '../publish/peso';
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

/**
 * Linha de item de coleção: arrastar para reordenar, abrir para editar, mudar
 * a visibilidade. Vale para as QUATRO coleções — antes só galeria e sketches
 * tinham alça, e projetos/notas só davam para reordenar pelo canvas.
 */
function SortableRow({ doc, collection, id, label, visibility, onSelect, extra }: { doc: DocApi; collection: CollectionName; id: string; label: string; visibility: Visibility; onSelect: (s: Selection) => void; extra?: React.ReactNode }): React.ReactElement {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <tr ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}>
      <td><span className="tree-grip" {...attributes} {...listeners} title="Arraste para reordenar">⠿</span></td>
      <td><button type="button" className="data-name" onClick={() => onSelect({ kind: 'item', collection, itemId: id })}>{label || id}</button></td>
      {extra ? <td>{extra}</td> : null}
      <td><VisSelect value={visibility} onChange={(v) => doc.setItemVisibility(collection, id, v)} /></td>
    </tr>
  );
}

/**
 * Peso estimado do site publicado, com a régua dos 25 MB do upload pelo
 * GitHub e as imagens que mais pesam (e onde estão), para decidir o que
 * trocar antes de o arquivo não caber.
 */
function PesoDoSitePainel({ peso, assets }: { peso: PesoDoSite; assets: Record<string, string> }): React.ReactElement {
  const fracao = Math.min(1, peso.total / LIMITE_GITHUB_BYTES);
  const nivel = peso.total > LIMITE_GITHUB_BYTES ? 'acima' : fracao > 0.8 ? 'perto' : 'ok';
  const top = peso.imagens.slice(0, 5);
  return (
    <div className={`peso-site peso-${nivel}`}>
      <div className="panel-h">Peso do site</div>
      <div className="peso-barra" role="meter" aria-label="Peso estimado do site" aria-valuemin={0} aria-valuemax={25} aria-valuenow={Math.round((peso.total / 1048576) * 10) / 10} aria-valuetext={`${formatarPeso(peso.total)} de 25 MB`}>
        <i style={{ width: `${Math.max(1, fracao * 100)}%` }} />
      </div>
      <p className="peso-resumo">
        ≈ <b>{formatarPeso(peso.total)}</b> de 25 MB (limite do upload pelo navegador do GitHub).
        {nivel === 'acima' ? ' Não cabe: troque as imagens maiores abaixo ou use vídeo por link.' : nivel === 'perto' ? ' Está perto do limite.' : ''}
      </p>
      {top.length ? (
        <details className="peso-imagens" open={nivel !== 'ok'}>
          <summary>Imagens que mais pesam</summary>
          <ol>
            {top.map((im) => (
              <li key={im.id}>
                {assets[im.id] ? <img src={assets[im.id]} alt="" /> : null}
                <span className="peso-onde">{im.onde}</span>
                <b>{formatarPeso(im.bytes)}</b>
              </li>
            ))}
          </ol>
        </details>
      ) : null}
    </div>
  );
}

/**
 * Imagens publicadas sem descrição (texto alternativo), com o lugar de cada
 * uma e um atalho que leva direto ao campo. A descrição é o que o leitor de
 * tela lê no lugar da imagem — e o que o buscador entende dela.
 */
function DescricoesPainel({ itens, resolver, onIr }: { itens: ImagemSemDescricao[]; resolver: (r: ImageRef) => string; onIr: (p: ImagemSemDescricao) => void }): React.ReactElement {
  // Recolhido: uma linha só, para não empurrar as listas do painel para baixo.
  return (
    <details className={`pendencia descricoes ${itens.length ? 'faltam' : 'ok'}`} data-faltam={itens.length}>
      <summary>
        Descrição das imagens · <b>{itens.length ? `${itens.length} sem descrição` : 'todas descritas ✓'}</b>
      </summary>
      {itens.length ? (
        <>
          <p className="peso-resumo">É o que o leitor de tela lê no lugar da imagem — e o que o buscador entende dela.</p>
          <ol className="descricoes-lista">
            {itens.slice(0, 8).map((p, i) => (
              <li key={i}>
                {resolver(p.imagem) ? <img src={resolver(p.imagem)} alt="" /> : <span />}
                <span className="peso-onde">{p.onde}</span>
                <button type="button" className="descricoes-ir" onClick={() => onIr(p)} aria-label={`Descrever: ${p.onde}`}>Descrever</button>
              </li>
            ))}
          </ol>
          {itens.length > 8 ? <p className="peso-resumo">e mais {itens.length - 8}.</p> : null}
        </>
      ) : null}
    </details>
  );
}

/**
 * Textos publicados que só existem num idioma: o visitante do outro idioma vê
 * o texto que existe, e o site fica pela metade. Mesma regra do "sem EN"/"sem
 * PT" do canvas, mas do site inteiro — não só do que está na tela.
 */
function ListaTraducoes({ itens, onIr }: { itens: TextoSemTraducao[]; onIr: (t: TextoSemTraducao) => void }): React.ReactElement {
  return (
    <>
      <ol className="descricoes-lista traducoes-lista">
        {itens.slice(0, 12).map((t, i) => (
          <li key={i}>
            <span className="traducoes-falta" title={t.tipo === 'igual' ? 'Igual ao português' : undefined}>{t.tipo === 'igual' ? 'PT=EN' : t.falta.toUpperCase()}</span>
            <span className="traducoes-texto">
              <span className="peso-onde">{t.onde}</span>
              <span className="traducoes-trecho">{t.trecho}</span>
            </span>
            <button type="button" className="descricoes-ir" onClick={() => onIr(t)} aria-label={`Traduzir para ${t.falta === 'en' ? 'inglês' : 'português'}: ${t.onde}`}>Traduzir</button>
          </li>
        ))}
      </ol>
      {itens.length > 12 ? <p className="peso-resumo">e mais {itens.length - 12}.</p> : null}
    </>
  );
}

function TraducoesPainel({ itens, onIr }: { itens: TextoSemTraducao[]; onIr: (t: TextoSemTraducao) => void }): React.ReactElement {
  const faltam = itens.filter((t) => t.tipo === 'falta');
  const iguais = itens.filter((t) => t.tipo === 'igual');
  const faltaEn = faltam.filter((t) => t.falta === 'en').length;
  const faltaPt = faltam.length - faltaEn;
  const resumo = [faltaEn ? `${faltaEn} sem EN` : '', faltaPt ? `${faltaPt} sem PT` : '', iguais.length ? `${iguais.length} iguais` : ''].filter(Boolean).join(' · ');
  return (
    <details className={`pendencia traducoes ${itens.length ? 'faltam' : 'ok'}`} data-faltam={faltam.length} data-iguais={iguais.length}>
      <summary>
        Traduções · <b>{itens.length ? resumo : 'tudo nos dois idiomas ✓'}</b>
      </summary>
      {faltam.length ? (
        <>
          <p className="peso-resumo">Quem visita no outro idioma vê o texto que existe — funciona, mas fica pela metade.</p>
          <ListaTraducoes itens={faltam} onIr={onIr} />
        </>
      ) : null}
      {iguais.length ? (
        <>
          <p className="peso-resumo"><b>Iguais em PT e EN.</b> Textos longos idênticos nos dois idiomas — em geral, português copiado para o inglês (a importação do portfólio antigo faz isso). Quem visita em inglês lê português.</p>
          <ListaTraducoes itens={iguais} onIr={onIr} />
        </>
      ) : null}
    </details>
  );
}

/** Painel de dados das coleções: editar, reordenar (arrastar), visibilidade, destaque. */
export function DataPanel({ doc, onSelect, peso, assets, semDescricao, resolver, onIrPara, semTraducao, onTraduzir }: { doc: DocApi; onSelect: (s: Selection) => void; peso?: PesoDoSite; assets?: Record<string, string>; semDescricao?: ImagemSemDescricao[]; resolver?: (r: ImageRef) => string; onIrPara?: (p: ImagemSemDescricao) => void; semTraducao?: TextoSemTraducao[]; onTraduzir?: (t: TextoSemTraducao) => void }): React.ReactElement {
  const c = doc.state.collections;
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const sel = (collection: CollectionName, id: string): void => onSelect({ kind: 'item', collection, itemId: id });
  const onDragEnd = (collection: CollectionName, ids: string[]) => (e: DragEndEvent): void => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    doc.reorderItems(collection, ids.indexOf(String(active.id)), ids.indexOf(String(over.id)));
  };

  return (
    <div className="panel data-panel">
      {peso ? <PesoDoSitePainel peso={peso} assets={assets ?? {}} /> : null}
      {semDescricao && resolver && onIrPara ? <DescricoesPainel itens={semDescricao} resolver={resolver} onIr={onIrPara} /> : null}
      {semTraducao && onTraduzir ? <TraducoesPainel itens={semTraducao} onIr={onTraduzir} /> : null}
      <div className="panel-h">Projetos</div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd('projects', c.projects.map((p) => p.id))}>
        <table className="data-table">
          <colgroup><col className="dc-grip" /><col /><col className="dc-feat" /><col className="dc-vis" /></colgroup>
          <thead><tr><th /><th>Título</th><th title="Destaque na Home">★</th><th>Visib.</th></tr></thead>
          <tbody>
            <SortableContext items={c.projects.map((p) => p.id)} strategy={verticalListSortingStrategy}>
              {c.projects.map((p) => (
                <SortableRow
                  key={p.id}
                  doc={doc}
                  collection="projects"
                  id={p.id}
                  label={pick(p.title, 'pt')}
                  visibility={p.visibility}
                  onSelect={onSelect}
                  extra={<input type="checkbox" checked={p.featured} title="Aparece na Home" onChange={(e) => doc.updateItem('projects', p.id, (it) => void (it.featured = e.target.checked))} />}
                />
              ))}
            </SortableContext>
          </tbody>
        </table>
      </DndContext>
      <button type="button" className="add-block-btn additem" onClick={() => sel('projects', doc.addItem('projects'))}>＋ Projeto</button>

      <div className="panel-h">Notas</div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd('blog', c.blog.map((b) => b.id))}>
      <table className="data-table">
        <colgroup><col /><col className="dc-vis" /></colgroup>
        <tbody>
          <SortableContext items={c.blog.map((b) => b.id)} strategy={verticalListSortingStrategy}>
            {c.blog.map((b) => (
              <SortableRow key={b.id} doc={doc} collection="blog" id={b.id} label={pick(b.title, 'pt')} visibility={b.visibility} onSelect={onSelect} />
            ))}
          </SortableContext>
        </tbody>
      </table>
      </DndContext>
      <button type="button" className="add-block-btn additem" onClick={() => sel('blog', doc.addItem('blog'))}>＋ Nota</button>

      <div className="panel-h">Galeria</div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd('gallery', c.gallery.map((g) => g.id))}>
        <SortableContext items={c.gallery.map((g) => g.id)} strategy={verticalListSortingStrategy}>
          <table className="data-table">
            <colgroup><col className="dc-grip" /><col /><col className="dc-vis" /></colgroup>
            <tbody>
              {c.gallery.map((g) => <SortableRow key={g.id} doc={doc} collection="gallery" id={g.id} label={pick(g.caption, 'pt')} visibility={g.visibility} onSelect={onSelect} />)}
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
              {c.sketches.map((s) => <SortableRow key={s.id} doc={doc} collection="sketches" id={s.id} label={pick(s.image.alt, 'pt')} visibility={s.visibility} onSelect={onSelect} />)}
            </tbody>
          </table>
        </SortableContext>
      </DndContext>
      <button type="button" className="add-block-btn additem" onClick={() => sel('sketches', doc.addItem('sketches'))}>＋ Sketch</button>
    </div>
  );
}
