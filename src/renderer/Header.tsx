import { useEffect, useState } from 'react';
import { DEFAULT_HEADER, headerSpan, type HeaderElement, type Page, type PortfolioV4 } from '../schema/v4';
import type { Lang } from './context';
import { useRender } from './context';
import { EditActions, SpanHandle } from './blocks';
import { HEADER_MOBILE_DEFAULT, spanVars } from './responsive';
import { styleVars } from './css';
import { pick } from './text';
import { LangFlag } from './Flags';

/** Itens do menu: páginas marcadas no menu (sem NDA) + páginas NDA (com cadeado). */
function menuPages(data: PortfolioV4): { nav: Page[]; nda: Page[] } {
  return {
    nav: data.site.nav.map((id) => data.pages.find((p) => p.id === id || p.slug === id)).filter((p): p is Page => !!p && p.visibility !== 'nda'),
    nda: data.pages.filter((p) => p.kind === 'static' && p.visibility === 'nda'),
  };
}

/**
 * Cabeçalho do site (público e canvas do editor). A ordem, os elementos ocultos
 * e o layout vêm de `site.header`; no editor cada elemento ganha ações de hover
 * e pode ser arrastado (`data-header-el`), assim como os itens do menu.
 */
export function SiteHeader({ data, lang, onLang, onNavigate, current }: { data: PortfolioV4; lang: Lang; onLang?: (l: Lang) => void; onNavigate?: (r: string) => void; current?: string }): React.ReactElement {
  const isCur = (p: Page): boolean => current !== undefined && ((p.slug || p.id) === (current || 'home') || p.id === (current || 'home'));
  const { editing, onSetHeaderSpan } = useRender();
  const cfg = data.site.header ?? DEFAULT_HEADER;
  const isGrid = cfg.layout === 'grid';
  const hidden = new Set(cfg.hidden ?? []);
  const { nav: navPages, nda: ndaPages } = menuPages(data);

  // No editor, elementos ocultos continuam visíveis (esmaecidos) para poder reexibir.
  const shown = cfg.order.filter((el) => editing || !hidden.has(el));
  const wrap = (el: HeaderElement, children: React.ReactNode): React.ReactElement => (
    <div
      key={el}
      className={`hdr-el hdr-${el}${hidden.has(el) ? ' hdr-hidden' : ''} hdr-align-${cfg.align?.[el] ?? 'start'}`}
      style={isGrid ? styleVars(spanVars({ desktop: headerSpan(cfg, el), tablet: cfg.spansTablet?.[el], mobile: cfg.spansMobile?.[el] ?? HEADER_MOBILE_DEFAULT }, 'header')) : undefined}
      {...(editing ? { 'data-header-el': el, draggable: true } : {})}
    >
      <EditActions target={{ target: 'header', id: el }} acts={['edit', 'hide']} />
      {children}
      {isGrid && onSetHeaderSpan ? <SpanHandle span={headerSpan(cfg, el)} onSpan={(n) => onSetHeaderSpan(el, n)} /> : null}
    </div>
  );

  const render = (el: HeaderElement): React.ReactElement => {
    if (el === 'brand') {
      return wrap(
        'brand',
        <div className="site-header-left" onClick={onNavigate && !editing ? () => onNavigate('') : undefined}>
          <div className="header-name">{pick(data.site.name, lang)}</div>
          {!hidden.has('role') || editing ? <div className={`header-role${hidden.has('role') ? ' hdr-hidden' : ''}`}>{pick(data.site.role, lang)}</div> : null}
        </div>,
      );
    }
    if (el === 'lang') {
      return wrap(
        'lang',
        <div className="lang-icons">
          {(['pt', 'en'] as const).map((l) => (
            <button key={l} type="button" className={`flag-btn ${lang === l ? 'is-on' : ''}`} onClick={onLang ? () => onLang(l) : undefined} aria-pressed={lang === l}>
              <LangFlag lang={l} /> {l.toUpperCase()}
            </button>
          ))}
        </div>,
      );
    }
    return wrap(
      'nav',
      <nav>
        {navPages.map((p) => (
          <button
            type="button"
            key={p.id}
            className={`nav-link${isCur(p) ? ' is-current' : ''}`}
            aria-current={isCur(p) ? 'page' : undefined}
            onClick={onNavigate ? () => onNavigate(p.slug || p.id) : undefined}
            {...(editing ? { 'data-nav-page': p.id, 'data-nav-drag': p.id, draggable: true, title: 'Clique para abrir · arraste para reordenar' } : {})}
          >
            {pick(p.title, lang)}
          </button>
        ))}
        {ndaPages.map((p) => (
          <button type="button" key={p.id} className={`nav-link nav-nda${isCur(p) ? ' is-current' : ''}`} aria-current={isCur(p) ? 'page' : undefined} onClick={onNavigate ? () => onNavigate(p.slug || p.id) : undefined} {...(editing ? { 'data-nav-page': p.id } : {})}>
            {pick(p.title, lang)} 🔒
          </button>
        ))}
      </nav>,
    );
  };

  const items = shown.map(render);
  const body =
    cfg.layout === 'split' && items.length > 1 ? (
      <>
        {items[0]}
        <div className="site-header-right">{items.slice(1)}</div>
      </>
    ) : (
      items
    );

  return (
    <header className={`site-header hdr-layout-${cfg.layout}`} {...(editing ? { 'data-site-header': true, title: 'Clique para editar o cabeçalho' } : {})}>
      {body}
    </header>
  );
}

/**
 * Menu fixo que aparece no topo quando o cabeçalho sai da tela ao rolar:
 * páginas + idiomas sobre fundo translúcido. Só no site público.
 */
export function StickyNav({ data, lang, onLang, onNavigate, current }: { data: PortfolioV4; lang: Lang; onLang: (l: Lang) => void; onNavigate: (r: string) => void; current: string }): React.ReactElement | null {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const header = document.querySelector('.site-header');
    if (!header || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => setShow(!e!.isIntersecting), { threshold: 0 });
    io.observe(header);
    return () => io.disconnect();
  }, []);
  const { nav: navPages, nda: ndaPages } = menuPages(data);
  const cur = current || 'home';
  const isCur = (p: Page): boolean => (p.slug || p.id) === cur || p.id === cur || (p.id === 'home' && cur === 'home');
  return (
    <div className={`sticky-nav${show ? ' is-on' : ''}`} aria-hidden={!show}>
      <nav>
        {navPages.map((p) => (
          <button type="button" key={p.id} tabIndex={show ? 0 : -1} className={`nav-link${isCur(p) ? ' is-current' : ''}`} onClick={() => onNavigate(p.slug || p.id)}>
            {pick(p.title, lang)}
          </button>
        ))}
        {ndaPages.map((p) => (
          <button type="button" key={p.id} tabIndex={show ? 0 : -1} className={`nav-link nav-nda${isCur(p) ? ' is-current' : ''}`} onClick={() => onNavigate(p.slug || p.id)}>
            {pick(p.title, lang)} 🔒
          </button>
        ))}
      </nav>
      <div className="lang-icons">
        {(['pt', 'en'] as const).map((l) => (
          <button key={l} type="button" tabIndex={show ? 0 : -1} className={`flag-btn ${lang === l ? 'is-on' : ''}`} onClick={() => onLang(l)} aria-pressed={lang === l}>
            <LangFlag lang={l} /> {l.toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  );
}
