// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { gravarSenhaNda, lerSenhaNda } from '../src/editor/senhaNda';
import { SenhaNdaPainel } from '../src/editor/SenhaNdaPainel';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('senha do NDA escolhida uma vez', () => {
  afterEach(() => localStorage.clear());

  it('guarda, lê e esquece (espaços nas pontas não contam)', () => {
    expect(lerSenhaNda()).toBeNull();
    gravarSenhaNda('  cavalo bateria grampo  ');
    expect(lerSenhaNda()).toBe('cavalo bateria grampo');
    gravarSenhaNda(null);
    expect(lerSenhaNda()).toBeNull();
  });

  it('o painel Dados acompanha: escolher → trocar/esquecer', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    const root = createRoot(el);
    act(() => root.render(<SenhaNdaPainel />));
    expect(el.textContent).toContain('Ainda não escolhida');
    expect(el.textContent).not.toContain('Esquecer');
    // Definida em outro lugar do editor (o primeiro "Baixar site"): o painel atualiza.
    act(() => gravarSenhaNda('cavalo bateria grampo'));
    expect(el.textContent).toContain('Guardada neste navegador');
    const esquecer = [...el.querySelectorAll('button')].find((b) => b.textContent === 'Esquecer');
    act(() => esquecer?.click());
    expect(lerSenhaNda()).toBeNull();
    expect(el.textContent).toContain('Ainda não escolhida');
    act(() => root.unmount());
    el.remove();
  });
});
