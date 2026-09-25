/**
 * Proteção do rascunho contra a limpeza automática do navegador.
 *
 * O portfólio inteiro (documento, imagens, versões) mora no IndexedDB deste
 * navegador. Por padrão esse espaço é "melhor esforço": com o disco apertado,
 * o Chrome apaga os dados de um site sem perguntar — seria perder tudo desde o
 * último backup. Ao abrir, o editor pede espaço PERSISTENTE; se o navegador
 * nega (o comum num endereço sem "engajamento", como o file:// do editor) e
 * não há backup recente, a pessoa fica sabendo e tem o botão para guardar um.
 * Espaço quase cheio também avisa antes de a gravação começar a falhar.
 */

export interface EstadoArmazenamento {
  /** true: o navegador não apaga sozinho; false: pode apagar; null: não dá para saber (API ausente). */
  persistente: boolean | null;
  /** Fração usada da cota (0–1), quando o navegador informa. */
  uso: number | null;
}

type ArmazenamentoDoNavegador = Partial<Pick<StorageManager, 'persisted' | 'persist' | 'estimate'>>;

const padrao = (): ArmazenamentoDoNavegador | undefined => (typeof navigator !== 'undefined' ? navigator.storage : undefined);

/** Pede espaço persistente (se ainda não tem) e lê quanto da cota está em uso. Nunca lança. */
export async function protegerRascunho(storage: ArmazenamentoDoNavegador | undefined = padrao()): Promise<EstadoArmazenamento> {
  let persistente: boolean | null = null;
  try {
    if (storage?.persisted) persistente = await storage.persisted();
    if (persistente === false && storage?.persist) persistente = await storage.persist();
  } catch {
    persistente = null;
  }
  let uso: number | null = null;
  try {
    const e = storage?.estimate ? await storage.estimate() : undefined;
    if (e?.quota && e.usage !== undefined) uso = e.usage / e.quota;
  } catch {
    uso = null;
  }
  return { persistente, uso };
}

export const DIAS_SEM_BACKUP = 7;
export const USO_ALTO = 0.8;
const DIA = 24 * 60 * 60 * 1000;

/** O que dizer à pessoa (ou null: nada a dizer). */
export function avisoDeArmazenamento(e: EstadoArmazenamento, ultimoBackup: number | null, agora = Date.now()): string | null {
  if (e.uso !== null && e.uso >= USO_ALTO) {
    return `O espaço deste navegador para o editor está ${Math.min(99, Math.round(e.uso * 100))}% cheio. Quando acabar, o editor não consegue mais salvar — baixe um backup agora.`;
  }
  if (e.persistente !== false) return null;
  const dias = ultimoBackup === null ? null : Math.floor((agora - ultimoBackup) / DIA);
  if (dias !== null && dias < DIAS_SEM_BACKUP) return null;
  const quando = dias === null ? 'Você ainda não baixou nenhum backup neste navegador' : `Seu último backup foi há ${dias} dias`;
  return `Este navegador pode apagar o rascunho sozinho se o disco ficar sem espaço. ${quando} — guarde um agora.`;
}

const CHAVE = 'portfolio-ultimo-backup';

/** Quando a pessoa baixou o último backup neste navegador (ou null). */
export function lerUltimoBackup(): number | null {
  try {
    const n = Number(localStorage.getItem(CHAVE));
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

export function marcarBackup(agora = Date.now()): void {
  try {
    localStorage.setItem(CHAVE, String(agora));
  } catch {
    // Sem localStorage: o aviso só volta a aparecer na próxima abertura.
  }
}
