import type { Block, Page, PortfolioV4, Section } from '../schema/v4';
import { linksPorId } from '../core/links';

/**
 * Páginas sem as quais o site e o editor não funcionam: a Home (rota vazia) e
 * os modelos de detalhe de projeto e nota (o editor abre um projeto por eles).
 * O código conta com elas; um backup antigo ou um arquivo mexido à mão podia
 * não ter — abrir um projeto derrubava o editor inteiro. Repor sem conteúdo.
 */
const PAGINAS_ESTRUTURAIS: Page[] = [
  { id: 'home', slug: '', title: { pt: 'Home', en: 'Home' }, kind: 'static', visibility: 'public', sections: [] },
  { id: 'project-detail', slug: 'project/:id', title: { pt: 'Projeto', en: 'Project' }, kind: 'template', collection: 'projects', visibility: 'public', sections: [] },
  { id: 'blog-detail', slug: 'blog/:id', title: { pt: 'Nota', en: 'Note' }, kind: 'template', collection: 'blog', visibility: 'public', sections: [] },
];

/** Repõe as páginas estruturais que faltarem (a Home volta no começo da lista). Idempotente. */
export function garantirPaginasEstruturais(doc: PortfolioV4): void {
  for (const base of PAGINAS_ESTRUTURAIS) {
    if (doc.pages.some((p) => p.id === base.id)) continue;
    const nova = structuredClone(base);
    if (nova.id === 'home') doc.pages.unshift(nova);
    else doc.pages.push(nova);
  }
}

const uid = (): string => `b_${(globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)).replace(/-/g, '').slice(0, 12)}`;

/** O "Baixar CV" embutido no bloco Contato vira um bloco Botão independente, logo após ele. */
function splitCvButton(sections: Section[]): void {
  for (const s of sections) {
    const out: Block[] = [];
    for (const b of s.blocks) {
      out.push(b);
      if (b.type === 'contact' && b.content.cvHref) {
        out.push({ id: uid(), type: 'button', span: 12, visibility: b.visibility, content: { label: b.content.cvLabel, href: b.content.cvHref, variant: 'solid' } });
        b.content.cvHref = '';
      }
    }
    s.blocks = out;
  }
}

/**
 * Ajustes idempotentes em documentos v4 já salvos (rascunho/backup) quando o
 * comportamento evolui. Ex.: botão de CV vira bloco próprio; listas da página NDA sem filtro passam a mostrar
 * só itens NDA (antes misturavam os públicos).
 */
export function upgradeDoc(doc: PortfolioV4): PortfolioV4 {
  garantirPaginasEstruturais(doc);
  for (const page of doc.pages) splitCvButton(page.sections);
  for (const page of doc.pages) {
    if (page.visibility !== 'nda') continue;
    for (const s of page.sections) for (const b of s.blocks) {
      if (b.type === 'collection' && (!b.content.filter || b.content.filter === 'all')) b.content.filter = 'nda';
    }
  }
  // Link para página gravado pelo endereço quebrava ao renomear o endereço: passa a ser pelo id.
  linksPorId(doc);
  return doc;
}
