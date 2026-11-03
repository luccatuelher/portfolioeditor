import { useEffect, useRef, useState } from 'react';
import { DEFAULT_HEADER, headerSpan } from '../schema/defaults';
import type { HeaderElement, Page, PortfolioV4 } from '../schema/v4';
import type { Lang } from './context';
import { useRender } from './context';
import { EditActions, SpanHandle } from './blocks';
import { HEADER_MOBILE_DEFAULT, spanVars } from './responsive';
import { styleVars } from './css';
import { pick } from './text';
import { LangFlag } from './Flags';
import { linkInterno } from './links';

const NOME_DO_ELEMENTO: Record<HeaderElement, string> = { brand: 'nome e função', nav: 'menu', lang: 'idiomas' };

/** Itens do menu: páginas marcadas no menu (sem NDA) + páginas NDA (com cadeado). */
function menuPages(data: PortfolioV4): { nav: Page[]; nda: Page[] } {
  return {
    nav: data.site.nav.map((id) => data.pages.find((p) => p.id === id || p.slug === id)).filter((p): p is Page => !!p && p.visibility !== 'nda'),
    nda: data.site.ndaNoMenu === false ? [] : data.pages.filter((p) => p.kind === 'static' && p.visibility === 'nda'),
  };
}

/**
 * Link para uma página do site. No site é um <a href="#rota"> de verdade:
 * alcançável pelo Tab, abre em nova aba (Ctrl/⌘/botão do meio) e dá para copiar
 * o endereço; o clique comum navega sem recarregar. No editor, onde o item é
 * arrastável e o clique só troca a página do canvas, continua sendo botão.
 */
function PageLink({ route, onNavigate, editing, className, children, ...rest }: { route: string; onNavigate?: (r: string) => void; editing: boolean; className: string; children: React.ReactNode } & Record<string, unknown>): React.ReactElement {
  if (editing || !onNavigate) {
    return (
      <button type="button" className={className} onClick={onNavigate ? () => onNavigate(route) : undefined} {...rest}>
        {children}
      </button>
    );
  }
  return (
    <a {...linkInterno(route, onNavigate)} className={className} {...rest}>
      {children}
    </a>
  );
}

type NavEntry = { page: Page } | { folder: string; label: Page['title']; pages: Page[] };

/** Agrupa as páginas de uma mesma pasta do menu; a pasta fica onde está a 1ª página dela. */
export function navEntries(pages: Page[]): NavEntry[] {
  const out: NavEntry[] = [];
  const byKey = new Map<string, Extract<NavEntry, { folder: string }>>();
  for (const p of pages) {
    const f = p.menuFolder;
    const key = f ? `${(f.pt ?? '').trim()}|${(f.en ?? '').trim()}` : '';
    if (!f || key === '|') {
      out.push({ page: p });
      continue;
    }
    let e = byKey.get(key);
    if (!e) {
      e = { folder: key, label: f, pages: [] };
      byKey.set(key, e);
      out.push(e);
    }
    e.pages.push(p);
  }
  // Uma pasta com uma página só vale como link comum? Não: o nome da pasta é uma escolha do autor.
  return out;
}

/** Pasta do menu: botão que abre uma lista suspensa (hover, foco ou clique). */
function NavFolder({ label, current, tabIndex, children }: { label: string; current: boolean; tabIndex?: number; children: React.ReactNode }): React.ReactElement {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const fora = (e: Event): void => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent): void => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', fora);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', fora); document.removeEventListener('keydown', esc); };
  }, [open]);
  return (
    <div ref={ref} className={`nav-folder${open ? ' is-open' : ''}`}>
      <button type="button" className={`nav-link nav-folder-btn${current ? ' is-current' : ''}`} aria-haspopup="true" aria-expanded={open} tabIndex={tabIndex} onClick={() => setOpen((v) => !v)}>
        {label} <span aria-hidden="true">▾</span>
      </button>
      <div className="nav-folder-menu" onClick={() => setOpen(false)}>{children}</div>
    </div>
  );
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
      <EditActions target={{ target: 'header', id: el }} acts={['edit', 'hide']} nome={`${NOME_DO_ELEMENTO[el]} do cabeçalho`} />
      {children}
      {isGrid && onSetHeaderSpan ? <SpanHandle span={headerSpan(cfg, el)} onSpan={(n) => onSetHeaderSpan(el, n)} /> : null}
    </div>
  );

  const render = (el: HeaderElement): React.ReactElement => {
    if (el === 'brand') {
      const brand = (
        <>
          <div className="header-name">{pick(data.site.name, lang)}</div>
          {!hidden.has('role') || editing ? <div className={`header-role${hidden.has('role') ? ' hdr-hidden' : ''}`}>{pick(data.site.role, lang)}</div> : null}
        </>
      );
      // No site, o nome leva à Home (link de verdade); no editor, o clique edita.
      return wrap(
        'brand',
        onNavigate && !editing ? (
          <PageLink route="" onNavigate={onNavigate} editing={false} className="site-header-left">
            {brand}
          </PageLink>
        ) : (
          <div className="site-header-left">{brand}</div>
        ),
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
        {navEntries(navPages).map((e) => {
          const link = (p: Page): React.ReactElement => (
            <PageLink
              key={p.id}
              route={p.slug || p.id}
              onNavigate={onNavigate}
              editing={editing}
              className={`nav-link${isCur(p) ? ' is-current' : ''}`}
              aria-current={isCur(p) ? 'page' : undefined}
              {...(editing ? { 'data-nav-page': p.id, 'data-nav-drag': p.id, draggable: true, title: 'Clique para abrir · arraste para reordenar' } : {})}
            >
              {pick(p.title, lang)}
            </PageLink>
          );
          return 'page' in e ? link(e.page) : (
            <NavFolder key={e.folder} label={pick(e.label, lang)} current={e.pages.some(isCur)}>
              {e.pages.map(link)}
            </NavFolder>
          );
        })}
        {ndaPages.map((p) => (
          <PageLink key={p.id} route={p.slug || p.id} onNavigate={onNavigate} editing={editing} className={`nav-link nav-nda${isCur(p) ? ' is-current' : ''}`} aria-current={isCur(p) ? 'page' : undefined} {...(editing ? { 'data-nav-page': p.id } : {})}>
            {pick(p.title, lang)}
          </PageLink>
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
        {navEntries(navPages).map((e) => {
          const link = (p: Page): React.ReactElement => (
            <PageLink key={p.id} route={p.slug || p.id} onNavigate={onNavigate} editing={false} tabIndex={show ? 0 : -1} className={`nav-link${isCur(p) ? ' is-current' : ''}`} aria-current={isCur(p) ? 'page' : undefined}>
              {pick(p.title, lang)}
            </PageLink>
          );
          return 'page' in e ? link(e.page) : (
            <NavFolder key={e.folder} label={pick(e.label, lang)} current={e.pages.some(isCur)} tabIndex={show ? 0 : -1}>
              {e.pages.map(link)}
            </NavFolder>
          );
        })}
        {ndaPages.map((p) => (
          <PageLink key={p.id} route={p.slug || p.id} onNavigate={onNavigate} editing={false} tabIndex={show ? 0 : -1} className={`nav-link nav-nda${isCur(p) ? ' is-current' : ''}`} aria-current={isCur(p) ? 'page' : undefined}>
            {pick(p.title, lang)}
          </PageLink>
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
