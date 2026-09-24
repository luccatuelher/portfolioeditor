import { createContext, useContext } from 'react';
import type { DocApi } from './useDocument';
import type { Selection } from './paths';

/**
 * Excluir, igual em todo o editor: o Editor fornece a remoção que exclui na
 * hora e mostra "Excluído: … · Desfazer" (nada de confirm() do navegador).
 * Painéis e Inspector pegam daqui, em vez de cada um apagar do seu jeito.
 */
export const RemoverContext = createContext<((sel: NonNullable<Selection>) => void) | null>(null);

/** Remoção do editor; fora dele (testes de componente), apaga direto no documento. */
export function useRemover(doc: DocApi): (sel: NonNullable<Selection>) => void {
  const remover = useContext(RemoverContext);
  if (remover) return remover;
  return (sel) => {
    if (sel.kind === 'block') doc.deleteBlock(sel.ref);
    else if (sel.kind === 'section') doc.deleteSection(sel.ref.container, sel.ref.sectionId);
    else if (sel.kind === 'item') doc.deleteItem(sel.collection, sel.itemId);
    else if (sel.kind === 'page') doc.deletePage(sel.pageId);
  };
}
