import type { Block, PortfolioV4, Section } from '../schema/v4';
import { linksPorId } from '../core/links';

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
