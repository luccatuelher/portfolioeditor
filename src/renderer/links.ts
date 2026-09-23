/**
 * Props de um link interno do site publicado: um <a href="#rota"> de verdade
 * (alcançável pelo Tab, abre em nova aba, dá para copiar o endereço) cujo
 * clique comum navega sem recarregar. Ctrl/⌘/Shift/Alt ou botão do meio ficam
 * com o navegador.
 */
export function linkInterno(route: string, onNavigate: (r: string) => void): { href: string; onClick: (e: React.MouseEvent) => void } {
  return {
    href: route && route !== 'home' ? `#${route}` : '#',
    onClick: (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      onNavigate(route);
    },
  };
}
