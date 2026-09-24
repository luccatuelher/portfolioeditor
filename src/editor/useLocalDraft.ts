import { useEffect, useRef, useState } from 'react';
import type { PortfolioV4 } from '../schema/v4';
import { saveLocalAssets, saveLocalDoc } from './localDraft';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

/** Estado de um dos dois canais de gravação (documento, imagens). */
type Canal = 'ok' | 'salvando' | 'erro';

/**
 * Status que a barra mostra, a partir dos DOIS canais. Antes era um estado só,
 * e quem gravava por último vencia: imagens falhando (espaço cheio) e o
 * documento gravando logo depois mostravam "Salvo" — com as imagens perdidas.
 */
export function combinarStatus(doc: Canal, imagens: Canal, algumaGravacao: boolean): SaveStatus {
  if (doc === 'erro' || imagens === 'erro') return 'error';
  if (doc === 'salvando' || imagens === 'salvando') return 'saving';
  return algumaGravacao ? 'saved' : 'idle';
}

/** Explica a falha de gravação em palavras de quem usa. */
export function explicarFalha(err: unknown): string {
  const nome = err && typeof err === 'object' && 'name' in err ? String((err as { name: unknown }).name) : '';
  if (nome === 'QuotaExceededError' || /quota/i.test(String(err))) {
    return 'O espaço deste navegador para o editor acabou (imagens grandes ocupam muito).';
  }
  return `O navegador recusou a gravação${err instanceof Error && err.message ? ` (${err.message})` : ''}.`;
}

export interface LocalDraftState {
  status: SaveStatus;
  /** Por que não gravou (só com status 'error'). */
  erro: string | null;
}

/**
 * Autosave do editor no IndexedDB, com doc e imagens em gravações separadas:
 * editar texto grava só o documento — as imagens (data URLs, potencialmente
 * vários MB) só são regravadas quando o próprio mapa de assets muda, ou
 * quando a última gravação delas falhou (tenta de novo junto do documento).
 *
 * O mapa vai INTEIRO, inclusive as imagens que o documento deixou de usar: o
 * desfazer e as versões salvas ainda podem trazê-las de volta. Gravar só as
 * usadas no momento apagava do navegador a imagem trocada, e restaurar uma
 * versão depois de recarregar devolvia o elemento vazio. Quem poda o mapa é a
 * abertura do editor (`manterImagensEmUso`), sabendo das versões.
 */
export function useLocalDraft(doc: PortfolioV4, assets: Record<string, string>, enabled = true): LocalDraftState {
  const [canais, setCanais] = useState<{ doc: Canal; imagens: Canal; gravou: boolean; erro: string | null }>({ doc: 'ok', imagens: 'ok', gravou: false, erro: null });
  const docTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const assetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstDoc = useRef(true);
  const latest = useRef(doc);
  latest.current = doc;
  const latestAssets = useRef(assets);
  latestAssets.current = assets;
  const pending = useRef(false);
  const assetsPending = useRef(false);
  /** A última gravação das imagens falhou: a próxima do documento tenta de novo. */
  const imagensFalharam = useRef(false);

  const canal = (qual: 'doc' | 'imagens', estado: Canal, erro?: unknown): void =>
    setCanais((c) => {
      const n = { ...c, [qual]: estado, gravou: c.gravou || estado === 'ok' };
      // A explicação some só quando nenhum dos dois canais está em erro.
      n.erro = estado === 'erro' ? explicarFalha(erro) : n.doc === 'erro' || n.imagens === 'erro' ? c.erro : null;
      return n;
    });

  // Só a resposta da gravação MAIS RECENTE de cada canal conta: uma antiga
  // que termina depois não pode pôr "erro" (ou "salvo") por cima da atual.
  const seq = useRef({ doc: 0, imagens: 0 });
  const gravarDoc = (d: PortfolioV4): void => {
    const n = ++seq.current.doc;
    canal('doc', 'salvando');
    void saveLocalDoc(d).then(
      () => { if (n === seq.current.doc) canal('doc', 'ok'); },
      (e: unknown) => { if (n === seq.current.doc) canal('doc', 'erro', e); },
    );
  };
  const gravarImagens = (a: Record<string, string>): void => {
    const n = ++seq.current.imagens;
    canal('imagens', 'salvando');
    void saveLocalAssets(a).then(
      () => { if (n === seq.current.imagens) { imagensFalharam.current = false; canal('imagens', 'ok'); } },
      (e: unknown) => { if (n === seq.current.imagens) { imagensFalharam.current = true; canal('imagens', 'erro', e); } },
    );
  };

  // Documento: grava a cada edição (debounced).
  useEffect(() => {
    if (!enabled) return;
    if (firstDoc.current) {
      firstDoc.current = false;
      return; // estado inicial recém-carregado não precisa regravar
    }
    canal('doc', 'salvando');
    pending.current = true;
    if (docTimer.current) clearTimeout(docTimer.current);
    docTimer.current = setTimeout(() => {
      pending.current = false;
      gravarDoc(doc);
      if (imagensFalharam.current && !assetsPending.current) gravarImagens(latestAssets.current);
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
      gravarImagens(assets);
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
        gravarImagens(latestAssets.current);
      }
      if (!pending.current) return;
      pending.current = false;
      if (docTimer.current) clearTimeout(docTimer.current);
      gravarDoc(latest.current);
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

  const status = combinarStatus(canais.doc, canais.imagens, canais.gravou);
  return { status, erro: status === 'error' ? canais.erro : null };
}
