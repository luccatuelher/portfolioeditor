// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, useLayoutEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { migrate } from '../src/migrate/migrate';
import { dataUrlResolver } from '../src/renderer/dataUrlResolver';
import { Site } from '../src/renderer/Site';
import { loadFixture } from './helpers/fixtures';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * O runtime do site começa enquanto o arquivo ainda chega. Um link que muda o
 * endereço entre o primeiro render e os efeitos do Site (o "boot") não pode ser
 * desfeito: o site abre a rota do endereço de AGORA, não a que leu no início.
 * (Antes o efeito de montagem devolvia o endereço para a rota antiga e o
 * pedido se perdia — o e2e f62 falhava uma vez em três.)
 */
function MudaEndereco({ hash }: { hash: string }): null {
  // Efeito de layout: roda depois do 1º render do Site e antes dos efeitos dele.
  useLayoutEffect(() => {
    history.replaceState(null, '', hash);
  }, [hash]);
  return null;
}

describe('endereço que muda durante o boot do site', () => {
  beforeEach(() => history.replaceState(null, '', '#'));
  afterEach(() => history.replaceState(null, '', '#'));

  it('a rota nova vale e o endereço não volta para a antiga', () => {
    const { data, assets } = migrate(loadFixture('template-v3.json'));
    const el = document.createElement('div');
    document.body.appendChild(el);
    const root = createRoot(el);
    act(() =>
      root.render(
        <>
          <Site data={data} resolveAsset={dataUrlResolver(assets)} initialRoute="" initialLang="pt" />
          <MudaEndereco hash="#project/demo-sequencia" />
        </>,
      ),
    );
    expect(location.hash).toBe('#project/demo-sequencia');
    expect(el.querySelector('main#conteudo')?.getAttribute('data-route')).toBe('project/demo-sequencia');
    act(() => root.unmount());
    el.remove();
  });
});
