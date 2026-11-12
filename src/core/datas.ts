/**
 * Datas e horas que o editor mostra: sempre no formato brasileiro (dia/mês/ano,
 * relógio de 24 h), qualquer que seja o idioma do navegador. Um lugar só —
 * antes cada tela formatava a sua, e uma delas seguia o idioma do navegador
 * ("3:05:09 PM" num Chrome em inglês).
 */
const DIA_MES: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false };

/** "08/11 20:13" (dia/mês e hora). Com `ano`, "08/11/26 20:13". */
export function dataHora(quando: number | string | Date, opcoes: { ano?: boolean } = {}): string {
  const d = new Date(quando);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('pt-BR', opcoes.ano ? { ...DIA_MES, year: '2-digit' } : DIA_MES).replace(',', '');
}

/** "20:13" (24 h, sem segundos). */
export function hora(quando: number | string | Date = Date.now()): string {
  const d = new Date(quando);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false });
}
