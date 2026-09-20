import { asArray, asBool, asObject, asString, isObject } from '../../src/core/access';
import { classifyImageSrc } from '../../src/core/images';
import { normalizeProjectRows } from '../../src/migrate/legacy';
import { PAIRED_TEXT_KEYS, PROJECT_META_FIELDS, SINGLE_UI_KEYS } from '../../src/migrate/migrate';

const isValidImg = (s: unknown): boolean => classifyImageSrc(s).kind !== 'empty';
const nonEmpty = (s: unknown): boolean => asString(s).trim().length > 0;

// =========================================================== contadores v3
export function countV3Images(input: unknown): number {
  const d = asObject(input);
  const meta = asObject(d['meta']);
  const texts = asObject(d['texts']);
  let n = 0;
  for (const raw of asArray(d['projects'])) {
    const p = asObject(raw);
    if (isValidImg(p['thumb'])) n++;
    for (const row of normalizeProjectRows(p)) {
      for (const it of row.items) if (it.kind === 'image' && isValidImg(it.src)) n++;
    }
  }
  for (const raw of asArray(d['blog'])) {
    const b = asObject(raw);
    if (isValidImg(b['thumb'])) n++;
    for (const s of asArray(b['images'])) if (isValidImg(s)) n++;
  }
  for (const raw of asArray(d['gallery'])) if (isValidImg(asObject(raw)['src'])) n++;
  for (const raw of asArray(d['sketches'])) if (isValidImg(asObject(raw)['src'])) n++;
  if (isValidImg(meta['banner'])) n++;
  for (const raw of asArray(meta['homeItems'])) {
    const it = asObject(raw);
    if (it['type'] === 'image' && isValidImg(it['src'])) n++;
  }
  if (isValidImg(texts['contactImgSrc'])) n++;
  for (const page of Object.values(asObject(meta['pageBlocks']))) {
    for (const raw of asArray(page)) {
      const blk = asObject(raw);
      if (blk['type'] === 'image' && isValidImg(blk['src'])) n++;
    }
  }
  return n;
}

export function countV3Embeds(input: unknown): number {
  const d = asObject(input);
  const meta = asObject(d['meta']);
  let n = 0;
  for (const raw of asArray(d['projects'])) {
    for (const row of normalizeProjectRows(asObject(raw))) {
      for (const it of row.items) if (it.kind === 'embed' && nonEmpty(it.embedId)) n++;
    }
  }
  for (const raw of asArray(meta['homeItems'])) {
    const it = asObject(raw);
    if (it['type'] !== 'image' && nonEmpty(it['id'])) n++;
  }
  for (const page of Object.values(asObject(meta['pageBlocks']))) {
    for (const raw of asArray(page)) {
      const blk = asObject(raw);
      if ((blk['type'] === 'video' || blk['type'] === 'embed') && nonEmpty(blk['embedId'])) n++;
    }
  }
  return n;
}

export function countV3NdaItems(input: unknown): number {
  const d = asObject(input);
  let n = 0;
  for (const k of ['projects', 'blog', 'gallery', 'sketches']) {
    for (const raw of asArray(d[k])) if (asBool(asObject(raw)['nda'])) n++;
  }
  return n;
}

/** Conjunto de todos os valores de texto de exibição não-vazios do v3. */
export function collectV3Texts(input: unknown): Set<string> {
  const d = asObject(input);
  const texts = asObject(d['texts']);
  const out = new Set<string>();
  const add = (s: unknown): void => {
    const v = asString(s);
    if (v.trim()) out.add(v);
  };
  add(texts['siteName']);
  add(texts['siteRole']);
  for (const k of SINGLE_UI_KEYS) add(texts[k]);
  for (const base of PAIRED_TEXT_KEYS) {
    add(texts[`${base}Pt`]);
    add(texts[`${base}En`]);
  }
  for (const raw of asArray(d['projects'])) {
    const p = asObject(raw);
    add(p['title']);
    add(p['description']);
    for (const f of PROJECT_META_FIELDS) add(p[f]);
    for (const row of normalizeProjectRows(p)) {
      for (const it of row.items) if (it.kind === 'text') add(it.content);
    }
  }
  for (const raw of asArray(d['blog'])) {
    const b = asObject(raw);
    add(b['title']);
    add(b['date']);
    add(b['excerpt']);
    add(b['content']);
  }
  for (const raw of asArray(d['gallery'])) add(asObject(raw)['caption']);
  for (const raw of asArray(d['sketches'])) add(asObject(raw)['alt']);
  return out;
}

// =========================================================== contadores v4
function isI18n(v: unknown): v is { pt: string; en: string } {
  return isObject(v) && typeof v['pt'] === 'string' && typeof v['en'] === 'string' && Object.keys(v).length === 2;
}
function isImageRef(v: unknown): v is { assetId?: string; url?: string } {
  return isObject(v) && 'alt' in v && ('assetId' in v || 'url' in v);
}
function isEmbedRef(v: unknown): v is { provider: string; ref: string } {
  return isObject(v) && typeof v['provider'] === 'string' && typeof v['ref'] === 'string';
}

function walk(node: unknown, visit: (n: unknown) => void): void {
  visit(node);
  if (Array.isArray(node)) {
    for (const x of node) walk(x, visit);
  } else if (isObject(node)) {
    for (const x of Object.values(node)) walk(x, visit);
  }
}

export function countV4Images(data: unknown): number {
  let n = 0;
  walk(data, (node) => {
    if (isImageRef(node)) {
      if (asString(node.assetId).trim() || asString(node.url).trim()) n++;
    }
  });
  return n;
}

export function countV4Embeds(data: unknown): number {
  let n = 0;
  walk(data, (node) => {
    if (isEmbedRef(node) && nonEmpty(node.ref)) n++;
  });
  return n;
}

export function countV4NdaItems(data: unknown): number {
  const d = asObject(data);
  const cols = asObject(d['collections']);
  let n = 0;
  for (const k of ['projects', 'blog', 'gallery', 'sketches']) {
    for (const raw of asArray(cols[k])) if (asObject(raw)['visibility'] === 'nda') n++;
  }
  return n;
}

export function collectV4Texts(data: unknown): Set<string> {
  const out = new Set<string>();
  walk(data, (node) => {
    if (isI18n(node)) {
      if (node.pt.trim()) out.add(node.pt);
      if (node.en.trim()) out.add(node.en);
    }
  });
  return out;
}
