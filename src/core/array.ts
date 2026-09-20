/** Move um item de `from` para `to`, mutando o array. No-op se índices inválidos. */
export function reorderArray<T>(arr: T[], from: number, to: number): void {
  if (from === to || from < 0 || to < 0 || from >= arr.length || to >= arr.length) return;
  const [moved] = arr.splice(from, 1);
  arr.splice(to, 0, moved!);
}
