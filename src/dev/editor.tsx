import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../renderer/styles.css';
import '../editor/editor.css';
import templateRaw from '../../fixtures/template-v3.json?raw';
import syntheticRaw from '../../fixtures/legacy-synthetic-v3.json?raw';
import { migrate } from '../migrate/migrate';
import { Editor } from '../editor/Editor';
import type { Backup } from '../editor/backup';
import { loadLocalDraft, saveLocalDraft, saveRescueCopy } from '../editor/localDraft';
import { repairDoc } from '../migrate/repair';
import { PortfolioV4Schema, type PortfolioV4 } from '../schema/v4';
import { upgradeDoc } from '../migrate/upgrade';

const q = new URLSearchParams(location.search);
const raw = q.get('fixture') === 'synthetic' ? syntheticRaw : templateRaw;
const fresh = q.has('fresh'); // ?fresh=1 ignora o rascunho salvo e recomeça do exemplo

type State = { doc: PortfolioV4; assets: Record<string, string>; version: number; notice?: string; persist?: boolean };

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
          if (parsed.success) return { doc: upgradeDoc(parsed.data), assets: saved.assets ?? {}, version: 0 };
          // Formato mudou: guarda a cópia intacta e conserta só o incompatível (nunca descarta em silêncio).
          await saveRescueCopy(saved.doc).catch(() => {});
          const { doc, fixes } = repairDoc(saved.doc);
          console.warn('[rascunho] ajustes ao carregar:', fixes);
          if (doc) {
            return { doc, assets: saved.assets ?? {}, version: 0, notice: `Seu rascunho foi recuperado com ${fixes.length} ajuste(s) de formato. Uma cópia do original ficou guardada neste navegador.` };
          }
          const fx = fromFixture();
          return { ...fx, notice: 'Não foi possível ler o rascunho salvo — uma cópia intacta ficou guardada neste navegador. Não edite: importe seu backup (Importar) ou me avise.' };
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

  const onImport = (b: Backup): void => {
    void saveLocalDraft(b.doc, b.assets).catch(() => {});
    setState((s) => ({ doc: b.doc, assets: b.assets, version: (s?.version ?? 0) + 1, persist: true }));
  };
  // Adiciona imagem sem remontar (mantém seleção/undo).
  const onAddAsset = (id: string, dataUrl: string): void => setState((s) => (s ? { ...s, assets: { ...s.assets, [id]: dataUrl } } : s));

  return <Editor key={state.version} initial={state.doc} assets={state.assets} onImport={onImport} onAddAsset={onAddAsset} notice={state.notice} persist={state.persist !== false} />;
}

const root = document.getElementById('root');
if (!root) throw new Error('#root ausente');
createRoot(root).render(<Root />);
