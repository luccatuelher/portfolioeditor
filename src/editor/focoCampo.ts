import { createContext, useContext, useEffect, useRef } from 'react';
import type { CampoId } from '../core/camposTexto';
import type { Selection } from './paths';

/**
 * Pedido de foco num campo do Inspector ("Traduzir", "Descrever"): o Editor
 * diz QUAL campo (pelo id de camposTexto) de QUAL seleção, e o próprio campo,
 * ao se ver pedido, se foca. Antes, quem pedia procurava o campo no DOM depois
 * de um tempo e adivinhava qual era pelo texto — e errava quando o painel
 * demorava a montar.
 *
 * `n` muda a cada pedido (o mesmo campo pode ser pedido de novo); `chave` é a
 * seleção de destino: o pedido só vale para ela — abrir outro projeto depois
 * não pode fazer o "Título" dele roubar o cursor.
 */
export interface PedidoFoco {
  campo: CampoId;
  chave: string;
  n: number;
}

/** Chave estável de uma seleção (para casar o pedido com o que está aberto). */
export function chaveDaSelecao(s: Selection): string {
  if (!s) return '';
  if (s.kind === 'site') return 'site';
  if (s.kind === 'page') return `page:${s.pageId}`;
  if (s.kind === 'item') return `item:${s.collection}:${s.itemId}`;
  return `${s.kind}:${s.ref.sectionId}:${'blockId' in s.ref ? s.ref.blockId : ''}`;
}

interface Contexto {
  pedido: PedidoFoco | null;
  /** O campo pedido já foi atendido: o Editor descarta o pedido. */
  atender: (n: number) => void;
}

export const FocoCampoContext = createContext<Contexto>({ pedido: null, atender: () => {} });

/** O pedido de foco em aberto para a seleção atual (o Inspector usa para mostrar a aba Conteúdo). */
export function usePedidoFoco(): PedidoFoco | null {
  return useContext(FocoCampoContext).pedido;
}

const FOCAVEL = 'input, textarea, [contenteditable="true"]';

/**
 * Campo do Inspector que atende o pedido quando é ele: abre o grupo recolhido
 * em que está, rola até aparecer e põe o cursor. O editor rico monta o
 * contenteditable um instante depois — tenta de novo por alguns quadros.
 */
export function useFocoDoCampo(campo: CampoId | undefined, ref: React.RefObject<HTMLElement | null>): void {
  const { pedido, atender } = useContext(FocoCampoContext);
  const atendido = useRef(0);
  const quadro = useRef(0);
  // Só ao sair da tela: uma nova renderização não pode cortar as tentativas.
  useEffect(() => () => cancelAnimationFrame(quadro.current), []);
  useEffect(() => {
    if (!pedido || !campo || pedido.campo !== campo || atendido.current === pedido.n) return;
    atendido.current = pedido.n;
    const n = pedido.n;
    let tentativas = 20;
    const focar = (): void => {
      const caixa = ref.current;
      const alvo = caixa?.matches(FOCAVEL) ? caixa : caixa?.querySelector<HTMLElement>(FOCAVEL);
      if (!alvo) {
        if (--tentativas > 0) quadro.current = requestAnimationFrame(focar);
        else atender(n);
        return;
      }
      const grupo = alvo.closest('details');
      if (grupo && !grupo.open) grupo.open = true;
      alvo.scrollIntoView({ block: 'center' });
      alvo.focus();
      atender(n);
    };
    focar();
  });
}
