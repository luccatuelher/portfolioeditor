import { useCallback, useEffect, useRef, useState } from 'react';
import { htmlLang, textoUi } from './ui';
import { rotaCanonica } from '../core/links';
import { tituloDaHome } from '../core/titulo';
import type { BlogItem, Page, PortfolioV4, ProjectItem } from '../schema/v4';
import type { AssetResolver, Lang, LightItem, RenderContextValue } from './context';
import { RenderContext } from './context';
import { styleVars } from './css';
import { Lightbox } from './Lightbox';
import { NaoEncontrado, PageView, TITULO_NAO_ENCONTRADO } from './Page';
import { SiteHeader, StickyNav } from './Header';
import { themeToCssVars } from './theme';
import { siteFrame } from './siteFrame';
import { pick } from './text';

interface Resolved {
  page: Page;
  item?: ProjectItem | BlogItem;
  /**
   * O endereço aponta para algo que não está no site (link antigo, projeto
   * excluído ou confidencial ainda trancado, página renomeada). Antes caía
   * calado na Home: quem chegava pelo link não entendia o que houve.
   */
  naoEncontrado?: 'project' | 'blog' | 'pagina';
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
    return { page: home, naoEncontrado: kind === 'project' ? 'project' : 'blog' };
  }

  const page = data.pages.find((p) => p.slug === clean || p.id === clean);
  return page ? { page } : { page: home, naoEncontrado: 'pagina' };
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

/** Âncora do link de pular ("#conteudo"; na Home pré-renderizada em inglês, "#conteudo-en"): nunca é uma rota. */
const ANCORA_CONTEUDO = /^conteudo(-[a-z]+)?$/;

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
export function initialVisitorLang(fallback: Lang): Lang {
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
  // Link para página chega pelo id (#about) e aparece pelo endereço (#sobre): ver core/links.
  // "#conteudo" é o âncora do link de pular, não uma rota (aberto antes de o site subir, ou colado): vale a Home.
  const hashRoute = (): string => {
    if (typeof location === 'undefined') return '';
    const r = rotaDoHash(location.hash);
    return rotaCanonica(data, ANCORA_CONTEUDO.test(r) ? '' : r);
  };
  const [route, setRouteState] = useState(() => (editing ? initialRoute : hashRoute() || initialRoute));
  const [lightbox, setLightbox] = useState<{ items: LightItem[]; index: number } | null>(null);
  const lbPushed = useRef(false);
  // O <main> recebe o foco depois de uma troca de página (pedida por quem navega, não pela
  // correção do endereço no carregamento): sem isso, o link clicado some e o foco cai no <body>.
  const mainRef = useRef<HTMLElement>(null);
  const routeAtual = useRef('');
  const focarAposRota = useRef(false);
  // history.back() disparado por nós mesmos ao fechar a imagem: o popstate seguinte deve ser ignorado.
  const ignorePop = useRef(false);
  routeAtual.current = route;
  const { page, item, naoEncontrado } = resolveRoute(data, route);

  const navigate = useCallback(
    (rota: string) => {
      const r = editing ? rota : rotaCanonica(data, rota);
      focarAposRota.current = !editing;
      setRouteState(r);
      if (editing || typeof history === 'undefined') return;
      const hash = r && r !== 'home' ? `#${r}` : '#';
      if (location.hash !== hash) history.pushState({ route: r }, '', hash === '#' ? location.pathname + location.search : hash);
      window.scrollTo({ top: 0 });
    },
    [editing, data],
  );

  useEffect(() => {
    if (editing) return;
    const onPop = (): void => {
      if (ignorePop.current) {
        ignorePop.current = false;
        return;
      }
      // O link de pular (clicado antes de o site subir) deixa "#conteudo" no endereço: fica na página atual.
      if (ANCORA_CONTEUDO.test(rotaDoHash(location.hash))) {
        history.replaceState(history.state, '', routeAtual.current ? `#${routeAtual.current}` : location.pathname + location.search);
        mainRef.current?.focus();
        return;
      }
      // "Voltar" com uma imagem aberta só fecha a imagem.
      if (lbPushed.current) {
        lbPushed.current = false;
        setLightbox(null);
        return;
      }
      const r = hashRoute();
      focarAposRota.current = true;
      setRouteState(r);
      // Chegou pelo id (link de texto, endereço antigo): o endereço mostra a rota canônica.
      if (rotaDoHash(location.hash) !== r) history.replaceState(history.state, '', r ? `#${r}` : location.pathname + location.search);
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [editing, data]);

  // Abriu por um endereço antigo ou pelo id (#about): mostra o canônico (#sobre).
  // O endereço pode ter mudado entre o 1º render e este efeito (o runtime começa
  // enquanto o arquivo ainda chega): vale o de AGORA — nunca devolver o endereço
  // para a rota lida no início, que perdia o pedido de quem clicou no meio.
  useEffect(() => {
    if (editing || typeof history === 'undefined' || !location.hash) return;
    const atual = hashRoute();
    if (atual !== route) setRouteState(atual);
    if (rotaDoHash(location.hash) !== atual) history.replaceState(history.state, '', atual ? `#${atual}` : location.pathname + location.search);
  }, []);

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
      document.documentElement.lang = htmlLang(lang);
    } catch {
      /* ambiente sem document */
    }
  }, [lang]);

  // Título da aba por página ("Projetos — Nome"), útil no histórico e nos favoritos.
  const siteName = pick(data.site.name, lang);
  const pageName = naoEncontrado ? textoUi(data, lang, TITULO_NAO_ENCONTRADO[naoEncontrado]) : item ? pick(item.title, lang) : page.id === 'home' ? '' : pick(page.title, lang);
  useEffect(() => {
    if (editing || typeof document === 'undefined') return;
    document.title = pageName ? `${pageName} — ${siteName}` : tituloDaHome(siteName, pick(data.site.role, lang));
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

  useEffect(() => {
    if (!focarAposRota.current) return;
    focarAposRota.current = false;
    // O título da página (h1) é o melhor ponto de foco para leitor de tela; sem h1, o conteúdo.
    const h1 = mainRef.current?.querySelector<HTMLElement>('h1');
    if (h1) h1.tabIndex = -1;
    (h1 ?? mainRef.current)?.focus({ preventScroll: true });
  }, [route]);

  // "Pular para o conteúdo": o endereço não muda (#conteudo seria lido como uma rota inexistente).
  const pularParaConteudo = (e: React.MouseEvent): void => {
    e.preventDefault();
    mainRef.current?.focus();
  };

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
      <div className={`site${frame.className}`} lang={htmlLang(lang)} style={styleVars({ ...themeToCssVars(data.theme), ...frame.vars })}>
        {/* Primeiro item do Tab: pula o menu inteiro e vai ao conteúdo. Só aparece ao receber foco. */}
        {!editing ? (
          <a className="skip-link" href="#conteudo" onClick={pularParaConteudo}>
            {textoUi(data, lang, 'pularConteudo')}
          </a>
        ) : null}
        <SiteHeader data={data} lang={lang} onLang={setLang} onNavigate={navigate} current={route} />
        {!editing ? <StickyNav data={data} lang={lang} onLang={setLang} onNavigate={navigate} current={route} /> : null}
        <main ref={mainRef} tabIndex={-1} className="container" id="conteudo" data-route={route || 'home'}>
          {naoEncontrado ? <NaoEncontrado tipo={naoEncontrado} /> : <PageView page={page} item={item} />}
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
