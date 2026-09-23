const ALLOWED_TAG = /^(p|div|span|br|strong|b|em|i|u|s|ul|ol|li|h1|h2|h3|h4|blockquote)$/i;
const TAG = /<\/?([a-zA-Z][a-zA-Z0-9:-]*)\b[^>]*>/g;
const PERIGOSOS = /<(script|style|iframe|object|embed|svg|math|template|noscript)\b[\s\S]*?<\/\1\s*>/gi;

/**
 * Percorre as tags do HTML e reescreve cada uma com `tag`. O texto ENTRE as
 * tags tem todo "<" escapado: sem isso, remover uma tag do meio podia colar os
 * pedaços dos lados numa tag nova — `<<x>img onerror=…>` virava `<img onerror=…>`.
 * Um "<" legítimo no texto já chega como `&lt;` (é assim que o navegador serializa).
 */
function porTags(html: string, tag: (match: string, nome: string) => string): string {
  let out = '';
  let ultimo = 0;
  for (const m of html.matchAll(TAG)) {
    out += html.slice(ultimo, m.index).replace(/</g, '&lt;');
    out += tag(m[0], m[1]!);
    ultimo = m.index + m[0].length;
  }
  return out + html.slice(ultimo).replace(/</g, '&lt;');
}

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
  out = out.replace(PERIGOSOS, '');
  return porTags(out, (match, tag) => {
    if (!ALLOWED_TAG.test(tag)) return '';
    return match.startsWith('</') ? `</${tag.toLowerCase()}>` : `<${tag.toLowerCase()}>`;
  });
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

const NOMEADAS: Record<string, string> = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ' };

/**
 * Valor de atributo como o navegador o lê. Validar o texto ainda codificado
 * deixava `&amp;` para trás, e a saída o codificava de novo: a cada passagem um
 * link `?a=1&b=2` virava `&amp;amp;` e quebrava. Entidade desconhecida fica
 * como está — a saída escapa todo "&", então ela nunca vira outra coisa.
 */
function decodificar(v: string): string {
  return v.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (m, e: string) => {
    const k = e.toLowerCase();
    if (k.startsWith('#')) {
      const n = k[1] === 'x' ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10);
      return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : m;
    }
    return NOMEADAS[k] ?? m;
  });
}
const esc = (v: string): string => v.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/**
 * Sanitizador isomórfico para rich text do editor (render público e editor):
 * mesma allowlist de tags, mais links seguros (http/mailto/tel/relativo) e
 * estilos limitados (cor, tamanho, fonte, alinhamento) com valores validados.
 * Idempotente: passar o resultado de novo devolve o mesmo HTML.
 */
export function sanitizeRich(input: unknown): string {
  let out = String(input ?? '');
  out = out.replace(/<!--[\s\S]*?-->/g, '');
  out = out.replace(PERIGOSOS, '');
  return porTags(out, (match, rawTag) => {
    const tag = rawTag.toLowerCase();
    if (!RICH_TAG.test(tag)) return '';
    if (match.startsWith('</')) return `</${tag}>`;
    const parts: string[] = [];
    const style = attr(match, 'style');
    if (style) {
      const kept = decodificar(style).split(';').map((d) => d.split(':')).filter(([k, v]) => k && v && STYLE_OK[k.trim().toLowerCase()]?.test(v.trim())).map(([k, v]) => `${k!.trim().toLowerCase()}: ${v!.trim()}`);
      if (kept.length) parts.push(`style="${esc(kept.join('; '))}"`);
    }
    if (tag === 'a') {
      const href = decodificar(attr(match, 'href') ?? '').trim();
      if (/^(https?:|mailto:|tel:)/i.test(href) || /^[#./\w-][^:]*$/.test(href)) {
        parts.push(`href="${esc(href)}"`);
        if (/^https?:/i.test(href)) parts.push('target="_blank" rel="noopener noreferrer"');
      }
    }
    return parts.length ? `<${tag} ${parts.join(' ')}>` : `<${tag}>`;
  });
}
