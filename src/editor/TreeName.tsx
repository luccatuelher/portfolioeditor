import { useState } from 'react';

/**
 * Renome no lugar para um nó da árvore (seção, página, projeto, nota).
 *
 * Um gesto só para tudo: o lápis abre o campo, Enter grava, Esc desiste.
 * É um hook — e não um componente que embrulha tudo — porque o nome fica
 * DENTRO do botão que abre o item, e o lápis precisa ficar FORA dele: botão
 * dentro de botão é HTML inválido e faz o clique cair no lugar errado.
 */
export function useTreeRename(texto: string, onCommit: (v: string) => void, abrirJa = false): {
  editando: boolean;
  campo: React.ReactElement;
  botao: React.ReactElement;
  abrir: (e: React.SyntheticEvent) => void;
} {
  const [editando, setEditando] = useState(abrirJa);
  const [valor, setValor] = useState(texto);

  const abrir = (e: React.SyntheticEvent): void => {
    e.stopPropagation();
    e.preventDefault();
    setValor(texto);
    setEditando(true);
  };

  const fechar = (grava: boolean): void => {
    setEditando(false);
    const v = valor.trim();
    if (grava && v !== texto) onCommit(v);
  };

  const campo = (
    <input
      className="tree-rename"
      value={valor}
      autoFocus
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onChange={(e) => setValor(e.target.value)}
      onBlur={() => fechar(true)}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Enter') fechar(true);
        if (e.key === 'Escape') fechar(false);
      }}
    />
  );

  const botao = (
    <button type="button" className="tree-rename-btn" title="Renomear" aria-label={`Renomear ${texto}`} onClick={abrir}>
      ✎
    </button>
  );

  return { editando, campo, botao, abrir };
}
