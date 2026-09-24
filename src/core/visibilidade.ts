import type { Page, Visibility } from '../schema/v4';

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
