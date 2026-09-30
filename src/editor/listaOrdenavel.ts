import { KeyboardSensor, closestCenter, MeasuringStrategy, PointerSensor, useSensor, useSensors, type Announcements, type DndContextProps } from '@dnd-kit/core';
import type { KeyboardCoordinateGetter } from '@dnd-kit/core';

/**
 * ↑/↓ andam um lugar na ordem da lista e param o item ativo com o CENTRO no
 * centro do vizinho. O `sortableKeyboardCoordinates` do dnd-kit alinha os
 * fundos e escolhe o vizinho por geometria: com linhas de alturas diferentes
 * (página com projetos aninhados, seção com blocos) o retângulo alto continua
 * mais perto de si mesmo e o item nunca sai do lugar.
 */
const coordenadasDoTeclado: KeyboardCoordinateGetter = (event, { context: { active, over, collisionRect, droppableRects, droppableContainers } }) => {
  if (event.code !== 'ArrowDown' && event.code !== 'ArrowUp') return undefined;
  event.preventDefault();
  if (!active || !collisionRect) return undefined;
  const ativo = droppableContainers.get(active.id);
  const ordem = (ativo?.data.current as { sortable?: { items?: (string | number)[] } } | undefined)?.sortable?.items;
  if (!ordem) return undefined;
  const aqui = ordem.indexOf(over?.id ?? active.id);
  const alvoId = ordem[aqui + (event.code === 'ArrowDown' ? 1 : -1)];
  const alvo = alvoId === undefined ? undefined : droppableRects.get(alvoId);
  if (!alvo) return undefined;
  return {
    x: alvo.left + (alvo.width - collisionRect.width) / 2,
    y: alvo.top + (alvo.height - collisionRect.height) / 2,
  };
};

/**
 * Sensores ÚNICOS de toda lista arrastável do editor: mouse (com folga de 4 px
 * para o clique não virar arraste) e teclado (Espaço pega, setas movem,
 * Espaço solta, Esc cancela). Antes só o mouse movia; a alça recebia foco e
 * se anunciava "reordenável" sem fazer nada.
 */
export function useSensoresDaLista(): ReturnType<typeof useSensors> {
  return useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: coordenadasDoTeclado }),
  );
}

const pos = (i: number | undefined): string => `Posição ${(i ?? 0) + 1}.`;
const indiceDe = (e: { over: { data: { current?: { sortable?: { index?: number } } } } | null }): number | undefined =>
  e.over?.data.current?.sortable?.index;

/** Anúncios em português para o leitor de tela (região viva do dnd-kit). */
export const ANUNCIOS_DA_LISTA: Announcements = {
  onDragStart: ({ active }) => `Item pego, posição ${((active.data.current?.sortable?.index as number | undefined) ?? 0) + 1}. Use as setas para mover, Espaço para soltar, Esc para cancelar.`,
  onDragOver: (e) => (e.over ? pos(indiceDe(e)) : 'Fora da lista.'),
  onDragEnd: (e) => (e.over ? `Solto na posição ${(indiceDe(e) ?? 0) + 1}.` : 'Solto fora da lista, nada mudou.'),
  onDragCancel: () => 'Movimento cancelado.',
};

export const ACESSIBILIDADE_DA_LISTA: NonNullable<DndContextProps['accessibility']> = {
  announcements: ANUNCIOS_DA_LISTA,
  screenReaderInstructions: {
    draggable: 'Para reordenar, aperte Espaço, mova com as setas e aperte Espaço de novo. Esc cancela.',
  },
};

/** Mede as linhas sempre (não só ao começar): o teclado depende de retângulos em dia. */
export const MEDICAO_DA_LISTA: NonNullable<DndContextProps['measuring']> = {
  droppable: { strategy: MeasuringStrategy.Always },
};

/**
 * Detecção de colisão única. Com o teclado o item para no CENTRO do vizinho
 * (ver `coordenadasDoTeclado`), então o centro mais próximo é sempre o certo.
 */
export const COLISAO_DA_LISTA = closestCenter;
