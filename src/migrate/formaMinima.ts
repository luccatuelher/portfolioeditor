import { defaultTheme, DEFAULT_HEADER, DEFAULT_LAYOUT, SCHEMA_VERSION } from '../schema/defaults';

type Obj = Record<string, unknown>;

/**
 * Antes de validar: repõe as partes que dá para repor sem inventar conteúdo.
 * Perder o tema ou a lista de projetos não pode custar as PÁGINAS do usuário —
 * o conteúdo dele está nelas.
 */
export function reporBasico(d: Obj, fixes: string[]): void {
  if (d['schemaVersion'] !== SCHEMA_VERSION && typeof d['schemaVersion'] === 'number') {
    d['schemaVersion'] = SCHEMA_VERSION;
    fixes.push('versão do formato normalizada');
  }
  if (!d['theme'] || typeof d['theme'] !== 'object') {
    d['theme'] = defaultTheme();
    fixes.push('tema reposto com o padrão');
  }
  const c = d['collections'];
  if (!c || typeof c !== 'object' || Array.isArray(c)) {
    d['collections'] = { projects: [], blog: [], gallery: [], sketches: [] };
    fixes.push('coleções repostas (vazias)');
  } else {
    for (const k of ['projects', 'blog', 'gallery', 'sketches']) {
      if (!Array.isArray((c as Obj)[k])) {
        (c as Obj)[k] = [];
        fixes.push(`coleção reposta (vazia): ${k}`);
      }
    }
  }
  const s = d['site'];
  if (!s || typeof s !== 'object' || Array.isArray(s)) {
    d['site'] = {
      name: { pt: '', en: '' }, role: { pt: '', en: '' }, locales: ['pt', 'en'],
      nav: [], ui: {}, header: DEFAULT_HEADER, layout: DEFAULT_LAYOUT,
    };
    fixes.push('dados do site repostos (nome e função em branco)');
  }
}
