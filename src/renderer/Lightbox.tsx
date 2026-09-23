import { useCallback, useEffect, useRef } from 'react';
import type { LightItem } from './context';
import { cropImgStyle } from './blocks';

/**
 * Visualizador de imagem (storyboard, galeria, sketches): overlay escuro sobre
 * a página, imagem centralizada e ajustada à tela, sem barra de comandos.
 * Fecha clicando fora, com Esc, com o ✕ (no toque) ou com o "voltar" do
 * navegador (quem abre cuida do histórico); ao fechar, o foco volta para quem
 * abriu. Setas laterais e ← → só quando há
 * mais de uma imagem; no celular, deslizar para o lado também troca.
 */
export function Lightbox({ items, index, onIndex, onClose }: { items: LightItem[]; index: number; onIndex: (i: number) => void; onClose: () => void }): React.ReactElement | null {
  const boxRef = useRef<HTMLDivElement>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const clamped = Math.max(0, Math.min(index, items.length - 1));
  const many = items.length > 1;
  const step = useCallback((d: number) => onIndex((clamped + d + items.length) % items.length), [clamped, items.length, onIndex]);

  useEffect(() => {
    // Quem abriu (a miniatura, o quadro) recebe o foco de volta ao fechar;
    // sem isso, quem navega pelo teclado recomeça do topo da página.
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    boxRef.current?.focus();
    // Trava a rolagem da página enquanto o overlay está aberto.
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
      else if (e.key === 'Tab') {
        const f = boxRef.current?.querySelectorAll<HTMLElement>('button');
        if (!f || !f.length) { e.preventDefault(); return; }
        const first = f[0]!;
        const last = f[f.length - 1]!;
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
      else if (many && e.key === 'ArrowRight') { e.preventDefault(); step(1); }
      else if (many && e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step, onClose, many]);

  if (!items.length) return null;
  const current = items[clamped]!;
  const stop = (e: React.MouseEvent): void => e.stopPropagation();
  // Deslizar para o lado troca a imagem; deslizar de leve (ou tocar) não conta.
  const onTouchStart = (e: React.TouchEvent): void => {
    const t0 = e.touches[0];
    touch.current = t0 ? { x: t0.clientX, y: t0.clientY } : null;
  };
  const onTouchEnd = (e: React.TouchEvent): void => {
    const start = touch.current;
    const t0 = e.changedTouches[0];
    touch.current = null;
    if (!start || !t0 || !many) return;
    const dx = t0.clientX - start.x;
    const dy = t0.clientY - start.y;
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.5) step(dx < 0 ? 1 : -1);
  };

  return (
    <div className="lightbox" role="dialog" aria-modal="true" aria-label="Imagem ampliada" ref={boxRef} tabIndex={-1} onClick={onClose} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <button type="button" className="lightbox-close" onClick={(e) => { stop(e); onClose(); }} aria-label="Fechar">✕</button>
      {current.crop ? (
        <span className="lightbox-img img-crop" style={{ aspectRatio: String(current.crop.ar), width: `min(92vw, calc(var(--lb-h, 88vh) * ${current.crop.ar}))` }} onClick={stop}>
          <img src={current.src} alt={current.alt || `Imagem ${clamped + 1}`} style={cropImgStyle(current.crop)} />
        </span>
      ) : (
        <img className="lightbox-img" src={current.src} alt={current.alt || `Imagem ${clamped + 1}`} onClick={stop} />
      )}
      {many ? (
        <>
          <button type="button" className="lightbox-nav prev" onClick={(e) => { stop(e); step(-1); }} aria-label="Imagem anterior">‹</button>
          <button type="button" className="lightbox-nav next" onClick={(e) => { stop(e); step(1); }} aria-label="Próxima imagem">›</button>
          <span className="lightbox-count" aria-live="polite">{clamped + 1} / {items.length}</span>
        </>
      ) : null}
    </div>
  );
}
