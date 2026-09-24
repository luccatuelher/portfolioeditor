import { useEffect, useId, useState } from 'react';
import { useDialog } from './useDialog';
import { useAvisos } from './avisos';
import type { PortfolioV4 } from '../schema/v4';
import { deleteVersion, guardarAntesDeTrocar, listVersions, loadVersion, MAX_VERSIONS, saveVersion, type VersionEntry } from './versions';

const fmt = (t: number): string =>
  new Date(t).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });

/**
 * Histórico de versões: pontos de retorno nomeados, guardados neste navegador.
 * Restaurar substitui o documento aberto (as imagens continuam as mesmas), e o
 * estado de agora vira uma versão antes da troca — nada some sem rede.
 */
export function VersionsModal({ doc, onRestore, onClose }: { doc: PortfolioV4; onRestore?: (doc: PortfolioV4) => void; onClose: () => void }): React.ReactElement {
  const [list, setList] = useState<VersionEntry[] | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = (): void => void listVersions().then(setList).catch(() => setList([]));
  useEffect(refresh, []);
  const dialogo = useDialog<HTMLDivElement>(onClose);
  const titulo = useId();
  const avisos = useAvisos();
  const motivo = (err: unknown): string => (err instanceof Error ? err.message : String(err));

  const save = async (): Promise<void> => {
    setBusy(true);
    try {
      await saveVersion(name || `Versão de ${fmt(Date.now())}`, doc);
      setName('');
      refresh();
    } catch (err) {
      avisos.avisar(`Não consegui salvar a versão: ${motivo(err)}`, { tipo: 'erro' });
    } finally {
      setBusy(false);
    }
  };

  const restore = async (v: VersionEntry): Promise<void> => {
    if (!onRestore) return;
    const ok = await avisos.confirmar({
      titulo: `Restaurar “${v.name}”?`,
      texto: `Versão de ${fmt(v.savedAt)}. O que está aberto agora vira uma versão automática antes da troca.`,
      confirmar: 'Restaurar',
      perigo: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      const target = await loadVersion(v.id);
      if (!target) {
        avisos.avisar('Essa versão não está mais guardada neste navegador.', { tipo: 'erro' });
        refresh();
        return;
      }
      if (!(await guardarAntesDeTrocar(`Antes de restaurar "${v.name}"`, doc, avisos.confirmar))) return;
      onRestore(target);
      onClose();
    } catch (err) {
      // Antes a falha ao ler a versão escapava sem aviso (não havia catch).
      avisos.avisar(`Não consegui restaurar a versão: ${motivo(err)}`, { tipo: 'erro' });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (v: VersionEntry): Promise<void> => {
    // Apagar versão não tem desfazer: pergunta antes.
    const ok = await avisos.confirmar({ titulo: `Apagar a versão “${v.name}”?`, texto: 'Ela sai deste navegador e não dá para trazer de volta.', confirmar: 'Apagar', perigo: true });
    if (!ok) return;
    // Antes a falha era engolida (catch vazio) e a versão seguia na lista sem explicação.
    await deleteVersion(v.id).catch((err: unknown) => avisos.avisar(`Não consegui apagar a versão: ${motivo(err)}`, { tipo: 'erro' }));
    refresh();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal versions-modal" role="dialog" aria-modal="true" aria-labelledby={titulo} ref={dialogo} tabIndex={-1} onClick={(e) => e.stopPropagation()}>
        <header className="modal-head">
          <h2 id={titulo}>Histórico de versões</h2>
          <button type="button" onClick={onClose} aria-label="Fechar">✕</button>
        </header>

        <div className="versions-save">
          <input
            type="text"
            value={name}
            placeholder="Nome da versão (ex.: antes de trocar as cores)"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => void (e.key === 'Enter' && !busy && save())}
          />
          <button type="button" className="tb-btn primary" disabled={busy} onClick={() => void save()}>Salvar versão</button>
        </div>

        {list === null ? (
          <p className="versions-empty">Carregando…</p>
        ) : list.length === 0 ? (
          <p className="versions-empty">Nenhuma versão ainda. Salve uma antes de mexidas grandes — e baixe o Backup para ter uma cópia fora do navegador.</p>
        ) : (
          <ul className="versions-list">
            {list.map((v) => (
              <li key={v.id}>
                <div className="v-main">
                  <b>{v.name}</b>
                  <span>{fmt(v.savedAt)}{v.auto ? ' · automática' : ''}</span>
                </div>
                <button type="button" className="tb-btn" disabled={busy || !onRestore} title={onRestore ? 'Trocar o documento aberto por esta versão' : 'Restaurar não está disponível nesta janela'} onClick={() => void restore(v)}>Restaurar</button>
                <button type="button" className="v-del" title="Apagar versão" onClick={() => void remove(v)}>🗑</button>
              </li>
            ))}
          </ul>
        )}
        <p className="versions-hint">Guardadas neste navegador (até {MAX_VERSIONS}); as automáticas saem primeiro. Só o documento é guardado — as imagens continuam no editor.</p>
      </div>
    </div>
  );
}
