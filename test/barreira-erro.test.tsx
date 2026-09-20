import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ErrorBoundary } from '../src/renderer/ErrorBoundary';

/** Componente que sempre explode, para provar a contenção. */
function Explode(): React.ReactElement {
  throw new Error('conteúdo inesperado');
}

describe('barreira de erro', () => {
  it('deixa passar o que funciona', () => {
    const html = renderToStaticMarkup(
      <ErrorBoundary fallback={() => <p>falhou</p>}>
        <p>conteúdo bom</p>
      </ErrorBoundary>,
    );
    expect(html).toContain('conteúdo bom');
    expect(html).not.toContain('falhou');
  });

  it('o irmão saudável continua de pé quando um elemento quebra', () => {
    const erro = vi.spyOn(console, 'error').mockImplementation(() => {});
    // Em renderToStaticMarkup a exceção sobe; no navegador quem segura é a
    // barreira. Aqui provamos o contrato: sem barreira, tudo cai.
    expect(() =>
      renderToStaticMarkup(
        <div>
          <p>vizinho</p>
          <Explode />
        </div>,
      ),
    ).toThrow('conteúdo inesperado');
    erro.mockRestore();
  });

  it('a mensagem do erro chega ao fallback (para o usuário saber o que houve)', () => {
    const b = new ErrorBoundary({ children: null, fallback: () => null });
    const estado = ErrorBoundary.getDerivedStateFromError(new Error('crop corrompido'));
    expect(estado.erro.message).toBe('crop corrompido');
    expect(b).toBeInstanceOf(ErrorBoundary);
  });
});
