import type { BlogItem, I18n, Page, ProjectItem } from '../schema/v4';
import { SectionView } from './blocks';
import { useRender } from './context';
import { pick } from './text';

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
  category: { professional: { pt: 'Profissional', en: 'Professional' }, personal: { pt: 'Pessoal', en: 'Personal' } },
  storyType: { storyboard: { pt: 'Storyboard', en: 'Storyboard' }, animatic: { pt: 'Animatic', en: 'Animatic' } },
};
const META_ORDER = ['year', 'client', 'role', 'category', 'skills', 'contribution', 'credits', 'sequenceLabel', 'storyType', 'processNotes'];

/** Renderiza uma página estática, ou o detalhe de um item numa página template. */
export function PageView({ page, item }: { page: Page; item?: ProjectItem | BlogItem }): React.ReactElement {
  const { lang, data } = useRender();

  if (page.kind === 'template' && item) {
    const isProject = 'meta' in item;
    const meta = isProject ? (item as ProjectItem).meta : {};
    const tag = pick(meta['tag'], lang);
    const metaRows = META_ORDER.map((k) => ({ k, label: pick(META_LABELS[k], lang), value: pick(META_VALUES[k]?.[pick(meta[k], 'pt')] ?? meta[k], lang) })).filter((r) => r.value);
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
      </article>
    );
  }

  // Uma página precisa de exatamente um h1. Se nenhum título do conteúdo é nível 1,
  // entra um invisível com o nome da página — não muda nada na tela.
  const temH1 = page.sections.some((s) => s.blocks.some((bl) => bl.type === 'heading' && (bl.content.level ?? 2) === 1 && bl.visibility === 'public'));
  // Na Home, o h1 é quem o site é — não a palavra "Home".
  const h1 = page.id === 'home' ? [pick(data.site.name, lang), pick(data.site.role, lang)].filter(Boolean).join(' — ') : pick(page.title, lang);

  return (
    <div data-page-id={page.id}>
      {temH1 ? null : <h1 className="sr-only">{h1}</h1>}
      {page.sections.map((s, i) => (
        <SectionView key={s.id} section={s} primeira={i === 0} />
      ))}
    </div>
  );
}
