import { useEffect, useRef, useState } from 'react';
import type { Theme } from '../schema/v4';

const SIZES = [12, 14, 16, 18, 20, 24, 32, 40, 56];

/**
 * Toolbar flutuante de rich text para a edição inline no canvas: estilo de
 * parágrafo (títulos), fonte, tamanho, cor, negrito/itálico/sublinhado, lista,
 * alinhamento e link. Usa document.execCommand sobre o contentEditable focado —
 * sem libs extras, então não entra no bundle público. O HTML resultante passa
 * por `sanitizeInlineHtml` antes de ir para o documento.
 */
export function FloatingToolbar({ fonts, colors }: { fonts: Theme['fonts']; colors: Theme['colors'] }): React.ReactElement | null {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const editable = useRef<HTMLElement | null>(null);
  const range = useRef<Range | null>(null);
  const bar = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const place = (el: HTMLElement): void => {
      const r = el.getBoundingClientRect();
      setPos({ top: Math.max(8, r.top - 48), left: Math.max(8, r.left) });
    };
    const onFocus = (e: FocusEvent): void => {
      const el = e.target as HTMLElement | null;
      if (el && el.classList?.contains('inline-edit') && !el.classList.contains('plain')) {
        editable.current = el;
        place(el);
      }
    };
    const onBlur = (): void => {
      setTimeout(() => {
        const a = document.activeElement as HTMLElement | null;
        // Focar um controle da própria toolbar (select/cor) não fecha a toolbar.
        if (a && bar.current?.contains(a)) return;
        if (!a || !a.classList?.contains('inline-edit') || a.classList.contains('plain')) setPos(null);
      }, 150);
    };
    // Guarda a seleção dentro do editável: selects e o seletor de cor roubam o foco.
    const onSel = (): void => {
      const s = window.getSelection();
      if (s && s.rangeCount && editable.current?.contains(s.anchorNode)) range.current = s.getRangeAt(0).cloneRange();
    };
    document.addEventListener('focusin', onFocus);
    document.addEventListener('focusout', onBlur);
    document.addEventListener('selectionchange', onSel);
    return () => {
      document.removeEventListener('focusin', onFocus);
      document.removeEventListener('focusout', onBlur);
      document.removeEventListener('selectionchange', onSel);
    };
  }, []);

  if (!pos) return null;

  const restore = (): void => {
    const el = editable.current;
    if (!el) return;
    el.focus();
    const s = window.getSelection();
    if (s && range.current) {
      s.removeAllRanges();
      s.addRange(range.current);
    }
  };
  const exec = (c: string, v?: string): void => {
    restore();
    document.execCommand('styleWithCSS', false, 'true');
    document.execCommand(c, false, v);
  };
  const btn = (c: string, v?: string) => (e: React.MouseEvent): void => {
    e.preventDefault();
    exec(c, v);
  };
  const setSize = (px: number): void => {
    // execCommand só conhece tamanhos 1–7: marca com 7 e troca pelo px escolhido.
    exec('fontSize', '7');
    const el = editable.current;
    el?.querySelectorAll('font[size="7"], span[style*="xxx-large"]').forEach((n) => {
      const span = document.createElement('span');
      span.style.fontSize = `${px}px`;
      span.append(...Array.from(n.childNodes));
      n.replaceWith(span);
    });
    el?.dispatchEvent(new Event('input', { bubbles: true }));
  };
  const link = (e: React.MouseEvent): void => {
    e.preventDefault();
    const url = prompt('Link (https://…, mailto:…, ou arquivo.pdf). Deixe vazio para remover:', 'https://');
    if (url === null) return;
    if (!url.trim() || url.trim() === 'https://') exec('unlink');
    else exec('createLink', url.trim());
  };

  const fontOpts = [
    { label: 'Fonte', value: '' },
    { label: `Títulos · ${fonts.display}`, value: fonts.display },
    { label: `Texto · ${fonts.body}`, value: fonts.body },
    { label: `Mono · ${fonts.mono}`, value: fonts.mono },
  ];

  return (
    <div className="pe-toolbar" ref={bar} style={{ top: pos.top, left: pos.left }} onMouseDown={(e) => { if (!(e.target as HTMLElement).closest('select, input')) e.preventDefault(); }}>
      <select title="Estilo do parágrafo" defaultValue="" onChange={(e) => { if (e.target.value) exec('formatBlock', e.target.value); e.target.value = ''; }}>
        <option value="" disabled>Estilo</option>
        <option value="p">Parágrafo</option>
        <option value="h2">Título grande</option>
        <option value="h3">Título médio</option>
        <option value="h4">Título pequeno</option>
        <option value="blockquote">Citação</option>
      </select>
      <select title="Fonte" defaultValue="" onChange={(e) => { if (e.target.value) exec('fontName', e.target.value); e.target.value = ''; }}>
        {fontOpts.map((f) => <option key={f.label} value={f.value} disabled={!f.value}>{f.label}</option>)}
      </select>
      <select title="Tamanho" defaultValue="" onChange={(e) => { if (e.target.value) setSize(Number(e.target.value)); e.target.value = ''; }}>
        <option value="" disabled>Tam.</option>
        {SIZES.map((s) => <option key={s} value={s}>{s}px</option>)}
      </select>
      <span className="pe-tb-sep" />
      <button type="button" onMouseDown={btn('bold')} title="Negrito"><b>B</b></button>
      <button type="button" onMouseDown={btn('italic')} title="Itálico"><i>I</i></button>
      <button type="button" onMouseDown={btn('underline')} title="Sublinhado"><u>U</u></button>
      <span className="pe-tb-colors" title="Cor do texto">
        {Object.entries(colors).map(([k, c]) => (
          <button key={k} type="button" className="pe-swatch" style={{ background: c }} title={k} onMouseDown={btn('foreColor', c)} />
        ))}
        <label className="pe-swatch pe-swatch-custom" title="Outra cor">
          <input type="color" onChange={(e) => exec('foreColor', e.target.value)} />
        </label>
      </span>
      <span className="pe-tb-sep" />
      <button type="button" onMouseDown={btn('justifyLeft')} title="Alinhar à esquerda">⯇</button>
      <button type="button" onMouseDown={btn('justifyCenter')} title="Centralizar">≡</button>
      <button type="button" onMouseDown={btn('justifyRight')} title="Alinhar à direita">⯈</button>
      <button type="button" onMouseDown={btn('justifyFull')} title="Justificar">☰</button>
      <span className="pe-tb-sep" />
      <button type="button" onMouseDown={btn('insertUnorderedList')} title="Lista">•</button>
      <button type="button" onMouseDown={link} title="Link no texto selecionado">🔗</button>
      <button type="button" onMouseDown={btn('removeFormat')} title="Limpar formatação">⌫</button>
    </div>
  );
}
