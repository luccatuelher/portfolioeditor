import { useEffect, useRef, useState } from 'react';
import type { PortfolioV4 } from '../schema/v4';
import { saveLocalAssets, saveLocalDoc } from './localDraft';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

/** Só as imagens referenciadas pelo documento (o mapa em memória guarda também as trocadas, para o desfazer). */
function usedAssets(doc: PortfolioV4, assets: Record<string, string>): Record<string, string> {
  const used = new Set<string>();
  const walk = (n: unknown): void => {
    if (Array.isArray(n)) n.forEach(walk);
    else if (n && typeof n === 'object') {
      const r = n as Record<string, unknown>;
      if (typeof r['assetId'] === 'string') used.add(r['assetId']);
      for (const v of Object.values(r)) walk(v);
    }
  };
  walk(doc);
  const out: Record<string, string> = {};
  for (const id of used) if (assets[id]) out[id] = assets[id];
  return out;
}

/**
 * Autosave do editor no IndexedDB, com doc e imagens em gravações separadas:
 * editar texto grava só o documento — as imagens (data URLs, potencialmente
 * vários MB) só são regravadas quando o próprio mapa de assets muda.
 */
export function useLocalDraft(doc: PortfolioV4, assets: Record<string, string>, enabled = true): SaveStatus {
  const [status, setStatus] = useState<SaveStatus>('idle');
  const docTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const assetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstDoc = useRef(true);
  const firstAssets = useRef(true);
  const latest = useRef(doc);
  latest.current = doc;
  const pending = useRef(false);

  // Documento: grava a cada edição (debounced).
  useEffect(() => {
    if (!enabled) return;
    if (firstDoc.current) {
      firstDoc.current = false;
      return; // estado inicial recém-carregado não precisa regravar
    }
    setStatus('saving');
    pending.current = true;
    if (docTimer.current) clearTimeout(docTimer.current);
    docTimer.current = setTimeout(() => {
      pending.current = false;
      void saveLocalDoc(doc)
        .then(() => setStatus('saved'))
        .catch(() => setStatus('error'));
    }, 700);
    return () => {
      if (docTimer.current) clearTimeout(docTimer.current);
    };
  }, [doc, enabled]);

  // Imagens: só quando o mapa muda (import, upload).
  useEffect(() => {
    if (!enabled) return;
    if (firstAssets.current) {
      firstAssets.current = false;
      return;
    }
    if (assetTimer.current) clearTimeout(assetTimer.current);
    assetTimer.current = setTimeout(() => {
      void saveLocalAssets(usedAssets(latest.current, assets)).catch(() => setStatus('error'));
    }, 700);
    return () => {
      if (assetTimer.current) clearTimeout(assetTimer.current);
    };
  }, [assets, enabled]);

  // Fechar/recarregar/trocar de aba antes do debounce: grava imediatamente.
  useEffect(() => {
    if (!enabled) return;
    const flush = (): void => {
      if (!pending.current) return;
      pending.current = false;
      if (docTimer.current) clearTimeout(docTimer.current);
      void saveLocalDoc(latest.current).then(() => setStatus('saved')).catch(() => setStatus('error'));
    };
    const onVis = (): void => { if (document.visibilityState === 'hidden') flush(); };
    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', flush);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('pagehide', flush);
      window.removeEventListener('beforeunload', flush);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [enabled]);

  return status;
}
