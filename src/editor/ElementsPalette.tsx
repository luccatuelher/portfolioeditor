import type { Block } from '../schema/v4';
import { SECTION_PRESETS } from './sectionPresets';

/** Tipos que podem ser adicionados (Contato saiu: use Texto + Botão). */
export const ELEMENTS: { type: Block['type']; label: string; icon: string }[] = [
  { type: 'heading', label: 'Título', icon: 'H' },
  { type: 'text', label: 'Texto', icon: '¶' },
  { type: 'image', label: 'Imagem', icon: '▣' },
  { type: 'embed', label: 'Embed', icon: '▶' },
  { type: 'storyboard', label: 'Storyboard', icon: '▦' },
  { type: 'collection', label: 'Coleção', icon: '▤' },
  { type: 'spacer', label: 'Espaço', icon: '↕' },
  { type: 'divider', label: 'Divisor', icon: '—' },
  { type: 'button', label: 'Botão', icon: '⬭' },
];

/**
 * Caixa de elementos: clique para adicionar (após o bloco/na seção selecionada)
 * ou arraste para o canvas — soltar na lateral de um bloco forma uma grade.
 */
export function ElementsPalette({ onAdd, onAddSection, onDragStart, onDragEnd }: { onAdd: (t: Block['type']) => void; onAddSection: (presetId: string) => void; onDragStart: (t: Block['type']) => void; onDragEnd: () => void }): React.ReactElement {
  return (
    <div className="elements-box">
      <div className="panel-h">Elementos</div>
      <div className="elements-grid">
        {ELEMENTS.map((el) => (
          <button
            key={el.type}
            type="button"
            className="element-tile"
            draggable
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = 'copy';
              try { e.dataTransfer.setData('text/plain', el.type); } catch { /* ignore */ }
              onDragStart(el.type);
            }}
            onDragEnd={onDragEnd}
            onClick={() => onAdd(el.type)}
            title={`Adicionar ${el.label.toLowerCase()} (clique ou arraste para o canvas)`}
          >
            <span className="element-icon" aria-hidden="true">{el.icon}</span>
            {el.label}
          </button>
        ))}
      </div>
      <p className="elements-hint">Arraste para o canvas. Solte na lateral de um bloco para criar uma grade.</p>
      <div className="panel-h">Seções prontas</div>
      <div className="presets-list">
        {SECTION_PRESETS.map((p) => (
          <button key={p.id} type="button" className="preset-tile" title={p.hint} onClick={() => onAddSection(p.id)}>
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Popup de escolha do tipo de bloco (botão "＋ Adicionar bloco" do canvas). */
export function AddBlockPopup({ x, y, onPick, onClose }: { x: number; y: number; onPick: (t: Block['type']) => void; onClose: () => void }): React.ReactElement {
  const left = Math.min(x - 150, window.innerWidth - 320);
  const top = Math.min(y + 8, window.innerHeight - 250);
  return (
    <div className="add-popup-backdrop" onMouseDown={onClose}>
      <div className="add-popup" style={{ left: Math.max(8, left), top: Math.max(8, top) }} onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-label="Adicionar bloco">
        <div className="add-popup-h">Adicionar bloco</div>
        <div className="elements-grid">
          {ELEMENTS.map((el) => (
            <button key={el.type} type="button" className="element-tile" onClick={() => onPick(el.type)}>
              <span className="element-icon" aria-hidden="true">{el.icon}</span>
              {el.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
