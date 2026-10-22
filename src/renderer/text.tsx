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
export function RichText({ html, className }: { html: string; className?: string }): React.ReactElement {
  return <div className={className} dangerouslySetInnerHTML={{ __html: escalarTamanhos(sanitizeRich(html)) }} />;
}
