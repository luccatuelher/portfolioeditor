import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../renderer/styles.css';
import './site-entry.css';
import type { AssetResolver } from '../renderer/context';
import { Site } from '../renderer/Site';
import { ErrorBoundary } from '../renderer/ErrorBoundary';
import { decryptNda, type EncryptedNda } from '../publish/nda';
import { mergeNda, type NdaBundle } from '../publish/publicSnapshot';
import type { PortfolioV4 } from '../schema/v4';
import { repairDoc } from '../migrate/repair';

declare global {
  interface Window {
    __PORTFOLIO_DATA__?: unknown;
    __ASSETS__?: Record<string, string>;
    __NDA__?: EncryptedNda;
  }
}

// Nunca derruba o site por um campo inválido: conserta só o que não bate com o schema.
const repaired = repairDoc(window.__PORTFOLIO_DATA__ ?? {});
if (repaired.fixes.length) console.warn('[site] dados ajustados:', repaired.fixes);
const publicData: PortfolioV4 = repaired.doc ?? (window.__PORTFOLIO_DATA__ as PortfolioV4);
const assets: Record<string, string> = { ...(window.__ASSETS__ ?? {}) };
const resolver: AssetResolver = (ref) => (ref.assetId ? assets[ref.assetId] ?? '' : ref.url ?? '');

function App(): React.ReactElement {
  const [data, setData] = useState<PortfolioV4>(publicData);
  const [unlocked, setUnlocked] = useState(false);
  const hasNda = !!window.__NDA__;

  // A senha é pedida dentro da própria página NDA (bloco de lista NDA).
  const unlock = async (password: string): Promise<string | null> => {
    if (!window.__NDA__) return 'sem NDA';
    try {
      const payload = await decryptNda<{ items: NdaBundle; assets: Record<string, string> }>(window.__NDA__, password);
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
      fallback={(erro, tentarDeNovo) => (
        <div className="tela-de-erro">
          <h1>Algo não pôde ser exibido</h1>
          <p>Tente de novo ou recarregue a página.</p>
          <pre>{erro.message}</pre>
          <div className="tela-de-erro-acoes">
            <button type="button" onClick={tentarDeNovo}>Tentar de novo</button>
            <button type="button" onClick={() => location.reload()}>Recarregar</button>
          </div>
        </div>
      )}
    >
      <Site data={data} resolveAsset={resolver} editing={false} nda={hasNda ? { locked: !unlocked, unlock } : undefined} />
    </ErrorBoundary>
  );
}

const root = document.getElementById('root');
if (root) createRoot(root).render(<App />);
