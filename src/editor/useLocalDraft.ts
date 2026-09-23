import { useEffect, useRef, useState } from 'react';
import type { PortfolioV4 } from '../schema/v4';
import { saveLocalAssets, saveLocalDoc } from './localDraft';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

/**
 * Autosave do editor no IndexedDB, com doc e imagens em gravações separadas:
 * editar texto grava só o documento — as imagens (data URLs, potencialmente
 * vários MB) só são regravadas quando o próprio mapa de assets muda.
 *
 * O mapa vai INTEIRO, inclusive as imagens que o documento deixou de usar: o
 * desfazer e as versões salvas ainda podem trazê-las de volta. Gravar só as
 * usadas no momento apagava do navegador a imagem trocada, e restaurar uma
 * versão depois de recarregar devolvia o elemento vazio. Quem poda o mapa é a
 * abertura do editor (`manterImagensEmUso`), sabendo das versões.
 */
export function useLocalDraft(doc: PortfolioV4, assets: Record<string, string>, enabled = true): SaveStatus {
  const [status, setStatus] = useState<SaveStatus>('idle');
  const docTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const assetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstDoc = useRef(true);
  const latest = useRef(doc);
  latest.current = doc;
  const latestAssets = useRef(assets);
  latestAssets.current = assets;
  const pending = useRef(false);
  const assetsPending = useRef(false);

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

  // Imagens: quando o mapa muda (import, upload) — e uma vez ao abrir. Na
  // primeira visita o editor nasce do exemplo, cujas imagens não estão gravadas
  // em lugar nenhum: sem essa gravação, o primeiro texto editado salvava o
  // documento e, ao recarregar, as imagens do exemplo tinham sumido. A abertura
  // também grava o mapa já podado (`manterImagensEmUso`).
  useEffect(() => {
    if (!enabled) return;
    assetsPending.current = true;
    if (assetTimer.current) clearTimeout(assetTimer.current);
    assetTimer.current = setTimeout(() => {
      assetsPending.current = false;
      void saveLocalAssets(assets).catch(() => setStatus('error'));
    }, 700);
    return () => {
      if (assetTimer.current) clearTimeout(assetTimer.current);
    };
  }, [assets, enabled]);

  // Fechar/recarregar/trocar de aba antes do debounce: grava imediatamente —
  // as imagens também, senão o documento salvo apontaria para uma imagem que
  // não chegou a ser gravada.
  useEffect(() => {
    if (!enabled) return;
    const flush = (): void => {
      if (assetsPending.current) {
        assetsPending.current = false;
        if (assetTimer.current) clearTimeout(assetTimer.current);
        void saveLocalAssets(latestAssets.current).catch(() => setStatus('error'));
      }
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
