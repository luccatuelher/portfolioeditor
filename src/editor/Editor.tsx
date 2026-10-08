import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Lang, RenderContextValue } from '../renderer/context';
import { RenderContext } from '../renderer/context';
import { PageView } from '../renderer/Page';
import { SiteHeader } from '../renderer/Header';
import { blockLabel, defaultPreview, TYPE_LABEL } from '../renderer/preview';
import { DEFAULT_HEADER, headerSpan, type HeaderElement } from '../schema/v4';
import { detachBlock, placeBlock } from './gridOps';
import { pick } from '../renderer/text';
import { styleVars } from '../renderer/css';
import { mapResolver } from '../renderer/dataUrlResolver';
import { themeToCssVars } from '../renderer/theme';
import { siteFrame } from '../renderer/siteFrame';
import { themeFontUrls } from '../renderer/fonts';
import { buildBackup, explicarErroDeImportacao, parseBackup, resumoDoBackup, type Backup } from './backup';
import siteShell from '../publish/site-shell.html?raw';
import { assembleSiteHtml } from '../publish/assemble';
import { buildPublishPayload } from '../publish/buildPayload';
import { arquivosAoLado, runPreflight } from '../publish/preflight';
import { ndaCount, publicSnapshot } from '../publish/publicSnapshot';
import { formatarPeso, LIMITE_GITHUB_BYTES, pesoDoSite, type PesoDoSite } from '../publish/peso';
import type { MigratedAsset } from '../migrate/migrate';
import { blobToDataUrl, imagemDeCompartilhar, importImage, miniaturaDeDataUrl } from '../assets/importImage';
import { ARQUIVO_SOCIAL, imagemSocialEmbutida } from '../publish/imagemSocial';
import { makeFavicon } from '../assets/favicon';
import { assetIdFromContent } from '../core/ids';
import { emptyI18n } from '../core/i18n';
import { completarDimensoes } from '../core/dimensoesImagem';
import { makeDefaultBlock, newBlockId, renewItemIds, renewSectionIds } from './blockFactory';
import { FloatingToolbar } from './FloatingToolbar';
import { sanitizeInlineHtml } from './sanitize';
import type { Block, BlogItem, Page, PortfolioV4, ProjectItem, Section } from '../schema/v4';
import { Inspector } from './Inspector';
import { LayersPanel } from './LayersPanel';
import { PagesPanel } from './PagesPanel';
import { ThemePanel } from './ThemePanel';
import { DataPanel } from './DataPanel';
import { findBlock, findSection, getSections, locateBlock, parentOf, sameContainer, type CollectionName, type Container, type Selection } from './paths';
import type { DropZone } from './gridOps';
import { reorderArray } from '../core/array';
import { AddBlockPopup, ElementsPalette } from './ElementsPalette';
import { SECTION_PRESETS } from './sectionPresets';
import { VersionsModal } from './VersionsModal';
import { NdaPasswordModal } from './NdaPasswordModal';
import { gravarSenhaNda, lerSenhaNda } from './senhaNda';
import { EnviarSiteModal } from './EnviarSiteModal';
import { BRANCH_PADRAO, REPO_DO_SITE_PADRAO, configSiteEfetiva, enviarSite, gravarConfigSite, quaisFaltam, type ArquivoSite } from './githubSite';
import { guardarAntesDeTrocar, saveVersion } from './versions';
import { CropModal } from './CropModal';
import type { ImageCrop, ImageRef } from '../schema/v4';
import { LangFlag } from '../renderer/Flags';
import { useDocument } from './useDocument';
import { useLocalDraft, type SaveStatus } from './useLocalDraft';
import { useOutraAba } from './outraAba';
import { AvisosContext, useAvisos, useAvisosDoEditor } from './avisos';
import { RemoverContext } from './remover';
import { chaveDaSelecao, type PedidoFoco } from './focoCampo';
import type { CampoId } from '../core/camposTexto';
import { imagensSemDescricao, textosSemTraducao, type ImagemSemDescricao, type TextoSemTraducao } from './pendencias';
import { alvoDe, CONFERIR_A_CADA_MS, gravarShaConhecido, hashTexto, lerConfig, lerShaConhecido, useGithubSync, verificarRemoto, type SyncConfig } from './githubSync';
import { avisoDeArmazenamento, lerUltimoBackup, marcarBackup, protegerRascunho } from './armazenamento';

/** Nome do item no aviso de exclusão. */
const COLL_NOME: Record<CollectionName, string> = { projects: 'projeto', blog: 'nota', gallery: 'imagem da galeria', sketches: 'sketch' };

export interface EditorProps {
  initial: PortfolioV4;
  /** assetId → data URL (imagens). Mutável via importação de backup. */
  assets: Record<string, string>;
  /** Chamado ao importar um backup (a raiz remonta o editor); `aviso` aparece no topo do editor novo. */
  onImport?: (backup: Backup, aviso?: string) => void;
  /** Adiciona uma imagem ao mapa de assets (data URL) sem remontar o editor. */
  onAddAsset?: (id: string, dataUrl: string) => void;
  persist?: boolean;
  /**
   * O documento de abertura ainda não está gravado (acabou de ser importado ou
   * restaurado): o autosave grava já — e mostra o aviso se não conseguir.
   */
  gravarAoAbrir?: boolean;
  /** Aviso exibido no topo (ex.: rascunho recuperado com ajustes). */
  notice?: string;
  /** Quando o rascunho aberto foi gravado neste navegador (ms). Compara com o backup do GitHub. */
  rascunhoSalvoEm?: number;
}

/** Baixa um arquivo gerado no navegador (site, imagem de compartilhamento, backup). */
function baixarArquivo(blob: Blob, nome: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revogar na hora cancelava o segundo download em alguns navegadores.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Nome curto do que está selecionado, para o botão que abre o Inspector na tela estreita. */
function rotuloDaSelecao(doc: PortfolioV4, sel: NonNullable<Selection>): string {
  if (sel.kind === 'block') {
    const b = findSection(doc, sel.ref)?.blocks.find((x) => x.id === sel.ref.blockId);
    return (b && TYPE_LABEL[b.type]) || 'Elemento';
  }
  if (sel.kind === 'section') return 'Seção';
  if (sel.kind === 'item') return { projects: 'Projeto', blog: 'Nota', gallery: 'Imagem', sketches: 'Sketch' }[sel.collection];
  if (sel.kind === 'site') return 'Cabeçalho';
  return 'Página';
}

/** Nome completo do selecionado, para o anúncio ao leitor de tela ("Título · Selected Work"). */
function descreverSelecao(doc: PortfolioV4, sel: NonNullable<Selection>): string {
  if (sel.kind === 'block') {
    const b = findSection(doc, sel.ref)?.blocks.find((x) => x.id === sel.ref.blockId);
    return b ? blockLabel(b) : 'Elemento';
  }
  if (sel.kind === 'section') return findSection(doc, sel.ref)?.name || 'Seção';
  if (sel.kind === 'item') {
    const it = doc.collections[sel.collection].find((x) => x.id === sel.itemId) as { title?: { pt: string; en: string }; caption?: { pt: string; en: string } } | undefined;
    const nome = it?.title ? pick(it.title, 'pt') : it?.caption ? pick(it.caption, 'pt') : '';
    return `${rotuloDaSelecao(doc, sel)}${nome ? ` “${nome}”` : ''}`;
  }
  if (sel.kind === 'page') return `Página ${pick(doc.pages.find((p) => p.id === sel.pageId)?.title ?? { pt: '', en: '' }, 'pt')}`;
  return rotuloDaSelecao(doc, sel);
}

/** Resultado do "Baixar site", para o aviso com os passos de publicação. */
interface Publicado {
  /** Arquivos que o site espera ao lado do index.html (cv.pdf…). */
  arquivos: string[];
  avisos: string[];
  /** Tamanho do index.html em MB. */
  mb: number;
}

/** O upload pelo navegador do GitHub não aceita arquivo acima disso. */
const LIMITE_UPLOAD_GITHUB_MB = 25;

/**
 * Depois de baixar: como pôr o site no ar pelo GitHub Pages, o que mais subir
 * junto e o que vale revisar (recolhido, para não esconder os passos).
 */
function AvisoPublicado({ p, onClose }: { p: Publicado; onClose: () => void }): React.ReactElement {
  const grande = p.mb > LIMITE_UPLOAD_GITHUB_MB;
  return (
    <div className="editor-notice publish-notice" role="status">
      <div className="publish-notice-body">
        <p>
          <strong>index.html baixado ({p.mb < 0.1 ? '<0,1' : p.mb.toFixed(1).replace('.', ',')} MB).</strong> Para pôr no ar no GitHub Pages: abra o repositório do site, clique em <b>Add file → Upload files</b>, arraste o index.html (ele substitui o anterior) e clique em <b>Commit changes</b>. Em cerca de um minuto o site atualiza.
        </p>
        {grande ? (
          <p className="publish-notice-alerta">
            ⚠ O arquivo passou de {LIMITE_UPLOAD_GITHUB_MB} MB, o limite do upload pelo navegador do GitHub. Diminua imagens grandes (ou use vídeos por link) e gere de novo.
          </p>
        ) : null}
        {p.arquivos.length ? (
          <p>
            Suba também, na mesma pasta do index.html: {p.arquivos.map((a, i) => <span key={a}>{i ? ', ' : ''}<code>{a}</code></span>)}. Sem eles, o que aponta para eles não funciona (links, imagem de compartilhamento).
          </p>
        ) : null}
        {p.avisos.length ? (
          <details>
            <summary>Vale revisar ({p.avisos.length})</summary>
            <ul>{p.avisos.map((w) => <li key={w}>{w}</li>)}</ul>
          </details>
        ) : null}
      </div>
      <button type="button" onClick={onClose} aria-label="Fechar aviso">✕</button>
    </div>
  );
}

type Clip =
  | { kind: 'block'; block: Block }
  | { kind: 'section'; section: Section }
  | { kind: 'item'; coll: CollectionName; item: PortfolioV4['collections'][CollectionName][number] };

/** Fotografa a seleção para a área de transferência interna do editor. */
function copySelection(doc: PortfolioV4, sel: NonNullable<Selection>): Clip | null {
  if (sel.kind === 'block') {
    const b = findSection(doc, sel.ref)?.blocks.find((x) => x.id === sel.ref.blockId);
    return b ? { kind: 'block', block: structuredClone(b) } : null;
  }
  if (sel.kind === 'section') {
    const s = findSection(doc, sel.ref);
    return s ? { kind: 'section', section: structuredClone(s) } : null;
  }
  if (sel.kind === 'item') {
    const it = doc.collections[sel.collection].find((x) => x.id === sel.itemId);
    return it ? { kind: 'item', coll: sel.collection, item: structuredClone(it) } : null;
  }
  return null;
}

type DragSource =
  | { kind: 'block'; id: string }
  | { kind: 'new'; type: Block['type'] }
  | { kind: 'item'; coll: CollectionName; id: string }
  | { kind: 'frame'; blockId: string; idx: number }
  | { kind: 'header'; el: HeaderElement }
  | { kind: 'nav'; pageId: string }
  | { kind: 'pv'; project: string; ref: string };

function resolveView(doc: PortfolioV4, c: Container): { page: Page; item?: ProjectItem | BlogItem } {
  if (c.on === 'page') return { page: doc.pages.find((p) => p.id === c.pageId) ?? doc.pages[0]! };
  const page = doc.pages.find((p) => p.id === `${c.collection === 'projects' ? 'project' : 'blog'}-detail`)!;
  const item = c.collection === 'projects' ? doc.collections.projects.find((i) => i.id === c.itemId) : doc.collections.blog.find((i) => i.id === c.itemId);
  return item ? { page, item } : { page };
}

/** Fechou o aviso de proteção do rascunho: não volta nesta sessão (o editor remonta ao importar). */
let protecaoDispensada = false;

export function Editor({ initial, assets, onImport, onAddAsset, persist = true, gravarAoAbrir = false, notice, rascunhoSalvoEm }: EditorProps): React.ReactElement {
  const [showNotice, setShowNotice] = useState(!!notice);
  // Avisos da última publicação ("Baixar site"), mostrados na barra de aviso.
  const [publishNotice, setPublishNotice] = useState<Publicado | null>(null);
  // Imagens sem tamanho gravado (migradas do site antigo, backups antigos) ganham o tamanho real ao abrir.
  const [inicial] = useState(() => completarDimensoes(initial, assets));
  const doc = useDocument(inicial);
  const resolveAsset = useMemo(() => mapResolver(assets), [assets]);
  const { status: saveStatus, erro: erroGravacao } = useLocalDraft(doc.state, assets, persist, gravarAoAbrir);
  const [syncConfig, setSyncConfig] = useState<SyncConfig | null>(() => (persist ? lerConfig() : null));
  // Enquanto confere se o GitHub tem uma versão mais nova, o envio automático espera.
  const [conferindoGitHub, setConferindoGitHub] = useState(() => !!(persist && onImport && lerConfig()));
  const puxarRef = useRef<() => void>(() => {});
  const sync = useGithubSync(doc.state, assets, syncConfig, conferindoGitHub, () => puxarRef.current());
  const outraAba = useOutraAba('portfolio-editor', persist);
  // Avisos e perguntas no visual do editor (nada de alert/confirm/prompt do navegador).
  const avisos = useAvisosDoEditor(doc.state);
  const { avisar: mostrarAviso, fecharAviso } = avisos.api;

  // O GitHub é a fonte da versão mais nova: se o backup de lá mudou por fora
  // (outro navegador, ou uma revisão enviada direto para lá) e é diferente do
  // que está aberto, carrega sozinho — o que estava aberto vira versão
  // automática (Versões). Confere ao abrir, ao voltar para a aba, a cada
  // CONFERIR_A_CADA_MS e quando um envio encontra o arquivo mudado.
  const docAtual = useRef(doc.state);
  docAtual.current = doc.state;
  const vivo = useRef(true);
  const puxando = useRef(false);
  const puxarDoGitHub = async (): Promise<void> => {
    const c = syncConfig;
    if (!c || !onImport || puxando.current) return;
    puxando.current = true;
    setConferindoGitHub(true);
    const alvo = alvoDe(c);
    try {
      const { oferta, sha } = await verificarRemoto(c, docAtual.current, rascunhoSalvoEm, lerShaConhecido(alvo));
      if (sha && sha !== lerShaConhecido(alvo)) gravarShaConhecido(alvo, sha);
      if (!vivo.current || !oferta) return;
      let backup: Backup;
      try {
        backup = parseBackup(oferta.texto);
      } catch (err) {
        mostrarAviso(`O backup do GitHub não abriu: ${explicarErroDeImportacao(err)}`, { tipo: 'erro' });
        return;
      }
      if (!(await guardarAntesDeTrocar('Antes de carregar do GitHub', docAtual.current, avisos.api.confirmar))) return;
      // Impressão digital do que veio: o editor que abre com ela não reenvia o mesmo conteúdo.
      gravarShaConhecido(alvo, oferta.sha, hashTexto(JSON.stringify({ ...buildBackup(backup.doc, backup.assets), savedAt: '' })));
      const quando = oferta.savedAt ? new Date(oferta.savedAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
      onImport(backup, `Carreguei a versão mais nova do GitHub${quando ? ` (salva em ${quando})` : ''}. O que estava aberto ficou em Versões.`);
    } catch (err) {
      console.warn('[github] não consegui conferir o backup do GitHub', err);
    } finally {
      puxando.current = false;
      if (vivo.current) setConferindoGitHub(false);
    }
  };
  puxarRef.current = () => void puxarDoGitHub();

  useEffect(() => {
    vivo.current = true;
    if (conferindoGitHub) void puxarDoGitHub();
    return () => {
      vivo.current = false;
    };
    // Só ao abrir (o editor remonta a cada importação).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!syncConfig || !onImport) return;
    let ultima = Date.now();
    const conferir = (): void => {
      if (document.visibilityState !== 'visible' || Date.now() - ultima < 30_000) return;
      ultima = Date.now();
      puxarRef.current();
    };
    window.addEventListener('focus', conferir);
    document.addEventListener('visibilitychange', conferir);
    const t = setInterval(conferir, CONFERIR_A_CADA_MS);
    return () => {
      window.removeEventListener('focus', conferir);
      document.removeEventListener('visibilitychange', conferir);
      clearInterval(t);
    };
  }, [syncConfig, onImport]);

  const uploadImage = useCallback(
    async (file: File): Promise<string> => {
      let r: Awaited<ReturnType<typeof importImage>>;
      try {
        r = await importImage(file, { maxSide: 2400 });
      } catch (err) {
        // Um único aviso para todo envio de imagem (canvas, inspector, tema…); quem chamou simplesmente não segue.
        mostrarAviso(`Não consegui usar essa imagem: ${err instanceof Error ? err.message : String(err)}`, { tipo: 'erro' });
        return new Promise<string>(() => {});
      }
      const dataUrl = await blobToDataUrl(r.blob);
      const id = assetIdFromContent(dataUrl);
      onAddAsset?.(id, dataUrl);
      doc.setAssetMeta(id, { mime: r.mime, w: r.w, h: r.h, alt: emptyI18n() });
      if (r.aviso) mostrarAviso(r.aviso, { duracaoMs: 12000 });
      return id;
    },
    [doc, onAddAsset, mostrarAviso],
  );
  const uploadFavicon = useCallback(
    async (file: File): Promise<void> => {
      let dataUrl: string;
      try {
        dataUrl = await makeFavicon(file);
      } catch (err) {
        mostrarAviso(`Não consegui usar essa imagem como ícone: ${err instanceof Error ? err.message : String(err)}`, { tipo: 'erro' });
        return;
      }
      const id = assetIdFromContent(dataUrl);
      onAddAsset?.(id, dataUrl);
      doc.setAssetMeta(id, { mime: 'image/png', w: 128, h: 128, alt: emptyI18n() });
      doc.updateSite((s) => void (s.favicon = { assetId: id, alt: emptyI18n() }));
    },
    [doc, onAddAsset],
  );
  const [container, setContainer] = useState<Container>({ on: 'page', pageId: 'home' });
  const [selection, setSelection] = useState<Selection>(null);
  const [lang, setLang] = useState<Lang>('pt');
  const [leftTab, setLeftTab] = useState<'pages' | 'layers' | 'theme' | 'data'>('layers');
  // Peso estimado do index.html (runtime + dados + imagens que vão para o site).
  const peso = useMemo(() => pesoDoSite(doc.state, assets, siteShell.length, { miniaturas: true }), [doc.state, assets]);
  const semDescricao = useMemo(() => imagensSemDescricao(doc.state), [doc.state]);
  const semTraducao = useMemo(() => textosSemTraducao(doc.state), [doc.state]);
  // Largura do canvas: ver o site como no tablet/celular (usa o mesmo CSS responsivo do site).
  const [device, setDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const backupRef = useRef<(() => void) | null>(null);
  // Rascunho protegido da limpeza automática do navegador (ver armazenamento.ts).
  const [protecao, setProtecao] = useState<string | null>(null);
  useEffect(() => {
    if (!persist || protecaoDispensada) return;
    let vivo = true;
    void protegerRascunho().then((e) => {
      if (vivo) setProtecao(avisoDeArmazenamento(e, lerUltimoBackup()));
    });
    return () => {
      vivo = false;
    };
  }, [persist]);
  const clipboard = useRef<Clip | null>(null);
  const drag = useRef<DragSource | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const pendingPick = useRef<((assetId: string) => void) | null>(null);
  // Recortador aberto: imagem atual, trava de proporção e como gravar o resultado.
  // Popup de "＋ Adicionar bloco": seção de destino e posição na tela.
  const [addMenu, setAddMenu] = useState<{ sectionId: string; x: number; y: number } | null>(null);
  const [cropping, setCropping] = useState<{ image: ImageRef; lock?: number; apply: (c: ImageCrop | undefined) => void } | null>(null);
  // Guias de alinhamento: enquanto arrasta, o canvas mostra as 12 colunas da grade.
  const [dragging, setDragging] = useState(false);
  // Tela estreita (tablet, celular): os painéis viram gavetas por cima do canvas.
  const [gaveta, setGaveta] = useState<'esquerda' | 'direita' | null>(null);
  // Aviso curto depois de desfazer/refazer ("Desfeito: texto de Título"): com o
  // atalho, a mudança pode acontecer fora da tela e ninguém saberia o que voltou.
  const [avisoHistorico, setAvisoHistorico] = useState<string | null>(null);
  const avisoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const avisar = (msg: string): void => {
    setAvisoHistorico(msg);
    if (avisoTimer.current) clearTimeout(avisoTimer.current);
    avisoTimer.current = setTimeout(() => setAvisoHistorico(null), 3500);
  };
  // Lê sempre o documento ATUAL (docRef): o "Desfazer" de um aviso guarda esta
  // função para depois, e o `doc` da renderização em que foi guardada dizia
  // canUndo=false num editor recém-aberto — o botão não fazia nada.
  const desfazer = (): void => {
    const d = docRef.current;
    const rotulo = d.undoLabel;
    if (!d.store.canUndo()) return;
    d.undo();
    if (rotulo) avisar(`Desfeito: ${rotulo}`);
  };
  const refazer = (): void => {
    const d = docRef.current;
    const rotulo = d.redoLabel;
    if (!d.store.canRedo()) return;
    d.redo();
    if (rotulo) avisar(`Refeito: ${rotulo}`);
  };
  // Depois de excluir: "Excluído: … · Desfazer" (aviso comum do editor). Some
  // sozinho, e some assim que o documento muda de novo (aí o Desfazer já não
  // desfaria a exclusão).
  const [exclusao, setExclusao] = useState<{ aviso: number; depois: PortfolioV4 } | null>(null);
  useEffect(() => {
    if (exclusao && doc.state !== exclusao.depois) {
      fecharAviso(exclusao.aviso);
      setExclusao(null);
    }
  }, [exclusao, doc.state, fecharAviso]);
  const [showVersions, setShowVersions] = useState(false);
  // Quadro de storyboard que o ✎ pediu para editar (destaca o campo dele).
  const [quadroEmFoco, setQuadroEmFoco] = useState<{ blockId: string; idx: number } | null>(null);

  const { page, item } = resolveView(doc.state, container);
  const favSrc = doc.state.site.favicon ? resolveAsset(doc.state.site.favicon) : '';
  useEffect(() => {
    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!favSrc) {
      link?.remove();
      return;
    }
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = favSrc;
  }, [favSrc]);
  const selectedId = selection?.kind === 'block' ? selection.ref.blockId : undefined;
  const docRef = useRef(doc);
  docRef.current = doc;

  /** Seleciona um item da lista de Dados E leva o canvas até onde ele aparece. */
  const abrirItem = useCallback(
    (s: Selection) => {
      setSelection(s);
      if (!s || s.kind !== 'item') return;
      if (s.collection === 'projects' || s.collection === 'blog') {
        setContainer({ on: 'item', collection: s.collection, itemId: s.itemId });
        return;
      }
      // Galeria e sketches não têm página própria: vai para a página que os lista.
      const pagina = docRef.current.state.pages.find((p) =>
        p.sections.some((sec) => sec.blocks.some((b) => b.type === 'collection' && b.content.collection === s.collection)),
      );
      if (pagina) setContainer({ on: 'page', pageId: pagina.id });
    },
    [],
  );

  // Pedido de foco num campo do Inspector (ver focoCampo): o campo se foca ao aparecer.
  const [pedidoFoco, setPedidoFoco] = useState<PedidoFoco | null>(null);
  const focoAtendido = useCallback((n: number) => setPedidoFoco((p) => (p?.n === n ? null : p)), []);
  /**
   * Leva a um campo pelo id (camposTexto): abre onde ele mora (página, projeto,
   * bloco), seleciona, troca o idioma de edição se pedido e pede o foco.
   */
  const irParaCampo = (alvo: NonNullable<Selection>, campo: CampoId, idioma?: Lang): void => {
    if (idioma) setLang(idioma);
    if (alvo.kind === 'item') abrirItem(alvo);
    else {
      if (alvo.kind === 'block' || alvo.kind === 'section') setContainer(alvo.ref.container);
      else if (alvo.kind === 'page') setContainer({ on: 'page', pageId: alvo.pageId });
      setSelection(alvo);
    }
    setPedidoFoco((p) => ({ campo, chave: chaveDaSelecao(alvo), n: (p?.n ?? 0) + 1 }));
    setGaveta('direita'); // tela estreita: o campo fica no Inspector
  };

  /** "Descrever" na lista de imagens sem descrição. */
  const irParaDescricao = (p: ImagemSemDescricao): void => {
    if (p.quadro !== undefined && p.alvo.kind === 'block') setQuadroEmFoco({ blockId: p.alvo.ref.blockId, idx: p.quadro });
    irParaCampo(p.alvo, p.campo);
  };

  /** "Traduzir" na lista de traduções: no idioma que falta (o outro aparece de modelo no campo). */
  const irParaTraducao = (t: TextoSemTraducao): void => irParaCampo(t.alvo, t.campo, t.falta);

  const openContainer = useCallback((c: Container) => {
    setContainer(c);
    setSelection(c.on === 'item' ? { kind: 'item', collection: c.collection, itemId: c.itemId } : null);
  }, []);

  useEffect(() => {
    const s = doc.state;
    const gone = container.on === 'page' ? !s.pages.some((p) => p.id === container.pageId) : !s.collections[container.collection].some((i) => i.id === container.itemId);
    if (gone) openContainer({ on: 'page', pageId: 'home' });
  }, [doc.state, container, openContainer]);

  // O bloco trocou de seção (arrastar, Alt+↑/↓, desfazer, refazer): a seleção o segue em
  // vez de apontar para a seção antiga ("Elemento não encontrado" no Inspector).
  useLayoutEffect(() => {
    if (selection?.kind !== 'block' || findBlock(doc.state, selection.ref)) return;
    const nova = locateBlock(doc.state, selection.ref.container, selection.ref.blockId);
    if (nova) setSelection({ kind: 'block', ref: nova });
  }, [doc.state, selection]);

  useEffect(() => {
    if (selection?.kind !== 'block') return;
    const el = document.querySelector<HTMLElement>(`.editor-canvas [data-block-id="${CSS.escape(selection.ref.blockId)}"]`);
    const wrap = el?.closest('.editor-canvas-wrap');
    if (!el || !wrap) return;
    const r = el.getBoundingClientRect();
    const w = wrap.getBoundingClientRect();
    if (r.bottom < w.top + 40 || r.top > w.bottom - 40) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [selection]);

  // Fontes do tema que não vêm de fábrica: carrega do Google Fonts (senão o navegador cai numa genérica).
  const fontUrls = themeFontUrls(doc.state.theme.fonts).join('|');
  useEffect(() => {
    document.querySelectorAll('link[data-theme-font]').forEach((l) => l.remove());
    for (const href of fontUrls ? fontUrls.split('|') : []) {
      const l = document.createElement('link');
      l.rel = 'stylesheet';
      l.href = href;
      l.setAttribute('data-theme-font', '');
      document.head.appendChild(l);
    }
  }, [fontUrls]);

  /** Abre o seletor de arquivo e entrega o assetId da imagem enviada. */
  const pickImage = useCallback((apply: (assetId: string) => void) => {
    pendingPick.current = apply;
    fileInput.current?.click();
  }, []);
  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const f = e.target.files?.[0];
    e.target.value = '';
    const apply = pendingPick.current;
    pendingPick.current = null;
    if (f && apply) void uploadImage(f).then(apply);
  };

  /** Navegação dentro do canvas (menu, cards de projeto/nota). */
  const navigate = useCallback(
    (route: string) => {
      const m = route.match(/^(project|blog)\/(.+)$/);
      if (m) {
        openContainer({ on: 'item', collection: m[1] === 'project' ? 'projects' : 'blog', itemId: m[2]! });
        return;
      }
      const p = docRef.current.state.pages.find((x) => x.slug === route || x.id === route) ?? docRef.current.state.pages.find((x) => x.id === 'home');
      if (p) openContainer({ on: 'page', pageId: p.id });
    },
    [openContainer],
  );

  /** Altera a prévia (popup da Home) de um projeto, criando-a a partir da padrão se preciso. */
  const editPreview = useCallback((projectId: string, recipe: (pv: NonNullable<ProjectItem['preview']>) => void) => {
    docRef.current.updateItem('projects', projectId, (it) => {
      const p = it as ProjectItem;
      p.preview ??= defaultPreview(p);
      recipe(p.preview);
    });
  }, []);

  /** Adiciona um elemento da paleta: após o bloco selecionado, na seção selecionada ou na última seção. */
  const addElement = useCallback(
    (type: Block['type']) => {
      const d = docRef.current;
      const block = makeDefaultBlock(type);
      let sectionId = selection?.kind === 'block' || selection?.kind === 'section' ? selection.ref.sectionId : undefined;
      if (selection && (selection.kind === 'block' || selection.kind === 'section') && !sameContainer(selection.ref.container, container)) sectionId = undefined;
      const secs = getSections(d.state, container) ?? [];
      const secaoFinal = d.transacao(() => {
        const sid = sectionId ?? secs[secs.length - 1]?.id ?? d.addSection(container);
        if (!sid) return null;
        if (selection?.kind === 'block' && sameContainer(selection.ref.container, container)) d.insertBelow(selection.ref, block);
        else d.insertBlock({ container, sectionId: sid }, block);
        return sid;
      });
      if (!secaoFinal) return;
      const bref = { container, sectionId: secaoFinal, blockId: block.id };
      setSelection({ kind: 'block', ref: bref });
      if (type === 'image') pickImage((aid) => docRef.current.updateBlock(bref, (b) => { if (b.type === 'image') { b.content.image.assetId = aid; b.content.image.url = undefined; } }));
    },
    [selection, container, pickImage],
  );

  /** Insere uma seção pronta depois da seção selecionada (ou no fim da página). */
  const addSectionPreset = useCallback(
    (presetId: string) => {
      const preset = SECTION_PRESETS.find((p) => p.id === presetId);
      if (!preset) return;
      const d = docRef.current;
      const secs = getSections(d.state, container) ?? [];
      const selSec = selection && (selection.kind === 'block' || selection.kind === 'section') && sameContainer(selection.ref.container, container) ? selection.ref.sectionId : undefined;
      const at = selSec ? secs.findIndex((s) => s.id === selSec) + 1 : secs.length;
      const sec = preset.make();
      d.insertSection(container, sec, at);
      setSelection({ kind: 'section', ref: { container, sectionId: sec.id } });
    },
    [container, selection],
  );

  /**
   * Remove o que está selecionado (bloco, seção, item ou página) sem perguntar
   * antes: tudo volta com Desfazer. `aviso` mostra "Excluído: … · Desfazer"
   * (o Recortar não precisa — o conteúdo está na área de transferência).
   */
  const removeSelection = (sel: NonNullable<Selection>, aviso = true): void => {
    const d = docRef.current;
    const antes = d.store.getState();
    const aberto = container;
    let texto = '';
    let fechaAberto = false;
    if (sel.kind === 'block') {
      const b = findSection(antes, sel.ref)?.blocks.find((x) => x.id === sel.ref.blockId);
      texto = `bloco ${b ? TYPE_LABEL[b.type] ?? b.type : ''}`.trim();
      d.deleteBlock(sel.ref);
    } else if (sel.kind === 'section') {
      const n = findSection(antes, sel.ref)?.blocks.length ?? 0;
      texto = n ? `seção com ${n} ${n === 1 ? 'bloco' : 'blocos'}` : 'seção vazia';
      d.deleteSection(sel.ref.container, sel.ref.sectionId);
    } else if (sel.kind === 'item') {
      const it = antes.collections[sel.collection].find((x) => x.id === sel.itemId);
      const nome = it ? pick('title' in it ? it.title : 'caption' in it ? it.caption : it.image.alt, 'pt') : '';
      texto = `${COLL_NOME[sel.collection]}${nome ? ` “${nome}”` : ''}`;
      d.deleteItem(sel.collection, sel.itemId);
      fechaAberto = aberto.on === 'item' && aberto.itemId === sel.itemId;
    } else if (sel.kind === 'page') {
      const pg = antes.pages.find((p) => p.id === sel.pageId);
      texto = `página “${pg ? pick(pg.title, 'pt') || pg.slug : sel.pageId}”`;
      d.deletePage(sel.pageId);
      fechaAberto = aberto.on === 'page' && aberto.pageId === sel.pageId;
    } else return;
    const depois = d.store.getState();
    if (depois === antes) return; // nada mudou (ex.: página estrutural)
    if (fechaAberto) openContainer({ on: 'page', pageId: 'home' });
    setSelection(null);
    if (!aviso) return;
    const voltar = fechaAberto ? aberto : undefined;
    const id = mostrarAviso(`Excluído: ${texto}`, {
      duracaoMs: 10000,
      acao: {
        rotulo: 'Desfazer',
        fazer: () => {
          if (docRef.current.store.getState() !== depois) return;
          desfazer();
          if (voltar) openContainer(voltar);
        },
      },
    });
    setExclusao({ aviso: id, depois });
  };

  /** Cola o conteúdo da área de transferência perto da seleção atual (sempre com ids novos). */
  const pasteClip = (clip: Clip): void => {
    const d = docRef.current;
    if (clip.kind === 'item') {
      const it = renewItemIds(structuredClone(clip.item), clip.coll);
      const after = selection?.kind === 'item' && selection.collection === clip.coll ? selection.itemId : clip.item.id;
      d.insertItem(clip.coll, it, after);
      setSelection({ kind: 'item', collection: clip.coll, itemId: it.id });
      return;
    }
    const secs = getSections(d.state, container) ?? [];
    const selSec = selection && (selection.kind === 'block' || selection.kind === 'section') && sameContainer(selection.ref.container, container) ? selection.ref.sectionId : undefined;
    if (clip.kind === 'section') {
      const s = structuredClone(clip.section);
      renewSectionIds(s);
      const i = selSec ? secs.findIndex((x) => x.id === selSec) + 1 : secs.length;
      d.insertSection(container, s, i);
      setSelection({ kind: 'section', ref: { container, sectionId: s.id } });
      return;
    }
    const b = structuredClone(clip.block);
    b.id = newBlockId();
    const sectionId = d.transacao(() => {
      const sid = selSec ?? secs[secs.length - 1]?.id ?? d.addSection(container);
      if (!sid) return null;
      if (selection?.kind === 'block' && sameContainer(selection.ref.container, container)) d.insertBelow(selection.ref, b);
      else d.insertBlock({ container, sectionId: sid }, b);
      return sid;
    });
    if (sectionId) setSelection({ kind: 'block', ref: { container, sectionId, blockId: b.id } });
  };

  // Atalhos: um único listener que sempre lê o estado mais recente (sem re-registrar a cada render).
  const onKeyRef = useRef<(e: KeyboardEvent) => void>(() => {});
  onKeyRef.current = (e: KeyboardEvent): void => {
    const t = e.target as HTMLElement | null;
    // Digitando/escolhendo num campo: os atalhos de texto são do próprio campo.
    const typing = !!t?.closest?.('input, textarea, select, [contenteditable="true"]');
    const mod = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();
    // Popup "adicionar bloco" / recortador abertos: só o Esc (fechar) importa aqui.
    if (addMenu || cropping) {
      if (e.key === 'Escape') setAddMenu(null);
      return;
    }
    // Gaveta aberta (tela estreita): o Esc fecha a gaveta antes de mexer na seleção.
    if (gaveta && e.key === 'Escape' && !typing) {
      setGaveta(null);
      return;
    }
    // Diálogo aberto (Versões, senha NDA): o teclado é dele. Sem isso, um Delete
    // ou Ctrl+Z com o diálogo na frente apagava/desfazia no documento por trás.
    if (document.querySelector('.modal-backdrop')) return;
    if (mod && key === 's') {
      // Ctrl+S: baixa o backup (o rascunho já é salvo sozinho no navegador).
      e.preventDefault();
      backupRef.current?.();
      return;
    }
    if (mod && key === 'z') {
      if (typing) return; // undo nativo do campo
      e.preventDefault();
      if (e.shiftKey) refazer();
      else desfazer();
      return;
    }
    if (mod && key === 'y') {
      if (typing) return;
      e.preventDefault();
      refazer();
      return;
    }
    // Alt+↑ / Alt+↓: move o selecionado (bloco, seção ou item) uma posição —
    // o jeito de reordenar sem mouse nem arrasto, como "mover linha" nos editores.
    if (e.altKey && !mod && (e.key === 'ArrowUp' || e.key === 'ArrowDown') && !typing && selection) {
      e.preventDefault();
      const dir = e.key === 'ArrowUp' ? -1 : 1;
      if (selection.kind === 'block') doc.moveBlock(selection.ref, dir);
      else if (selection.kind === 'section') {
        const secs = getSections(doc.state, selection.ref.container) ?? [];
        const i = secs.findIndex((s) => s.id === selection.ref.sectionId);
        if (i >= 0 && i + dir >= 0 && i + dir < secs.length) doc.reorderSections(selection.ref.container, i, i + dir);
      } else if (selection.kind === 'item') {
        const lista = doc.state.collections[selection.collection];
        const i = lista.findIndex((x) => x.id === selection.itemId);
        if (i >= 0 && i + dir >= 0 && i + dir < lista.length) doc.reorderItems(selection.collection, i, i + dir);
      }
      return;
    }
    // Duplicar (Ctrl+D): igual para bloco, seção e item — a cópia entra logo abaixo/depois.
    if (mod && key === 'd' && !typing && selection) {
      e.preventDefault();
      if (selection.kind === 'block') {
        const created = doc.duplicateBlock(selection.ref);
        if (created) setSelection({ kind: 'block', ref: created });
      } else {
        const clip = copySelection(doc.state, selection);
        if (clip) pasteClip(clip);
      }
      return;
    }
    // Copiar / recortar / colar / excluir: iguais para bloco, seção e item de coleção.
    if (mod && (key === 'c' || key === 'x') && !typing && selection) {
      const clip = copySelection(doc.state, selection);
      if (!clip) return;
      e.preventDefault();
      clipboard.current = clip;
      if (key === 'x') removeSelection(selection, false);
      return;
    }
    if (mod && key === 'v' && !typing && clipboard.current) {
      e.preventDefault();
      pasteClip(clipboard.current);
      return;
    }
    if (!typing && (e.key === 'Delete' || e.key === 'Backspace') && selection && selection.kind !== 'site' && selection.kind !== 'page') {
      e.preventDefault();
      removeSelection(selection);
      return;
    }
    if (e.key === 'Escape' && !typing) setSelection((s) => parentOf(s));
  };
  useEffect(() => {
    const onKey = (ev: KeyboardEvent): void => onKeyRef.current(ev);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const onCanvasClick = useCallback(
    (e: React.MouseEvent): void => {
      const el = e.target as HTMLElement;
      if (el.closest('.inline-edit')) return; // deixa o cursor/seleção do editável em paz
      const stop = (): void => {
        e.preventDefault();
        e.stopPropagation();
      };
      const d = docRef.current;
      const setImg = (img: { assetId?: string; url?: string }, aid: string): void => {
        img.assetId = aid;
        img.url = undefined;
      };

      // Ícones de ação no hover (editar / trocar imagem / excluir).
      const actBtn = el.closest('[data-act]');
      const actBox = actBtn?.closest('.pe-actions');
      if (actBtn && actBox) {
        stop();
        const act = actBtn.getAttribute('data-act');
        const target = actBox.getAttribute('data-target');
        const id = actBox.getAttribute('data-id')!;
        if (target === 'block') {
          const ref = locateBlock(d.state, container, id);
          if (!ref) return;
          if (act === 'delete') {
            removeSelection({ kind: 'block', ref });
          } else {
            setSelection({ kind: 'block', ref });
            if (act === 'image') pickImage((aid) => docRef.current.updateBlock(ref, (b) => void (b.type === 'image' && setImg(b.content.image, aid))));
            if (act === 'crop') {
              const blk = findSection(d.state, ref)?.blocks.find((x) => x.id === ref.blockId);
              if (blk?.type === 'image') setCropping({ image: blk.content.image, apply: (c) => docRef.current.updateBlock(ref, (b) => void (b.type === 'image' && (b.content.image.crop = c))) });
            }
          }
        } else if (target === 'item') {
          const coll = actBox.getAttribute('data-coll') as CollectionName;
          if (act === 'delete') {
            removeSelection({ kind: 'item', collection: coll, itemId: id });
          } else if (act === 'edit') {
            setSelection({ kind: 'item', collection: coll, itemId: id });
          } else if (act === 'crop') {
            const it = d.state.collections[coll].find((x) => x.id === id);
            if (it) {
              const isThumb = 'thumb' in it;
              setCropping({
                image: isThumb ? (it as { thumb: ImageRef }).thumb : (it as { image: ImageRef }).image,
                lock: isThumb ? 16 / 9 : undefined, // capas de card são sempre 16:9
                apply: (c) => docRef.current.updateItem(coll, id, (x) => { const img = 'thumb' in x ? x.thumb : x.image; img.crop = c; }),
              });
            }
          } else if (act === 'image') {
            pickImage((aid) =>
              docRef.current.updateItem(coll, id, (it) => {
                if ('thumb' in it) setImg(it.thumb, aid);
                else setImg(it.image, aid);
              }),
            );
          }
        } else if (target === 'pv') {
          const project = actBox.getAttribute('data-project')!;
          editPreview(project, (pv) => { pv.items = pv.items.filter((x) => x.ref !== id); });
        } else if (target === 'header') {
          const el = id as HeaderElement;
          if (act === 'hide') {
            d.updateSite((st) => {
              const h = (st.header ??= structuredClone(DEFAULT_HEADER));
              const hid = new Set(h.hidden ?? []);
              if (hid.has(el)) hid.delete(el);
              else hid.add(el);
              h.hidden = [...hid];
            });
          }
          setSelection({ kind: 'site' });
        } else if (target === 'frame') {
          const ref = locateBlock(d.state, container, id);
          const idx = Number(actBox.getAttribute('data-idx'));
          if (!ref) return;
          if (act === 'edit') {
            // Mesmo destino do ✎ de uma imagem: os campos daquele elemento — aqui,
            // a lista de quadros do bloco com este em foco.
            setSelection({ kind: 'block', ref });
            setQuadroEmFoco({ blockId: ref.blockId, idx });
            return;
          }
          if (act === 'delete') d.updateBlock(ref, (b) => void (b.type === 'storyboard' && b.content.frames.splice(idx, 1)));
          else if (act === 'crop') {
            const blk = findSection(d.state, ref)?.blocks.find((x) => x.id === ref.blockId);
            const f = blk?.type === 'storyboard' ? blk.content.frames[idx] : undefined;
            if (f) setCropping({ image: f, apply: (c) => docRef.current.updateBlock(ref, (b) => { const fr = b.type === 'storyboard' ? b.content.frames[idx] : undefined; if (fr) fr.crop = c; }) });
          } else pickImage((aid) => docRef.current.updateBlock(ref, (b) => { const f = b.type === 'storyboard' ? b.content.frames[idx] : undefined; if (f) setImg(f, aid); }));
        }
        return;
      }

      // Tiles de "adicionar" dentro de blocos (galeria/sketches/storyboard/imagem vazia).
      const itemAdd = el.closest('[data-item-add]');
      if (itemAdd) {
        stop();
        const coll = itemAdd.getAttribute('data-item-add') as 'gallery' | 'sketches';
        pickImage((aid) => {
          const nid = docRef.current.addItem(coll);
          docRef.current.updateItem(coll, nid, (it) => setImg(it.image, aid));
        });
        return;
      }
      const frameAdd = el.closest('[data-frame-add]');
      if (frameAdd) {
        stop();
        const ref = locateBlock(d.state, container, frameAdd.getAttribute('data-frame-add')!);
        if (ref) pickImage((aid) => docRef.current.updateBlock(ref, (b) => void (b.type === 'storyboard' && b.content.frames.push({ assetId: aid, alt: emptyI18n() }))));
        return;
      }
      const blockUpload = el.closest('[data-block-upload]');
      if (blockUpload) {
        stop();
        const ref = locateBlock(d.state, container, blockUpload.getAttribute('data-block-upload')!);
        if (ref) {
          setSelection({ kind: 'block', ref });
          pickImage((aid) => docRef.current.updateBlock(ref, (b) => void (b.type === 'image' && setImg(b.content.image, aid))));
        }
        return;
      }

      // Menu do site: troca de página.
      const navEl = el.closest('[data-nav-page]');
      if (navEl) {
        stop();
        openContainer({ on: 'page', pageId: navEl.getAttribute('data-nav-page')! });
        return;
      }

      // Imagem da galeria/sketch: seleciona o próprio item (recortar, copiar, excluir, inspector).
      const imgItem = el.closest('[data-item-coll="gallery"], [data-item-coll="sketches"]');
      if (imgItem) {
        stop();
        setSelection({ kind: 'item', collection: imgItem.getAttribute('data-item-coll') as CollectionName, itemId: imgItem.getAttribute('data-item-id')! });
        return;
      }

      // Cards de projeto/nota, prévia e filtros: deixa o próprio componente agir (abrir prévia / página).
      if (el.closest('.project-card, .blog-item, .home-preview, .project-filter')) return;

      const addBtn = el.closest('[data-add-block]');
      if (addBtn) {
        e.preventDefault();
        e.stopPropagation();
        const sectionId = addBtn.getAttribute('data-add-block')!;
        const r = addBtn.getBoundingClientRect();
        setAddMenu({ sectionId, x: r.left + r.width / 2, y: r.bottom });
        return;
      }
      if (el.closest('[data-site-header]')) {
        e.preventDefault();
        setSelection({ kind: 'site' });
        return;
      }
      const blockEl = el.closest('[data-block-id]');
      if (blockEl) {
        e.preventDefault();
        e.stopPropagation();
        const ref = locateBlock(doc.state, container, blockEl.getAttribute('data-block-id')!);
        if (ref) setSelection({ kind: 'block', ref });
        return;
      }
      const secEl = el.closest('[data-section-id]');
      if (secEl) {
        e.preventDefault();
        setSelection({ kind: 'section', ref: { container, sectionId: secEl.getAttribute('data-section-id')! } });
      }
    },
    [doc.state, container, openContainer, pickImage],
  );

  // ------------------------------------------------------------ arrastar e soltar
  // Fontes: bloco (alça ⠿), elemento novo (paleta), item de coleção, quadro de storyboard.
  const marked = useRef<HTMLElement | null>(null);
  const mark = (el: HTMLElement | null, zone?: string): void => {
    if (marked.current && marked.current !== el) marked.current.removeAttribute('data-drop');
    marked.current = el;
    if (el && zone) el.setAttribute('data-drop', zone);
  };
  const dropTarget = (e: React.DragEvent): { el: HTMLElement; zone: string } | null => {
    const src = drag.current;
    const t = e.target as HTMLElement;
    if (!src) return null;
    if (src.kind === 'item') {
      const el = t.closest<HTMLElement>(`[data-item-coll="${src.coll}"]`);
      return el && el.getAttribute('data-item-id') !== src.id ? { el, zone: 'swap' } : null;
    }
    if (src.kind === 'pv') {
      const el = t.closest<HTMLElement>(`[data-pv-of="${src.project}"][data-pv-cell]`);
      if (!el || el.getAttribute('data-pv-cell') === src.ref) return null;
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      return { el, zone: x < 0.25 ? 'left' : x > 0.75 ? 'right' : (e.clientY - r.top) / r.height < 0.5 ? 'top' : 'bottom' };
    }
    if (src.kind === 'nav') {
      const el = t.closest<HTMLElement>('[data-nav-drag]');
      return el && el.getAttribute('data-nav-drag') !== src.pageId ? { el, zone: 'swap' } : null;
    }
    if (src.kind === 'header') {
      const el = t.closest<HTMLElement>('[data-header-el]');
      if (!el || el.getAttribute('data-header-el') === src.el) return null;
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      return { el, zone: x < 0.25 ? 'left' : x > 0.75 ? 'right' : (e.clientY - r.top) / r.height < 0.5 ? 'top' : 'bottom' };
    }
    if (src.kind === 'frame') {
      const el = t.closest<HTMLElement>(`[data-frame-block="${src.blockId}"]`);
      return el && Number(el.getAttribute('data-frame-idx')) !== src.idx ? { el, zone: 'swap' } : null;
    }
    const add = t.closest<HTMLElement>('[data-add-block]');
    if (add) return { el: add, zone: 'end' };
    const el = t.closest<HTMLElement>('[data-block-id]');
    if (!el || (src.kind === 'block' && el.getAttribute('data-block-id') === src.id)) return null;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    const zone: DropZone = x < 0.25 ? 'left' : x > 0.75 ? 'right' : y < 0.5 ? 'top' : 'bottom';
    return { el, zone };
  };

  const onCanvasDragStart = useCallback((e: React.DragEvent): void => {
    const t = e.target as HTMLElement;
    const h = t.closest('[data-drag-block]');
    const frame = t.closest('[data-frame-idx]');
    const it = t.closest('[data-item-id]');
    const pvEl = t.closest('[data-pv-cell]');
    const navEl = t.closest('[data-nav-drag]');
    const hdrEl = t.closest('[data-header-el]');
    if (pvEl) drag.current = { kind: 'pv', project: pvEl.getAttribute('data-pv-of')!, ref: pvEl.getAttribute('data-pv-cell')! };
    else if (navEl) drag.current = { kind: 'nav', pageId: navEl.getAttribute('data-nav-drag')! };
    else if (hdrEl) drag.current = { kind: 'header', el: hdrEl.getAttribute('data-header-el') as HeaderElement };
    else if (h) drag.current = { kind: 'block', id: h.getAttribute('data-drag-block')! };
    else if (frame) drag.current = { kind: 'frame', blockId: frame.getAttribute('data-frame-block')!, idx: Number(frame.getAttribute('data-frame-idx')) };
    else if (it) drag.current = { kind: 'item', coll: it.getAttribute('data-item-coll') as CollectionName, id: it.getAttribute('data-item-id')! };
    else return;
    setDragging(true);
    e.stopPropagation();
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', 'pe'); } catch { /* ignore */ }
  }, []);
  /**
   * Rolagem automática enquanto arrasta.
   *
   * Numa página longa só dava para soltar no que já estava na tela: levar um
   * elemento do topo para o fim era impossível pelo arrasto, porque o canvas
   * não acompanhava o ponteiro. Aqui, chegando perto da borda de cima ou de
   * baixo, a área do canvas rola sozinha — mais rápido quanto mais perto da
   * borda. Precisa de um laço próprio: parado na borda, o navegador deixa de
   * disparar "dragover".
   */
  const autoScroll = useRef<{ vel: number; raf: number | null }>({ vel: 0, raf: null });
  const pararAutoScroll = useCallback(() => {
    if (autoScroll.current.raf !== null) cancelAnimationFrame(autoScroll.current.raf);
    autoScroll.current = { vel: 0, raf: null };
  }, []);
  const ajustarAutoScroll = useCallback((clientY: number) => {
    const area = document.querySelector<HTMLElement>('.editor-canvas-wrap');
    if (!area) return;
    const r = area.getBoundingClientRect();
    const margem = 70; // faixa sensível junto de cada borda
    const acima = clientY - r.top;
    const abaixo = r.bottom - clientY;
    let vel = 0;
    if (acima < margem) vel = -Math.ceil(((margem - acima) / margem) * 22);
    else if (abaixo < margem) vel = Math.ceil(((margem - abaixo) / margem) * 22);
    autoScroll.current.vel = vel;
    if (vel === 0) return pararAutoScroll();
    if (autoScroll.current.raf !== null) return;
    const passo = (): void => {
      const v = autoScroll.current.vel;
      if (!v) return pararAutoScroll();
      area.scrollTop += v;
      autoScroll.current.raf = requestAnimationFrame(passo);
    };
    autoScroll.current.raf = requestAnimationFrame(passo);
  }, [pararAutoScroll]);

  const onCanvasDragOver = (e: React.DragEvent): void => {
    ajustarAutoScroll(e.clientY);
    const hit = dropTarget(e);
    if (!hit) return mark(null);
    e.preventDefault();
    e.dataTransfer.dropEffect = drag.current?.kind === 'new' ? 'copy' : 'move';
    mark(hit.el, hit.zone);
  };
  const onCanvasDrop = (e: React.DragEvent): void => {
    pararAutoScroll();
    const hit = dropTarget(e);
    const src = drag.current;
    drag.current = null;
    setDragging(false);
    mark(null);
    if (!hit || !src) return;
    e.preventDefault();
    const d = docRef.current;
    if (src.kind === 'item') {
      const ids = d.state.collections[src.coll].map((x) => x.id);
      d.reorderItems(src.coll, ids.indexOf(src.id), ids.indexOf(hit.el.getAttribute('data-item-id')!));
      return;
    }
    if (src.kind === 'pv') {
      const to = hit.el.getAttribute('data-pv-cell')!;
      editPreview(src.project, (pv) => {
        const cells = pv.items.map((x) => ({ id: x.ref, span: x.span }));
        const moving = detachBlock(cells, src.ref);
        if (!moving) return;
        placeBlock(cells, moving, to, hit.zone as DropZone);
        pv.items = cells.map((c) => ({ ref: c.id, span: c.span }));
      });
      return;
    }
    if (src.kind === 'nav') {
      const to = hit.el.getAttribute('data-nav-drag')!;
      d.updateSite((st) => reorderArray(st.nav, st.nav.indexOf(src.pageId), st.nav.indexOf(to)));
      return;
    }
    if (src.kind === 'header') {
      const to = hit.el.getAttribute('data-header-el') as HeaderElement;
      // Mesmo sistema de grade das seções: lateral = mesma linha, topo/base = linha própria.
      d.updateSite((st) => {
        const h = (st.header ??= structuredClone(DEFAULT_HEADER));
        const cells = h.order.map((id) => ({ id, span: headerSpan(h, id) }));
        const moving = detachBlock(cells, src.el);
        if (!moving) return;
        placeBlock(cells, moving, to, hit.zone as DropZone);
        h.layout = 'grid';
        h.order = cells.map((c) => c.id as HeaderElement);
        h.spans = Object.fromEntries(cells.map((c) => [c.id, c.span]));
      });
      return;
    }
    if (src.kind === 'frame') {
      const ref = locateBlock(d.state, container, src.blockId);
      const to = Number(hit.el.getAttribute('data-frame-idx'));
      if (ref) d.updateBlock(ref, (b) => void (b.type === 'storyboard' && reorderArray(b.content.frames, src.idx, to)));
      return;
    }
    const source = src.kind === 'new' ? makeDefaultBlock(src.type) : src.id;
    const newId = typeof source === 'string' ? source : source.id;
    if (hit.zone === 'end') {
      // Página vazia: o alvo não tem seção ainda (data-add-block=""); a seção nasce junto (um passo só).
      d.transacao(() => {
        const sid = hit.el.getAttribute('data-add-block') || d.addSection(container);
        if (sid) d.dropBlockInSection(container, source, sid);
      });
    }
    else d.dropBlock(container, source, hit.el.getAttribute('data-block-id')!, hit.zone as DropZone);
    const ref = locateBlock(docRef.current.store.getState(), container, newId);
    if (ref) {
      setSelection({ kind: 'block', ref });
      if (src.kind === 'new' && src.type === 'image') pickImage((aid) => docRef.current.updateBlock(ref, (b) => { if (b.type === 'image') { b.content.image.assetId = aid; b.content.image.url = undefined; } }));
    }
  };
  const onDragEnd = (): void => {
    pararAutoScroll();
    drag.current = null;
    setDragging(false);
    mark(null);
  };

  const ctx: RenderContextValue = useMemo(
    () => ({
      data: doc.state,
      lang,
      resolveAsset,
      editing: true,
      posterEmbeds: true,
      selectedId,
      onNavigate: navigate,
      selectedItemId: selection?.kind === 'item' ? selection.itemId : undefined,
      onEditPreview: editPreview,
      // Redimensionar vale só para a TELA que está selecionada no topo: mexer
      // com o celular aberto não mexe no computador, e vice-versa.
      onSetHeaderSpan: (el, span) => {
        docRef.current.updateSite((st) => {
          const h = (st.header ??= structuredClone(DEFAULT_HEADER));
          h.layout = 'grid';
          if (device === 'tablet') h.spansTablet = { ...(h.spansTablet ?? {}), [el]: span };
          else if (device === 'mobile') h.spansMobile = { ...(h.spansMobile ?? {}), [el]: span };
          else h.spans = { ...(h.spans ?? DEFAULT_HEADER.spans), [el]: span };
        }, `hspan:${device}:${el}`);
      },
      onSetItemSpan: (target, span) => {
        const d = docRef.current;
        const campo = device === 'tablet' ? 'widthTablet' : device === 'mobile' ? 'widthMobile' : 'width';
        if ('coll' in target) {
          d.updateItem(target.coll, target.id, (it) => void ((it as Record<string, unknown>)[campo] = span), `ispan:${device}:${target.id}`);
          return;
        }
        const ref = locateBlock(d.state, container, target.blockId);
        const campoQuadro = device === 'tablet' ? 'spanTablet' : device === 'mobile' ? 'spanMobile' : 'span';
        if (ref) d.updateBlock(ref, (b) => { const f = b.type === 'storyboard' ? b.content.frames[target.frame] : undefined; if (f) (f as Record<string, unknown>)[campoQuadro] = span; }, `fspan:${device}:${target.blockId}:${target.frame}`);
      },
      onSetSpan: (blockId: string, span: number) => {
        const d = docRef.current;
        const ref = locateBlock(d.state, container, blockId);
        if (!ref) return;
        if (device === 'desktop') {
          d.setBlockSpan(ref, span, `span:${blockId}`);
          return;
        }
        const tela = device === 'tablet' ? 'tablet' : 'mobile';
        d.updateBlock(ref, (b) => void ((b.responsive ??= {})[tela] = { ...(b.responsive[tela] ?? {}), span }), `span:${device}:${blockId}`);
      },
      device,
      onInlineText: (blockId: string, value: string, kind: 'text' | 'heading') => {
        const d = docRef.current;
        const ref = locateBlock(d.state, container, blockId);
        if (!ref) return;
        d.updateBlock(
          ref,
          (b) => {
            if (kind === 'text' && b.type === 'text') b.content.html[lang] = sanitizeInlineHtml(value);
            else if (kind === 'heading' && b.type === 'heading') b.content.text[lang] = sanitizeInlineHtml(value).replace(/^<p>([\s\S]*)<\/p>$/, '$1');
          },
          `inline:${blockId}:${lang}`,
        );
      },
    }),
    [doc.state, container, lang, resolveAsset, selectedId, navigate, selection, editPreview, device],
  );

  // Onde estou: com um projeto/nota aberto, a trilha mostra a página de origem
  // e volta para ela num clique.
  const itemAberto = container.on === 'item' ? doc.state.collections[container.collection].find((i) => i.id === container.itemId) : undefined;
  const colecaoAberta = container.on === 'item' ? container.collection : undefined;
  // A página de origem é a que LISTA a coleção — a Home também mostra projetos
  // (os em destaque), então ela só vale como último recurso.
  const listamColecao = colecaoAberta
    ? doc.state.pages.filter((p) => p.sections.some((s) => s.blocks.some((b) => b.type === 'collection' && b.content.collection === colecaoAberta)))
    : [];
  const paginaDeOrigem = listamColecao.find((p) => p.id !== 'home') ?? listamColecao[0];
  const trilha = itemAberto
    ? {
        pai: paginaDeOrigem ? pick(paginaDeOrigem.title, lang) : colecaoAberta === 'projects' ? 'Projetos' : 'Notas',
        atual: pick(itemAberto.title, lang) || 'Sem título',
        voltar: () => openContainer({ on: 'page', pageId: paginaDeOrigem?.id ?? 'home' }),
      }
    : undefined;

  const frame = siteFrame(doc.state, resolveAsset);
  return (
    <AvisosContext.Provider value={avisos.api}>
    <RemoverContext.Provider value={removeSelection}>
    <div className="editor" style={styleVars(themeToCssVars(doc.state.theme))}>
      <TopBar doc={doc} peso={peso} onPeso={() => { setLeftTab('data'); setGaveta('esquerda'); }} onUndo={desfazer} onRedo={refazer} avisoHistorico={avisoHistorico} lang={lang} onLang={setLang} pageTitle={pick(page.title, lang)} trilha={trilha} saveStatus={saveStatus} assets={assets} onImport={onImport} onPublished={setPublishNotice} device={device} onDevice={setDevice} onBackupRef={backupRef} onBackup={() => setProtecao(null)} onVersions={() => setShowVersions(true)} />
      {erroGravacao ? (
        <div className="editor-notice editor-alerta" role="alert">
          <span><b>Não estou conseguindo salvar neste navegador.</b> {erroGravacao} O que está aberto continua aqui — baixe um backup para não perder.</span>
          <button type="button" className="editor-alerta-acao" onClick={() => backupRef.current?.()}>Baixar backup</button>
        </div>
      ) : null}
      {protecao ? (
        <div className="editor-notice editor-alerta editor-protecao" role="status">
          <span>{protecao}</span>
          <button type="button" className="editor-alerta-acao" onClick={() => backupRef.current?.()}>Baixar backup</button>
          <button type="button" onClick={() => { protecaoDispensada = true; setProtecao(null); }} aria-label="Fechar aviso">✕</button>
        </div>
      ) : null}
      {outraAba ? (
        <div className="editor-notice editor-alerta" role="alert">
          <span><b>O editor também está aberto em outra aba.</b> As duas gravam no mesmo lugar: a última a salvar apaga o que a outra fez. Feche uma delas.</span>
        </div>
      ) : null}
      {notice && showNotice ? (
        <div className="editor-notice" role="status">
          <span>{notice}</span>
          <button type="button" onClick={() => setShowNotice(false)} aria-label="Fechar aviso">✕</button>
        </div>
      ) : null}
      {/* Leitor de tela: diz o que acabou de ser selecionado (no canvas, nas Layers ou pelo teclado). */}
      <div className="sr-only" aria-live="polite">{selection ? `Selecionado: ${descreverSelecao(doc.state, selection)}` : ''}</div>
      {publishNotice ? <AvisoPublicado p={publishNotice} onClose={() => setPublishNotice(null)} /> : null}
      {/* Só em tela estreita (CSS): abre os painéis, que viram gavetas por cima do canvas. */}
      <div className="editor-gavetas" role="region" aria-label="Abrir painéis">
        <button type="button" className={gaveta === 'esquerda' ? 'on' : ''} aria-expanded={gaveta === 'esquerda'} onClick={() => setGaveta((g) => (g === 'esquerda' ? null : 'esquerda'))}>
          ☰ Páginas e painéis
        </button>
        <button type="button" className={gaveta === 'direita' ? 'on' : ''} aria-expanded={gaveta === 'direita'} onClick={() => setGaveta((g) => (g === 'direita' ? null : 'direita'))}>
          ✎ Editar{selection ? ` · ${rotuloDaSelecao(doc.state, selection)}` : ''}
        </button>
      </div>
      <div className={`editor-main${gaveta ? ` gaveta-${gaveta}` : ''}`}>
        {gaveta ? <button type="button" className="editor-scrim" aria-label="Fechar painel" onClick={() => setGaveta(null)} /> : null}
        <aside className="editor-left" aria-label="Painéis: páginas, camadas, tema e dados">
          <button type="button" className="gaveta-fechar" aria-label="Fechar painel" onClick={() => setGaveta(null)}>✕</button>
          <div className="left-tabs">
            <button type="button" className={leftTab === 'pages' ? 'active' : ''} onClick={() => setLeftTab('pages')}>Páginas</button>
            <button type="button" className={leftTab === 'layers' ? 'active' : ''} onClick={() => setLeftTab('layers')}>Layers</button>
            <button type="button" className={leftTab === 'theme' ? 'active' : ''} onClick={() => setLeftTab('theme')}>Tema</button>
            <button type="button" className={leftTab === 'data' ? 'active' : ''} onClick={() => setLeftTab('data')}>Dados</button>
          </div>
          {leftTab === 'pages' ? (
            <PagesPanel doc={doc} container={container} lang={lang} onOpen={openContainer} onSelect={setSelection} />
          ) : leftTab === 'theme' ? (
            <ThemePanel doc={doc} onUploadImage={uploadImage} onUploadFavicon={uploadFavicon} resolveAsset={resolveAsset} />
          ) : leftTab === 'data' ? (
            <DataPanel doc={doc} onSelect={abrirItem} peso={peso} assets={assets} semDescricao={semDescricao} resolver={resolveAsset} onIrPara={irParaDescricao} semTraducao={semTraducao} onTraduzir={irParaTraducao} sync={persist ? { config: syncConfig, status: sync.status, onConfig: setSyncConfig, enviarAgora: sync.enviarAgora } : undefined} />
          ) : (
            <LayersPanel doc={doc} page={page} item={item} lang={lang} selection={selection} onSelect={setSelection} />
          )}
          {leftTab === 'pages' || leftTab === 'layers' ? (
            <ElementsPalette onAdd={addElement} onAddSection={addSectionPreset} onDragStart={(type) => { drag.current = { kind: 'new', type }; setDragging(true); }} onDragEnd={onDragEnd} />
          ) : null}
        </aside>

        {/* O arrasto é ouvido NA ÁREA QUE ROLA: parado na borda de baixo, o
            ponteiro já saiu do canvas, e sem isso a rolagem automática nunca
            entraria em ação justamente onde ela é necessária. */}
        {/* Região principal do editor: o canvas. A prévia do site dentro dele não
            tem <main> próprio (não pode haver dois) e o cabeçalho do site não
            conta como um segundo "banner" para o leitor de tela. */}
        <main className="editor-canvas-wrap" aria-label="Canvas: prévia do site" onDragOver={(ev) => ajustarAutoScroll(ev.clientY)} onDrop={pararAutoScroll} onDragLeave={(ev) => {
            // Junto da borda o navegador dispara "leave" a toda hora, mesmo com o
            // ponteiro dentro (ele troca de elemento por baixo). Conferir pelo
            // PONTO, e não pelo elemento, evita matar a rolagem em curso.
            const r = (ev.currentTarget as HTMLElement).getBoundingClientRect();
            const dentro = ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom;
            if (!dentro) pararAutoScroll();
          }}>
          <div className={`editor-canvas pv-${device}${dragging ? ' dragging' : ''}`} onClickCapture={onCanvasClick} onDragStart={onCanvasDragStart} onDragOver={onCanvasDragOver} onDrop={onCanvasDrop} onDragEnd={onDragEnd} onDragLeave={(e) => { if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) mark(null); }}>
            <RenderContext.Provider value={ctx}>
              <div className={`site canvas-site${frame.className}`} style={styleVars(frame.vars)}>
                <SiteHeader data={doc.state} lang={lang} onLang={setLang} onNavigate={navigate} current={container.on === 'page' ? container.pageId : undefined} />
                <div className="container">
                  <PageView page={page} item={item} />
                </div>
              </div>
            </RenderContext.Provider>
          </div>
        </main>

        <aside className="editor-right" aria-label="Inspector: ajustes do que está selecionado">
          <button type="button" className="gaveta-fechar" aria-label="Fechar painel" onClick={() => setGaveta(null)}>✕</button>
          <Inspector doc={doc} selection={selection} onUploadImage={uploadImage} onSelect={setSelection} lang={lang} onLang={setLang} quadroEmFoco={quadroEmFoco} resolveAsset={resolveAsset} pedidoFoco={pedidoFoco} onFocoAtendido={focoAtendido} />
        </aside>
      </div>
      <FloatingToolbar fonts={doc.state.theme.fonts} colors={doc.state.theme.colors} />
      {avisos.ui}
      {addMenu ? (
        <AddBlockPopup
          x={addMenu.x}
          y={addMenu.y}
          onClose={() => setAddMenu(null)}
          onPick={(t) => {
            const block = makeDefaultBlock(t);
            // Página vazia: a seção nasce junto com o primeiro bloco (um passo de desfazer só).
            const sectionId = doc.transacao(() => {
              const sid = addMenu.sectionId || doc.addSection(container);
              if (sid) doc.insertBlock({ container, sectionId: sid }, block);
              return sid;
            });
            if (!sectionId) return;
            const ref = { container, sectionId };
            const bref = { ...ref, blockId: block.id };
            setSelection({ kind: 'block', ref: bref });
            setAddMenu(null);
            if (t === 'image') pickImage((aid) => docRef.current.updateBlock(bref, (b) => { if (b.type === 'image') { b.content.image.assetId = aid; b.content.image.url = undefined; } }));
          }}
        />
      ) : null}
      {showVersions ? (
        <VersionsModal
          doc={doc.state}
          onClose={() => setShowVersions(false)}
          onRestore={onImport ? (restored) => onImport({ format: 'portfolio-v4-backup', version: 1, savedAt: new Date().toISOString(), doc: restored, assets }) : undefined}
        />
      ) : null}
      {cropping ? (
        <CropModal
          src={resolveAsset(cropping.image)}
          initial={cropping.image.crop}
          lockRatio={cropping.lock}
          onApply={(c) => { cropping.apply(c); setCropping(null); }}
          onClose={() => setCropping(null)}
        />
      ) : null}
      <input ref={fileInput} type="file" accept="image/*" hidden onChange={onPickFile} data-testid="pe-file" />
    </div>
    </RemoverContext.Provider>
    </AvisosContext.Provider>
  );
}

const STATUS_LABEL: Record<SaveStatus, string> = { idle: 'Salvo localmente', saving: 'Salvando…', saved: 'Salvo neste navegador', error: 'Falha ao salvar' };

/** Ícones do seletor de tela: monitor, tablet e celular desenhados (os glifos
 *  de caixinha não se distinguiam). */
function DeviceIcon({ kind }: { kind: 'desktop' | 'tablet' | 'mobile' }): React.ReactElement {
  const p = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };
  if (kind === 'desktop') {
    return (
      <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
        <rect x="2" y="3.5" width="16" height="10.5" rx="1.2" {...p} />
        <path d="M7 17h6M10 14v3" {...p} />
      </svg>
    );
  }
  if (kind === 'tablet') {
    return (
      <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
        <rect x="4" y="2.5" width="12" height="15" rx="1.6" {...p} />
        <path d="M8.8 15.2h2.4" {...p} />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
      <rect x="6" y="2" width="8" height="16" rx="1.6" {...p} />
      <path d="M9 4.2h2M9.2 15.6h1.6" {...p} />
    </svg>
  );
}

const DEVICES = [
  { id: 'desktop', label: 'Computador', curto: 'Computador' },
  { id: 'tablet', label: 'Tablet (768px)', curto: 'Tablet' },
  { id: 'mobile', label: 'Celular (390px)', curto: 'Celular' },
] as const;

function TopBar({ doc, peso, onPeso, onUndo, onRedo, avisoHistorico, lang, onLang, pageTitle, trilha, saveStatus, assets, onImport, onPublished, device, onDevice, onBackupRef, onBackup, onVersions }: { doc: ReturnType<typeof useDocument>; peso: PesoDoSite; onPeso: () => void; onUndo: () => void; onRedo: () => void; avisoHistorico: string | null; lang: Lang; onLang: (l: Lang) => void; pageTitle: string; trilha?: { pai: string; atual: string; voltar: () => void }; saveStatus: SaveStatus; assets: Record<string, string>; onImport?: (b: Backup) => void; onPublished?: (p: Publicado | null) => void; device: 'desktop' | 'tablet' | 'mobile'; onDevice: (d: 'desktop' | 'tablet' | 'mobile') => void; onBackupRef?: { current: (() => void) | null }; onBackup?: () => void; onVersions?: () => void }): React.ReactElement {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pedirSenha, setPedirSenha] = useState(false);
  const dialogos = useAvisos();

  if (onBackupRef) onBackupRef.current = () => download();
  const download = (): void => {
    const backup = buildBackup(doc.state, assets);
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    baixarArquivo(blob, `portfolio-backup-${new Date().toISOString().slice(0, 10)}.json`);
    marcarBackup();
    onBackup?.();
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    let backup: Backup;
    try {
      backup = parseBackup(await file.text());
    } catch (err) {
      dialogos.avisar(explicarErroDeImportacao(err), { tipo: 'erro' });
      return;
    }
    // Importar troca o que está aberto (e o editor recomeça, sem desfazer):
    // confirma com o resumo do arquivo e guarda o estado atual como versão.
    const ok = await dialogos.confirmar({
      titulo: `Importar “${file.name}”?`,
      texto: `${resumoDoBackup(backup)}\n\nO que está aberto agora vira uma versão automática (Versões) antes da troca.`,
      confirmar: 'Importar',
      perigo: true,
    });
    if (!ok) return;
    if (!(await guardarAntesDeTrocar(`Antes de importar "${file.name}"`, doc.state, dialogos.confirmar))) return;
    onImport?.(backup);
  };

  // Quantos itens confidenciais vão cifrados (0 = nem pergunta a senha). Conta
  // o que o próprio publicSnapshot separa — antes esta conta era uma cópia à
  // mão da regra dele, que podia divergir. Calcula no clique: o snapshot copia
  // o documento inteiro, não é para rodar a cada tecla.
  const [itensNda, setItensNda] = useState(0);
  // O mesmo caminho (preflight, senha do NDA, ponto de retorno) serve aos dois
  // botões; só o último passo muda: baixar os arquivos ou gravá-los no GitHub.
  const destino = useRef<'baixar' | 'enviar'>('baixar');
  const [pedirToken, setPedirToken] = useState<{ erro?: string } | null>(null);
  const [enviandoSite, setEnviandoSite] = useState(false);
  const baixarSite = (): void => {
    destino.current = 'baixar';
    prepararSite();
  };
  const enviarAoPortfolio = (): void => {
    destino.current = 'enviar';
    if (!configSiteEfetiva()) return void setPedirToken({});
    prepararSite();
  };
  const prepararSite = (): void => {
    const n = ndaCount(publicSnapshot(doc.state).nda);
    setItensNda(n);
    if (!n) return void publishSite();
    // Senha escolhida uma vez: cifra direto (troca e esquece no painel Dados).
    const guardada = lerSenhaNda();
    if (guardada) void publishSite(guardada);
    else setPedirSenha(true);
  };

  // Uma falha ao gerar (cifrar o NDA, montar o arquivo) não pode ser silêncio:
  // o botão parecia simplesmente não fazer nada.
  const publishSite = (password?: string): Promise<void> =>
    gerarSite(password, destino.current).catch((err: unknown) => {
      dialogos.avisar(`Não consegui gerar o site: ${err instanceof Error ? err.message : String(err)}. Seu rascunho não foi afetado.`, { tipo: 'erro' });
    });
  const gerarSite = async (password: string | undefined, para: 'baixar' | 'enviar'): Promise<void> => {
    const doc0 = doc.state;
    const migratedAssets: MigratedAsset[] = Object.entries(assets).map(([id, dataUrl]) => ({ id, dataUrl, mime: '' }));
    // Miniaturas das imagens em grade: geradas aqui, no navegador (o canvas faz o trabalho).
    const payload = await buildPublishPayload({ data: doc0, assets: migratedAssets }, password, { miniatura: miniaturaDeDataUrl });
    // O que vai de fato para o site: com senha, o NDA vai junto (cifrado) e
    // também é conferido; sem senha, só o público.
    const vaiProSite = payload.ndaBlob ? doc0 : payload.publicData;
    const pf = runPreflight(vaiProSite, { assetSizes: payload.assetSizes });
    if (pf.errors.length && !(await dialogos.confirmar({
      titulo: pf.errors.length === 1 ? 'Um problema impede o site de ficar certo' : `${pf.errors.length} problemas impedem o site de ficar certo`,
      texto: pf.errors.join('\n'),
      confirmar: para === 'enviar' ? 'Enviar mesmo assim' : 'Baixar mesmo assim',
      cancelar: 'Voltar e corrigir',
      perigo: true,
    }))) return;
    // Toda publicação vira um ponto de retorno (automático) no histórico.
    void saveVersion(`Publicado em ${new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}`, doc0, true).catch(() => {});

    // Imagem de compartilhamento: vira um arquivo no tamanho do cartão das
    // redes, ao lado do index.html (com o endereço do site, dá para apontá-la).
    const social = imagemSocialEmbutida(payload.publicData);
    const fonteSocial = social?.assetId ? assets[social.assetId] : undefined;
    const jpg = fonteSocial && (payload.publicData.site.url ?? '').trim() ? await imagemDeCompartilhar(fonteSocial, social?.crop).catch(() => null) : null;
    if (jpg) payload.arquivoSocial = ARQUIVO_SOCIAL;

    const html = assembleSiteHtml(siteShell, payload);
    const blob = new Blob([html], { type: 'text/html' });
    if (para === 'enviar') return enviarAoSite(html, jpg, arquivosAoLado(vaiProSite), pf.warnings);
    // Os arquivos relativos já aparecem na lista própria do aviso: não repetem nos avisos.
    const arquivos = [...arquivosAoLado(vaiProSite), ...(jpg ? [ARQUIVO_SOCIAL] : [])];
    const avisos = pf.warnings.filter((w) => !arquivos.some((a) => w.includes(`"${a}"`)));
    onPublished?.({ arquivos, avisos, mb: blob.size / (1024 * 1024) });
    // index.html: é o arquivo que o GitHub Pages (e qualquer hospedagem) abre sozinho no endereço do site.
    baixarArquivo(blob, 'index.html');
    if (jpg) baixarArquivo(jpg, ARQUIVO_SOCIAL);
  };

  /** Último passo do "Enviar ao portfólio": grava o site gerado no repositório do GitHub Pages. */
  const enviarAoSite = async (html: string, jpg: Blob | null, aoLado: string[], avisosPf: string[]): Promise<void> => {
    const c = configSiteEfetiva();
    if (!c) return void setPedirToken({});
    const bytes = new TextEncoder().encode(html);
    const mb = (bytes.length / (1024 * 1024)).toFixed(1).replace('.', ',');
    const ok = await dialogos.confirmar({
      titulo: 'Enviar o site para o portfólio?',
      texto: `Grava o index.html (${mb} MB)${jpg ? ' e a imagem de compartilhar' : ''} na branch ${c.branch} de ${c.repo}. O site no ar é substituído e atualiza em cerca de 1 minuto.`,
      confirmar: 'Enviar',
    });
    if (!ok) return;
    setEnviandoSite(true);
    try {
      const arquivos: ArquivoSite[] = [{ path: 'index.html', bytes }];
      if (jpg) arquivos.push({ path: ARQUIVO_SOCIAL, bytes: new Uint8Array(await jpg.arrayBuffer()) });
      const r = await enviarSite(c, arquivos, `Site publicado pelo editor em ${new Date().toISOString()}`);
      // O que o site espera ao lado (cv.pdf…) tem de estar no repositório: só os que faltam merecem aviso.
      const faltam = await quaisFaltam(c, aoLado.filter((a) => a !== ARQUIVO_SOCIAL)).catch(() => [] as string[]);
      const presentes = [...aoLado.filter((a) => !faltam.includes(a)), ...(jpg ? [ARQUIVO_SOCIAL] : [])];
      const restantes = avisosPf.filter((w) => !presentes.some((a) => w.includes(`"${a}"`)));
      dialogos.avisar(
        r.enviados.length
          ? `Site enviado para ${c.repo} (${r.enviados.join(', ')}). Atualiza no ar em cerca de 1 minuto.`
          : 'O site no ar já está igual a este: nada a enviar.',
        { duracaoMs: 9000 },
      );
      const atencao = [...restantes, ...faltam.map((a) => `O site usa "${a}", que não está em ${c.repo}: suba esse arquivo lá.`)];
      if (atencao.length) dialogos.avisar(`Vale conferir: ${atencao.join(' ')}`, { duracaoMs: 15000 });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Token recusado ou sem acesso ao repositório: pede o token certo em vez de só falhar.
      if (/Token inválido|permissão de escrita|Repositório não encontrado/.test(msg)) setPedirToken({ erro: msg });
      else dialogos.avisar(`Não consegui enviar o site: ${msg}`, { tipo: 'erro' });
    } finally {
      setEnviandoSite(false);
    }
  };

  return (
    <header className="editor-topbar">
      <div className="tb-left">
        <strong>Portfolio</strong>
        {trilha ? (
          <span className="tb-page">
            <button type="button" className="tb-voltar" onClick={trilha.voltar} title="Voltar para a lista">← {trilha.pai}</button>
            <span className="tb-sep">›</span>
            {trilha.atual}
          </span>
        ) : (
          <span className="tb-page">{pageTitle}</span>
        )}
      </div>
      <div className="tb-center">
        <button type="button" disabled={!doc.canUndo} onClick={onUndo} title={doc.undoLabel ? `Desfazer: ${doc.undoLabel} (Ctrl+Z)` : 'Nada para desfazer'} aria-label={doc.undoLabel ? `Desfazer: ${doc.undoLabel}` : 'Desfazer'}>↶</button>
        <button type="button" disabled={!doc.canRedo} onClick={onRedo} title={doc.redoLabel ? `Refazer: ${doc.redoLabel} (Ctrl+Shift+Z)` : 'Nada para refazer'} aria-label={doc.redoLabel ? `Refazer: ${doc.redoLabel}` : 'Refazer'}>↷</button>
        <span className="tb-devices" role="group" aria-label="Ver em outra tela">
          {DEVICES.map((d) => (
            <button key={d.id} type="button" className={device === d.id ? 'on' : ''} aria-pressed={device === d.id} aria-label={`Ver como ${d.label}`} title={`Ver como ${d.label}`} onClick={() => onDevice(d.id)}>
              <DeviceIcon kind={d.id} />
            </button>
          ))}
        </span>
        {device !== 'desktop' ? (
          <button type="button" className="tb-device-back" onClick={() => onDevice('desktop')} title="Voltar para a largura de computador">
            {DEVICES.find((d) => d.id === device)!.curto} ✕
          </button>
        ) : null}
        <span className={`tb-status status-${saveStatus}`} title={saveStatus === 'error' ? 'Veja o aviso logo abaixo da barra' : undefined}>{STATUS_LABEL[saveStatus]}</span>
        <span className="tb-historico" role="status" aria-live="polite">{avisoHistorico ?? ''}</span>
      </div>
      <div className="tb-right">
        <div className="lang-toggle">
          <button type="button" className={lang === 'pt' ? 'on' : ''} onClick={() => onLang('pt')} title="Português"><LangFlag lang="pt" /> PT</button>
          <button type="button" className={lang === 'en' ? 'on' : ''} onClick={() => onLang('en')} title="English"><LangFlag lang="en" /> EN</button>
        </div>
        <button type="button" className="tb-btn" onClick={onVersions} title="Histórico de versões salvas neste navegador">Versões</button>
        <button type="button" className="tb-btn" onClick={download} title="Baixar backup (doc + imagens)">Backup</button>
        <button type="button" className="tb-btn" onClick={() => fileRef.current?.click()} title="Importar backup">Importar</button>
        <button type="button" className={`tb-peso${peso.total > LIMITE_GITHUB_BYTES ? ' acima' : peso.total > LIMITE_GITHUB_BYTES * 0.8 ? ' perto' : ''}`} onClick={onPeso} title="Peso estimado do index.html (limite do upload pelo GitHub: 25 MB). Clique para ver o que mais pesa.">≈ {formatarPeso(peso.total)}</button>
        <button type="button" className="tb-btn primary" onClick={baixarSite} title="Gera o index.html do site, pronto para subir no GitHub Pages">Baixar site</button>
        <button type="button" className="tb-btn primary" onClick={enviarAoPortfolio} disabled={enviandoSite} title="Gera o site e grava direto no repositório do GitHub Pages, sem baixar nem subir à mão">{enviandoSite ? 'Enviando…' : 'Enviar ao portfólio'}</button>
        {pedirToken ? (
          <EnviarSiteModal
            inicial={configSiteEfetiva() ?? { repo: REPO_DO_SITE_PADRAO, token: '', branch: BRANCH_PADRAO }}
            erro={pedirToken.erro}
            onCancel={() => setPedirToken(null)}
            onConfirm={(c) => { gravarConfigSite(c); setPedirToken(null); prepararSite(); }}
          />
        ) : null}
        {pedirSenha ? (
          <NdaPasswordModal
            quantidade={itensNda}
            onCancel={() => setPedirSenha(false)}
            onConfirm={(senha) => { setPedirSenha(false); if (senha) gravarSenhaNda(senha); void publishSite(senha); }}
          />
        ) : null}
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={onFile} />
      </div>
    </header>
  );
}
