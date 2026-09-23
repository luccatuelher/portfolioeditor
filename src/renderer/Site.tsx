import { useCallback, useEffect, useRef, useState } from 'react';
import type { BlogItem, Page, PortfolioV4, ProjectItem } from '../schema/v4';
import type { AssetResolver, Lang, LightItem, RenderContextValue } from './context';
import { RenderContext } from './context';
import { styleVars } from './css';
import { Lightbox } from './Lightbox';
import { PageView } from './Page';
import { SiteHeader, StickyNav } from './Header';
import { themeToCssVars } from './theme';
import { siteFrame } from './siteFrame';
import { pick } from './text';

interface Resolved {
  page: Page;
  item?: ProjectItem | BlogItem;
}

/** Resolve uma rota (slug ou `project/<id>` / `blog/<id>`) para página + item. */
export function resolveRoute(data: PortfolioV4, route: string): Resolved {
  const clean = route.replace(/^#/, '').replace(/^\/+/, '');
  const byId = (id: string): Page | undefined => data.pages.find((p) => p.id === id);
  const home = byId('home') ?? data.pages[0]!;

  if (!clean || clean === 'home') return { page: home };

  const detail = clean.match(/^(project|blog)\/(.+)$/);
  if (detail) {
    const [, kind, id] = detail;
    if (kind === 'project') {
      const item = data.collections.projects.find((p) => p.id === id);
      const page = byId('project-detail');
      if (item && page) return { page, item };
    } else {
      const item = data.collections.blog.find((b) => b.id === id);
      const page = byId('blog-detail');
      if (item && page) return { page, item };
    }
    return { page: home };
  }

  const page = data.pages.find((p) => p.slug === clean || p.id === clean);
  return { page: page ?? home };
}

/**
 * Rota que está no endereço (#projects, #project/<id>…). Um "%" solto num link
 * colado (`#100%`) fazia o decodeURIComponent lançar erro na montagem — e o
 * site inteiro caía na tela de erro. Aí vale o texto cru (que cai na Home).
 */
export function rotaDoHash(hash: string): string {
  const cru = hash.replace(/^#\/?/, '');
  try {
    return decodeURIComponent(cru);
  } catch {
    return cru;
  }
}

export interface SiteProps {
  data: PortfolioV4;
  resolveAsset: AssetResolver;
  initialRoute?: string;
  initialLang?: Lang;
  editing?: boolean;
  /** Desbloqueio de NDA (site publicado). */
  nda?: RenderContextValue['nda'];
}

/** Raiz do renderer: mesmo componente serve o site público e o canvas do editor. */
/** Idioma inicial do visitante: a escolha salva, senão o do navegador (quem não usa português vê EN). */
function initialVisitorLang(fallback: Lang): Lang {
  try {
    const saved = localStorage.getItem('portfolio-lang');
    if (saved === 'pt' || saved === 'en') return saved;
    if (typeof navigator !== 'undefined' && navigator.language) return navigator.language.toLowerCase().startsWith('pt') ? 'pt' : 'en';
  } catch {
    /* sem storage (modo privado, SSR) */
  }
  return fallback;
}

export function Site({ data, resolveAsset, initialRoute = '', initialLang, editing = false, nda }: SiteProps): React.ReactElement {
  const [lang, setLangState] = useState<Lang>(() => initialLang ?? (editing ? 'pt' : initialVisitorLang('pt')));
  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem('portfolio-lang', l);
    } catch {
      /* sem storage */
    }
  }, []);
  // A rota vive no endereço (#projects, #project/<id>…): voltar/avançar do navegador funcionam, inclusive em file://.
  const hashRoute = (): string => (typeof location !== 'undefined' ? rotaDoHash(location.hash) : '');
  const [route, setRouteState] = useState(() => (editing ? initialRoute : hashRoute() || initialRoute));
  const [lightbox, setLightbox] = useState<{ items: LightItem[]; index: number } | null>(null);
  const lbPushed = useRef(false);
  // history.back() disparado por nós mesmos ao fechar a imagem: o popstate seguinte deve ser ignorado.
  const ignorePop = useRef(false);
  const { page, item } = resolveRoute(data, route);

  const navigate = useCallback(
    (r: string) => {
      setRouteState(r);
      if (editing || typeof history === 'undefined') return;
      const hash = r && r !== 'home' ? `#${r}` : '#';
      if (location.hash !== hash) history.pushState({ route: r }, '', hash === '#' ? location.pathname + location.search : hash);
      window.scrollTo({ top: 0 });
    },
    [editing],
  );

  useEffect(() => {
    if (editing) return;
    const onPop = (): void => {
      if (ignorePop.current) {
        ignorePop.current = false;
        return;
      }
      // "Voltar" com uma imagem aberta só fecha a imagem.
      if (lbPushed.current) {
        lbPushed.current = false;
        setLightbox(null);
        return;
      }
      setRouteState(hashRoute());
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [editing]);

  const openLightbox = (items: LightItem[], index: number): void => {
    setLightbox({ items, index });
    if (!editing && typeof history !== 'undefined' && !lbPushed.current) {
      history.pushState({ lightbox: true }, '', location.href);
      lbPushed.current = true;
    }
  };
  const closeLightbox = (): void => {
    setLightbox(null);
    if (lbPushed.current) {
      lbPushed.current = false;
      ignorePop.current = true;
      history.back();
    }
  };

  useEffect(() => {
    try {
      document.documentElement.lang = lang === 'en' ? 'en' : 'pt-BR';
    } catch {
      /* ambiente sem document */
    }
  }, [lang]);

  // Título da aba por página ("Projetos — Nome"), útil no histórico e nos favoritos.
  const siteName = pick(data.site.name, lang);
  const pageName = item ? pick(item.title, lang) : page.id === 'home' ? '' : pick(page.title, lang);
  useEffect(() => {
    if (editing || typeof document === 'undefined') return;
    document.title = pageName ? `${pageName} — ${siteName}` : siteName;
    // Descrição do buscador acompanha a página aberta (as redes sociais leem o <head> publicado).
    const desc = pick(page.seo?.description, lang) || pick(data.site.role, lang);
    let tag = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!tag) {
      tag = document.createElement('meta');
      tag.name = 'description';
      document.head.appendChild(tag);
    }
    tag.content = desc;
  }, [editing, pageName, siteName, page, lang, data.site.role]);

  const frame = siteFrame(data, resolveAsset);
  const ctx: RenderContextValue = {
    data,
    lang,
    resolveAsset,
    editing,
    nda,
    onNavigate: navigate,
    onOpenLightbox: openLightbox,
  };

  return (
    <RenderContext.Provider value={ctx}>
      <div className={`site${frame.className}`} lang={lang === 'en' ? 'en' : 'pt-BR'} style={styleVars({ ...themeToCssVars(data.theme), ...frame.vars })}>
        {/* Primeiro item do Tab: pula o menu inteiro e vai ao conteúdo. Só aparece ao receber foco. */}
        {!editing ? (
          <a className="skip-link" href="#conteudo">
            {lang === 'en' ? 'Skip to content' : 'Pular para o conteúdo'}
          </a>
        ) : null}
        <SiteHeader data={data} lang={lang} onLang={setLang} onNavigate={navigate} current={route} />
        {!editing ? <StickyNav data={data} lang={lang} onLang={setLang} onNavigate={navigate} current={route} /> : null}
        <main className="container" id="conteudo" data-route={route || 'home'}>
          <PageView page={page} item={item} />
        </main>
      </div>
      {lightbox ? (
        <Lightbox
          items={lightbox.items}
          index={lightbox.index}
          onIndex={(i) => setLightbox((lb) => (lb ? { ...lb, index: i } : lb))}
          onClose={closeLightbox}
        />
      ) : null}
    </RenderContext.Provider>
  );
}
