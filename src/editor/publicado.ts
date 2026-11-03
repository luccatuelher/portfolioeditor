import { useCallback, useEffect, useState } from 'react';

/**
 * "Alterações não publicadas": o editor guarda a impressão digital do documento
 * no momento em que o site foi baixado/enviado e compara com a de agora.
 * Sem publicação registrada neste navegador, não há como saber — nada é mostrado.
 */
const CHAVE = 'pe:publicadoHash';

/** Hash FNV-1a de 32 bits do documento (rápido; basta para "mudou ou não"). */
export function impressaoDoDocumento(doc: unknown): string {
  const s = JSON.stringify(doc);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16) + ':' + s.length;
}

export function lerPublicado(): string | null {
  try {
    return localStorage.getItem(CHAVE);
  } catch {
    return null;
  }
}

export function gravarPublicado(hash: string): void {
  try {
    localStorage.setItem(CHAVE, hash);
  } catch {
    /* sem armazenamento: o indicador só não aparece */
  }
}

/** true = há alterações desde a última publicação; false = igual; null = nunca publicou aqui. */
export function usePendenteDePublicar(doc: unknown): { pendente: boolean | null; marcar: (d: unknown) => void } {
  const [publicado, setPublicado] = useState<string | null>(lerPublicado);
  const [atual, setAtual] = useState<string | null>(null);
  useEffect(() => {
    // Adiado: o documento é grande e o hash não precisa acompanhar cada tecla.
    const t = setTimeout(() => setAtual(impressaoDoDocumento(doc)), 1200);
    return () => clearTimeout(t);
  }, [doc]);
  const marcar = useCallback((d: unknown) => {
    const h = impressaoDoDocumento(d);
    gravarPublicado(h);
    setPublicado(h);
  }, []);
  return { pendente: publicado === null || atual === null ? null : publicado !== atual, marcar };
}
