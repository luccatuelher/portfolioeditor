import type { BlogItem, I18n, Page, PortfolioV4, ProjectItem } from '../schema/v4';
import { useUi, type UiChave } from './ui';
import { blocoNoSite, NdaUnlock, SectionView } from './blocks';
import { ErrorBoundary } from './ErrorBoundary';
import { useRender } from './context';
import { pick } from './text';
import { CATEGORY_LABEL, projectCategory } from '../core/category';
import { linkInterno } from './links';

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

/**
 * Fim da página de um projeto (ou nota): anterior, a lista inteira e o
 * próximo, na ordem da lista. Sem isto, quem chegava ao fim tinha de rolar
 * de volta ao menu. Projeto NDA só anda entre os NDA (e vice-versa), como
 * as listas do site.
 */
function DetailPager({ item, kind }: { item: ProjectItem | BlogItem; kind: 'project' | 'blog' }): React.ReactElement | null {
  const { lang, data, editing, onNavigate } = useRender();
  const t = useUi();
  if (!onNavigate) return null;
  const nome = kind === 'project' ? 'projects' : 'blog';
  const mundoNda = item.visibility === 'nda';
  const irmaos = (data.collections[nome] as (ProjectItem | BlogItem)[]).filter((it) =>
    mundoNda ? it.visibility === 'nda' : it.visibility === 'public' || (editing && it.visibility === 'draft'),
  );
  const i = irmaos.findIndex((it) => it.id === item.id);
  const prev = i > 0 ? irmaos[i - 1] : undefined;
  const next = i >= 0 && i < irmaos.length - 1 ? irmaos[i + 1] : undefined;
  const lista = paginaDaLista(data, nome, mundoNda);
  if (!prev && !next && !lista) return null;
  const ir = (route: string): Record<string, unknown> =>
    editing ? { onClick: () => onNavigate(route), role: 'link' } : linkInterno(route, onNavigate);
  const Tag = editing ? 'button' : 'a';
  const rota = (it: ProjectItem | BlogItem): string => `${kind}/${it.id}`;
  return (
    <nav className="detail-pager" aria-label={t(kind === 'project' ? 'maisProjetos' : 'maisNotas')}>
      {prev ? (
        <Tag className="pager-link pager-prev" {...(editing ? { type: 'button' } : {})} {...ir(rota(prev))}>
          <span className="pager-dir">← {t('anterior')}</span>
          <span className="pager-title">{pick(prev.title, lang)}</span>
        </Tag>
      ) : <span />}
      {lista ? (
        <Tag className="pager-link pager-all" {...(editing ? { type: 'button' } : {})} {...ir(lista.slug || lista.id)}>
          {t(kind === 'project' ? 'allProjects' : 'todasNotas')}
        </Tag>
      ) : <span />}
      {next ? (
        <Tag className="pager-link pager-next" {...(editing ? { type: 'button' } : {})} {...ir(rota(next))}>
          <span className="pager-dir">{t(kind === 'project' ? 'proximo' : 'proxima')} →</span>
          <span className="pager-title">{pick(next.title, lang)}</span>
        </Tag>
      ) : <span />}
    </nav>
  );
}

/**
 * No editor, página ou projeto sem nenhuma seção não tinha onde clicar para
 * começar (o "＋ Adicionar bloco" mora dentro das seções). data-add-block
 * vazio = a seção é criada junto com o primeiro bloco.
 */
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
        {item.sections.map((s) => (
          <SectionView key={s.id} section={s} />
        ))}
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
        <ErrorBoundary
          key={s.id}
          fallback={() => <p className="secao-defeito">{t('secaoComDefeito')}</p>}
        >
          <SectionView section={s} primeira={i === 0} />
        </ErrorBoundary>
      ))}
      {editing && !page.sections.length ? <PrimeiroBloco /> : null}
    </div>
  );
}
