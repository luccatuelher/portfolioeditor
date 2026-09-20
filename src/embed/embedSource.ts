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
        ['youtube.com', 'www.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com', 'youtu.be'].includes(host)
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
    for (const k of Object.keys(options)) q.set(k, options[k]!);
    return `https://player.vimeo.com/video/${id}?${q.toString()}`;
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
