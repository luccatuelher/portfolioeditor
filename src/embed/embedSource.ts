/**
 * Porta pura de `embedSource` do v3 (legacy/index.html l.2215).
 * Normaliza YouTube / Vimeo / Speaker Deck a partir de URL, ID cru ou <iframe>.
 * Sem dependência de DOM: o caso <iframe> extrai o `src` via regex.
 */

export type EmbedProvider = 'youtube' | 'vimeo' | 'speakerdeck';

export interface EmbedInput {
  type?: string;
  /** URL, id cru ou trecho <iframe ...>. No v3 este campo chama-se `id`/`embedId`. */
  id?: string;
  autoplay?: string | boolean;
  loop?: string | boolean;
  muted?: string | boolean;
  background?: string | boolean;
  controls?: string | boolean;
  start?: string | number;
}

const OPTION_KEYS = ['autoplay', 'loop', 'muted', 'background', 'controls', 'start'] as const;

/**
 * Converte o tempo que vem no link para segundos.
 *
 * Quem copia o link "a partir deste momento" recebe `?t=90`, `?t=1m30s` ou
 * `#t=90s` — e o vídeo começava do zero assim mesmo, porque só o parâmetro
 * `start` era lido.
 */
export function segundosDoTempo(valor: string | null | undefined): string | null {
  if (!valor) return null;
  const v = valor.trim().toLowerCase();
  if (/^\d+$/.test(v)) return v === '0' ? null : v;
  const m = v.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
  if (!m || (!m[1] && !m[2] && !m[3])) return null;
  const s = Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
  return s > 0 ? String(s) : null;
}

function extractIframeSrc(input: string): string {
  const m = input.match(/<iframe[^>]*\ssrc\s*=\s*["']([^"']+)["']/i);
  return m ? m[1]! : '';
}

export function embedSource(embed: EmbedInput | null | undefined): string {
  if (!embed || !embed.id) return '';
  let type = embed.type;
  let input = String(embed.id).trim();
  let hash = '';
  const options: Record<string, string> = {};

  if (input.startsWith('<')) input = extractIframeSrc(input);
  let id = input;

  if (/^https?:\/\//.test(input)) {
    try {
      const u = new URL(input);
      const host = u.hostname.toLowerCase();
      if (host === 'vimeo.com' || host === 'www.vimeo.com' || host === 'player.vimeo.com') {
        type = 'vimeo';
        const mm = u.pathname.match(/\/(?:video\/)?(\d+)(?:\/([a-zA-Z0-9]+))?/);
        if (!mm) return '';
        id = mm[1]!;
        hash = u.searchParams.get('h') || mm[2] || '';
      } else if (
        ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com', 'youtu.be'].includes(host)
      ) {
        type = 'youtube';
        id = host === 'youtu.be' ? u.pathname.slice(1) : u.searchParams.get('v') || u.pathname.split('/').pop() || '';
      } else if (host === 'speakerdeck.com' && u.pathname.startsWith('/player/')) {
        type = 'speakerdeck';
        id = u.pathname.split('/').pop() || '';
      } else {
        return '';
      }
      for (const k of OPTION_KEYS) {
        const v = u.searchParams.get(k);
        if (v === null) continue;
        if (k === 'start' ? /^\d+$/.test(v) : v === '0' || v === '1') options[k] = v;
      }
      // "?t=" (YouTube) e "#t=" (Vimeo): o momento que quem copiou o link escolheu.
      const tempo = segundosDoTempo(u.searchParams.get('t') ?? (u.hash.startsWith('#t=') ? u.hash.slice(3) : null));
      if (tempo && !options.start) options.start = tempo;
    } catch {
      return '';
    }
  }

  for (const k of OPTION_KEYS) {
    if (options[k] !== undefined) continue;
    const raw = embed[k as keyof EmbedInput];
    if (raw === undefined) continue;
    let v = raw === true ? '1' : raw === false ? '0' : String(raw);
    if (k === 'start' ? /^\d+$/.test(v) : v === '0' || v === '1') options[k] = v;
  }

  if (type === 'vimeo' && /^\d+$/.test(id)) {
    const q = new URLSearchParams({ title: '0', byline: '0' });
    if (hash && /^[a-zA-Z0-9]+$/.test(hash)) q.set('h', hash);
    // O Vimeo começa num ponto pelo fragmento (#t=90s), não por parâmetro.
    const inicio = options.start;
    for (const k of Object.keys(options)) if (k !== 'start') q.set(k, options[k]!);
    return `https://player.vimeo.com/video/${id}?${q.toString()}${inicio ? `#t=${inicio}s` : ''}`;
  }
  if (type === 'youtube' && /^[a-zA-Z0-9_-]{11}$/.test(id)) {
    const y = new URLSearchParams({ rel: '0' });
    if (options.start && /^\d+$/.test(options.start)) y.set('start', options.start);
    return `https://www.youtube-nocookie.com/embed/${id}?${y.toString()}`;
  }
  if (type === 'speakerdeck' && /^[a-fA-F0-9]{32}$/.test(id)) {
    return `https://speakerdeck.com/player/${id}`;
  }
  return '';
}

/** Provider normalizado, ou null quando o embed não resolve. */
export function embedProvider(embed: EmbedInput | null | undefined): EmbedProvider | null {
  const src = embedSource(embed);
  if (!src) return null;
  if (src.includes('player.vimeo.com')) return 'vimeo';
  if (src.includes('youtube-nocookie.com')) return 'youtube';
  if (src.includes('speakerdeck.com')) return 'speakerdeck';
  return null;
}

/**
 * Por que este embed não virou player — em linguagem de gente.
 *
 * Antes, qualquer valor que não resolvia produzia o mesmo "cole o link do
 * vídeo", inclusive quando a pessoa TINHA colado um link: o Speaker Deck, por
 * exemplo, só embute pelo código <iframe> (o id do player não aparece na URL
 * da apresentação). Sem essa distinção, a pessoa fica tentando o mesmo caminho.
 */
export function motivoDoEmbedVazio(embed: EmbedInput | null | undefined): string {
  const bruto = String(embed?.id ?? '').trim();
  if (!bruto) return 'Cole o link do vídeo (YouTube ou Vimeo) ou o código de incorporar.';
  if (/speakerdeck\.com/i.test(bruto) && !/\/player\//i.test(bruto)) {
    return 'Speaker Deck: a página da apresentação não serve para incorporar. Abra "Embed" lá e cole o código <iframe> aqui.';
  }
  if (/^https?:\/\//i.test(bruto)) {
    if (/youtu\.?be/i.test(bruto)) return 'Link do YouTube não reconhecido — confira se ele abre o vídeo no navegador.';
    if (/vimeo\.com/i.test(bruto)) return 'Link do Vimeo não reconhecido — use o endereço do vídeo (vimeo.com/123456789).';
    return 'Este site não é suportado. Vale YouTube, Vimeo e Speaker Deck (pelo código de incorporar).';
  }
  if (bruto.startsWith('<')) return 'Código de incorporar sem endereço reconhecido — copie o <iframe> inteiro.';
  return 'Não reconheci isso como vídeo. Cole o link do YouTube/Vimeo ou o código de incorporar.';
}

/**
 * Endereço de ver o vídeo no site de origem, a partir do endereço do player.
 * Vai para o papel: na impressão o player não toca, e o link é o que resta.
 * Sem os parâmetros de reprodução (autoplay, mudo…); desconhecido volta como está.
 */
export function linkDoEmbed(src: string): string {
  const yt = src.match(/youtube(?:-nocookie)?\.com\/embed\/([\w-]{11})/)?.[1];
  if (yt) return `https://youtu.be/${yt}`;
  const vimeo = src.match(/player\.vimeo\.com\/video\/(\d+)/)?.[1];
  if (vimeo) {
    // Vídeo não listado: sem o h= a página diz que o vídeo não existe.
    const h = src.match(/[?&]h=([a-zA-Z0-9]+)/)?.[1];
    return h ? `https://vimeo.com/${vimeo}/${h}` : `https://vimeo.com/${vimeo}`;
  }
  return src.split('?')[0]!;
}
