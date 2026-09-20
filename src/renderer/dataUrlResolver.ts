import type { MigratedAsset } from '../migrate/migrate';
import type { AssetResolver } from './context';

/**
 * Resolvedor de assets baseado nos data URLs da migração — para preview e
 * testes. Em produção (F7) haverá um resolvedor via object URLs do IDB.
 */
export function dataUrlResolver(assets: MigratedAsset[]): AssetResolver {
  const map = new Map(assets.map((a) => [a.id, a.dataUrl]));
  return (ref) => (ref.assetId ? map.get(ref.assetId) ?? '' : ref.url ?? '');
}

/** Resolvedor a partir de um mapa assetId → data URL (usado no editor/backup). */
export function mapResolver(map: Record<string, string>): AssetResolver {
  return (ref) => (ref.assetId ? map[ref.assetId] ?? '' : ref.url ?? '');
}
