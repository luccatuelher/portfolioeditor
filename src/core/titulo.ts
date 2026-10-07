/** Título da Home (aba, resultado da busca, cartão de compartilhamento): "Nome — Função". */
export function tituloDaHome(nome: string, funcao: string): string {
  return funcao.trim() ? `${nome} — ${funcao.trim()}` : nome;
}
