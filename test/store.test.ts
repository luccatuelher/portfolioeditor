import { describe, expect, it } from 'vitest';
import { createStore } from '../src/state/store';

interface S {
  count: number;
  text: string;
}

const initial = (): S => ({ count: 0, text: '' });

describe('store — undo/redo por patches', () => {
  it('aplica edições e desfaz/refaz', () => {
    const store = createStore<S>(initial());
    store.update((d) => void (d.count = 1));
    store.update((d) => void (d.count = 2));
    expect(store.getState().count).toBe(2);

    expect(store.undo()).toBe(true);
    expect(store.getState().count).toBe(1);
    expect(store.undo()).toBe(true);
    expect(store.getState().count).toBe(0);
    expect(store.undo()).toBe(false); // nada a desfazer

    expect(store.redo()).toBe(true);
    expect(store.getState().count).toBe(1);
    expect(store.redo()).toBe(true);
    expect(store.getState().count).toBe(2);
  });

  it('não cria histórico para no-ops', () => {
    const store = createStore<S>(initial());
    store.update((d) => void (d.count = d.count));
    expect(store.canUndo()).toBe(false);
    expect(store.historyLength()).toBe(0);
  });

  it('agrupa edições contínuas com a mesma groupKey dentro da janela', () => {
    let t = 1000;
    const store = createStore<S>(initial(), { now: () => t, groupWindow: 700 });
    store.update((d) => void (d.text = 'a'), { groupKey: 'text' });
    t += 100;
    store.update((d) => void (d.text = 'ab'), { groupKey: 'text' });
    t += 100;
    store.update((d) => void (d.text = 'abc'), { groupKey: 'text' });
    expect(store.historyLength()).toBe(1); // 3 edições, 1 entrada

    expect(store.undo()).toBe(true);
    expect(store.getState().text).toBe(''); // reverte o grupo inteiro
    expect(store.redo()).toBe(true);
    expect(store.getState().text).toBe('abc');
  });

  it('não agrupa quando a janela expira', () => {
    let t = 0;
    const store = createStore<S>(initial(), { now: () => t, groupWindow: 700 });
    store.update((d) => void (d.text = 'a'), { groupKey: 'text' });
    t += 1000; // fora da janela
    store.update((d) => void (d.text = 'ab'), { groupKey: 'text' });
    expect(store.historyLength()).toBe(2);
  });

  it('respeita o limite de histórico', () => {
    const store = createStore<S>(initial(), { limit: 5 });
    for (let i = 1; i <= 20; i++) store.update((d) => void (d.count = i));
    expect(store.historyLength()).toBe(5);
  });

  it('notifica assinantes', () => {
    const store = createStore<S>(initial());
    let seen = -1;
    const off = store.subscribe((s) => (seen = s.count));
    store.update((d) => void (d.count = 7));
    expect(seen).toBe(7);
    off();
    store.update((d) => void (d.count = 8));
    expect(seen).toBe(7); // não recebe mais após unsubscribe
  });
});

describe('store — uma ação, um passo de desfazer', () => {
  it('transação junta várias mudanças numa entrada; desfazer volta tudo de uma vez', () => {
    const store = createStore<S>(initial());
    const r = store.transaction(() => {
      store.update((d) => void (d.count = 1));
      expect(store.getState().count).toBe(1); // vale na hora, dentro da transação
      store.update((d) => void (d.text = 'x'));
      return 'ok';
    });
    expect(r).toBe('ok');
    expect(store.historyLength()).toBe(1);
    store.undo();
    expect(store.getState()).toEqual({ count: 0, text: '' });
    store.redo();
    expect(store.getState()).toEqual({ count: 1, text: 'x' });
  });

  it('avisa quem ouve uma vez só, no fim', () => {
    const store = createStore<S>(initial());
    let avisos = 0;
    store.subscribe(() => avisos++);
    store.transaction(() => {
      store.update((d) => void (d.count = 1));
      store.update((d) => void (d.count = 2));
    });
    expect(avisos).toBe(1);
  });

  it('erro no meio desfaz o que a transação já tinha mudado, e nada entra no histórico', () => {
    const store = createStore<S>(initial());
    expect(() => store.transaction(() => {
      store.update((d) => void (d.count = 5));
      throw new Error('falhou');
    })).toThrow('falhou');
    expect(store.getState().count).toBe(0);
    expect(store.historyLength()).toBe(0);
  });

  it('transação dentro de transação vira parte da de fora', () => {
    const store = createStore<S>(initial());
    store.transaction(() => {
      store.update((d) => void (d.count = 1));
      store.transaction(() => store.update((d) => void (d.text = 'y')));
    });
    expect(store.historyLength()).toBe(1);
  });

  it('registro técnico (semHistorico) muda o estado sem virar passo de desfazer', () => {
    const store = createStore<S>(initial());
    store.update((d) => void (d.count = 1));
    store.update((d) => void (d.text = 'meta'), { semHistorico: true });
    expect(store.historyLength()).toBe(1);
    store.undo(); // desfaz a edição, não o registro
    expect(store.getState()).toEqual({ count: 0, text: 'meta' });
    store.redo();
    expect(store.getState()).toEqual({ count: 1, text: 'meta' });
  });
});
