import { useEffect, useState } from 'react';

/**
 * O editor aberto em DUAS abas grava no mesmo rascunho do navegador: a última
 * a salvar apaga, em silêncio, o que a outra fez. Aqui as abas se anunciam
 * umas às outras (BroadcastChannel) para o editor poder avisar.
 *
 * Protocolo: ao abrir, "oi"; quem já estava responde "estou"; ao fechar,
 * "tchau". Cada aba sabe quantas outras estão abertas.
 */
type Msg = { tipo: 'oi' | 'estou' | 'tchau'; aba: string };

export function useOutraAba(canal = 'portfolio-editor', ativo = true): boolean {
  const [outras, setOutras] = useState<string[]>([]);
  useEffect(() => {
    if (!ativo || typeof BroadcastChannel === 'undefined') return;
    const aba = Math.random().toString(36).slice(2);
    const bc = new BroadcastChannel(canal);
    const post = (tipo: Msg['tipo']): void => {
      try { bc.postMessage({ tipo, aba } satisfies Msg); } catch { /* canal fechado */ }
    };
    bc.onmessage = (e: MessageEvent<Msg>) => {
      const m = e.data;
      if (!m || m.aba === aba) return;
      if (m.tipo === 'tchau') setOutras((o) => o.filter((x) => x !== m.aba));
      else setOutras((o) => (o.includes(m.aba) ? o : [...o, m.aba]));
      if (m.tipo === 'oi') post('estou');
    };
    post('oi');
    const tchau = (): void => post('tchau');
    window.addEventListener('pagehide', tchau);
    return () => {
      tchau();
      window.removeEventListener('pagehide', tchau);
      bc.close();
    };
  }, [canal, ativo]);
  return outras.length > 0;
}
