import { useEffect, useState } from 'react';

/**
 * Senha da área NDA, escolhida uma vez e lembrada neste navegador: o "Baixar
 * site" cifra com ela sem perguntar de novo. Troca e esquece no painel Dados.
 * Fica só aqui (localStorage) — nunca vai para o documento, o backup ou o site.
 */
const CHAVE = 'portfolio-v4:nda-senha';
const EVENTO = 'portfolio-nda-senha';

export function lerSenhaNda(): string | null {
  try {
    const s = localStorage.getItem(CHAVE);
    return s && s.trim() ? s : null;
  } catch {
    return null;
  }
}

export function gravarSenhaNda(senha: string | null): void {
  try {
    if (senha && senha.trim()) localStorage.setItem(CHAVE, senha.trim());
    else localStorage.removeItem(CHAVE);
  } catch {
    /* sem armazenamento: a senha volta a ser pedida no próximo "Baixar site" */
  }
  window.dispatchEvent(new Event(EVENTO));
}

/** Há senha guardada? Atualiza quando ela é definida em outro lugar do editor. */
export function useTemSenhaNda(): boolean {
  const [tem, setTem] = useState(() => !!lerSenhaNda());
  useEffect(() => {
    const atualizar = (): void => setTem(!!lerSenhaNda());
    window.addEventListener(EVENTO, atualizar);
    return () => window.removeEventListener(EVENTO, atualizar);
  }, []);
  return tem;
}
