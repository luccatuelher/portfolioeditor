const ALLOWED_TAG = /^(p|div|span|br|strong|b|em|i|u|s|ul|ol|li|h1|h2|h3|h4|blockquote)$/i;

/**
 * Sanitizador isomórfico (sem DOM) aplicado na INGESTÃO de HTML não confiável
 * — backups v3 importados, fixtures, conteúdo migrado. Política conservadora:
 *  - remove comentários e blocos com conteúdo perigoso (script/style/iframe/…);
 *  - mantém apenas tags de formatação de uma allowlist;
 *  - remove TODOS os atributos (logo, sem on*=, href/src javascript:, style).
 *
 * Existe também `editor/sanitize.ts` (baseado em DOM) para o caminho de edição
 * inline no navegador; este aqui cobre Node (migrate/publish/testes).
 */
export function sanitizeHtml(input: unknown): string {
  let out = String(input ?? '');
  out = out.replace(/<!--[\s\S]*?-->/g, '');
  out = out.replace(/<(script|style|iframe|object|embed|svg|math|template|noscript)\b[\s\S]*?<\/\1\s*>/gi, '');
  // Tags órfãs perigosas (sem fechamento) e qualquer tag fora da allowlist.
  out = out.replace(/<\/?([a-zA-Z][a-zA-Z0-9:-]*)\b[^>]*>/g, (match, tag: string) => {
    if (!ALLOWED_TAG.test(tag)) return '';
    return match.startsWith('</') ? `</${tag.toLowerCase()}>` : `<${tag.toLowerCase()}>`;
  });
  return out;
}

const RICH_TAG = /^(p|div|span|br|strong|b|em|i|u|s|ul|ol|li|h1|h2|h3|h4|blockquote|a)$/i;
const STYLE_OK: Record<string, RegExp> = {
  color: /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|[a-z]+)$/i,
  'font-size': /^\d+(\.\d+)?(px|rem|em|%)$/,
  'font-family': /^[\w\s,"'-]+$/,
  'text-align': /^(left|right|center|justify|start|end)$/,
};

function attr(tag: string, name: string): string | null {
  const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i'));
  return m ? (m[2] ?? m[3] ?? '') : null;
}

const unq = (v: string): string => v.replace(/&quot;/g, '"').replace(/&#39;/g, "'");
const esc = (v: string): string => v.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/**
 * Sanitizador isomórfico para rich text do editor (render público e editor):
 * mesma allowlist de tags, mais links seguros (http/mailto/tel/relativo) e
 * estilos limitados (cor, tamanho, fonte, alinhamento) com valores validados.
 */
export function sanitizeRich(input: unknown): string {
  let out = String(input ?? '');
  out = out.replace(/<!--[\s\S]*?-->/g, '');
  out = out.replace(/<(script|style|iframe|object|embed|svg|math|template|noscript)\b[\s\S]*?<\/\1\s*>/gi, '');
  return out.replace(/<\/?([a-zA-Z][a-zA-Z0-9:-]*)\b[^>]*>/g, (match, rawTag: string) => {
    const tag = rawTag.toLowerCase();
    if (!RICH_TAG.test(tag)) return '';
    if (match.startsWith('</')) return `</${tag}>`;
    const parts: string[] = [];
    const style = attr(match, 'style');
    if (style) {
      const kept = unq(style).split(';').map((d) => d.split(':')).filter(([k, v]) => k && v && STYLE_OK[k.trim().toLowerCase()]?.test(v.trim())).map(([k, v]) => `${k!.trim().toLowerCase()}: ${v!.trim()}`);
      if (kept.length) parts.push(`style="${esc(kept.join('; '))}"`);
    }
    if (tag === 'a') {
      const href = unq(attr(match, 'href') ?? '').trim();
      if (/^(https?:|mailto:|tel:)/i.test(href) || /^[#./\w-][^:]*$/.test(href)) {
        parts.push(`href="${esc(href)}"`);
        if (/^https?:/i.test(href)) parts.push('target="_blank" rel="noopener noreferrer"');
      }
    }
    return parts.length ? `<${tag} ${parts.join(' ')}>` : `<${tag}>`;
  });
}
