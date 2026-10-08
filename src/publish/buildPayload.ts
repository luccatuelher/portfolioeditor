import type { MigratedAsset } from '../migrate/migrate';
import type { PortfolioV4 } from '../schema/v4';
import { selarPacoteNda, type EncryptedNda } from './nda';
import { mergeNda, ndaCount, publicSnapshot, type NdaBundle } from './publicSnapshot';
import { repairDoc } from '../migrate/repair';
import { completarDimensoes } from '../core/dimensoesImagem';
import { descartarCapasInteiras, miniaturasDoSite, type GerarMiniatura } from '../core/miniaturas';

export interface PublishPayload {
  /** Documento público (sem NDA/rascunho). */
  publicData: PortfolioV4;
  /** assetId → data URL, apenas os referenciados pelo público. */
  assetMap: Record<string, string>;
  /** Blob NDA cifrado (ou null se não há itens NDA ou sem senha). */
  ndaBlob: EncryptedNda | null;
  /** assetId → bytes (para preflight de tamanho). */
  assetSizes: Record<string, number>;
  /** Imagem de compartilhamento gerada como arquivo ao lado (ver imagemSocial.ts). */
  arquivoSocial?: string;
}

function dataUrlBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(',');
  const payload = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  return /;base64/i.test(dataUrl.slice(0, comma)) ? Math.floor((payload.length * 3) / 4) : payload.length;
}

/**
 * Monta o payload de publicação a partir do resultado da migração:
 * separa público × NDA, poda assets, encripta o bundle NDA. Testável sem Vite.
 */
export async function buildPublishPayload(
  migrated: { data: PortfolioV4; assets: MigratedAsset[] },
  ndaPassword?: string,
  opts: { miniatura?: GerarMiniatura } = {},
): Promise<PublishPayload> {
  const byId = new Map(migrated.assets.map((a) => [a.id, a.dataUrl]));
  // Toda imagem sai com largura e altura (o site reserva o espaço antes de a foto chegar).
  const snap = publicSnapshot(completarDimensoes(migrated.data, byId));
  const nda = snap.nda;
  // O site publicado valida os dados ao abrir: garante aqui que eles saem válidos.
  const publicData = repairDoc(snap.data).doc ?? snap.data;

  const assetMap: Record<string, string> = {};
  const assetSizes: Record<string, number> = {};
  for (const id of Object.keys(publicData.assets)) {
    const url = byId.get(id);
    if (url) {
      assetMap[id] = url;
      assetSizes[id] = dataUrlBytes(url);
    }
  }

  // Miniaturas das imagens em grade (quem publica tem canvas: o editor). Sem
  // gerador — publicação pela linha de comando —, a grade usa a foto inteira.
  if (opts.miniatura) {
    for (const [id, url] of Object.entries(await miniaturasDoSite(publicData, assetMap, opts.miniatura))) {
      assetMap[id] = url;
      assetSizes[id] = dataUrlBytes(url);
    }
    // A capa que só aparece em card não precisa da foto inteira no arquivo.
    descartarCapasInteiras(publicData, [assetMap, assetSizes], (mini) => !!assetMap[mini]);
  }

  const hasNda = ndaCount(nda) > 0;
  let ndaBlob: EncryptedNda | null = null;
  if (hasNda && ndaPassword) {
    // Inclui os data URLs dos assets NDA dentro do bundle cifrado.
    const ndaAssets: Record<string, string> = {};
    const collect = (obj: unknown): void => {
      if (Array.isArray(obj)) obj.forEach(collect);
      else if (obj && typeof obj === 'object') {
        const r = obj as Record<string, unknown>;
        if (typeof r['assetId'] === 'string') {
          const url = byId.get(r['assetId']);
          if (url) ndaAssets[r['assetId']] = url;
        }
        Object.values(r).forEach(collect);
      }
    };
    collect(nda);
    if (opts.miniatura) {
      // Mesma regra do público, para o que o visitante vê ao destrancar: miniatura
      // das imagens em grade que o pacote carrega e, nas que só servem de capa, sem a
      // foto inteira — o pacote todo visitante baixa. O pacote é autossuficiente
      // (miniatura própria mesmo se o público já tem a mesma): o `publicar:site` sem
      // senha reaproveita o pacote antigo ao lado de dados públicos novos.
      const vista = mergeNda(publicData, nda as NdaBundle);
      Object.assign(ndaAssets, await miniaturasDoSite(vista, { ...ndaAssets }, opts.miniatura));
      descartarCapasInteiras(vista, [ndaAssets], (mini) => !!ndaAssets[mini]);
    }
    ndaBlob = await selarPacoteNda({ items: nda as NdaBundle, assets: ndaAssets }, ndaPassword);
  }

  return { publicData, assetMap, ndaBlob, assetSizes };
}
