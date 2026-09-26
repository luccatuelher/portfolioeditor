import type { MigratedAsset } from '../migrate/migrate';
import type { AssetResolver } from './context';
import { miniId } from '../core/miniaturas';

/**
 * Do mapa id → data URL: em grade, a miniatura (se houver); fora dela, a foto
 * inteira — e a miniatura enquanto a inteira não existe no mapa.
 */
export function resolverDoMapa(get: (id: string) => string | undefined): AssetResolver {
  return (ref, uso) => {
    if (!ref.assetId) return ref.url ?? '';
    const mini = get(miniId(ref.assetId));
    return (uso === 'miniatura' ? mini ?? get(ref.assetId) : get(ref.assetId) ?? mini) ?? '';
  };
}

/**
 * Resolvedor de assets baseado nos data URLs da migração — para preview e
 * testes. Em produção (F7) haverá um resolvedor via object URLs do IDB.
 */
export function dataUrlResolver(assets: MigratedAsset[]): AssetResolver {
  const map = new Map(assets.map((a) => [a.id, a.dataUrl]));
  return resolverDoMapa((id) => map.get(id));
}

/** Resolvedor a partir de um mapa assetId → data URL (usado no editor/backup). */
export function mapResolver(map: Record<string, string>): AssetResolver {
  return resolverDoMapa((id) => map[id]);
}
