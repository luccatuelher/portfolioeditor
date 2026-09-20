import { Component, type ErrorInfo, type ReactNode } from 'react';

/**
 * Barreira de erro.
 *
 * Sem ela, uma única peça com defeito derruba a árvore inteira do React e o
 * resultado é a tela branca — a mesma que já apareceu neste projeto. Com ela,
 * o estrago fica contido: o elemento quebrado vira um aviso e o resto da
 * página continua de pé (e editável).
 */
export class ErrorBoundary extends Component<
  { children: ReactNode; fallback: (erro: Error, tentarDeNovo: () => void) => ReactNode; onError?: (erro: Error, info: ErrorInfo) => void },
  { erro: Error | null }
> {
  override state = { erro: null as Error | null };

  static getDerivedStateFromError(erro: Error): { erro: Error } {
    return { erro };
  }

  override componentDidCatch(erro: Error, info: ErrorInfo): void {
    // Registrado no console para quem for investigar; nunca engolido em silêncio.
    console.error('[portfolio] elemento com defeito:', erro, info.componentStack);
    this.props.onError?.(erro, info);
  }

  override render(): ReactNode {
    const { erro } = this.state;
    if (!erro) return this.props.children;
    return this.props.fallback(erro, () => this.setState({ erro: null }));
  }
}
