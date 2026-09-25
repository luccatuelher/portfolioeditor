import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { DEFAULT_HEADER, type Block, type BlogItem, type GalleryItem, type HeaderConfig, type I18n, type ImageRef, type ProjectItem, type SketchItem, type Visibility } from '../schema/v4';
import { reorderArray } from '../core/array';
import { computeRowColumns, rowHeadId, type DropZone } from './gridOps';
import { emptyI18n, isBlankI18n } from '../core/i18n';
import { findBlock, findSection, type CollectionName, type Selection } from './paths';
import type { DocApi } from './useDocument';
import { useRemover } from './remover';
import { chaveDaSelecao, FocoCampoContext, usePedidoFoco, type PedidoFoco } from './focoCampo';
import { newBlockId } from './blockFactory';
import { EditLangContext, I18nInput, NumberInput, Row, RangeInput, SelectInput, TextInput } from './fields';
import { LangFlag } from '../renderer/Flags';
import { RichI18nInput } from './RichTextEditor';
import { TYPE_LABEL } from '../renderer/preview';
import { embedProvider } from '../embed/embedSource';
import { resolveSpan } from '../renderer/responsive';
import { itemWidth } from '../renderer/blocks';
import { CATEGORY_LABEL, projectCategory, type ProjectCategory } from '../core/category';
import { AnoRow, DataRow, FormatoRow, LinkPicker, RedesDatalist, redeDoLink } from './choices';

const PROJECT_META_FIELDS = ['tag', 'year', 'client', 'role', 'category', 'skills', 'contribution', 'credits', 'sequenceLabel', 'storyType', 'processNotes'] as const;
const META_LABEL: Record<string, string> = {
  tag: 'Tag', year: 'Ano', client: 'Cliente', role: 'Papel', skills: 'Competências',
  contribution: 'Contribuição', credits: 'Créditos', sequenceLabel: 'Sequência', storyType: 'Formato', processNotes: 'Processo',
};
/**
 * Categoria do projeto: escolha fechada, porque é ela que alimenta o filtro
 * "Profissionais / Pessoais" do site. Um texto antigo que não é nenhuma das
 * duas aparece como opção própria (avisando que fica fora do filtro) em vez
 * de ser apagado sem pedir.
 */
function CategoryRow({ value, onChange }: { value: I18n | undefined; onChange: (c: ProjectCategory | undefined) => void }): React.ReactElement {
  const cat = projectCategory(value);
  const texto = (value?.pt || value?.en || '').trim();
  const solto = !cat && texto ? texto : '';
  return (
    <Row label="Categoria (filtro do site)">
      <select className="insp-input" aria-label="Categoria" value={cat ?? (solto ? '__texto' : '')} onChange={(e) => { const v = e.target.value; if (v !== '__texto') onChange(v ? (v as ProjectCategory) : undefined); }}>
        <option value="">— Sem categoria</option>
        <option value="professional">{CATEGORY_LABEL.professional.pt}</option>
        <option value="personal">{CATEGORY_LABEL.personal.pt}</option>
        {solto ? <option value="__texto">“{solto}” — fica fora do filtro</option> : null}
      </select>
    </Row>
  );
}

const VIS_CURTO: { value: Visibility; label: string }[] = [
  { value: 'public', label: 'Público' },
  { value: 'draft', label: 'Rascunho' },
  { value: 'nda', label: 'NDA' },
];
const VIS_NOTA: Record<Visibility, string> = {
  public: 'Aparece no site.',
  draft: 'Só aparece aqui no editor — escolha Público para ir ao site.',
  nda: 'Só aparece depois da senha da área NDA.',
};

/**
 * Onde o item aparece, no topo do Inspector: projeto e nota nascem como
 * rascunho, e o controle para publicar ficava no fim de uma ficha técnica
 * de onze campos.
 */
function VisibilidadeItem({ value, onChange }: { value: Visibility; onChange: (v: Visibility) => void }): React.ReactElement {
  return (
    <div className={`insp-status is-${value}`}>
      <span className="insp-label" id="insp-status-rot">Onde aparece</span>
      <div className="insp-align" role="group" aria-labelledby="insp-status-rot">
        {VIS_CURTO.map((o) => (
          <button key={o.value} type="button" className={value === o.value ? 'on' : ''} aria-pressed={value === o.value} onClick={() => onChange(o.value)}>{o.label}</button>
        ))}
      </div>
      <div className="insp-note">{VIS_NOTA[value]}</div>
    </div>
  );
}

const COLL_LABEL: Record<CollectionName, string> = { projects: 'Projeto', blog: 'Nota', gallery: 'Imagem da galeria', sketches: 'Sketch' };

function ItemInspector({ doc, collection, id, onUploadImage, onDeleted }: { doc: DocApi; collection: CollectionName; id: string; onUploadImage?: UploadImage; onDeleted: () => void }): React.ReactElement {
  const item = doc.state.collections[collection].find((x) => x.id === id);
  const remover = useRemover(doc);
  if (!item) return <div className="insp-empty">Item não encontrado.</div>;
  const del = (): void => {
    remover({ kind: 'item', collection, itemId: id });
    onDeleted();
  };
  const uploadBtn = (apply: (aid: string) => void, atual?: ImageRef): React.ReactNode =>
    onUploadImage ? <ImageUploadButton atual={atual} onPick={(f) => void onUploadImage(f).then(apply)} /> : null;

  // Mesma régua e mesmo controle dos blocos, nas três telas.
  const widthRow = (coll: CollectionName, it: ItemComLargura): React.ReactNode => <LarguraItemPorDispositivo doc={doc} coll={coll} id={id} item={it} />;
  let fields: React.ReactNode = null;
  if (collection === 'projects') {
    const p = item as ProjectItem;
    fields = (
      <>
        <Row label="Título"><I18nInput campo="title" value={p.title} onChange={(v) => doc.updateItem('projects', id, (it) => void (it.title = v), `${id}:title`)} /></Row>
        <Row label="Descrição"><I18nInput campo="description" multiline value={p.description} onChange={(v) => doc.updateItem('projects', id, (it) => void (it.description = v), `${id}:desc`)} /></Row>
        <Row label="Capa (thumb)">{uploadBtn((aid) => doc.updateItem('projects', id, (it) => { it.thumb.assetId = aid; it.thumb.url = undefined; }), p.thumb)}</Row>
        {widthRow('projects', p)}
        <label className="insp-check"><input type="checkbox" checked={p.featured} onChange={(e) => doc.updateItem('projects', id, (it) => void (it.featured = e.target.checked))} /> Destaque na Home</label>
        <div className="insp-sub">Ficha técnica</div>
        {PROJECT_META_FIELDS.map((f) =>
          f === 'category' ? (
            <CategoryRow key={f} value={p.meta[f]} onChange={(c) => doc.updateItem('projects', id, (it) => { if (c) it.meta[f] = { pt: c, en: c }; else delete it.meta[f]; })} />
          ) : f === 'year' ? (
            <AnoRow key={`${id}:${f}`} value={p.meta[f]} onChange={(v) => doc.updateItem('projects', id, (it) => { if (v) it.meta[f] = v; else delete it.meta[f]; }, `${id}:${f}`)} />
          ) : f === 'storyType' ? (
            <FormatoRow key={`${id}:${f}`} value={p.meta[f]} onChange={(v) => doc.updateItem('projects', id, (it) => { if (v) it.meta[f] = v; else delete it.meta[f]; }, `${id}:${f}`)} />
          ) : (
            <Row key={f} label={META_LABEL[f] ?? f}><I18nInput campo={`meta.${f}`} value={p.meta[f] ?? emptyI18n()} onChange={(v) => doc.updateItem('projects', id, (it) => { it.meta[f] = v; }, `${id}:${f}`)} /></Row>
          ),
        )}
      </>
    );
  } else if (collection === 'blog') {
    const b = item as BlogItem;
    fields = (
      <>
        <Row label="Título"><I18nInput campo="title" value={b.title} onChange={(v) => doc.updateItem('blog', id, (it) => void (it.title = v), `${id}:title`)} /></Row>
        <DataRow key={`${id}:date`} value={b.date} onChange={(v) => doc.updateItem('blog', id, (it) => void (it.date = v), `${id}:date`)} />
        <Row label="Resumo"><I18nInput campo="excerpt" multiline value={b.excerpt} onChange={(v) => doc.updateItem('blog', id, (it) => void (it.excerpt = v), `${id}:exc`)} /></Row>
        {widthRow('blog', b)}
        <Row label="Capa (thumb)">{uploadBtn((aid) => doc.updateItem('blog', id, (it) => { it.thumb.assetId = aid; it.thumb.url = undefined; }), b.thumb)}</Row>
      </>
    );
  } else if (collection === 'gallery') {
    const g = item as GalleryItem;
    fields = (
      <>
        <Row label="Imagem">{uploadBtn((aid) => doc.updateItem('gallery', id, (it) => { it.image.assetId = aid; it.image.url = undefined; }), g.image)}</Row>
        <Row label="Legenda"><I18nInput campo="caption" value={g.caption} onChange={(v) => doc.updateItem('gallery', id, (it) => void (it.caption = v), `${id}:cap`)} /></Row>
        <Row label="Descrição da imagem (alt)"><I18nInput campo="image.alt" value={g.image.alt} onChange={(v) => doc.updateItem('gallery', id, (it) => void (it.image.alt = v), `${id}:alt`)} /></Row>
        {widthRow('gallery', g)}
      </>
    );
  } else {
    const s = item as SketchItem;
    fields = (
      <>
        <Row label="Imagem">{uploadBtn((aid) => doc.updateItem('sketches', id, (it) => { it.image.assetId = aid; it.image.url = undefined; }), s.image)}</Row>
        <Row label="Descrição da imagem (alt)"><I18nInput campo="image.alt" value={s.image.alt} onChange={(v) => doc.updateItem('sketches', id, (it) => void (it.image.alt = v), `${id}:alt`)} /></Row>
        {widthRow('sketches', s)}
      </>
    );
  }

  return (
    <>
      <div className="insp-head">{COLL_LABEL[collection]}</div>
      <div className="insp-body">
        <VisibilidadeItem value={item.visibility} onChange={(v) => doc.updateItem(collection, id, (it) => void (it.visibility = v))} />
        {fields}
        <button type="button" className="insp-delete" onClick={del}>Excluir {COLL_LABEL[collection].toLowerCase()}</button>
      </div>
    </>
  );
}

type Tab = 'content' | 'layout' | 'style' | 'visibility';
const TABS: { id: Tab; label: string }[] = [
  { id: 'content', label: 'Conteúdo' },
  { id: 'layout', label: 'Layout' },
  { id: 'style', label: 'Estilo' },
  { id: 'visibility', label: 'Visibilidade' },
];

/** Colunas da primeira lista (bloco Coleção) que mostra esta coleção — base da largura automática. */
function colsDaColecao(d: DocApi['state'], coll: CollectionName): number {
  for (const p of d.pages) for (const s of p.sections) for (const b of s.blocks) if (b.type === 'collection' && b.content.collection === coll) return b.content.cols;
  return 3;
}

type ItemComLargura = { width?: number; widthTablet?: number; widthMobile?: number; span?: number };

/**
 * Largura de um item de coleção nas três telas — o mesmo controle dos blocos
 * (régua de 12, cascata computador → tablet → celular, "↺" volta a herdar).
 * No computador, sem valor próprio o item segue as colunas da lista.
 */
function LarguraItemPorDispositivo({ doc, coll, id, item }: { doc: DocApi; coll: CollectionName; id: string; item: ItemComLargura }): React.ReactElement {
  const cols = colsDaColecao(doc.state, coll);
  const auto = itemWidth({ span: item.span }, cols);
  const kind = coll === 'projects' || coll === 'blog' ? 'card' : 'media';
  const spans = { desktop: item.width ?? auto, tablet: item.widthTablet, mobile: item.widthMobile };
  const campo = { desktop: 'width', tablet: 'widthTablet', mobile: 'widthMobile' } as const;
  const telas: { id: 'desktop' | 'tablet' | 'mobile'; nome: string }[] = [
    { id: 'desktop', nome: 'Computador' },
    { id: 'tablet', nome: 'Tablet' },
    { id: 'mobile', nome: 'Celular' },
  ];
  const setar = (tela: 'desktop' | 'tablet' | 'mobile', v: number | undefined): void =>
    doc.updateItem(coll, id, (x) => void ((x as ItemComLargura)[campo[tela]] = v), `${id}:${campo[tela]}`);
  return (
    <>
      {telas.map((t) => {
        const r = resolveSpan(spans, t.id, kind);
        const proprio = t.id === 'desktop' ? item.width !== undefined : r.own;
        const origem = t.id === 'desktop'
          ? (proprio ? 'próprio' : `automático · ${cols} por linha`)
          : r.own ? 'próprio' : r.floored ? 'ajustado' : `herdado do ${r.from === 'tablet' ? 'tablet' : 'computador'}`;
        return (
          <Row key={t.id} label={`Largura · ${t.nome}`}>
            <div className="insp-span-row">
              <RangeInput min={1} max={12} value={r.span} onChange={(v) => setar(t.id, v)} />
              <span className={`insp-span-tag${proprio ? ' own' : ''}`}>{r.span}/12 · {origem}</span>
              {proprio ? (
                <button type="button" className="insp-span-reset" title={t.id === 'desktop' ? 'Voltar ao automático (pelas colunas da lista)' : 'Voltar ao valor herdado'} onClick={() => setar(t.id, undefined)}>↺</button>
              ) : null}
            </div>
          </Row>
        );
      })}
    </>
  );
}

/** Existe, em alguma página publicada, a lista NDA (onde o visitante digita a senha)? */
function temListaNda(d: DocApi['state']): boolean {
  return d.pages.some((p) => p.visibility !== 'draft' && p.sections.some((s) => s.blocks.some((b) => b.type === 'collection' && b.content.filter === 'nda' && b.visibility === 'public')));
}

const VIS: { value: Visibility; label: string }[] = [
  { value: 'public', label: 'Público' },
  { value: 'draft', label: 'Rascunho (só no editor)' },
  { value: 'nda', label: 'NDA (só com a senha)' },
];

export type UploadImage = (file: File) => Promise<string>;

const ALIGNS = [
  { value: 'start', icon: '⯇', label: 'Esquerda' },
  { value: 'center', icon: '≡', label: 'Centro' },
  { value: 'end', icon: '⯈', label: 'Direita' },
] as const;

/** Alinhamento do bloco (texto, imagem, vídeo, botão…) — mesmo controle em todo lugar. */
function AlignRow({ doc, block, refBlock }: { doc: DocApi; block: Block; refBlock: import('./paths').BlockRef }): React.ReactElement {
  const cur = block.align ?? 'start';
  return (
    <div className="insp-row">
      <span className="insp-label">Alinhamento</span>
      <div className="insp-align" role="group" aria-label="Alinhamento">
        {ALIGNS.map((a) => (
          <button key={a.value} type="button" className={cur === a.value ? 'on' : ''} aria-pressed={cur === a.value} title={a.label} onClick={() => doc.updateBlock(refBlock, (b) => void (b.align = a.value))}>
            {a.icon} <span>{a.label}</span>
          </button>
        ))}
      </div>
      {block.type === 'image' && (block.content.widthPct ?? 100) >= 100 ? (
        <div className="insp-note">A imagem ocupa 100% da largura — diminua a "Largura (%)" para ver o alinhamento.</div>
      ) : null}
    </div>
  );
}

/** Espaçamentos da seção — os mesmos controles no inspector da seção e na aba Layout de cada bloco. */
function SpacingControls({ doc, sectionRef, title }: { doc: DocApi; sectionRef: import('./paths').SectionRef; title?: string }): React.ReactElement | null {
  const section = findSection(doc.state, sectionRef);
  if (!section) return null;
  const st = section.style;
  const row = (key: 'gap' | 'rowGap' | 'spaceTop' | 'spaceBottom', label: string, max: number, def: number): React.ReactElement => {
    const v = st[key];
    return (
      <div className="insp-row insp-space">
        <span className="insp-label">{label} · {v ?? `padrão (${def})`}{v !== undefined ? 'px' : ''}</span>
        <div className="insp-space-row">
          <input type="range" min={0} max={max} step={2} value={v ?? def} onChange={(e) => doc.updateSection(sectionRef, (s) => void (s.style[key] = Number(e.target.value)), `${sectionRef.sectionId}:${key}`)} />
          {v !== undefined ? <button type="button" title="Voltar ao padrão" onClick={() => doc.updateSection(sectionRef, (s) => void delete s.style[key])}>↺</button> : null}
        </div>
      </div>
    );
  };
  return (
    <>
      {title ? <div className="insp-sub">{title}</div> : null}
      {row('gap', 'Entre elementos (lado a lado)', 160, 24)}
      <div className="insp-note">Os elementos mantêm o tamanho: o espaço usa a sobra da linha. Numa linha cheia, diminua a largura de um elemento para abrir espaço.</div>
      {row('rowGap', 'Entre linhas', 160, 24)}
      {row('spaceTop', 'Acima da seção', 320, 52)}
      {row('spaceBottom', 'Abaixo da seção', 320, 52)}
    </>
  );
}

/** Grupo recolhível do inspector; lembra aberto/fechado entre sessões. */
function Group({ id, title, children, defaultOpen = true }: { id: string; title: string; children: React.ReactNode; defaultOpen?: boolean }): React.ReactElement {
  const key = `insp-group:${id}`;
  const [open, setOpen] = useState(() => {
    try {
      const v = localStorage.getItem(key);
      return v === null ? defaultOpen : v === '1';
    } catch {
      return defaultOpen;
    }
  });
  return (
    <details className="insp-group" open={open} onToggle={(e) => {
      const o = (e.currentTarget as HTMLDetailsElement).open;
      setOpen(o);
      try { localStorage.setItem(key, o ? '1' : '0'); } catch { /* sem storage */ }
    }}>
      <summary>{title}</summary>
      <div className="insp-group-body">{children}</div>
    </details>
  );
}

const ROW_ALIGNS = [
  { value: 'start', icon: '⯇', label: 'Esquerda' },
  { value: 'center', icon: '≡', label: 'Centro' },
  { value: 'end', icon: '⯈', label: 'Direita' },
  { value: 'between', icon: '⟷', label: 'Distribuir' },
] as const;

/** Alinhamento da linha inteira em que o bloco está (usa a sobra da linha; nada muda de tamanho). */
/**
 * Largura nos três dispositivos, com a cascata à mostra.
 *
 * Cada linha diz de onde vem o valor: próprio daquela tela, herdado do
 * computador/tablet, ou ajustado pelo piso (miniatura que ficaria pequena
 * demais). "↺" devolve a linha para o valor herdado — é o mesmo gesto de
 * "reset to inherited" dos editores que têm breakpoints.
 */
function LarguraPorDispositivo({ doc, block, refBlock }: { doc: DocApi; block: Block; refBlock: import('./paths').BlockRef }): React.ReactElement {
  const spans = { desktop: block.span, tablet: block.responsive?.tablet?.span, mobile: block.responsive?.mobile?.span };
  const telas: { id: 'desktop' | 'tablet' | 'mobile'; nome: string }[] = [
    { id: 'desktop', nome: 'Computador' },
    { id: 'tablet', nome: 'Tablet' },
    { id: 'mobile', nome: 'Celular' },
  ];
  const setar = (tela: 'desktop' | 'tablet' | 'mobile', v: number): void => {
    if (tela === 'desktop') return void doc.setBlockSpan(refBlock, v, `${refBlock.blockId}:span`);
    doc.updateBlock(refBlock, (b) => void ((b.responsive ??= {})[tela] = { ...(b.responsive[tela] ?? {}), span: v }), `${refBlock.blockId}:${tela}span`);
  };
  const limpar = (tela: 'tablet' | 'mobile'): void =>
    doc.updateBlock(refBlock, (b) => {
      const r = b.responsive?.[tela];
      if (!r) return;
      delete r.span;
      if (!r.hidden) delete b.responsive![tela];
    }, `${refBlock.blockId}:${tela}span:clear`);

  return (
    <>
      {telas.map((t) => {
        const r = resolveSpan(spans, t.id, 'block');
        return (
          <Row key={t.id} label={`Largura · ${t.nome}`}>
            <div className="insp-span-row">
              <RangeInput min={1} max={12} value={r.span} onChange={(v) => setar(t.id, v)} />
              <span className={`insp-span-tag${r.own ? ' own' : ''}`}>
                {r.span}/12 · {r.own ? (t.id === 'desktop' ? 'padrão' : 'próprio') : r.floored ? 'ajustado' : `herdado do ${r.from === 'tablet' ? 'tablet' : 'computador'}`}
              </span>
              {t.id !== 'desktop' && r.own ? (
                <button type="button" className="insp-span-reset" title="Voltar ao valor herdado" onClick={() => limpar(t.id as 'tablet' | 'mobile')}>↺</button>
              ) : null}
            </div>
          </Row>
        );
      })}
    </>
  );
}

function RowAlignRow({ doc, refBlock }: { doc: DocApi; refBlock: import('./paths').BlockRef }): React.ReactElement | null {
  const section = findSection(doc.state, refBlock);
  if (!section) return null;
  const head = section.blocks.find((b) => b.id === rowHeadId(section.blocks, refBlock.blockId));
  const cur = head?.rowAlign ?? 'start';
  const i = section.blocks.findIndex((b) => b.id === refBlock.blockId);
  const row = computeRowColumns(section.blocks).find((r) => r.some((c) => c.includes(i)));
  const used = row ? row.reduce((s, c) => s + section.blocks[c[0]!]!.span, 0) : 12;
  return (
    <div className="insp-row">
      <span className="insp-label">Alinhamento da linha inteira</span>
      <div className="insp-align" role="group" aria-label="Alinhamento da linha">
        {ROW_ALIGNS.map((a) => (
          <button key={a.value} type="button" className={cur === a.value ? 'on' : ''} aria-pressed={cur === a.value} title={a.label} onClick={() => doc.setRowAlign(refBlock, a.value)}>
            {a.icon} <span>{a.label}</span>
          </button>
        ))}
      </div>
      {used >= 12 ? <div className="insp-note">Esta linha está cheia (12/12) — diminua a largura de um elemento para sobrar espaço para alinhar.</div> : null}
    </div>
  );
}

/** Espaço próprio do elemento (4 lados), dentro da sua célula da linha. */
function BlockPadding({ doc, block, refBlock }: { doc: DocApi; block: Block; refBlock: import('./paths').BlockRef }): React.ReactElement {
  const sides = [
    { k: 't', label: 'Acima' },
    { k: 'b', label: 'Abaixo' },
    { k: 'l', label: 'Afastar para a direita' },
    { k: 'r', label: 'Afastar para a esquerda' },
  ] as const;
  const set = (k: 't' | 'r' | 'b' | 'l', v: number | undefined): void =>
    doc.updateBlock(refBlock, (b) => {
      const pad = { ...(b.pad ?? {}) };
      if (v === undefined) delete pad[k];
      else pad[k] = v;
      b.pad = Object.keys(pad).length ? pad : undefined;
    }, `${refBlock.blockId}:pad:${k}`);
  return (
    <>
      {sides.map(({ k, label }) => {
        const v = block.pad?.[k];
        return (
          <div key={k} className="insp-row insp-space">
            <span className="insp-label">{label} · {v ?? 0}px</span>
            <div className="insp-space-row">
              <input type="range" min={0} max={200} step={2} value={v ?? 0} onChange={(e) => set(k, Number(e.target.value) || undefined)} />
              {v !== undefined ? <button type="button" title="Zerar" onClick={() => set(k, undefined)}>↺</button> : null}
            </div>
          </div>
        );
      })}
    </>
  );
}

const HEADER_LABEL: Record<string, string> = { brand: 'Nome + função', nav: 'Menu', lang: 'Idiomas' };

/** Layout, ordem e visibilidade dos elementos do cabeçalho + itens do menu. */
function HeaderControls({ doc }: { doc: DocApi }): React.ReactElement {
  const cfg = doc.state.site.header ?? DEFAULT_HEADER;
  const hidden = new Set(cfg.hidden ?? []);
  const setHeader = (recipe: (h: HeaderConfig) => void): void =>
    doc.updateSite((s) => recipe((s.header ??= structuredClone(DEFAULT_HEADER))));
  const toggle = (k: 'brand' | 'nav' | 'lang' | 'role'): void =>
    setHeader((h) => {
      const set = new Set(h.hidden ?? []);
      if (set.has(k)) set.delete(k);
      else set.add(k);
      h.hidden = [...set];
    });
  const pages = doc.state.pages.filter((p) => p.kind === 'static' && p.visibility !== 'nda');
  const nav = doc.state.site.nav;
  return (
    <>
      <div className="insp-sub">Layout do cabeçalho</div>
      <Row label="Arranjo">
        <SelectInput
          value={cfg.layout}
          onChange={(v) => setHeader((h) => void (h.layout = v))}
          options={[
            { value: 'grid', label: 'Grade (como as seções)' },
            { value: 'split', label: '1º à esquerda, resto à direita' },
            { value: 'row', label: 'Tudo em uma linha' },
            { value: 'stacked', label: 'Empilhado (esquerda)' },
            { value: 'centered', label: 'Empilhado (centro)' },
          ]}
        />
      </Row>
      <div className="insp-list">
        {cfg.order.map((el, i) => (
          <div key={el} className={`insp-list-row${hidden.has(el) ? ' off' : ''}`}>
            <label><input type="checkbox" checked={!hidden.has(el)} onChange={() => toggle(el)} /> {HEADER_LABEL[el]}</label>
            {cfg.layout === 'grid' ? (
              <select className="insp-list-align" value={cfg.align?.[el] ?? 'start'} title="Alinhamento na célula" aria-label={`Alinhamento de “${HEADER_LABEL[el]}” na célula`} onChange={(e) => setHeader((h) => void (h.align = { ...(h.align ?? {}), [el]: e.target.value as 'start' | 'center' | 'end' }))}>
                <option value="start">⯇ esq.</option>
                <option value="center">≡ centro</option>
                <option value="end">dir. ⯈</option>
              </select>
            ) : null}
            <span className="insp-list-ord">
              <button type="button" disabled={i === 0} onClick={() => setHeader((h) => reorderArray(h.order, i, i - 1))}>↑</button>
              <button type="button" disabled={i === cfg.order.length - 1} onClick={() => setHeader((h) => reorderArray(h.order, i, i + 1))}>↓</button>
            </span>
          </div>
        ))}
      </div>
      <label className="insp-check"><input type="checkbox" checked={!hidden.has('role')} onChange={() => toggle('role')} /> Mostrar a função abaixo do nome</label>
      <div className="insp-note">Dica: no canvas, arraste os elementos do cabeçalho e os itens do menu para reorganizar.</div>

      <div className="insp-sub">Itens do menu</div>
      <div className="insp-list">
        {[...nav.map((id) => pages.find((p) => p.id === id)).filter((p): p is NonNullable<typeof p> => !!p), ...pages.filter((p) => !nav.includes(p.id))].map((p) => {
          const i = nav.indexOf(p.id);
          return (
            <div key={p.id} className={`insp-list-row${i < 0 ? ' off' : ''}`}>
              <label><input type="checkbox" checked={i >= 0} onChange={() => doc.toggleNav(p.id)} /> {p.title.pt || p.id}</label>
              {i >= 0 ? (
                <span className="insp-list-ord">
                  <button type="button" disabled={i === 0} onClick={() => doc.updateSite((s) => reorderArray(s.nav, i, i - 1))}>↑</button>
                  <button type="button" disabled={i === nav.length - 1} onClick={() => doc.updateSite((s) => reorderArray(s.nav, i, i + 1))}>↓</button>
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
      <div className="insp-note">O nome de cada item é o título da página (aba Páginas → selecione a página).</div>
    </>
  );
}

/** Resolve a imagem (asset embutido ou URL) para a prévia nos campos do Inspector. */
const ResolverContext = createContext<((r: ImageRef) => string) | undefined>(undefined);

/**
 * Campo de imagem: mostra a que está escolhida (antes nenhum campo mostrava —
 * só dava para saber qual era a capa olhando o card no canvas) e troca por
 * outra. `atual` ausente = campo de acrescentar (quadro novo do storyboard).
 */
function ImageUploadButton({ onPick, atual }: { onPick: (file: File) => void; atual?: ImageRef }): React.ReactElement {
  const ref = useRef<HTMLInputElement>(null);
  const resolver = useContext(ResolverContext);
  const src = atual && resolver ? resolver(atual) : '';
  return (
    <>
      {src ? (
        <div className="insp-img-atual">
          <img src={src} alt="" />
          <button type="button" className="insp-upload" onClick={() => ref.current?.click()}>Trocar imagem…</button>
        </div>
      ) : (
        <button type="button" className="insp-upload" onClick={() => ref.current?.click()}>Enviar imagem…</button>
      )}
      <input
        ref={ref}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) onPick(f);
        }}
      />
    </>
  );
}

const LANGS = [
  { id: 'pt', label: 'PT', name: 'Português' },
  { id: 'en', label: 'EN', name: 'English' },
] as const;

export function Inspector({ lang, onLang, quadroEmFoco, resolveAsset, pedidoFoco, onFocoAtendido, ...props }: { doc: DocApi; selection: Selection; onUploadImage?: UploadImage; onSelect?: (s: Selection) => void; lang: 'pt' | 'en'; onLang: (l: 'pt' | 'en') => void; quadroEmFoco?: { blockId: string; idx: number } | null; resolveAsset?: (r: ImageRef) => string; pedidoFoco?: PedidoFoco | null; onFocoAtendido?: (n: number) => void }): React.ReactElement {
  // O pedido de foco só vale para a seleção que ele mirou.
  const pedido = pedidoFoco && pedidoFoco.chave === chaveDaSelecao(props.selection) ? pedidoFoco : null;
  return (
    <aside className="inspector">
      <div className="insp-langbar" role="group" aria-label="Idioma dos textos">
        <span className="insp-langbar-label">Editando</span>
        {LANGS.map((l) => (
          <button key={l.id} type="button" className={`insp-lang ${lang === l.id ? 'on' : ''}`} aria-pressed={lang === l.id} title={`Editar textos em ${l.name}`} onClick={() => onLang(l.id)}>
            <LangFlag lang={l.id} /> {l.label}
          </button>
        ))}
      </div>
      <EditLangContext.Provider value={lang}>
        <ResolverContext.Provider value={resolveAsset}>
          <FocoCampoContext.Provider value={{ pedido, atender: onFocoAtendido ?? (() => {}) }}>
            <InspectorBody {...props} quadroEmFoco={quadroEmFoco} />
          </FocoCampoContext.Provider>
        </ResolverContext.Provider>
      </EditLangContext.Provider>
    </aside>
  );
}

function InspectorBody({ doc, selection, onUploadImage, onSelect , quadroEmFoco }: { doc: DocApi; selection: Selection; onUploadImage?: UploadImage; onSelect?: (s: Selection) => void ; quadroEmFoco?: { blockId: string; idx: number } | null }): React.ReactElement {
  const [tab, setTab] = useState<Tab>('content');
  const remover = useRemover(doc);
  // "Traduzir"/"Descrever" pediram um campo: os textos moram na aba Conteúdo.
  const pedido = usePedidoFoco();
  useEffect(() => {
    if (pedido) setTab('content');
  }, [pedido]);

  if (!selection) {
    return (
      <div className="insp-help">
        <p className="insp-help-lead">Clique num elemento do canvas (ou nas Layers) para editar.</p>
        <div className="insp-sub">Gestos no canvas</div>
        <ul>
          <li><b>⠿</b> arraste para mover · solte na <b>lateral</b> de outro elemento = mesma linha · <b>em cima/embaixo</b> = empilha na coluna</li>
          <li><b>Borda direita</b> arraste para mudar a largura</li>
          <li>Ícones no hover: trocar imagem, recortar, editar, excluir</li>
          <li>Textos e títulos: selecione e clique de novo para escrever direto no canvas (com barra de formatação)</li>
          <li><b>Sem mouse:</b> Tab chega às Layers e aos ícones de cada elemento (Enter em “Editar” seleciona); a aba Layout tem Subir/Descer e Posição na grade</li>
        </ul>
        <div className="insp-sub">Atalhos</div>
        <dl className="insp-keys">
          <dt>Ctrl+Z / Ctrl+Shift+Z</dt><dd>desfazer / refazer</dd>
          <dt>Ctrl+C · X · V</dt><dd>copiar · recortar · colar</dd>
          <dt>Ctrl+D</dt><dd>duplicar</dd>
          <dt>Alt+↑ / Alt+↓</dt><dd>mover o selecionado uma posição</dd>
          <dt>Delete</dt><dd>excluir o selecionado</dd>
          <dt>Esc</dt><dd>selecionar o "pai" (bloco → seção → página)</dd>
          <dt>Ctrl+S</dt><dd>baixar o backup (o rascunho já salva sozinho)</dd>
        </dl>
      </div>
    );
  }

  if (selection.kind === 'item') {
    return <><ItemInspector doc={doc} collection={selection.collection} id={selection.itemId} onUploadImage={onUploadImage} onDeleted={() => onSelect?.(null)} /></>;
  }

  if (selection.kind === 'site') {
    return (
      <>
        <div className="insp-head">Site · cabeçalho</div>
        <div className="insp-body">
          <Row label="Nome"><I18nInput campo="site.name" value={doc.state.site.name} onChange={(v) => doc.updateSite((s) => void (s.name = v), 'site:name')} /></Row>
          <Row label="Função"><I18nInput campo="site.role" value={doc.state.site.role} onChange={(v) => doc.updateSite((s) => void (s.role = v), 'site:role')} /></Row>
          <HeaderControls doc={doc} />
        </div>
      </>
    );
  }

  if (selection.kind === 'page') {
    const page = doc.state.pages.find((p) => p.id === selection.pageId);
    return (
      <>
        <div className="insp-head">Página · {page?.id}</div>
        {page ? (
          <div className="insp-body">
            <Row label="Título">
              <I18nInput campo="title" value={page.title} onChange={(v) => doc.updatePage(page.id, (p) => void (p.title = v), `${page.id}:title`)} />
            </Row>
            {page.id !== 'home' ? (
              <Row label="Endereço (slug) — site.html#…">
                <TextInput value={page.slug} onChange={(v) => doc.updatePage(page.id, (p) => void (p.slug = v.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9-]+/g, '-').replace(/^-+/, '')), `${page.id}:slug`)} />
                {!page.slug ? <div className="insp-note">Sem endereço, a página usa o id interno ({page.id}).</div> : null}
                {page.slug && doc.state.pages.some((p) => p.id !== page.id && p.slug === page.slug) ? <div className="insp-note insp-warn">Outra página já usa este endereço — os links vão abrir a primeira.</div> : null}
              </Row>
            ) : null}
            <label className="insp-check">
              <input type="checkbox" checked={doc.state.site.nav.includes(page.id)} onChange={() => doc.toggleNav(page.id)} />
              Mostrar no menu
            </label>
            <Group id="seo" title="SEO e compartilhamento" defaultOpen={false}>
              <Row label="Descrição (Google e redes sociais)">
                <I18nInput campo="seo.description" multiline value={page.seo?.description ?? emptyI18n()} onChange={(v) => doc.updatePage(page.id, (p) => void ((p.seo ??= {}).description = v), `${page.id}:seodesc`)} />
              </Row>
              {onUploadImage ? (
                <Row label="Imagem ao compartilhar o link">
                  <ImageUploadButton atual={page.seo?.image} onPick={(f) => void onUploadImage(f).then((id) => doc.updatePage(page.id, (p) => void ((p.seo ??= {}).image = { assetId: id, alt: emptyI18n() })))} />
                </Row>
              ) : null}
              <div className="insp-note">{page.id === 'home' ? 'A Home define o texto e a imagem que aparecem ao compartilhar o site.' : 'Usada quando esta página está aberta; o link compartilhado usa sempre os dados da Home (o site é um arquivo só).'}</div>
            </Group>
            {page.id !== 'home' ? (
              <button type="button" className="insp-delete" onClick={() => remover({ kind: 'page', pageId: page.id })}>Excluir página</button>
            ) : null}
          </div>
        ) : null}
      </>
    );
  }

  if (selection.kind === 'section') {
    const section = findSection(doc.state, selection.ref);
    return (
      <>
        <div className="insp-head">Seção</div>
        {section ? (
          <div className="insp-body">
            <SpacingControls doc={doc} sectionRef={selection.ref} title="Espaçamento" />
            <Row label="Nome (só no editor)"><TextInput value={section.name ?? ''} placeholder="Ex.: Destaques" onChange={(v) => doc.updateSection(selection.ref, (s) => void (s.name = v || undefined), `${selection.ref.sectionId}:name`)} /></Row>
            <Row label="Largura">
              <SelectInput
                value={section.style.width ?? 'normal'}
                onChange={(v) => doc.updateSection(selection.ref, (s) => void (s.style.width = v))}
                options={[
                  { value: 'full', label: 'Cheia' },
                  { value: 'wide', label: 'Larga' },
                  { value: 'normal', label: 'Normal' },
                  { value: 'narrow', label: 'Estreita' },
                ]}
              />
            </Row>
            {selection.ref.container.on === 'item' && selection.ref.container.collection === 'projects' ? (
              <label className="insp-check">
                <input type="checkbox" checked={!!section.homeHidden} onChange={(e) => doc.updateSection(selection.ref, (s) => void (s.homeHidden = e.target.checked || undefined))} />
                Ocultar na prévia da Home
              </label>
            ) : null}
            <div className="insp-move">
              <button type="button" onClick={() => doc.duplicateSection(selection.ref.container, selection.ref.sectionId)}>Duplicar</button>
            </div>
            <button type="button" className="insp-delete" onClick={() => { remover({ kind: 'section', ref: selection.ref }); onSelect?.(null); }}>Excluir seção</button>
          </div>
        ) : null}
      </>
    );
  }

  const ref = selection.ref;
  const block = findBlock(doc.state, ref);
  if (!block) return <><div className="insp-empty">Bloco não encontrado.</div></>;

  return (
    <>
      <div className="insp-head">{TYPE_LABEL[block.type] ?? block.type}</div>
      <div className="insp-tabs">
        {TABS.map((t) => (
          <button key={t.id} type="button" className={`insp-tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="insp-body">
        {tab === 'content' && (
          <>
            <ContentTab doc={doc} block={block} refBlock={selection.ref} onUploadImage={onUploadImage} foco={quadroEmFoco?.blockId === selection.ref.blockId ? quadroEmFoco.idx : undefined} />
          </>
        )}
        {tab === 'layout' && <LayoutTab doc={doc} block={block} refBlock={selection.ref} />}
        {tab === 'style' && <StyleTab doc={doc} block={block} refBlock={selection.ref} />}
        {tab === 'visibility' && (
          <>
            <Row label="Visibilidade">
              <SelectInput value={block.visibility} onChange={(v) => doc.updateBlock(selection.ref, (b) => void (b.visibility = v))} options={VIS} />
            </Row>
            <div className="insp-note">
              {block.visibility === 'public'
                ? 'Aparece para todo mundo.'
                : block.visibility === 'draft'
                  ? 'Fica só aqui no editor: não vai para o site publicado.'
                  : 'Vai cifrado no site e aparece neste mesmo lugar depois que o visitante digita a senha da área NDA. Antes disso, nem o código da página mostra que ele existe.'}
            </div>
            {block.visibility === 'nda' && !temListaNda(doc.state) ? (
              <div className="insp-note insp-warn">Nenhuma página tem a lista confidencial (coleção com filtro NDA), que é onde o visitante digita a senha. Sem ela, este elemento não tem como aparecer.</div>
            ) : null}
          </>
        )}
      </div>
    </>
  );
}

function ContentTab({ doc, block, refBlock, onUploadImage, foco }: { doc: DocApi; block: Block; refBlock: import('./paths').BlockRef; onUploadImage?: UploadImage; foco?: number }): React.ReactElement {
  const gk = (f: string): string => `${refBlock.blockId}:${f}`;
  const upd = doc.updateBlock;
  switch (block.type) {
    case 'heading':
      return (
        <>
          <Row label="Texto">
            <I18nInput campo="content.text" value={{ pt: stripTags(block.content.text.pt), en: stripTags(block.content.text.en) }} onChange={(v) => upd(refBlock, (b) => void (b.type === 'heading' && (b.content.text = { pt: escapeText(v.pt), en: escapeText(v.en) })), gk('text'))} />
            {/<[a-z]/i.test(block.content.text.pt + block.content.text.en) ? <div className="insp-note">Este título tem formatação (cor, fonte…) feita no canvas. Editar aqui remove a formatação — para mantê-la, edite direto no canvas.</div> : null}
          </Row>
          <div className="insp-row">
            <span className="insp-label">Nível do título</span>
            <div className="insp-align" role="group" aria-label="Nível do título">
              {[1, 2, 3, 4].map((n) => (
                <button key={n} type="button" className={(block.content.level ?? 2) === n ? 'on' : ''} aria-pressed={(block.content.level ?? 2) === n} onClick={() => upd(refBlock, (b) => void (b.type === 'heading' && (b.content.level = n)))}>H{n}</button>
              ))}
            </div>
          </div>
        </>
      );
    case 'text':
      return <Row label="Texto rich"><RichI18nInput campo="content.html" value={block.content.html} onChange={(v) => upd(refBlock, (b) => void (b.type === 'text' && (b.content.html = v)), gk('html'))} /></Row>;
    case 'image':
      return (
        <>
          {onUploadImage ? (
            <Row label="Imagem">
              <ImageUploadButton
                atual={block.content.image}
                onPick={(file) => {
                  void onUploadImage(file).then((id) =>
                    upd(refBlock, (b) => {
                      if (b.type === 'image') {
                        b.content.image.assetId = id;
                        b.content.image.url = undefined;
                      }
                    }),
                  );
                }}
              />
            </Row>
          ) : null}
          <Row label="Legenda (aparece embaixo da imagem)"><I18nInput campo="content.caption" value={block.content.caption ?? emptyI18n()} onChange={(v) => upd(refBlock, (b) => void (b.type === 'image' && (b.content.caption = isBlankI18n(v) ? undefined : v)), gk('cap'))} /></Row>
          <Row label="Descrição da imagem (alt)"><I18nInput campo="content.image.alt" value={block.content.image.alt} onChange={(v) => upd(refBlock, (b) => void (b.type === 'image' && (b.content.image.alt = v)), gk('alt'))} /></Row>
          <Row label="Largura (%)"><NumberInput value={block.content.widthPct ?? 100} min={25} max={100} onChange={(v) => upd(refBlock, (b) => void (b.type === 'image' && (b.content.widthPct = v)), gk('wpct'))} /></Row>
        </>
      );
    case 'embed':
      return (
        <>
          <Row label="Provedor"><SelectInput value={block.content.provider} onChange={(v) => upd(refBlock, (b) => void (b.type === 'embed' && (b.content.provider = v)))} options={[{ value: 'youtube', label: 'YouTube' }, { value: 'vimeo', label: 'Vimeo' }, { value: 'speakerdeck', label: 'Speaker Deck' }]} /></Row>
          <Row label="URL / ID / iframe">
            <TextInput
              value={block.content.ref}
              onChange={(v) =>
                upd(refBlock, (b) => {
                  if (b.type !== 'embed') return;
                  b.content.ref = v;
                  // Colou um link de outro serviço: o provedor acompanha, senão o
                  // campo passa a dizer uma coisa e o player mostrar outra.
                  const real = embedProvider({ type: b.content.provider, id: v });
                  if (real) b.content.provider = real;
                }, gk('ref'))
              }
            />
          </Row>
          <Row label="Nome (aba do carrossel)">
            <I18nInput
              campo="content.label"
              value={block.content.label ?? emptyI18n()}
              onChange={(v) => upd(refBlock, (b) => void (b.type === 'embed' && (b.content.label = v.pt.trim() || v.en.trim() ? v : undefined)), gk('elabel'))}
            />
          </Row>
          <div className="insp-note">Na prévia do projeto, os vídeos e apresentações viram um carrossel — este nome é o rótulo da aba. Sem nome, aparece o provedor.</div>
        </>
      );
    case 'collection':
      return (
        <>
          <Row label="Coleção"><SelectInput value={block.content.collection} onChange={(v) => upd(refBlock, (b) => void (b.type === 'collection' && (b.content.collection = v)))} options={[{ value: 'projects', label: 'Projetos' }, { value: 'blog', label: 'Notas' }, { value: 'gallery', label: 'Galeria' }, { value: 'sketches', label: 'Sketches' }]} /></Row>
          <Row label="Colunas"><RangeInput min={1} max={6} value={block.content.cols} onChange={(v) => upd(refBlock, (b) => void (b.type === 'collection' && (b.content.cols = v)), gk('cols'))} /></Row>
          <Row label={`Espaço entre os itens · ${block.content.gap ?? 'padrão (24)'}${block.content.gap !== undefined ? 'px' : ''}`}><RangeInput min={0} max={120} value={block.content.gap ?? 24} onChange={(v) => upd(refBlock, (b) => void (b.type === 'collection' && (b.content.gap = v)), gk('gap'))} /></Row>
          <Row label="Filtro fixo"><SelectInput value={block.content.filter ?? 'all'} onChange={(v) => upd(refBlock, (b) => void (b.type === 'collection' && (b.content.filter = v)))} options={[{ value: 'all', label: 'Todos' }, { value: 'featured', label: 'Destaques' }, { value: 'professional', label: 'Profissional' }, { value: 'personal', label: 'Pessoal' }, { value: 'nda', label: 'Só NDA (confidencial)' }]} /></Row>
          <label className="insp-check">
            <input type="checkbox" checked={!!block.content.showFilter} onChange={(e) => upd(refBlock, (b) => void (b.type === 'collection' && (b.content.showFilter = e.target.checked || undefined)))} />
            Botões de filtro p/ o visitante (projetos)
          </label>
          {block.content.showFilter && (block.content.filter === 'professional' || block.content.filter === 'personal') ? (
            <div className="insp-note">Com o filtro fixo numa categoria, os botões do visitante ficam ocultos (só haveria uma categoria).</div>
          ) : null}
          <label className="insp-check">
            <input type="checkbox" checked={!!block.content.preview} onChange={(e) => upd(refBlock, (b) => void (b.type === 'collection' && (b.content.preview = e.target.checked || undefined)))} />
            Prévia inline ao clicar (Home)
          </label>
        </>
      );
    case 'spacer':
      return <Row label="Tamanho"><SelectInput value={block.content.size} onChange={(v) => upd(refBlock, (b) => void (b.type === 'spacer' && (b.content.size = v)))} options={[{ value: 's', label: 'P' }, { value: 'm', label: 'M' }, { value: 'l', label: 'G' }, { value: 'xl', label: 'GG' }]} /></Row>;
    case 'contact': {
      const c = block.content;
      return (
        <>
          <Row label="Título"><I18nInput campo="content.heading" value={c.heading} onChange={(v) => upd(refBlock, (b) => void (b.type === 'contact' && (b.content.heading = v)), gk('ch'))} /></Row>
          <Row label="Corpo"><I18nInput campo="content.body" multiline value={c.body} onChange={(v) => upd(refBlock, (b) => void (b.type === 'contact' && (b.content.body = v)), gk('cb'))} /></Row>
          <Row label="E-mail"><TextInput value={c.email} onChange={(v) => upd(refBlock, (b) => void (b.type === 'contact' && (b.content.email = v)), gk('em'))} /></Row>
          <Row label="Telefone"><TextInput value={c.phone} onChange={(v) => upd(refBlock, (b) => void (b.type === 'contact' && (b.content.phone = v)), gk('ph'))} /></Row>
          <Row label="CV">
            <button type="button" className="insp-upload" onClick={() => doc.transacao(() => { upd(refBlock, (b) => void (b.type === 'contact' && (b.content.cvHref = ''))); doc.insertBelow(refBlock, { id: newBlockId(), type: 'button', span: 4, visibility: 'public', content: { label: c.cvLabel.pt || c.cvLabel.en ? c.cvLabel : { pt: 'Baixar CV', en: 'Download CV' }, href: c.cvHref || 'cv.pdf', variant: 'solid' } }); })}>＋ Criar botão de CV logo abaixo</button>
            <div className="insp-note">O CV é um bloco Botão: dá para mover, redimensionar e mudar texto/link como qualquer elemento.</div>
          </Row>
          {onUploadImage ? (
            <Row label="Foto de contato">
              <ImageUploadButton atual={c.image} onPick={(f) => void onUploadImage(f).then((id) => upd(refBlock, (b) => { if (b.type === 'contact') b.content.image = { assetId: id, alt: emptyI18n() }; }))} />
            </Row>
          ) : null}
          {/* Toda imagem que vai para o site tem descrição — a foto do Contato não tinha onde escrever. */}
          {c.image ? (
            <Row label="Descrição da foto (alt)">
              <I18nInput campo="content.image.alt" value={c.image.alt} onChange={(v) => upd(refBlock, (b) => { if (b.type === 'contact' && b.content.image) b.content.image.alt = v; }, gk('calt'))} />
            </Row>
          ) : null}
          <div className="insp-sub">Redes sociais</div>
          <RedesDatalist id="redes-sociais" />
          {c.socials.map((s, i) => (
            <div key={i} className="insp-social">
              <TextInput label={`Nome da rede ${i + 1}`} list="redes-sociais" value={s.label} placeholder="Instagram, Behance…" onChange={(v) => upd(refBlock, (b) => void (b.type === 'contact' && (b.content.socials[i]!.label = v)), gk(`sl${i}`))} />
              <TextInput
                label={`Link da rede ${i + 1}`}
                value={s.href}
                placeholder="Cole o link do perfil"
                onChange={(v) => upd(refBlock, (b) => {
                  if (b.type !== 'contact') return;
                  const soc = b.content.socials[i]!;
                  soc.href = v;
                  // Colou o link de uma rede conhecida e o nome ainda é o provisório: preenche sozinho.
                  const rede = redeDoLink(v);
                  if (rede && (!soc.label.trim() || soc.label === 'Rede')) soc.label = rede;
                }, gk(`sh${i}`))}
              />
              <button type="button" className="insp-social-del" onClick={() => upd(refBlock, (b) => { if (b.type === 'contact') b.content.socials.splice(i, 1); })}>✕</button>
            </div>
          ))}
          <button type="button" className="add-block-btn additem" onClick={() => upd(refBlock, (b) => { if (b.type === 'contact') b.content.socials.push({ label: '', href: '' }); })}>＋ Rede social</button>
        </>
      );
    }
    case 'button': {
      const c = block.content;
      return (
        <>
          <Row label="Texto do botão"><I18nInput campo="content.label" value={c.label} onChange={(v) => upd(refBlock, (b) => void (b.type === 'button' && (b.content.label = v)), gk('lbl'))} /></Row>
          <LinkPicker key={block.id} doc={doc.state} href={c.href} onChange={(v) => upd(refBlock, (b) => void (b.type === 'button' && (b.content.href = v)), gk('href'))} />
          <Row label="Estilo"><SelectInput value={c.variant} onChange={(v) => upd(refBlock, (b) => void (b.type === 'button' && (b.content.variant = v)))} options={[{ value: 'solid', label: 'Cheio' }, { value: 'outline', label: 'Contorno' }, { value: 'link', label: 'Link' }]} /></Row>
          <label className="insp-check"><input type="checkbox" checked={!!c.newTab} onChange={(e) => upd(refBlock, (b) => void (b.type === 'button' && (b.content.newTab = e.target.checked || undefined)))} /> Abrir em nova aba</label>
        </>
      );
    }
    case 'columns':
      return <Row label="Colunas"><NumberInput value={block.content.count} min={2} max={4} onChange={(v) => upd(refBlock, (b) => void (b.type === 'columns' && (b.content.count = v)), gk('count'))} /></Row>;
    case 'storyboard':
      return (
        <>
          {onUploadImage ? (
            <Row label={`Quadros (${block.content.frames.length})`}>
              <ImageUploadButton onPick={(f) => void onUploadImage(f).then((id) => upd(refBlock, (b) => void (b.type === 'storyboard' && b.content.frames.push({ assetId: id, alt: emptyI18n() }))))} />
            </Row>
          ) : null}
          {/* Cada quadro: a legenda que o site mostra embaixo (plano, ação, diálogo)
              e a descrição que leitor de tela e busca leem. */}
          {block.content.frames.map((f, n) => (
            <div key={n} className={`insp-quadro${foco === n ? ' em-foco' : ''}`} data-quadro={n}>
              <Row label={`Quadro ${n + 1} · legenda`}>
                <I18nInput
                  campo={`frames.${n}.caption`}
                  value={f.caption ?? emptyI18n()}
                  onChange={(v) => upd(refBlock, (b) => { const fr = b.type === 'storyboard' ? b.content.frames[n] : undefined; if (fr) fr.caption = isBlankI18n(v) ? undefined : v; }, `${refBlock.blockId}:cap${n}`)}
                />
              </Row>
              <Row label={`Quadro ${n + 1} · descrição`}>
                <I18nInput
                  campo={`frames.${n}.alt`}
                  value={f.alt}
                  onChange={(v) => upd(refBlock, (b) => { const fr = b.type === 'storyboard' ? b.content.frames[n] : undefined; if (fr) fr.alt = v; }, `${refBlock.blockId}:alt${n}`)}
                />
              </Row>
            </div>
          ))}
          <div className="insp-note">No canvas, cada quadro tem trocar imagem, recortar, editar e excluir no hover; arraste para reordenar e use a borda direita para a largura.</div>
        </>
      );
    case 'divider':
      return <div className="insp-note">O divisor não tem conteúdo — ajuste largura e espaçamento na aba Layout.</div>;
    default:
      return <div className="insp-note">—</div>;
  }
}

/**
 * Montar a grade sem arrastar: os mesmos gestos de soltar na lateral ou embaixo
 * de outro elemento, em botões. Arrastar no canvas não existe no toque nem no
 * teclado; aqui tudo fica ao alcance de um toque ou de um Enter.
 */
function PosicaoNaGrade({ doc, refBlock }: { doc: DocApi; refBlock: import('./paths').BlockRef }): React.ReactElement | null {
  const section = findSection(doc.state, refBlock);
  if (!section) return null;
  const blocks = section.blocks;
  const i = blocks.findIndex((b) => b.id === refBlock.blockId);
  if (i < 0) return null;
  const linhas = computeRowColumns(blocks);
  const linha = linhas.find((r) => r.some((c) => c.includes(i))) ?? [[i]];
  const naLinha = (j: number): boolean => linha.some((c) => c.includes(j));
  const anterior = blocks[i - 1];
  const proximo = blocks[i + 1];
  const eu = blocks[i]!;
  const sozinho = linha.length === 1 && linha[0]!.length === 1;
  const soltar = (alvo: string, zona: DropZone): void => doc.dropBlock(refBlock.container, refBlock.blockId, alvo, zona);
  return (
    <div className="insp-row">
      <span className="insp-label">Posição na grade</span>
      <div className="insp-grade" role="group" aria-label="Posição na grade">
        <button type="button" disabled={!anterior || (naLinha(i - 1) && !eu.stack)} onClick={() => anterior && soltar(anterior.id, 'right')} title="Na mesma linha, à direita do elemento de cima">⇤ Ao lado do anterior</button>
        <button type="button" disabled={!proximo || (naLinha(i + 1) && !proximo.stack)} onClick={() => proximo && soltar(proximo.id, 'left')} title="Na mesma linha, à esquerda do elemento de baixo">Ao lado do próximo ⇥</button>
        <button type="button" disabled={!anterior || !!eu.stack || !(anterior && linhas.find((r) => r.some((c) => c.includes(i - 1)))!.length > 1)} onClick={() => anterior && soltar(anterior.id, 'bottom')} title="Na mesma coluna, logo embaixo do elemento de cima (quando ele divide a linha com outros)">⤓ Embaixo do anterior</button>
        <button type="button" disabled={sozinho} onClick={() => doc.blockOwnRow(refBlock)} title="Tira da linha/coluna e ocupa a largura toda">▭ Linha própria</button>
      </div>
    </div>
  );
}

function LayoutTab({ doc, block, refBlock }: { doc: DocApi; block: Block; refBlock: import('./paths').BlockRef }): React.ReactElement {
  return (
    <>
      <Group id="size" title="Tamanho e alinhamento">
        <LarguraPorDispositivo doc={doc} block={block} refBlock={refBlock} />
        {['divider', 'spacer'].includes(block.type) ? null : <AlignRow doc={doc} block={block} refBlock={refBlock} />}
        <RowAlignRow doc={doc} refBlock={refBlock} />
        <div className="insp-move">
          <button type="button" onClick={() => doc.moveBlock(refBlock, -1)}>↑ Subir</button>
          <button type="button" onClick={() => doc.moveBlock(refBlock, 1)}>↓ Descer</button>
        </div>
        <PosicaoNaGrade doc={doc} refBlock={refBlock} />
      </Group>
      <Group id="pad" title="Espaço deste elemento" defaultOpen={false}>
        <BlockPadding doc={doc} block={block} refBlock={refBlock} />
      </Group>
      <Group id="section" title="Espaço da seção" defaultOpen={false}>
        <SpacingControls doc={doc} sectionRef={{ container: refBlock.container, sectionId: refBlock.sectionId }} />
      </Group>
      <Group id="mobile" title="Mostrar em cada tela" defaultOpen={false}>
        <label className="insp-check">
          <input type="checkbox" checked={!!block.responsive?.tablet?.hidden} onChange={(e) => doc.updateBlock(refBlock, (b) => void ((b.responsive ??= {}).tablet = { ...(b.responsive.tablet ?? {}), hidden: e.target.checked }))} />
          Ocultar no tablet
        </label>
        <label className="insp-check">
          <input type="checkbox" checked={!!block.responsive?.mobile?.hidden} onChange={(e) => doc.updateBlock(refBlock, (b) => void ((b.responsive ??= {}).mobile = { ...(b.responsive.mobile ?? {}), hidden: e.target.checked }))} />
          Ocultar no celular
        </label>
      </Group>
    </>
  );
}

const TEXT_STYLE_LABEL: Record<string, string> = { display: 'Display (título grande)', label: 'Etiqueta (mono, caixa alta)', body: 'Corpo (texto leve)' };
const COLOR_LABEL: Record<string, string> = { bg: 'Fundo', surface: 'Superfície', ink: 'Tinta', inkSoft: 'Tinta suave', inkPale: 'Tinta clara', rule: 'Régua', accent: 'Destaque', accent2: 'Destaque 2' };

/** Texto visível de um título salvo com formatação (HTML). */
function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
}
/** Texto digitado no inspector → seguro para renderizar como HTML. */
function escapeText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Tipos cujo conteúdo é texto — só neles o estilo de texto do tema faz efeito. */
const COM_TEXTO = ['heading', 'text', 'button', 'contact'];

function StyleTab({ doc, block, refBlock }: { doc: DocApi; block: Block; refBlock: import('./paths').BlockRef }): React.ReactElement {
  const colorTokens = Object.keys(doc.state.theme.colors);
  const styleTokens = Object.keys(doc.state.theme.textStyles);
  const bg = block.style?.bg ?? '';
  const ts = block.style?.textStyle ?? '';
  return (
    <>
      <Row label="Cor de fundo do bloco">
        <SelectInput
          value={bg}
          onChange={(v) => doc.updateBlock(refBlock, (b) => void ((b.style ??= {}).bg = v || undefined))}
          options={[{ value: '', label: '— nenhuma —' }, ...colorTokens.map((t) => ({ value: t, label: COLOR_LABEL[t] ?? t }))]}
        />
      </Row>
      {COM_TEXTO.includes(block.type) ? (
        <Row label="Estilo de texto (do tema)">
          <SelectInput
            value={ts}
            onChange={(v) => doc.updateBlock(refBlock, (b) => void ((b.style ??= {}).textStyle = v || undefined))}
            options={[{ value: '', label: '— padrão do bloco —' }, ...styleTokens.map((t) => ({ value: t, label: TEXT_STYLE_LABEL[t] ?? t }))]}
          />
        </Row>
      ) : null}
    </>
  );
}
