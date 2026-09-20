import { useEffect, useRef, useState } from 'react';
import { embedSource } from '../embed/embedSource';
import { sobraDaLinha, spanVars } from './responsive';
import { ErrorBoundary } from './ErrorBoundary';
import type { Block, GalleryItem, HomePreview, ImageRef, ProjectItem, Section, SketchItem } from '../schema/v4';
import { blockLabel, effectivePreview, projectBlocks } from './preview';
import type { BlogItem } from '../schema/v4';
import { RenderContext, useRender } from './context';
import { styleVars } from './css';
import { pick, RichText } from './text';
import { sanitizeRich } from '../core/sanitizeHtml';
import { layoutGrid, type Placement } from './gridLayout';

// ----------------------------------------------------------------- primitivos
function Img({ image, className, eager }: { image: ImageRef; className?: string; eager?: boolean }): React.ReactElement | null {
  const { resolveAsset, lang, data } = useRender();
  const src = resolveAsset(image);
  if (!src) return null;
  const meta = image.assetId ? data.assets[image.assetId] : undefined;
  const dims = meta && meta.w > 0 && meta.h > 0 ? { width: meta.w, height: meta.h } : {};
  const c = image.crop;
  // A imagem do topo carrega na frente (é a maior pintura da tela); o resto é preguiçoso.
  const carga = eager ? ({ loading: 'eager', fetchPriority: 'high' } as const) : ({ loading: 'lazy', decoding: 'async' } as const);
  if (!c) return <img className={className} {...carga} src={src} alt={pick(image.alt, lang)} {...dims} />;
  // Recorte: a caixa tem a proporção do trecho; a imagem inteira é ampliada/deslocada dentro dela.
  return (
    <span className={`${className ?? ''} img-crop`} style={{ aspectRatio: String(c.ar) }}>
      <img {...carga} src={src} alt={pick(image.alt, lang)} style={cropImgStyle(c)} />
    </span>
  );
}

/** Estilo de texto do tema (Display, Etiqueta, Corpo…) aplicado ao bloco via variáveis. */
function textStyleVars(name: string | undefined): Record<string, string> {
  if (!name) return {};
  const v = (k: string): string => `var(--ts-${name}-${k})`;
  return { '--ts-font': v('font'), '--ts-size': v('size'), '--ts-weight': v('weight'), '--ts-tracking': v('tracking'), '--ts-case': v('case') };
}

/** Espaço em px de referência (base 16) → rem, para escalar junto com o site. */
function rem(px: number | undefined): string | undefined {
  return px === undefined ? undefined : `${px / 16}rem`;
}

/** Posição/escala da imagem inteira dentro da caixa do recorte (vale para qualquer tamanho). */
export function cropImgStyle(c: { x: number; y: number; w: number; h: number }): React.CSSProperties {
  return { width: `${100 / c.w}%`, height: `${100 / c.h}%`, left: `${(-c.x / c.w) * 100}%`, top: `${(-c.y / c.h) * 100}%` };
}

function EmbedFrame({ provider, refValue, options }: { provider: string; refValue: string; options?: Record<string, string> }): React.ReactElement {
  const { editing, posterEmbeds } = useRender();
  const src = embedSource({ type: provider, id: refValue, ...(options ?? {}) });
  if (!src) return <p className="media-message">{editing ? 'Cole o link do vídeo no inspector (✎).' : 'Mídia indisponível.'}</p>;
  if (posterEmbeds) {
    // No editor: capa estática em vez do player (arrastável, sem o erro 153 do YouTube em file://).
    const yt = src.match(/youtube(?:-nocookie)?\.com\/embed\/([\w-]{11})/)?.[1];
    return (
      <div className="embed-area embed-poster">
        {yt ? <img src={`https://i.ytimg.com/vi/${yt}/hqdefault.jpg`} alt="" loading="lazy" draggable={false} /> : null}
        <span className="embed-poster-play" aria-hidden="true">▶</span>
        <span className="embed-poster-label">{provider === 'speakerdeck' ? 'Speaker Deck' : provider === 'vimeo' ? 'Vimeo' : 'YouTube'}</span>
      </div>
    );
  }
  return (
    <div className="embed-area">
      <iframe
        loading="lazy"
        title={provider}
        src={src}
        allowFullScreen
        allow="fullscreen; picture-in-picture"
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </div>
  );
}

// ---------------------------------------------------------- overlay do editor
const IconEdit = (): React.ReactElement => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
);
const IconTrash = (): React.ReactElement => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 14H6L5 6" /></svg>
);
const IconImage = (): React.ReactElement => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-5-5L5 21" /></svg>
);
const IconCrop = (): React.ReactElement => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 2v14a2 2 0 0 0 2 2h14" /><path d="M18 22V8a2 2 0 0 0-2-2H2" /></svg>
);
const IconEye = (): React.ReactElement => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></svg>
);
const ACT_ICON = { edit: IconEdit, image: IconImage, crop: IconCrop, hide: IconEye, delete: IconTrash } as const;
type ActKind = keyof typeof ACT_ICON;
const ACT_TITLE: Record<ActKind, string> = { edit: 'Editar', image: 'Trocar imagem', crop: 'Recortar', hide: 'Ocultar / mostrar', delete: 'Excluir' };

/**
 * Ícones de ação que aparecem no hover (só no editor). O editor lê os
 * atributos `data-*` do contêiner e o `data-act` do botão clicado.
 */
export function EditActions({ target, acts }: { target: Record<string, string | number>; acts: ActKind[] }): React.ReactElement | null {
  const { editing } = useRender();
  if (!editing) return null;
  const attrs = Object.fromEntries(Object.entries(target).map(([k, v]) => [`data-${k}`, String(v)]));
  return (
    <div className="pe-actions" {...attrs}>
      {acts.map((a) => {
        const Icon = ACT_ICON[a];
        return (
          <button key={a} type="button" className={`pe-act pe-act-${a}`} data-act={a} title={ACT_TITLE[a]} aria-label={ACT_TITLE[a]}>
            <Icon />
          </button>
        );
      })}
    </div>
  );
}

type ItemColl = 'projects' | 'blog' | 'gallery' | 'sketches';

/** Alça de largura de um item de coleção (mesmo comportamento dos blocos). */
function ItemResize({ coll, id, span }: { coll: ItemColl; id: string; span: number }): React.ReactElement | null {
  const { onSetItemSpan } = useRender();
  return onSetItemSpan ? <SpanHandle span={span} onSpan={(n) => onSetItemSpan({ coll, id }, n)} /> : null;
}

/** Largura do item em 12 avos: `width` explícito, senão o legado (span em colunas da coleção). */
function itemWidth(item: { width?: number; span?: number }, cols: number): number {
  if (item.width) return item.width;
  const units = Math.max(1, Math.round(12 / Math.max(1, cols)));
  return Math.min(12, Math.min(item.span ?? 1, cols) * units);
}

/** Atributos de arrastar para itens de coleção (reordenar no canvas). */
function itemDrag(editing: boolean, coll: string, id: string): Record<string, string | boolean> {
  return editing ? { draggable: true, 'data-item-coll': coll, 'data-item-id': id } : {};
}

/** Classe de destaque quando o item está selecionado no editor. */
function useItemSel(id: string): string {
  const { selectedItemId } = useRender();
  return selectedItemId === id ? ' is-selected' : '';
}

// -------------------------------------------------------------- cards de coleção
function EditBadges({ visibility, featured }: { visibility: string; featured?: boolean }): React.ReactElement | null {
  const { editing } = useRender();
  if (!editing) return null;
  return (
    <div className="edit-badges">
      {featured ? <span className="edit-badge feat">★ Destaque</span> : null}
      {visibility === 'draft' ? <span className="edit-badge draft">Rascunho</span> : null}
      {visibility === 'nda' ? <span className="edit-badge nda">NDA</span> : null}
    </div>
  );
}

function onCardKey(onClick?: () => void): ((e: React.KeyboardEvent) => void) | undefined {
  if (!onClick) return undefined;
  return (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  };
}

function ProjectCard({ item, cols, onClick, selected }: { item: ProjectItem; cols: number; onClick?: () => void; selected?: boolean }): React.ReactElement {
  const { lang, editing } = useRender();
  const span = itemWidth(item, cols);
  return (
    <div className={`project-card ${selected ? 'is-open' : ''}${useItemSel(item.id)}`} style={styleVars(spanVars({ desktop: span, tablet: item.widthTablet, mobile: item.widthMobile }, 'card'))} onClick={onClick} role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined} onKeyDown={onCardKey(onClick)} {...itemDrag(editing, 'projects', item.id)}>
      <div className="card-thumb-wrap">
        <Img image={item.thumb} className="card-thumb" />
        <EditBadges visibility={item.visibility} featured={item.featured} />
        <EditActions target={{ target: 'item', coll: 'projects', id: item.id }} acts={['edit', 'image', 'crop', 'delete']} />
      </div>
      <div className="card-title">{pick(item.title, lang)}</div>
      <ItemResize coll="projects" id={item.id} span={span} />
    </div>
  );
}

/**
 * Prévia inline (popup) de um projeto na Home. Mostra os blocos escolhidos na
 * prévia do projeto (ordem/largura próprias); o conteúdo vem do bloco original.
 * No editor: chips para incluir/tirar elementos + alça de largura, arrastar em
 * grade e ocultar — os mesmos gestos do resto do editor, valendo só no popup.
 */
function ProjectPreview({ item, onClose }: { item: ProjectItem; onClose: () => void }): React.ReactElement {
  const ctx = useRender();
  const panel = useRef<HTMLDivElement>(null);
  // Abriu: traz a prévia para a tela. Sem isso, no celular ela nasce abaixo do
  // que cabe na janela e o toque parece não ter feito nada.
  useEffect(() => {
    panel.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [item.id]);
  const { lang, onNavigate, editing, onEditPreview } = ctx;
  const pv = effectivePreview(item);
  const all = projectBlocks(item);
  const byId = new Map(all.map((bl) => [bl.id, bl]));
  const included = new Set(pv.items.map((i) => i.ref));
  const edit = onEditPreview ? (recipe: (p: HomePreview) => void) => onEditPreview(item.id, recipe) : undefined;
  const readOnly = { ...ctx, editing: false, selectedId: undefined };
  const desc = pick(item.description, lang);

  return (
    <div className="home-preview" data-pv-project={item.id} ref={panel}>
      <div className="home-preview-head">
        <h3 className="home-preview-title">{pick(item.title, lang)}</h3>
        <div className="home-preview-actions">
          {onNavigate ? (
            <button type="button" className="home-preview-go" onClick={() => onNavigate(`project/${item.id}`)}>
              {lang === 'en' ? 'Go to project →' : 'Ir para o projeto →'}
            </button>
          ) : null}
          <button type="button" className="home-preview-close" onClick={onClose} aria-label="Fechar">✕</button>
        </div>
      </div>
      {editing && edit ? (
        <div className="pv-chips" aria-label="Elementos do projeto nesta prévia">
          <span className="pv-chips-label">Nesta prévia:</span>
          {desc ? (
            <button type="button" className={`pv-chip${pv.hideDescription ? '' : ' on'}`} onClick={() => edit((p) => void (p.hideDescription = !p.hideDescription || undefined))}>
              Descrição
            </button>
          ) : null}
          {all.map((bl) => (
            <button
              key={bl.id}
              type="button"
              className={`pv-chip${included.has(bl.id) ? ' on' : ''}`}
              title={included.has(bl.id) ? 'Tirar da prévia' : 'Incluir na prévia'}
              onClick={() => edit((p) => {
                const i = p.items.findIndex((x) => x.ref === bl.id);
                if (i >= 0) p.items.splice(i, 1);
                else p.items.push({ ref: bl.id, span: bl.span });
              })}
            >
              {blockLabel(bl)}
            </button>
          ))}
        </div>
      ) : null}
      {desc && !pv.hideDescription ? <p className="home-preview-desc">{desc}</p> : null}
      <div className="pv-grid">
        {pv.items.map((it) => {
          const bl = byId.get(it.ref);
          if (!bl || (!editing && bl.visibility !== 'public')) return null;
          return (
            <div
              key={it.ref}
              className="pv-cell"
              style={styleVars({ '--span': it.span })}
              {...(editing ? { 'data-pv-cell': it.ref, 'data-pv-of': item.id, draggable: true } : {})}
            >
              <EditActions target={{ target: 'pv', project: item.id, id: it.ref }} acts={['hide']} />
              <RenderContext.Provider value={readOnly}>
                <BlockView block={{ ...bl, span: 12 }} />
              </RenderContext.Provider>
              {edit ? <SpanHandle span={it.span} onSpan={(n) => edit((p) => { const x = p.items.find((y) => y.ref === it.ref); if (x) x.span = n; })} /> : null}
            </div>
          );
        })}
      </div>
      {editing && pv.items.length === 0 ? <p className="pv-empty">Nenhum elemento — escolha acima o que aparece nesta prévia.</p> : null}
    </div>
  );
}

function BlogCard({ item, cols }: { item: BlogItem; cols: number }): React.ReactElement {
  const { lang, onNavigate, editing } = useRender();
  const span = itemWidth(item, cols);
  return (
    <div className={`blog-item${useItemSel(item.id)}`} style={styleVars(spanVars({ desktop: span, tablet: item.widthTablet, mobile: item.widthMobile }, 'card'))} onClick={onNavigate ? () => onNavigate(`blog/${item.id}`) : undefined} role={onNavigate ? 'button' : undefined} tabIndex={onNavigate ? 0 : undefined} onKeyDown={onCardKey(onNavigate ? () => onNavigate(`blog/${item.id}`) : undefined)} {...itemDrag(editing, 'blog', item.id)}>
      <EditBadges visibility={item.visibility} />
      <span className="blog-date">{pick(item.date, lang)}</span>
      <div className="blog-thumb-wrap">
        <Img image={item.thumb} className="blog-thumb" />
        <EditActions target={{ target: 'item', coll: 'blog', id: item.id }} acts={['edit', 'image', 'crop', 'delete']} />
      </div>
      <div className="blog-title">{pick(item.title, lang)}</div>
      <p className="blog-excerpt">{pick(item.excerpt, lang)}</p>
      <ItemResize coll="blog" id={item.id} span={span} />
    </div>
  );
}

function GalleryCard({ item, cols, onOpen }: { item: GalleryItem; cols: number; onOpen?: () => void }): React.ReactElement {
  const { lang, editing } = useRender();
  const span = itemWidth(item, cols);
  return (
    <figure className={`art-item${useItemSel(item.id)}`} style={styleVars(spanVars({ desktop: span, tablet: item.widthTablet, mobile: item.widthMobile }, 'media'))} {...itemDrag(editing, 'gallery', item.id)}>
      <button type="button" className="art-img-btn" onClick={onOpen} aria-label={pick(item.caption, lang) || 'Abrir imagem'}>
        <Img image={item.image} className="art-img" />
        {editing && !item.image.assetId && !item.image.url ? <span className="pe-img-empty">Sem imagem</span> : null}
      </button>
      <EditBadges visibility={item.visibility} />
      <EditActions target={{ target: 'item', coll: 'gallery', id: item.id }} acts={['image', 'crop', 'edit', 'delete']} />
      <ItemResize coll="gallery" id={item.id} span={span} />
      <figcaption className="art-caption">{pick(item.caption, lang)}</figcaption>
    </figure>
  );
}

function SketchCard({ item, cols, onOpen }: { item: SketchItem; cols: number; onOpen?: () => void }): React.ReactElement {
  const { editing } = useRender();
  const span = itemWidth(item, cols);
  return (
    <div className={`sketch-item${useItemSel(item.id)}`} style={styleVars(spanVars({ desktop: span, tablet: item.widthTablet, mobile: item.widthMobile }, 'media'))} {...itemDrag(editing, 'sketches', item.id)}>
      <EditActions target={{ target: 'item', coll: 'sketches', id: item.id }} acts={['image', 'crop', 'delete']} />
      <ItemResize coll="sketches" id={item.id} span={span} />
      <button type="button" className="sketch-img-btn" onClick={onOpen} aria-label="Abrir imagem">
        <Img image={item.image} />
      </button>
      <EditBadges visibility={item.visibility} />
    </div>
  );
}

const CATEGORY_FILTERS = [
  { value: 'all', label: { pt: 'Todos', en: 'All' } },
  { value: 'professional', label: { pt: 'Profissionais', en: 'Professional' } },
  { value: 'personal', label: { pt: 'Pessoais', en: 'Personal' } },
] as const;

function CollectionView({ block }: { block: Extract<Block, { type: 'collection' }> }): React.ReactElement {
  const { data, editing, resolveAsset, lang, onOpenLightbox, onNavigate, nda } = useRender();
  const { collection, cols, filter, showFilter, preview } = block.content;
  const [uiFilter, setUiFilter] = useState<'all' | 'professional' | 'personal'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // NDA é um mundo à parte: listas públicas nunca mostram NDA; a lista 'nda' só mostra NDA.
  // Rascunhos aparecem (esmaecidos) só no editor.
  const ndaOnly = filter === 'nda';
  const visible = <T extends { visibility: string }>(items: T[]): T[] =>
    items.filter((it) => (ndaOnly ? it.visibility === 'nda' : it.visibility === 'public' || (editing && it.visibility === 'draft')));

  let filterBar: React.ReactNode = null;
  let previewPanel: React.ReactNode = null;
  let body: React.ReactNode;
  if (collection === 'projects') {
    let items = visible(data.collections.projects);
    // O filtro fixo vale sempre; os botões do visitante filtram DENTRO dele.
    const byCategory = (f: string | undefined): void => {
      if (f === 'featured') items = items.filter((p) => p.featured);
      else if (f === 'professional' || f === 'personal') items = items.filter((p) => pick(p.meta['category'], 'pt') === f);
    };
    byCategory(filter);
    // Com filtro fixo de categoria, os botões de categoria não fazem sentido (dariam lista vazia).
    const fixedCategory = filter === 'professional' || filter === 'personal';
    if (showFilter && !fixedCategory) byCategory(uiFilter);
    const expanded = preview && expandedId ? items.find((p) => p.id === expandedId) : undefined;
    if (expanded) previewPanel = <ProjectPreview key="__preview" item={expanded} onClose={() => setExpandedId(null)} />;
    if (showFilter && !fixedCategory) {
      filterBar = (
        <div className="project-filter" role="group" aria-label="Filtrar projetos">
          {CATEGORY_FILTERS.map((f) => (
            <button key={f.value} type="button" className={`filter-btn ${uiFilter === f.value ? 'active' : ''}`} aria-pressed={uiFilter === f.value} onClick={() => setUiFilter(f.value)}>
              {pick(f.label, lang)}
            </button>
          ))}
        </div>
      );
    }
    body = items.map((p) => (
      <ProjectCard
        key={p.id}
        item={p}
        cols={cols}
        selected={expandedId === p.id}
        onClick={preview ? () => setExpandedId((cur) => (cur === p.id ? null : p.id)) : onNavigate ? () => onNavigate(`project/${p.id}`) : undefined}
      />
    ));
    // A prévia entra DENTRO da grade, logo depois do card aberto: no celular
    // (uma coluna) ela fica colada no projeto tocado, em vez de no fim da lista.
    const at = previewPanel ? items.findIndex((p) => p.id === expandedId) : -1;
    if (at >= 0) {
      const cards = body as React.ReactNode[];
      body = [...cards.slice(0, at + 1), previewPanel, ...cards.slice(at + 1)];
      previewPanel = null;
    }
  } else if (collection === 'blog') {
    body = visible(data.collections.blog).map((b) => <BlogCard key={b.id} item={b} cols={cols} />);
  } else if (collection === 'gallery') {
    const items = visible(data.collections.gallery);
    const light = items.map((g) => ({ src: resolveAsset(g.image), alt: pick(g.image.alt, lang), crop: g.image.crop }));
    body = items.map((g, i) => <GalleryCard key={g.id} item={g} cols={cols} onOpen={() => onOpenLightbox?.(light, i)} />);
  } else {
    const items = visible(data.collections.sketches);
    const light = items.map((s) => ({ src: resolveAsset(s.image), alt: pick(s.image.alt, lang), crop: s.image.crop }));
    body = items.map((s, i) => <SketchCard key={s.id} item={s} cols={cols} onOpen={() => onOpenLightbox?.(light, i)} />);
  }
  if (editing && (collection === 'gallery' || collection === 'sketches') && Array.isArray(body)) {
    body = [...body, <button key="__add" type="button" className="pe-add-tile" style={styleVars(spanVars({ desktop: Math.max(1, Math.round(12 / cols)) }, 'media'))} data-item-add={collection}>＋ Adicionar imagem</button>];
  }
  const empty = Array.isArray(body) && body.length === 0;
  return (
    <>
      {filterBar}
      {empty ? (
        ndaOnly && !editing && nda?.locked ? (
          <NdaUnlock />
        ) : (
          // Visitante não precisa saber que falta conteúdo: fora do editor, uma
          // lista vazia simplesmente não aparece. A exceção é a área NDA, onde
          // o vazio É a informação ("não há trabalho confidencial").
          !editing && !ndaOnly ? null : (
            <p className={`empty-collection${ndaOnly ? ' empty-nda' : ''}`}>
              {ndaOnly
                ? editing
                  ? 'Nenhum item NDA ainda — marque a visibilidade de um projeto como NDA. No site, a senha é pedida aqui.'
                  : lang === 'en' ? 'No confidential work yet.' : 'Nenhum trabalho confidencial ainda.'
                : 'Nenhum item aqui ainda — crie no painel Dados, à esquerda. Esta mensagem só aparece no editor.'}
            </p>
          )
        )
      ) : (
        <div className={`collection-grid collection-${collection}`} style={styleVars({ '--cols': cols, '--coll-gap': rem(block.content.gap) })}>
          {body}
        </div>
      )}
      {previewPanel}
    </>
  );
}

/** Senha da área NDA, exibida no lugar da lista confidencial enquanto trancada. */
function NdaUnlock(): React.ReactElement {
  const { nda, lang } = useRender();
  const [pw, setPw] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const en = lang === 'en';
  return (
    <form
      className="nda-unlock"
      onSubmit={(e) => {
        e.preventDefault();
        if (!nda || !pw) return;
        setBusy(true);
        void nda.unlock(pw).then((err) => {
          setBusy(false);
          setError(err ? (en ? 'Wrong password.' : 'Senha incorreta.') : '');
        });
      }}
    >
      <p className="nda-unlock-text">🔒 {en ? 'Confidential work. Enter the password to view.' : 'Trabalhos confidenciais. Digite a senha para ver.'}</p>
      <div className="nda-unlock-row">
        <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder={en ? 'Password' : 'Senha'} aria-label={en ? 'NDA password' : 'Senha NDA'} autoComplete="current-password" />
        <button type="submit" disabled={busy || !pw}>{busy ? '…' : en ? 'Unlock' : 'Desbloquear'}</button>
      </div>
      {error ? <p className="nda-unlock-error" role="alert">{error}</p> : null}
    </form>
  );
}

// ------------------------------------------------------------------- blocos
/**
 * Alça universal de largura: fica na borda direita de qualquer elemento que
 * ocupa colunas numa grade (bloco, card, imagem da galeria, quadro…). Mede as
 * colunas reais da grade-pai, então vale igual para o grid de 12 da seção e
 * para as grades das coleções/storyboard.
 */
export function SpanHandle({ span, onSpan }: { span: number; onSpan: (span: number) => void }): React.ReactElement | null {
  const { editing } = useRender();
  if (!editing) return null;
  const onDown = (e: React.PointerEvent): void => {
    e.preventDefault();
    e.stopPropagation();
    const el = (e.currentTarget as HTMLElement).parentElement;
    const grid = el?.parentElement;
    if (!el || !grid) return;
    const cols = getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length || 1;
    const colW = grid.getBoundingClientRect().width / cols;
    if (!(colW > 0)) return;
    const left = el.getBoundingClientRect().left;
    document.body.classList.add('pe-resizing');
    el.setAttribute('data-cols', String(cols));
    const move = (ev: PointerEvent): void => onSpan(Math.max(1, Math.min(cols, Math.round((ev.clientX - left) / colW))));
    const up = (): void => {
      document.body.classList.remove('pe-resizing');
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  return (
    <div
      className="pe-span-handle"
      draggable={false}
      onPointerDown={onDown}
      onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
      onClick={(e) => e.stopPropagation()}
      title="Arraste para mudar a largura"
    >
      <span className="pe-span-badge">{span}/12</span>
    </div>
  );
}

function InlineEditable({ initial, plain, className, onCommit }: { initial: string; plain?: boolean; className?: string; onCommit: (v: string) => void }): React.ReactElement {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Sincroniza o DOM com o valor externo (inspector, undo) só quando o próprio
    // editável NÃO está focado — assim a digitação inline não salta o cursor.
    if (document.activeElement === el) return;
    const current = plain ? el.textContent ?? '' : el.innerHTML;
    const next = plain ? initial : initial || '<p></p>';
    if (current !== next) {
      if (plain) el.textContent = initial;
      else el.innerHTML = next;
    }
  }, [initial, plain]);
  return (
    <div
      ref={ref}
      className={`${className ?? ''} inline-edit${plain ? ' plain' : ''}`}
      contentEditable
      suppressContentEditableWarning
      onInput={() => onCommit(plain ? ref.current?.textContent ?? '' : ref.current?.innerHTML ?? '')}
    />
  );
}

/**
 * O texto deste bloco já existe no idioma em edição?
 *
 * No site, o que falta cai para o outro idioma e o visitante nem percebe — o
 * que é bom. O problema é para o DONO: sem marca nenhuma, achar o que falta
 * traduzir exigiria abrir bloco por bloco nos dois idiomas.
 */
function faltaTraduzir(block: Block, lang: 'pt' | 'en'): boolean {
  const outro = lang === 'pt' ? 'en' : 'pt';
  const vazio = (v?: { pt: string; en: string }): boolean => !!v && !v[lang].trim() && !!v[outro].trim();
  if (block.type === 'heading') return vazio(block.content.text);
  if (block.type === 'text') return vazio(block.content.html);
  if (block.type === 'button') return vazio(block.content.label);
  if (block.type === 'image') return vazio(block.content.image.alt);
  if (block.type === 'contact') return vazio(block.content.heading) || vazio(block.content.body);
  return false;
}

export function BlockView({ block, place, sobra, topo }: { block: Block; place?: Placement; sobra?: { tablet: number | null; mobile: number | null }; topo?: boolean }): React.ReactElement | null {
  const { lang, editing, selectedId, resolveAsset, onOpenLightbox, onInlineText, onSetSpan, onSetItemSpan } = useRender();
  if (!editing && block.visibility !== 'public') return null;

  const bgToken = block.style?.bg;
  const rm = block.responsive?.mobile;
  const rt = block.responsive?.tablet;
  const cls = [
    'block',
    `block-${block.type}`,
    `align-${block.align ?? 'start'}`,
    editing && block.visibility !== 'public' ? `vis-${block.visibility}` : '',
    bgToken ? 'has-bg' : '',
    editing && selectedId === block.id ? 'is-selected' : '',
    block.style?.textStyle ? `has-ts ts-${block.style.textStyle}` : '',
    rm?.hidden ? 'hide-mobile' : '',
    rt?.hidden ? 'hide-tablet' : '',
    // A linha só mantém o alinhamento na tela em que ela ainda cabe inteira.
    sobra && sobra.tablet !== null ? 't-row' : '',
    sobra && sobra.mobile !== null ? 'm-row' : '',
    editing && faltaTraduzir(block, lang) ? 'falta-traducao' : '',
  ].filter(Boolean).join(' ');

  const wrap = (children: React.ReactNode): React.ReactElement => (
    <div
      className={cls}
      style={styleVars({ ...spanVars({ desktop: block.span, tablet: rt?.span, mobile: rm?.span }, 'block'), '--span-m': rm?.span, '--gc': place?.col, '--cfree-t': sobra?.tablet ?? undefined, '--cfree-m': sobra?.mobile ?? undefined, '--gr': place?.row, '--ck': place?.k, '--cn': place?.n, '--cfree': place?.free, '--ra': place ? { start: 0, center: 0.5, end: 1, between: 0 }[place.align] : undefined, '--rb': place?.align === 'between' ? 1 : undefined, '--block-bg': bgToken ? `var(--${bgToken})` : undefined, ...textStyleVars(block.style?.textStyle), '--pad-t': rem(block.pad?.t), '--pad-r': rem(block.pad?.r), '--pad-b': rem(block.pad?.b), '--pad-l': rem(block.pad?.l) })}
      data-block-id={block.id}
    >
      {editing && faltaTraduzir(block, lang) ? (
        <span className="edit-badge traducao" title={`Sem texto em ${lang === 'pt' ? 'português' : 'inglês'} — o site mostra o outro idioma`}>
          sem {lang.toUpperCase()}
        </span>
      ) : null}
      {editing ? (
        <>
          <span className="pe-drag-handle" draggable data-drag-block={block.id} title="Arraste para mover — solte na lateral de outro bloco para formar uma grade" aria-hidden="true">⠿</span>
          <EditActions target={{ target: 'block', id: block.id }} acts={block.type === 'image' ? ['image', 'crop', 'edit', 'delete'] : ['edit', 'delete']} />
          {onSetSpan ? <SpanHandle span={block.span} onSpan={(n) => onSetSpan(block.id, n)} /> : null}
        </>
      ) : null}
      {children}
    </div>
  );

  switch (block.type) {
    case 'heading': {
      const level = block.content.level ?? 2;
      const Tag = (`h${Math.min(4, Math.max(1, level))}`) as 'h1' | 'h2' | 'h3' | 'h4';
      if (editing && onInlineText && selectedId === block.id) {
        return wrap(<InlineEditable key={`${block.id}:${lang}`} className="block-heading-text" initial={pick(block.content.text, lang)} onCommit={(v) => onInlineText(block.id, v, 'heading')} />);
      }
      // Títulos aceitam a mesma formatação inline dos textos (cor, fonte, tamanho, link…).
      return wrap(<Tag className="block-heading-text" dangerouslySetInnerHTML={{ __html: sanitizeRich(pick(block.content.text, lang)) }} />);
    }
    case 'text':
      if (editing && onInlineText && selectedId === block.id) {
        return wrap(<InlineEditable key={`${block.id}:${lang}`} className="block-text-body" initial={pick(block.content.html, lang)} onCommit={(v) => onInlineText(block.id, v, 'text')} />);
      }
      return wrap(<RichText className="block-text-body" html={pick(block.content.html, lang)} />);
    case 'image':
      return wrap(
        <div className="block-image-inner" style={styleVars({ '--w': block.content.widthPct ? `${block.content.widthPct}%` : undefined })}>
          <Img image={block.content.image} className="block-image-img" eager={topo} />
          {editing && !block.content.image.assetId && !block.content.image.url ? (
            <button type="button" className="pe-img-placeholder" data-block-upload={block.id}>＋ Enviar imagem</button>
          ) : null}
        </div>,
      );
    case 'embed':
      return wrap(<EmbedFrame provider={block.content.provider} refValue={block.content.ref} options={block.content.options} />);
    case 'storyboard': {
      const frames = block.content.frames;
      const light = frames.map((f) => ({ src: resolveAsset(f), alt: pick(f.alt, lang), crop: f.crop }));
      return wrap(
        <div className="storyboard-grid">
          {frames.map((f, i) => (
            <div key={i} className="storyboard-cell" style={styleVars(spanVars({ desktop: f.span ?? 3, tablet: f.spanTablet, mobile: f.spanMobile }, 'media'))} {...(editing ? { draggable: true, 'data-frame-block': block.id, 'data-frame-idx': i } : {})}>
              <button type="button" className="storyboard-frame-btn" onClick={() => onOpenLightbox?.(light, i)} aria-label={`Abrir quadro ${i + 1}`}>
                <Img image={f} className="storyboard-frame" />
              </button>
              <EditActions target={{ target: 'frame', id: block.id, idx: i }} acts={['image', 'crop', 'delete']} />
              {onSetItemSpan ? <SpanHandle span={f.span ?? 3} onSpan={(n) => onSetItemSpan({ blockId: block.id, frame: i }, n)} /> : null}
            </div>
          ))}
          {editing ? <button type="button" className="pe-add-tile" data-frame-add={block.id}>＋ Quadro</button> : null}
        </div>,
      );
    }
    case 'collection':
      return wrap(<CollectionView block={block} />);
    case 'spacer':
      return wrap(<div className={`spacer spacer-${block.content.size}`} aria-hidden="true" />);
    case 'divider':
      return wrap(<hr className="block-divider" />);
    case 'contact': {
      const c = block.content;
      return wrap(
        <div className={`contact-layout${c.image || c.cvHref ? '' : ' no-aside'}`}>
          <div className="contact-main">
            <h2 className="contact-h1">{pick(c.heading, lang)}</h2>
            <p className="contact-body">{pick(c.body, lang)}</p>
            {c.email ? (
              <a className="contact-email" href={`mailto:${c.email}`}>
                {c.email}
              </a>
            ) : null}
            {c.phone ? (
              <a className="contact-phone" href={`tel:${c.phone.replace(/[^+\d]/g, '')}`}>
                {c.phone}
              </a>
            ) : null}
            <div className="social-row">
              {c.socials.map((s, i) => (
                <a key={i} className="social-link" href={s.href}>
                  {s.label}
                </a>
              ))}
            </div>
          </div>
          {c.image || c.cvHref ? (
            <div className="contact-aside">
              {c.image ? <Img image={c.image} className="contact-img" /> : null}
              {c.cvHref ? (
                <a className="btn-cv" href={c.cvHref}>
                  {pick(c.cvLabel, lang)}
                </a>
              ) : null}
            </div>
          ) : null}
        </div>,
      );
    }
    case 'button': {
      const c = block.content;
      return wrap(
        <a className={`btn btn-${c.variant}`} href={c.href || '#'} {...(c.newTab ? { target: '_blank', rel: 'noopener noreferrer' } : {})} onClick={editing ? (e) => e.preventDefault() : undefined}>
          {pick(c.label, lang)}
        </a>,
      );
    }
    case 'columns':
      return wrap(<div className="columns-placeholder" data-cols={block.content.count} />);
    default:
      return null;
  }
}

// ------------------------------------------------------------------- seção
export function SectionView({ section, primeira }: { section: Section; primeira?: boolean }): React.ReactElement | null {
  const { editing } = useRender();
  const width = section.style.width ?? 'normal';
  // Posição de cada bloco (linhas × colunas, com pilhas) — só dos que aparecem.
  const shown = section.blocks.filter((b) => editing || b.visibility === 'public');
  if (!editing && shown.length === 0) return null;
  const { places, rows } = layoutGrid(shown);
  // A sobra de cada linha muda de tela para tela: no celular o texto ocupa a
  // linha inteira e uma imagem pode ter largura própria. Sem recalcular, o
  // deslocamento do alinhamento continuava usando os números do computador —
  // e a linha saía torta justamente onde ela já tinha mudado de forma.
  const sobraPorLinha = new Map<string, { tablet: number | null; mobile: number | null }>();
  for (const p of places) {
    const r = p?.row;
    if (r === undefined || sobraPorLinha.has(r)) continue;
    const naLinha = shown.filter((_, i) => places[i]?.row === r);
    sobraPorLinha.set(r, { tablet: sobraDaLinha(naLinha, 'tablet'), mobile: sobraDaLinha(naLinha, 'mobile') });
  }
  return (
    <section className={`section width-${width}`} data-section-id={section.id} style={styleVars({ '--sec-gap': rem(section.style.gap), '--sec-rowgap': rem(section.style.rowGap), '--sec-top': rem(section.style.spaceTop), '--sec-bottom': rem(section.style.spaceBottom) })}>
      <div className="section-grid">
        {shown.map((b, i) => (
          <ErrorBoundary
            key={b.id}
            fallback={(erro, tentarDeNovo) => (
              <div className="block block-defeito" style={styleVars({ '--span': b.span })} data-block-id={b.id}>
                <b>Este elemento não pôde ser exibido</b>
                <span>{b.type} · {erro.message.slice(0, 120)}</span>
                <button type="button" onClick={tentarDeNovo}>Tentar de novo</button>
              </div>
            )}
          >
            <BlockView block={b} place={places[i]} sobra={places[i] ? sobraPorLinha.get(places[i]!.row) : undefined} topo={primeira && (places[i]?.row ?? '').startsWith('1 ')} />
          </ErrorBoundary>
        ))}
        {editing ? (
          <button type="button" className="canvas-add-block" data-add-block={section.id} style={{ gridRow: String(rows + 1) }}>
            {section.blocks.length === 0 ? '＋ Adicionar o primeiro bloco' : '＋ Adicionar bloco'}
          </button>
        ) : null}
      </div>
    </section>
  );
}
