import { PortfolioV4Schema, type PortfolioV4 } from '../schema/v4';
import { migrate } from '../migrate/migrate';
import { isObject } from '../core/access';
import { upgradeDoc } from '../migrate/upgrade';
import { repairDoc } from '../migrate/repair';

/**
 * Backup portátil do portfólio: doc v4 + as imagens (data URLs) num único JSON.
 * É a ponte entre o editor (que guarda no navegador) e o `publish` (que roda no
 * Node) — herda o hábito do "baixar backup" do v3, mas agora carrega os assets.
 */
export interface Backup {
  format: 'portfolio-v4-backup';
  version: 1;
  savedAt: string;
  doc: PortfolioV4;
  assets: Record<string, string>;
}

/** Todos os assetIds referenciados em qualquer lugar de `node` (doc, versão, trecho). */
export function collectAssetIds(node: unknown, out: Set<string>): void {
  if (Array.isArray(node)) node.forEach((n) => collectAssetIds(n, out));
  else if (node && typeof node === 'object') {
    const r = node as Record<string, unknown>;
    if (typeof r['assetId'] === 'string') out.add(r['assetId']);
    Object.values(r).forEach((v) => collectAssetIds(v, out));
  }
}

export function buildBackup(doc: PortfolioV4, assets: Record<string, string>): Backup {
  const used = new Set<string>();
  collectAssetIds(doc, used);
  const pruned: Record<string, string> = {};
  for (const id of used) if (assets[id]) pruned[id] = assets[id];
  return { format: 'portfolio-v4-backup', version: 1, savedAt: new Date().toISOString(), doc, assets: pruned };
}

/**
 * Aceita três formatos:
 *  1. backup v4 completo (wrapper `portfolio-v4-backup`, com doc + imagens);
 *  2. doc v4 nu (schemaVersion 4);
 *  3. backup do app ANTIGO (v3/v2 — o `portfolio.html` exporta esse) → migra na hora.
 */
function repairOrThrow(raw: unknown): PortfolioV4 {
  const { doc } = repairDoc(raw);
  if (!doc) throw new Error('Documento v4 ilegível.');
  return doc;
}

/**
 * Só entram no mapa imagens de verdade (data:image/…). Um backup editado à mão
 * ou de outro programa podia trazer números, objetos ou endereços quaisquer,
 * que iam parar direto no src das imagens do site.
 */
function soImagens(v: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!isObject(v)) return out;
  for (const [id, url] of Object.entries(v)) if (typeof url === 'string' && /^data:image\//i.test(url)) out[id] = url;
  return out;
}

/**
 * O que dizer quando um arquivo não pôde ser importado. JSON.parse fala inglês
 * técnico ("Unexpected end of JSON input"); o caso comum é um download que não
 * terminou ou um arquivo que não é backup.
 */
export function explicarErroDeImportacao(err: unknown): string {
  if (err instanceof SyntaxError) {
    return 'O arquivo está incompleto ou corrompido: não é um JSON válido (talvez o download não tenha terminado). Nada foi alterado.';
  }
  const msg = err instanceof Error ? err.message : String(err);
  return `Não consegui importar este arquivo: ${msg} Nada foi alterado.`;
}

/** Resumo do que o backup traz, para a pessoa confirmar antes de trocar o que está aberto. */
export function resumoDoBackup(b: Backup): string {
  const c = b.doc.collections;
  const n = (q: number, um: string, varios: string): string => `${q} ${q === 1 ? um : varios}`;
  return [
    n(b.doc.pages.length, 'página', 'páginas'),
    n(c.projects.length, 'projeto', 'projetos'),
    n(c.blog.length, 'nota', 'notas'),
    n(c.gallery.length + c.sketches.length, 'imagem de galeria/sketch', 'imagens de galeria/sketch'),
    n(Object.keys(b.assets).length, 'arquivo de imagem', 'arquivos de imagem'),
  ].join(' · ');
}

export function parseBackup(json: string): Backup {
  const raw: unknown = JSON.parse(json);
  const obj = isObject(raw) ? raw : {};

  if (obj['format'] === 'portfolio-v4-backup' && obj['doc']) {
    const doc = upgradeDoc(PortfolioV4Schema.safeParse(obj['doc']).data ?? repairOrThrow(obj['doc']));
    const assets = soImagens(obj['assets']);
    return { format: 'portfolio-v4-backup', version: 1, savedAt: new Date().toISOString(), doc, assets };
  }

  if (obj['schemaVersion'] === 4) {
    const doc = upgradeDoc(PortfolioV4Schema.safeParse(raw).data ?? repairOrThrow(raw));
    return { format: 'portfolio-v4-backup', version: 1, savedAt: new Date().toISOString(), doc, assets: {} };
  }

  // Backup do app antigo (v3/v2): migra e extrai as imagens (data URLs).
  const looksLikePortfolio =
    ['projects', 'blog', 'gallery', 'sketches'].some((k) => Array.isArray(obj[k])) ||
    isObject(obj['meta']) ||
    isObject(obj['texts']) ||
    typeof obj['schemaVersion'] === 'number';
  if (!looksLikePortfolio) throw new Error('Arquivo não parece um backup de portfólio.');
  const migrated = migrate(raw);
  const assets: Record<string, string> = {};
  for (const a of migrated.assets) assets[a.id] = a.dataUrl;
  return { format: 'portfolio-v4-backup', version: 1, savedAt: new Date().toISOString(), doc: migrated.data, assets };
}
