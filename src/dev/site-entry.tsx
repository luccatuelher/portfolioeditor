import { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../renderer/styles.css';
import './site-entry.css';
import type { AssetResolver } from '../renderer/context';
import { resolverDoMapa } from '../renderer/dataUrlResolver';
import { initialVisitorLang, Site } from '../renderer/Site';
import { htmlLang, textoUi } from '../renderer/ui';
import { ErrorBoundary } from '../renderer/ErrorBoundary';
import { abrirPacoteNda, type EncryptedNda } from '../publish/nda';
import { mergeNda, type NdaBundle } from '../publish/publicSnapshot';
import type { PortfolioV4 } from '../schema/v4';
import { reporBasico } from '../migrate/formaMinima';

declare global {
  interface Window {
    __PORTFOLIO_DATA__?: unknown;
    __ASSETS__?: Record<string, string>;
    __NDA__?: EncryptedNda;
    /** Há pacote NDA no fim do arquivo (o runtime pode começar antes de ele chegar). */
    __TEM_NDA__?: boolean;
  }
}

// Os dados já saem validados da publicação (buildPublishPayload roda o
// repairDoc). Aqui só a forma mínima — tema, coleções, dados do site — para
// um arquivo mexido à mão não derrubar a página; sem carregar o schema (zod)
// no celular de quem visita. O resto fica com a barreira de erro.
const bruto = structuredClone(window.__PORTFOLIO_DATA__ ?? {}) as Record<string, unknown>;
if (!Array.isArray(bruto['pages'])) bruto['pages'] = [];
const ajustes: string[] = [];
reporBasico(bruto, ajustes);
if (ajustes.length) console.warn('[site] dados ajustados:', ajustes);
const publicData = bruto as unknown as PortfolioV4;
// O runtime começa antes de o arquivo terminar de chegar (ver runtimeNoLugar):
// o mapa de imagens é o MESMO objeto que os <script> seguintes vão enchendo.
const assets: Record<string, string> = (window.__ASSETS__ ??= {});
const lendoArquivo = (): boolean => document.readyState === 'loading';

/**
 * Enquanto a imagem ainda está a caminho, um SVG vazio com a proporção dela
 * guarda o lugar (a página não pula quando ela chega). Terminado o arquivo, a
 * que não veio some, como antes.
 */
function reserva(id: string, data: PortfolioV4): string {
  const m = data.assets[id];
  if (!m || !(m.w > 0 && m.h > 0) || !lendoArquivo()) return '';
  return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${m.w} ${m.h}'/%3E`;
}

/** O pacote NDA vem no fim do arquivo: quem digita a senha antes espera ele chegar. */
async function pacoteNda(): Promise<EncryptedNda | undefined> {
  if (!window.__NDA__ && lendoArquivo()) await new Promise((ok) => document.addEventListener('DOMContentLoaded', ok, { once: true }));
  return window.__NDA__;
}

/** Nova imagem chegou (ou o arquivo terminou): uma nova pintura por quadro, no máximo. */
function useImagensChegando(): number {
  const [versao, setVersao] = useState(0);
  useEffect(() => {
    let quadro = 0;
    const repintar = (): void => {
      if (!quadro) quadro = requestAnimationFrame(() => {
        quadro = 0;
        setVersao((v) => v + 1);
      });
    };
    addEventListener('portfolio-imagem', repintar);
    document.addEventListener('DOMContentLoaded', repintar);
    // O que chegou entre o primeiro render e este efeito.
    repintar();
    return () => {
      removeEventListener('portfolio-imagem', repintar);
      document.removeEventListener('DOMContentLoaded', repintar);
      cancelAnimationFrame(quadro);
    };
  }, []);
  return versao;
}

function App(): React.ReactElement {
  const [data, setData] = useState<PortfolioV4>(publicData);
  const [unlocked, setUnlocked] = useState(false);
  const hasNda = !!(window.__NDA__ || window.__TEM_NDA__);
  const versao = useImagensChegando();
  // Identidade nova a cada imagem que chega: quem mostra imagem pinta de novo.
  const resolver = useMemo<AssetResolver>(
    () => {
      const doMapa = resolverDoMapa((id) => assets[id]);
      return (ref, uso) => doMapa(ref, uso) || (ref.assetId ? reserva(ref.assetId, data) : '');
    },
    [versao, data],
  );

  // A senha é pedida dentro da própria página NDA (bloco de lista NDA).
  const unlock = async (password: string): Promise<string | null> => {
    const pacote = await pacoteNda();
    if (!pacote) return 'sem NDA';
    try {
      // Imagens do NDA viram blob: URL — nada de recodificar megabytes em base64 no celular.
      const payload = await abrirPacoteNda<NdaBundle>(pacote, password, (mime, bytes) => URL.createObjectURL(new Blob([bytes as BlobPart], { type: mime })));
      Object.assign(assets, payload.assets);
      setData(mergeNda(publicData, payload.items));
      setUnlocked(true);
      return null;
    } catch {
      return 'senha incorreta';
    }
  };

  return (
    <ErrorBoundary
      // O site caiu inteiro: o idioma do visitante vem da escolha salva (o
      // estado se perdeu com o erro). O motivo técnico fica no console.
      fallback={(_erro, tentarDeNovo) => {
        const lang = initialVisitorLang('pt');
        const t = (k: Parameters<typeof textoUi>[2]): string => textoUi(data, lang, k);
        return (
          <div className="tela-de-erro" lang={htmlLang(lang)}>
            <h1>{t('erroTitulo')}</h1>
            <p>{t('erroTexto')}</p>
            <div className="tela-de-erro-acoes">
              <button type="button" onClick={tentarDeNovo}>{t('tentarDeNovo')}</button>
              <button type="button" onClick={() => location.reload()}>{t('recarregar')}</button>
            </div>
          </div>
        );
      }}
    >
      <Site data={data} resolveAsset={resolver} editing={false} nda={hasNda ? { locked: !unlocked, unlock } : undefined} />
    </ErrorBoundary>
  );
}

const root = document.getElementById('root');
if (root) createRoot(root).render(<App />);
