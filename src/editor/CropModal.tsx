import { useEffect, useRef, useState } from 'react';
import type { ImageCrop } from '../schema/v4';

type Rect = { x: number; y: number; w: number; h: number };

const PRESETS: { label: string; ratio: number | 'free' | 'orig' }[] = [
  { label: 'Livre', ratio: 'free' },
  { label: 'Original', ratio: 'orig' },
  { label: '16:9', ratio: 16 / 9 },
  { label: '4:3', ratio: 4 / 3 },
  { label: '1:1', ratio: 1 },
  { label: '3:4', ratio: 3 / 4 },
  { label: '9:16', ratio: 9 / 16 },
];

const MIN = 0.04;
const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

/** Maior retângulo centralizado com a proporção `ratio` (em pixels) dentro da imagem. */
function fitRect(ratio: number, natW: number, natH: number): Rect {
  const imgRatio = natW / natH;
  if (ratio > imgRatio) {
    const h = imgRatio / ratio;
    return { x: 0, y: (1 - h) / 2, w: 1, h };
  }
  const w = ratio / imgRatio;
  return { x: (1 - w) / 2, y: 0, w, h: 1 };
}

/**
 * Recortador não destrutivo: a imagem original fica intacta; o recorte é uma
 * janela (x, y, w, h em frações da imagem) + a proporção resultante (`ar`),
 * usada pelo renderer para exibir só o trecho escolhido em qualquer tamanho.
 */
export function CropModal({ src, initial, lockRatio, onApply, onClose }: { src: string; initial?: ImageCrop; lockRatio?: number; onApply: (crop: ImageCrop | undefined) => void; onClose: () => void }): React.ReactElement {
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const [rect, setRect] = useState<Rect>(initial ? { x: initial.x, y: initial.y, w: initial.w, h: initial.h } : { x: 0, y: 0, w: 1, h: 1 });
  const [ratio, setRatio] = useState<number | 'free' | 'orig'>(lockRatio ?? 'free');
  const stage = useRef<HTMLDivElement>(null);

  // Proporção em pixels exigida pelo preset (null = livre).
  const pxRatio = (): number | null => (!nat ? null : ratio === 'free' ? null : ratio === 'orig' ? nat.w / nat.h : ratio);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const choose = (r: number | 'free' | 'orig'): void => {
    setRatio(r);
    if (!nat || r === 'free') return;
    setRect(fitRect(r === 'orig' ? nat.w / nat.h : r, nat.w, nat.h));
  };

  // Ao carregar com proporção travada (capa 16:9) e sem recorte anterior, já propõe o enquadramento.
  const onLoad = (e: React.SyntheticEvent<HTMLImageElement>): void => {
    const n = { w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight };
    setNat(n);
    if (lockRatio && !initial) setRect(fitRect(lockRatio, n.w, n.h));
  };

  /** Arrasta a moldura inteira ('move') ou um canto ('nw' | 'ne' | 'sw' | 'se'). */
  const startDrag = (mode: 'move' | 'nw' | 'ne' | 'sw' | 'se') => (e: React.PointerEvent): void => {
    e.preventDefault();
    e.stopPropagation();
    const box = stage.current?.getBoundingClientRect();
    if (!box || !nat || box.width <= 0 || box.height <= 0) return;
    const start = { px: e.clientX, py: e.clientY, r: rect };
    const r = pxRatio();
    // proporção em frações: w/h = r * (natH / natW)
    const fr = r ? r * (nat.h / nat.w) : null;
    const move = (ev: PointerEvent): void => {
      const dx = (ev.clientX - start.px) / box.width;
      const dy = (ev.clientY - start.py) / box.height;
      const s = start.r;
      if (mode === 'move') {
        setRect({ ...s, x: clamp(s.x + dx, 0, 1 - s.w), y: clamp(s.y + dy, 0, 1 - s.h) });
        return;
      }
      // Canto oposto fica fixo.
      const ax = mode === 'nw' || mode === 'sw' ? s.x + s.w : s.x;
      const ay = mode === 'nw' || mode === 'ne' ? s.y + s.h : s.y;
      let px = clamp((mode === 'nw' || mode === 'sw' ? s.x : s.x + s.w) + dx, 0, 1);
      let py = clamp((mode === 'nw' || mode === 'ne' ? s.y : s.y + s.h) + dy, 0, 1);
      let w = Math.max(MIN, Math.abs(px - ax));
      let h = Math.max(MIN, Math.abs(py - ay));
      if (fr) {
        // Mantém a proporção: usa a maior dimensão arrastada e respeita os limites da imagem.
        if (w / h > fr) h = w / fr;
        else w = h * fr;
        const maxW = px < ax ? ax : 1 - ax;
        const maxH = py < ay ? ay : 1 - ay;
        const k = Math.min(1, maxW / w, maxH / h);
        w *= k;
        h *= k;
      }
      px = px < ax ? ax - w : ax;
      py = py < ay ? ay - h : ay;
      setRect({ x: px, y: py, w, h });
    };
    const up = (): void => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const apply = (): void => {
    if (!nat) return;
    const full = rect.x <= 0.001 && rect.y <= 0.001 && rect.w >= 0.999 && rect.h >= 0.999;
    if (full) return onApply(undefined);
    const round = (v: number): number => Math.round(v * 10000) / 10000;
    onApply({ x: round(rect.x), y: round(rect.y), w: round(rect.w), h: round(rect.h), ar: round((rect.w * nat.w) / (rect.h * nat.h)) });
  };

  const pct = (v: number): string => `${v * 100}%`;
  // Tamanho de exibição explícito (SVGs sem tamanho próprio encolheriam a zero).
  const dispSize = (): React.CSSProperties | undefined => {
    if (!nat || !nat.w || !nat.h) return undefined;
    const maxW = Math.min(window.innerWidth * 0.86, 1060);
    const maxH = window.innerHeight * 0.66;
    const k = Math.min(maxW / nat.w, maxH / nat.h);
    return { width: Math.round(nat.w * k), height: Math.round(nat.h * k) };
  };
  const outW = nat ? Math.round(rect.w * nat.w) : 0;
  const outH = nat ? Math.round(rect.h * nat.h) : 0;

  return (
    <div className="crop-modal" role="dialog" aria-modal="true" aria-label="Recortar imagem" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="crop-panel">
        <div className="crop-head">
          <strong>Recortar imagem</strong>
          <span className="crop-size">{nat ? `${outW} × ${outH}px` : 'carregando…'}</span>
        </div>
        <div className="crop-presets">
          {lockRatio ? (
            <span className="crop-lock">Proporção fixa deste lugar ({lockRatio === 16 / 9 ? '16:9' : lockRatio.toFixed(2)})</span>
          ) : (
            PRESETS.map((p) => (
              <button key={p.label} type="button" className={ratio === p.ratio ? 'on' : ''} onClick={() => choose(p.ratio)}>{p.label}</button>
            ))
          )}
        </div>
        <div className="crop-stage" ref={stage}>
          <img src={src} alt="" onLoad={onLoad} draggable={false} style={dispSize()} />
          {nat ? (
            <div className="crop-rect" style={{ left: pct(rect.x), top: pct(rect.y), width: pct(rect.w), height: pct(rect.h) }} onPointerDown={startDrag('move')}>
              {(['nw', 'ne', 'sw', 'se'] as const).map((c) => (
                <span key={c} className={`crop-handle ${c}`} onPointerDown={startDrag(c)} />
              ))}
            </div>
          ) : null}
        </div>
        <div className="crop-actions">
          <button type="button" className="crop-reset" onClick={() => onApply(undefined)} title="Volta a mostrar a imagem inteira">Remover recorte</button>
          <span className="crop-spacer" />
          <button type="button" onClick={onClose}>Cancelar</button>
          <button type="button" className="crop-apply" onClick={apply} disabled={!nat}>Aplicar</button>
        </div>
      </div>
    </div>
  );
}
