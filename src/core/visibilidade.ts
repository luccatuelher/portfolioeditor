import type { Block, BlogItem, Page, PortfolioV4, ProjectItem, Section, Visibility } from '../schema/v4';

/**
 * O que vai para o site publicado — a regra num lugar só.
 *
 * Cada módulo escrevia a sua versão ("!== 'draft'", "=== 'public'", "!== 'nda'")
 * e elas divergiam: a lista de textos esquecia que os modelos de detalhe
 * sempre vão, o Editor recontava os itens NDA copiando o publicSnapshot linha
 * a linha. Quem decide de fato é o publicSnapshot; ele e os demais usam isto.
 *
 * "Vai para o site" inclui o que vai CIFRADO (NDA): aparece depois da senha.
 * "Aberto" é só o que qualquer visitante vê sem senha.
 */

/** Rascunho nunca sai do editor; público e NDA saem (NDA cifrado). */
export const vaiProSite = (v: Visibility): boolean => v !== 'draft';

/** Visível sem senha. */
export const aberto = (v: Visibility): boolean => v === 'public';

/** A página vai para o site: rascunho não — a Home e os modelos de detalhe sempre (sem eles o site não abre). */
export const paginaVaiProSite = (p: Pick<Page, 'id' | 'kind' | 'visibility'>): boolean =>
  vaiProSite(p.visibility) || p.id === 'home' || p.kind === 'template';

/** Um bloco que vai para o site, com quem o contém. */
export interface BlocoNoSite {
  bloco: Block;
  /** A página, ou o projeto/nota, onde o bloco está. */
  dono: { page: Page } | { coll: 'projects' | 'blog'; item: ProjectItem | BlogItem };
  /** Só aparece depois da senha (o bloco ou o projeto/nota é NDA). */
  nda: boolean;
}

/**
 * Todo bloco que vai para o site — de páginas, projetos e notas —, pela mesma
 * regra do publicSnapshot. Quem confere o site antes de publicar (avisos,
 * arquivos ao lado) anda por aqui, e não por um filtro próprio: cada filtro
 * solto esquecia uma parte (o NDA, as páginas em rascunho…).
 */
export function blocosQueVaoProSite(data: PortfolioV4): BlocoNoSite[] {
  const out: BlocoNoSite[] = [];
  const juntar = (sections: Section[], dono: BlocoNoSite['dono'], ndaDoDono: boolean): void => {
    for (const s of sections) for (const b of s.blocks) if (vaiProSite(b.visibility)) out.push({ bloco: b, dono, nda: ndaDoDono || !aberto(b.visibility) });
  };
  // A página NDA sai aberta (é a casca com a senha); cifrados são os itens e os blocos NDA.
  for (const page of data.pages) if (paginaVaiProSite(page)) juntar(page.sections, { page }, false);
  for (const coll of ['projects', 'blog'] as const) {
    for (const item of data.collections[coll]) if (vaiProSite(item.visibility)) juntar(item.sections, { coll, item }, !aberto(item.visibility));
  }
  return out;
}
