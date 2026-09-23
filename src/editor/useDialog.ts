import { useEffect, useRef, useState } from 'react';

const FOCAVEIS = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Elementos que o Tab alcança dentro do diálogo (visíveis e habilitados). */
function focaveis(box: HTMLElement): HTMLElement[] {
  return [...box.querySelectorAll<HTMLElement>(FOCAVEIS)].filter((el) => el.getClientRects().length > 0);
}

/**
 * Comportamento comum dos diálogos do editor (Versões, senha NDA, recorte):
 * - ao abrir, o foco entra no diálogo (respeitando um `autoFocus` que já esteja lá);
 * - o Tab e o Shift+Tab circulam só dentro dele, sem cair no editor por trás;
 * - o Esc fecha, e não chega aos atalhos do editor (que tirariam a seleção);
 * - ao fechar, o foco volta para quem abriu (o botão da barra, o ícone do card).
 *
 * Devolve o ref a pôr no elemento com `role="dialog"`.
 */
export function useDialog<T extends HTMLElement>(onClose: () => void): React.RefObject<T | null> {
  const ref = useRef<T>(null);
  const fechar = useRef(onClose);
  fechar.current = onClose;
  // Quem abriu é lido na renderização: antes de um `autoFocus` do diálogo roubar o foco.
  const [opener] = useState(() => (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement ? document.activeElement : null));

  useEffect(() => {
    const box = ref.current;
    if (box && !box.contains(document.activeElement)) (focaveis(box)[0] ?? box).focus();

    const onKey = (e: KeyboardEvent): void => {
      const box = ref.current;
      if (!box) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        fechar.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const f = focaveis(box);
      const active = document.activeElement;
      if (!f.length) {
        e.preventDefault();
        box.focus();
        return;
      }
      const first = f[0]!;
      const last = f[f.length - 1]!;
      if (!box.contains(active)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (e.shiftKey && (active === first || active === box)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    // Captura no window: chega antes dos atalhos do editor (que escutam na bolha).
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [opener]);

  return ref;
}
