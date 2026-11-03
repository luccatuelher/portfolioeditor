import { Fragment, useEffect, useRef, useState } from 'react';
import type { BlogItem, I18n, Page, PortfolioV4, ProjectItem } from '../schema/v4';
import { useUi, type UiChave } from './ui';
import { blocoNoSite, NdaUnlock, SectionView } from './blocks';
import { ErrorBoundary } from './ErrorBoundary';
import { useRender } from './context';
import { pick } from './text';
import { CATEGORY_LABEL, projectCategory } from '../core/category';
import { linkInterno } from './links';
import { embedSource } from '../embed/embedSource';

const META_LABELS: Record<string, I18n> = {
  year: { pt: 'Ano', en: 'Year' },
  client: { pt: 'Cliente', en: 'Client' },
  role: { pt: 'Papel', en: 'Role' },
  category: { pt: 'Categoria', en: 'Category' },
  skills: { pt: 'Competências', en: 'Skills' },
  contribution: { pt: 'Contribuição', en: 'Contribution' },
  credits: { pt: 'Créditos', en: 'Credits' },
  sequenceLabel: { pt: 'Sequência', en: 'Sequence' },
  storyType: { pt: 'Formato', en: 'Format' },
  processNotes: { pt: 'Processo', en: 'Process' },
};
/** Valores internos (usados nos filtros) exibidos com rótulo legível. */
const META_VALUES: Record<string, Record<string, I18n>> = {
  category: CATEGORY_LABEL,
  storyType: { storyboard: { pt: 'Storyboard', en: 'Storyboard' }, animatic: { pt: 'Animatic', en: 'Animatic' } },
};
const META_ORDER = ['year', 'client', 'role', 'category', 'skills', 'contribution', 'credits', 'sequenceLabel', 'storyType', 'processNotes'];


/** A página que lista uma coleção (a de NDA, para item NDA); a Home só se não houver outra. */
function paginaDaLista(data: PortfolioV4, nome: 'projects' | 'blog', nda: boolean): Page | undefined {
  const listas = data.pages.filter((p) =>
    p.kind === 'static' && (p.visibility === 'nda') === nda &&
    p.sections.some((sec) => sec.blocks.some((b) => b.type === 'collection' && b.content.collection === nome)),
  );
  return listas.find((p) => p.id !== 'home') ?? listas[0];
}

export const TITULO_NAO_ENCONTRADO: Record<'project' | 'blog' | 'pagina', UiChave> = {
  project: 'projetoNaoEncontrado',
  blog: 'notaNaoEncontrada',
  pagina: 'paginaNaoEncontrada',
};

/**
 * Endereço que não leva a nada do site (link antigo, projeto excluído, página
 * renomeada): diz isso e oferece saídas, em vez de mostrar a Home calada. Se
 * o site tem área NDA trancada, o projeto pode ser confidencial: a senha é
 * pedida aqui mesmo — destrancou, o projeto aparece neste mesmo endereço.
 */
export function NaoEncontrado({ tipo }: { tipo: 'project' | 'blog' | 'pagina' }): React.ReactElement {
  const { data, nda, onNavigate } = useRender();
  const t = useUi();
  const lista = tipo === 'pagina' ? undefined : paginaDaLista(data, tipo === 'project' ? 'projects' : 'blog', false);
  const ir = (rota: string): Record<string, unknown> => (onNavigate ? linkInterno(rota, onNavigate) : { href: rota ? `#${rota}` : '#' });
  return (
    <section className="nao-encontrado" data-nao-encontrado={tipo}>
      <h1>{t(TITULO_NAO_ENCONTRADO[tipo])}</h1>
      <p>{t('enderecoMudou')}</p>
      {tipo !== 'pagina' && nda?.locked ? <NdaUnlock /> : null}
      <p className="nao-encontrado-saidas">
        {lista ? <a {...ir(lista.slug || lista.id)}>{t(tipo === 'project' ? 'allProjects' : 'todasNotas')}</a> : null}
        <a {...ir('')}>{t('irParaInicio')}</a>
      </p>
    </section>
  );
}

/** Quantos cards o "Você também pode gostar" mostra. */
export const MAIS_ITENS = 2;

/**
 * Os próximos itens da lista depois deste (dando a volta no fim), sem ele.
 * Projeto NDA só sugere NDA (e vice-versa), como as listas do site; rascunho
 * só aparece no editor.
 */
export function proximosDaLista<T extends ProjectItem | BlogItem>(lista: T[], item: T, editing: boolean, n = MAIS_ITENS): T[] {
  const mundoNda = item.visibility === 'nda';
  const irmaos = lista.filter((it) => (mundoNda ? it.visibility === 'nda' : it.visibility === 'public' || (editing && it.visibility === 'draft')));
  const i = irmaos.findIndex((it) => it.id === item.id);
  const out: T[] = [];
  // Começa no seguinte (ou no primeiro, se este não está na lista) e dá a volta.
  const inicio = i + 1;
  for (let k = 0; k < irmaos.length && out.length < n; k++) {
    const it = irmaos[(inicio + k) % irmaos.length]!;
    if (it.id !== item.id) out.push(it);
  }
  return out;
}

/**
 * Fim da página de um projeto (ou nota): "Você também pode gostar" — os
 * próximos da lista em cards grandes; o vídeo do projeto toca mudo, em loop,
 * no lugar da capa quando o card entra na tela, e o mouse mostra título e ano. Junta o
 * antigo anterior · todos · próximo num lugar só (o "Todos os projetos" fica ao
 * lado do título da seção).
 */
function DetailPager({ item, kind }: { item: ProjectItem | BlogItem; kind: 'project' | 'blog' }): React.ReactElement | null {
  const { data, editing, onNavigate } = useRender();
  const t = useUi();
  if (!onNavigate) return null;
  const nome = kind === 'project' ? 'projects' : 'blog';
  const proximos = proximosDaLista(data.collections[nome] as (ProjectItem | BlogItem)[], item, editing);
  const lista = paginaDaLista(data, nome, item.visibility === 'nda');
  if (!proximos.length && !lista) return null;
  const ir = (route: string): Record<string, unknown> =>
    editing ? { onClick: () => onNavigate(route), role: 'link', type: 'button' } : linkInterno(route, onNavigate);
  const Tag = editing ? 'button' : 'a';
  return (
    <nav className="detail-pager" aria-label={t(kind === 'project' ? 'maisProjetos' : 'maisNotas')}>
      <div className="pager-head">
        <h2 className="pager-heading">{t('vocePodeGostar')}</h2>
        {lista ? (
          <Tag className="pager-link pager-all" {...ir(lista.slug || lista.id)}>
            {t(kind === 'project' ? 'allProjects' : 'todasNotas')} →
          </Tag>
        ) : null}
      </div>
      {proximos.length ? (
        <div className="pager-cards">
          {proximos.map((it) => (
            <CardSugerido key={it.id} item={it} Tag={Tag} props={ir(`${kind}/${it.id}`)} />
          ))}
        </div>
      ) : null}
    </nav>
  );
}

/** Id do primeiro vídeo do YouTube do projeto (e o início escolhido), para a prévia. */
export function videoDaPrevia(item: ProjectItem | BlogItem): { id: string; start?: string } | null {
  for (const s of item.sections) {
    for (const b of s.blocks) {
      if (b.type !== 'embed' || b.visibility !== 'public') continue;
      const src = embedSource({ type: b.content.provider, id: b.content.ref, ...(b.content.options ?? {}) });
      const id = src.match(/youtube(?:-nocookie)?\.com\/embed\/([\w-]{11})/)?.[1];
      if (id) return { id, start: src.match(/[?&]start=(\d+)/)?.[1] };
    }
  }
  return null;
}

/**
 * A prévia toca sozinha (muda, em loop) quando o card entra na tela — como
 * uma capa animada. Fica parada com "reduzir movimento", economia de dados ou
 * o editor aberto de um arquivo local (o YouTube recusa tocar em file://).
 */
function podeTocarPrevia(): boolean {
  if (typeof matchMedia !== 'function' || typeof IntersectionObserver === 'undefined') return false;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  if (typeof location !== 'undefined' && location.protocol === 'file:') return false;
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return !conn?.saveData;
}

function CardSugerido({ item, Tag, props }: { item: ProjectItem | BlogItem; Tag: 'a' | 'button'; props: Record<string, unknown> }): React.ReactElement {
  const { lang, resolveAsset } = useRender();
  const titulo = pick(item.title, lang);
  const sub = 'meta' in item ? pick(item.meta['year'], lang) : pick(item.date, lang);
  const capa = resolveAsset(item.thumb, 'miniatura');
  const video = videoDaPrevia(item);
  // O player nasce quando o card chega perto da tela e some quando sai dela
  // (quem não rola até o fim não baixa nada).
  const [tocar, setTocar] = useState(false);
  const [pronto, setPronto] = useState(false);
  const caixa = useRef<HTMLElement | null>(null);
  const mostrar = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const id = video?.id;
  useEffect(() => {
    const el = caixa.current;
    if (!id || !el || !podeTocarPrevia()) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        const visivel = !!e?.isIntersecting;
        setTocar(visivel);
        if (!visivel) {
          clearTimeout(mostrar.current);
          setPronto(false);
        }
      },
      { rootMargin: '200px 0px' },
    );
    obs.observe(el);
    return () => {
      obs.disconnect();
      clearTimeout(mostrar.current);
    };
  }, [id]);
  const src = video
    ? `https://www.youtube-nocookie.com/embed/${video.id}?autoplay=1&mute=1&controls=0&loop=1&playlist=${video.id}&playsinline=1&rel=0&iv_load_policy=3&disablekb=1&fs=0${video.start ? `&start=${video.start}` : ''}`
    : '';
  return (
    <Tag className="pager-card" data-card={item.id} ref={(el: HTMLElement | null) => { caixa.current = el; }} {...props}>
      <span className="pager-media">
        {capa ? <img className="pager-thumb" src={capa} alt="" loading="lazy" decoding="async" draggable={false} /> : null}
        {tocar ? (
          <iframe
            className={`pager-video${pronto ? ' is-on' : ''}`}
            src={src}
            title=""
            aria-hidden="true"
            tabIndex={-1}
            allow="autoplay; encrypted-media"
            referrerPolicy="strict-origin-when-cross-origin"
            // O YouTube pinta preto e o título antes do vídeo: só aparece depois de começar.
            onLoad={() => {
              clearTimeout(mostrar.current);
              mostrar.current = setTimeout(() => setPronto(true), 900);
            }}
          />
        ) : null}
        <span className="pager-over" aria-hidden="true">
          <span className="pager-over-title">{titulo}</span>
          {sub ? <span className="pager-over-sub">{sub}</span> : null}
        </span>
      </span>
      <span className="pager-caption">
        <span className="pager-title">{titulo}</span>
        {sub ? <span className="pager-sub">{sub}</span> : null}
      </span>
    </Tag>
  );
}

/**
 * No editor, página ou projeto sem nenhuma seção não tinha onde clicar para
 * começar (o "＋ Adicionar bloco" mora dentro das seções). data-add-block
 * vazio = a seção é criada junto com o primeiro bloco.
 */
/**
 * No editor, entre duas seções (e no fim da página), uma linha fina com "＋"
 * aparece ao passar o mouse — como no Adobe Portfolio: insere uma seção nova
 * ali mesmo, já pedindo o primeiro bloco. data-insert-section = índice.
 */
function InserirSecao({ at }: { at: number }): React.ReactElement {
  return (
    <div className="canvas-insert-section">
      <button type="button" data-insert-section={at} aria-label="Inserir seção aqui" title="Inserir seção aqui">＋</button>
    </div>
  );
}

function PrimeiroBloco(): React.ReactElement {
  return (
    <div className="section canvas-vazio">
      <button type="button" className="canvas-add-block" data-add-block="">＋ Adicionar o primeiro bloco</button>
    </div>
  );
}

/** Renderiza uma página estática, ou o detalhe de um item numa página template. */
export function PageView({ page, item }: { page: Page; item?: ProjectItem | BlogItem }): React.ReactElement {
  const { lang, data, nda, editing } = useRender();
  const t = useUi();

  if (page.kind === 'template' && item) {
    const isProject = 'meta' in item;
    const meta = isProject ? (item as ProjectItem).meta : {};
    const tag = pick(meta['tag'], lang);
    // A categoria aceita o texto livre antigo ("Profissional", "Personal"…) e mostra o rótulo do idioma.
    const chave = (k: string): string => (k === 'category' ? projectCategory(meta[k]) ?? '' : pick(meta[k], 'pt'));
    const metaRows = META_ORDER.map((k) => ({ k, label: pick(META_LABELS[k], lang), value: pick(META_VALUES[k]?.[chave(k)] ?? meta[k], lang) })).filter((r) => r.value);
    return (
      <article className="detail" data-page-id={page.id}>
        <header className="detail-header">
          {tag ? <div className="detail-tag">{tag}</div> : null}
          {/* Nota: a data (antes só aparecia no card da lista; quem lia a nota não sabia de quando era). */}
          {'date' in item && pick(item.date, lang) ? <p className="detail-tag detail-data">{pick(item.date, lang)}</p> : null}
          <h1 className="detail-title">{pick(item.title, lang)}</h1>
          {'description' in item ? <p className="detail-desc">{pick(item.description, lang)}</p> : null}
          {metaRows.length ? (
            <dl className="detail-meta">
              {metaRows.map((r) => (
                <div key={r.k} className="detail-meta-item">
                  <dt className="meta-label">{r.label}</dt>
                  <dd className="meta-value">{r.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </header>
        {item.sections.map((s, i) => (
          <Fragment key={s.id}>
            {editing ? <InserirSecao at={i} /> : null}
            <SectionView section={s} />
          </Fragment>
        ))}
        {editing && item.sections.length ? <InserirSecao at={item.sections.length} /> : null}
        {editing && !item.sections.length ? <PrimeiroBloco /> : null}
        <DetailPager item={item} kind={isProject ? 'project' : 'blog'} />
      </article>
    );
  }

  // Uma página precisa de exatamente um h1. Se nenhum título do conteúdo é nível 1,
  // entra um invisível com o nome da página — não muda nada na tela.
  const temH1 = page.sections.some((s) => s.blocks.some((bl) => bl.type === 'heading' && (bl.content.level ?? 2) === 1 && blocoNoSite(bl, nda)));
  // Na Home, o h1 é quem o site é — não a palavra "Home".
  const h1 = page.id === 'home' ? [pick(data.site.name, lang), pick(data.site.role, lang)].filter(Boolean).join(' — ') : pick(page.title, lang);

  return (
    <div data-page-id={page.id}>
      {temH1 ? null : <h1 className="sr-only">{h1}</h1>}
      {page.sections.map((s, i) => (
        <Fragment key={s.id}>
          {editing ? <InserirSecao at={i} /> : null}
          <ErrorBoundary fallback={() => <p className="secao-defeito">{t('secaoComDefeito')}</p>}>
            <SectionView section={s} primeira={i === 0} />
          </ErrorBoundary>
        </Fragment>
      ))}
      {editing && page.sections.length ? <InserirSecao at={page.sections.length} /> : null}
      {editing && !page.sections.length ? <PrimeiroBloco /> : null}
    </div>
  );
}
