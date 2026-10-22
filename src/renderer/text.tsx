import { useLayoutEffect, useRef } from 'react';
import type { I18n } from '../core/i18n';
import type { Lang } from './context';
import { sanitizeRich } from '../core/sanitizeHtml';

/** Escolhe o idioma; cai para o outro se o preferido estiver vazio. */
export function pick(v: I18n | undefined, lang: Lang): string {
  if (!v) return '';
  const primary = lang === 'en' ? v.en : v.pt;
  const fallback = lang === 'en' ? v.pt : v.en;
  return primary || fallback || '';
}

/**
 * Tamanhos escritos na mão (`font-size: 18px`) viram `calc(18px * var(--escala-inline))`:
 * a variável vale 1 no computador e encolhe no tablet/celular (Tema). Só na tela —
 * o HTML guardado e o editor de texto seguem com o valor original.
 */
export function escalarTamanhos(html: string): string {
  return html.replace(/font-size: (\d+(?:\.\d+)?(?:px|rem))/g, 'font-size: calc($1 * var(--escala-inline, 1))');
}

/** Renderiza HTML rich já sanitizado (saída de richText do v3 / Tiptap na F4). */
export function RichText({ html, className, fit }: { html: string; className?: string; fit?: boolean }): React.ReactElement {
  const ref = useRef<HTMLDivElement>(null);
  // "Uma linha só" (Inspector › Mostrar em cada tela): o CSS tira a quebra de linha
  // naquela tela; aqui o texto encolhe até caber na largura do bloco.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!fit || !el) return;
    const ajustar = (): void => {
      el.style.zoom = '';
      if (getComputedStyle(el).whiteSpace !== 'nowrap' || el.scrollWidth <= el.clientWidth) return;
      el.style.zoom = String(Math.floor((el.clientWidth / el.scrollWidth) * 100) / 100);
    };
    ajustar();
    window.addEventListener('resize', ajustar);
    void document.fonts?.ready.then(ajustar);
    return () => window.removeEventListener('resize', ajustar);
  }, [fit, html]);
  return <div ref={ref} className={className} dangerouslySetInnerHTML={{ __html: escalarTamanhos(sanitizeRich(html)) }} />;
}
