import type { ImageRef, PortfolioV4 } from '../schema/v4';
import type { Selection } from './paths';
import { camposDeTexto, textoLimpo, type CampoId, type Dono } from '../core/camposTexto';

/**
 * Imagem publicada sem descrição (texto alternativo): o que o leitor de tela
 * lê no lugar dela, e o que o buscador entende da imagem. `alvo` é o que
 * selecionar para cair direto no campo de descrição.
 */
export interface ImagemSemDescricao {
  onde: string;
  imagem: ImageRef;
  alvo: NonNullable<Selection>;
  /** O campo de descrição no Inspector (camposTexto). */
  campo: CampoId;
  /** Quadro do storyboard a pôr em foco no Inspector. */
  quadro?: number;
}

const temImagem = (r: ImageRef): boolean => !!r.assetId || !!(r.url && r.url.trim());

/**
 * As imagens que vão para o site (rascunho não) e ainda não têm descrição.
 * Sai da lista única de campos (camposTexto) — o aviso de publicação conta
 * pela mesma função, e uma imagem nova no schema entra nas duas de uma vez.
 */
export function imagensSemDescricao(doc: PortfolioV4): ImagemSemDescricao[] {
  const out: ImagemSemDescricao[] = [];
  for (const c of camposDeTexto(doc)) {
    if (!c.publicado || !c.imagem || !temImagem(c.imagem.ref)) continue;
    if (textoLimpo(c.valor.pt) || textoLimpo(c.valor.en)) continue;
    const quadro = c.campo.match(/^frames\.(\d+)\.alt$/);
    out.push({
      onde: `${c.imagem.nome} · ${c.lugar}`,
      imagem: c.imagem.ref,
      alvo: selecaoDoDono(c.dono),
      campo: c.campo,
      ...(quadro ? { quadro: Number(quadro[1]) } : {}),
    });
  }
  return out;
}

/**
 * Um texto publicado que só existe num idioma (`tipo: 'falta'`), ou que está
 * igual nos dois (`'igual'`: a migração do portfólio antigo copiou o
 * português para o inglês). `falta` é o idioma a preencher; `campo` é o id
 * do campo no Inspector (para levar o cursor até ele).
 */
export interface TextoSemTraducao {
  onde: string;
  tipo: 'falta' | 'igual';
  falta: 'pt' | 'en';
  /** Começo do texto que existe, para a pessoa reconhecer qual é. */
  trecho: string;
  campo: CampoId;
  alvo: NonNullable<Selection>;
}

/** Iguais nos dois idiomas só contam a partir de 4 palavras: nome, título curto e termo ("Storyboard") costumam ser iguais de propósito. */
const PALAVRAS_IGUAL = 4;

/** O que selecionar para chegar ao dono de um campo. */
export function selecaoDoDono(d: Dono): NonNullable<Selection> {
  if (d.tipo === 'site') return { kind: 'site' };
  if (d.tipo === 'pagina') return { kind: 'page', pageId: d.pageId };
  if (d.tipo === 'item') return { kind: 'item', collection: d.colecao, itemId: d.itemId };
  return { kind: 'block', ref: { container: d.container, sectionId: d.sectionId, blockId: d.blockId } };
}

/**
 * Textos que vão para o site com PT e sem EN (ou o contrário) — o visitante
 * do outro idioma vê o texto do idioma que existe: funciona, mas fica pela
 * metade — e textos longos iguais nos dois (`tipo: 'igual'`), à parte. Os
 * campos vêm de camposDeTexto, a mesma lista que o canvas usa.
 */
export function textosSemTraducao(doc: PortfolioV4): TextoSemTraducao[] {
  const out: TextoSemTraducao[] = [];
  for (const c of camposDeTexto(doc)) {
    if (!c.publicado) continue;
    const pt = textoLimpo(c.valor.pt);
    const en = textoLimpo(c.valor.en);
    const texto = pt || en;
    if (!texto) continue;
    const trecho = texto.length > 40 ? `${texto.slice(0, 40)}…` : texto;
    const onde = `${c.rotulo[0]!.toUpperCase()}${c.rotulo.slice(1)} · ${c.lugar}`;
    const base = { onde, trecho, campo: c.campo, alvo: selecaoDoDono(c.dono) };
    if (!pt || !en) out.push({ ...base, tipo: 'falta', falta: pt ? 'en' : 'pt' });
    else if (pt === en && pt.split(' ').filter((w) => /\p{L}/u.test(w)).length >= PALAVRAS_IGUAL) {
      // "&", "·" e números não contam como palavra.
      out.push({ ...base, tipo: 'igual', falta: 'en' });
    }
  }
  return out;
}
