const ALLOWED = new Set(['P', 'DIV', 'SPAN', 'BR', 'STRONG', 'B', 'EM', 'I', 'U', 'S', 'UL', 'OL', 'LI', 'H1', 'H2', 'H3', 'H4', 'BLOCKQUOTE', 'A', 'FONT']);

/** Propriedades de estilo aceitas e o formato de valor permitido para cada uma. */
const STYLE_RULES: Record<string, RegExp> = {
  color: /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|[a-z]+)$/i,
  'font-size': /^\d+(\.\d+)?(px|rem|em|%)$/,
  'font-family': /^[\w\s,"'-]+$/,
  'text-align': /^(left|right|center|justify|start|end)$/,
};

/** http(s), mailto, tel, âncora ou caminho relativo (ex.: cv.pdf). Nada de javascript:/data:. */
function safeHref(href: string): string | null {
  const h = href.trim();
  if (/^(https?:|mailto:|tel:)/i.test(h) || /^[#./\w-][^:]*$/.test(h)) return h;
  return null;
}

function cleanStyle(el: HTMLElement): string {
  const out: string[] = [];
  for (const [prop, re] of Object.entries(STYLE_RULES)) {
    const v = el.style.getPropertyValue(prop).trim();
    if (v && re.test(v)) out.push(`${prop}: ${v}`);
  }
  return out.join('; ');
}

/**
 * Sanitiza HTML de edição inline (contentEditable/execCommand) antes de gravar
 * no documento: só tags de formatação, links seguros e um punhado de estilos
 * (cor, tamanho, fonte, alinhamento) com valores validados.
 * Usa DOM (roda no navegador, no editor). Portado do `richText` do v3.
 */
export function sanitizeInlineHtml(html: string): string {
  // Documento inerte: num <div> do documento vivo, um <img onerror> colado
  // chegava a carregar (e rodar) antes de ser removido logo abaixo.
  const inerte = document.implementation.createHTMLDocument('');
  const box = inerte.createElement('div');
  box.innerHTML = String(html || '');
  box.querySelectorAll('script,style,iframe,object,embed,link,meta,svg,math,img,video,audio,input,button,textarea,select').forEach((el) => el.remove());
  for (const el of Array.from(box.querySelectorAll<HTMLElement>('*'))) {
    if (!ALLOWED.has(el.tagName)) {
      el.replaceWith(...Array.from(el.childNodes));
      continue;
    }
    // <font> (execCommand) → <span style> equivalente.
    let node: HTMLElement = el;
    if (el.tagName === 'FONT') {
      const span = inerte.createElement('span');
      const color = el.getAttribute('color');
      const face = el.getAttribute('face');
      if (color) span.style.color = color;
      if (face) span.style.fontFamily = face;
      span.setAttribute('style', `${span.getAttribute('style') ?? ''};${el.getAttribute('style') ?? ''}`);
      span.append(...Array.from(el.childNodes));
      el.replaceWith(span);
      node = span;
    }
    const style = cleanStyle(node);
    const href = node.tagName === 'A' ? safeHref(node.getAttribute('href') ?? '') : null;
    for (const a of Array.from(node.attributes)) node.removeAttribute(a.name);
    if (style) node.setAttribute('style', style);
    if (node.tagName === 'A') {
      if (!href) {
        node.replaceWith(...Array.from(node.childNodes));
        continue;
      }
      node.setAttribute('href', href);
      if (/^https?:/i.test(href)) {
        node.setAttribute('target', '_blank');
        node.setAttribute('rel', 'noopener noreferrer');
      }
    }
  }
  return box.innerHTML;
}
