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

function collectAssetIds(node: unknown, out: Set<string>): void {
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

export function parseBackup(json: string): Backup {
  const raw: unknown = JSON.parse(json);
  const obj = isObject(raw) ? raw : {};

  if (obj['format'] === 'portfolio-v4-backup' && obj['doc']) {
    const doc = upgradeDoc(PortfolioV4Schema.safeParse(obj['doc']).data ?? repairOrThrow(obj['doc']));
    const assets = isObject(obj['assets']) ? (obj['assets'] as Record<string, string>) : {};
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
