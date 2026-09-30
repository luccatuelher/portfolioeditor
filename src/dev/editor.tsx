import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../renderer/styles.css';
import '../editor/editor.css';
import templateRaw from '../../fixtures/template-v3.json?raw';
import syntheticRaw from '../../fixtures/legacy-synthetic-v3.json?raw';
import { migrate } from '../migrate/migrate';
import { Editor } from '../editor/Editor';
import { ErrorBoundary } from '../renderer/ErrorBoundary';
import type { Backup } from '../editor/backup';
import { loadLocalDraft, manterImagensEmUso, podarImagensGravadas, saveRescueCopy } from '../editor/localDraft';
import { repairDoc } from '../migrate/repair';
import { PortfolioV4Schema, type PortfolioV4 } from '../schema/v4';
import { upgradeDoc } from '../migrate/upgrade';
import { guardarAoAbrir } from '../editor/versions';

const q = new URLSearchParams(location.search);
const raw = q.get('fixture') === 'synthetic' ? syntheticRaw : templateRaw;
const fresh = q.has('fresh'); // ?fresh=1 ignora o rascunho salvo e recomeça do exemplo

type State = { doc: PortfolioV4; assets: Record<string, string>; version: number; notice?: string; persist?: boolean; gravarAoAbrir?: boolean; /** Quando o rascunho aberto foi gravado neste navegador (ms). */ savedAt?: number };

/**
 * Imagens da abertura: só as que o documento, as versões ou a cópia de resgate
 * usam — e as gravadas que sobram saem do navegador agora, antes de o editor
 * começar a gravar (a gravação só acrescenta). Falhar a poda não impede abrir.
 */
async function imagensDaAbertura(doc: PortfolioV4, assets: Record<string, string>): Promise<Record<string, string>> {
  const manter = await manterImagensEmUso(doc, assets);
  await podarImagensGravadas(manter).catch((err: unknown) => console.warn('[rascunho] não podei as imagens', err));
  return manter;
}

function fromFixture(): State {
  const { data, assets } = migrate(JSON.parse(raw));
  return { doc: upgradeDoc(data), assets: Object.fromEntries(assets.map((a) => [a.id, a.dataUrl])), version: 0 };
}

function Root(): React.ReactElement {
  const [state, setState] = useState<State | null>(null);

  useEffect(() => {
    let alive = true;
    const boot = async (): Promise<State> => {
      if (fresh) return fromFixture();
      try {
        const saved = await loadLocalDraft();
        if (saved) {
          const parsed = PortfolioV4Schema.safeParse(saved.doc);
          if (parsed.success) {
            const doc = upgradeDoc(parsed.data);
            // Ponto de volta da sessão ("como estava ao abrir"): o desfazer não
            // sobrevive a recarregar. Falhar aqui não impede de abrir.
            void guardarAoAbrir(doc).catch((err: unknown) => console.warn('[versões] não guardei a versão ao abrir', err));
            return { doc, assets: await imagensDaAbertura(doc, saved.assets ?? {}), version: 0, savedAt: saved.savedAt };
          }
          // Formato mudou: guarda a cópia intacta e conserta só o incompatível (nunca descarta em silêncio).
          const copiou = await saveRescueCopy(saved.doc).then(() => true, () => false);
          const { doc, fixes } = repairDoc(saved.doc);
          console.warn('[rascunho] ajustes ao carregar:', fixes);
          if (doc) {
            return { doc, assets: await imagensDaAbertura(doc, saved.assets ?? {}), version: 0, notice: `Seu rascunho foi recuperado com ${fixes.length} ajuste(s) de formato. ${copiou ? 'Uma cópia do original ficou guardada neste navegador.' : 'Não consegui guardar uma cópia do original — baixe um backup agora (Ctrl+S).'}` };
          }
          const fx = fromFixture();
          // Sem cópia de resgate, o rascunho ilegível é a ÚNICA cópia: não grava por cima dele.
          return { ...fx, persist: copiou, notice: `Não foi possível ler o rascunho salvo${copiou ? ' — uma cópia intacta ficou guardada neste navegador' : ''}. Não edite: importe seu backup (Importar) ou me avise.` };
        }
      } catch (err) {
        // Não conseguiu LER o armazenamento: mostra o exemplo, mas NÃO grava por cima do que está salvo.
        console.error('[rascunho] falha ao ler', err);
        return { ...fromFixture(), persist: false, notice: 'Não consegui ler o rascunho salvo neste navegador. Nada será gravado por cima dele — recarregue a página; se continuar, importe seu backup.' };
      }
      return fromFixture();
    };
    void boot().then((s) => {
      if (alive) setState(s);
    });
    return () => {
      alive = false;
    };
  }, []);

  if (!state) return <div style={{ padding: 40, fontFamily: 'system-ui', color: '#5a574f' }}>Carregando editor…</div>;

  /**
   * Importar backup (e restaurar versão, que passa por aqui) SOMA as imagens em
   * vez de trocar o conjunto.
   *
   * Uma versão guarda só o documento — as imagens ficam no mapa do editor. Se
   * importar um backup apagasse as imagens que ele não traz, restaurar uma
   * versão anterior mostraria os elementos sem imagem nenhuma, sem aviso. O
   * custo de somar é espaço no navegador; o de trocar seria trabalho perdido.
   * No site publicado entram só as imagens realmente usadas.
   */
  const onImport = (b: Backup, aviso?: string): void => {
    setState((s) => {
      const assets = { ...(s?.assets ?? {}), ...b.assets };
      // Quem grava é o autosave do editor que vai abrir (gravarAoAbrir): uma
      // falha aparece no aviso dele. Antes a gravação era aqui, e a falha, engolida.
      return { doc: b.doc, assets, version: (s?.version ?? 0) + 1, persist: true, gravarAoAbrir: true, notice: aviso };
    });
  };
  // Adiciona imagem sem remontar (mantém seleção/undo).
  const onAddAsset = (id: string, dataUrl: string): void => setState((s) => (s ? { ...s, assets: { ...s.assets, [id]: dataUrl } } : s));

  return (
    <ErrorBoundary
      fallback={(erro, tentarDeNovo) => (
        <div className="tela-de-erro">
          <h1>O editor parou em algo inesperado</h1>
          <p>
            Seu rascunho continua salvo neste navegador — nada foi perdido. Tente de novo; se voltar a parar,
            recarregue a página e, se ainda assim persistir, importe seu último backup.
          </p>
          <pre>{erro.message}</pre>
          <div className="tela-de-erro-acoes">
            <button type="button" onClick={tentarDeNovo}>Tentar de novo</button>
            <button type="button" onClick={() => location.reload()}>Recarregar</button>
          </div>
        </div>
      )}
    >
      <Editor key={state.version} initial={state.doc} assets={state.assets} onImport={onImport} onAddAsset={onAddAsset} notice={state.notice} persist={state.persist !== false} gravarAoAbrir={state.gravarAoAbrir} rascunhoSalvoEm={state.savedAt} />
    </ErrorBoundary>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('#root ausente');
createRoot(root).render(<Root />);
