import { useEffect, useRef, useState } from 'react';
import type { PortfolioV4 } from '../schema/v4';
import { buildBackup } from './backup';

/**
 * Cópia automática do backup num repositório (privado) do GitHub, para o
 * backup existir fora deste navegador. A configuração — inclusive o token —
 * fica só no localStorage daqui; nunca vai para o documento nem para o site.
 */
export interface SyncConfig {
  /** "dono/repositorio" */
  repo: string;
  token: string;
  /** Caminho do arquivo no repositório. */
  path: string;
}

export type SyncStatus =
  | { tipo: 'desligado' }
  | { tipo: 'aguardando' }
  | { tipo: 'enviando' }
  | { tipo: 'ok'; em: string }
  | { tipo: 'erro'; msg: string };

const CHAVE = 'portfolio-v4:github-sync';
export const CAMINHO_PADRAO = 'portfolio-backup.json';
/** Espera depois da última edição antes de enviar (não sobe a cada tecla). */
export const ESPERA_MS = 60_000;

export function lerConfig(): SyncConfig | null {
  try {
    const raw = localStorage.getItem(CHAVE);
    if (!raw) return null;
    const c = JSON.parse(raw) as Partial<SyncConfig>;
    if (typeof c.repo !== 'string' || typeof c.token !== 'string' || !c.repo || !c.token) return null;
    return { repo: c.repo, token: c.token, path: typeof c.path === 'string' && c.path ? c.path : CAMINHO_PADRAO };
  } catch {
    return null;
  }
}

export function gravarConfig(c: SyncConfig | null): void {
  try {
    if (c) localStorage.setItem(CHAVE, JSON.stringify(c));
    else localStorage.removeItem(CHAVE);
  } catch {
    /* sem armazenamento: a sincronização só vale nesta aba */
  }
}

export function repoValido(repo: string): boolean {
  return /^[\w.-]+\/[\w.-]+$/.test(repo.trim());
}

/** Base64 de texto UTF-8, em pedaços (btoa direto estoura a pilha em MBs). */
export function base64Utf8(texto: string): string {
  const bytes = new TextEncoder().encode(texto);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

function explicarHttp(status: number, corpo: string): string {
  if (status === 401) return 'Token inválido ou expirado.';
  if (status === 403) return 'O token não tem permissão de escrita nesse repositório (Contents: Read and write).';
  if (status === 404) return 'Repositório não encontrado — confira o nome e se o token tem acesso a ele.';
  return `GitHub respondeu ${status}${corpo ? `: ${corpo.slice(0, 160)}` : ''}`;
}

/** sha atual do arquivo (null se ainda não existe). */
async function shaAtual(c: SyncConfig, f: typeof fetch): Promise<string | null> {
  const r = await f(`https://api.github.com/repos/${c.repo}/contents/${encodeURI(c.path)}`, {
    headers: { Authorization: `Bearer ${c.token}`, Accept: 'application/vnd.github+json' },
    cache: 'no-store',
  });
  if (r.status === 404) {
    // 404 também é "repo inexistente": o PUT seguinte dirá qual dos dois.
    return null;
  }
  if (!r.ok) throw new Error(explicarHttp(r.status, await r.text().catch(() => '')));
  const j = (await r.json()) as { sha?: string };
  return j.sha ?? null;
}

/** Envia o conteúdo; devolve o novo sha. */
export async function enviarArquivo(c: SyncConfig, conteudo: string, shaConhecido: string | null, f: typeof fetch = fetch): Promise<string> {
  const put = (sha: string | null): Promise<Response> =>
    f(`https://api.github.com/repos/${c.repo}/contents/${encodeURI(c.path)}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${c.token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: `Backup automático ${new Date().toISOString()}`, content: base64Utf8(conteudo), ...(sha ? { sha } : {}) }),
    });
  let r = await put(shaConhecido ?? (await shaAtual(c, f)));
  // sha velho (outro navegador enviou antes): busca o atual e tenta uma vez.
  if (r.status === 409 || r.status === 422) r = await put(await shaAtual(c, f));
  if (!r.ok) throw new Error(explicarHttp(r.status, await r.text().catch(() => '')));
  const j = (await r.json()) as { content?: { sha?: string } };
  return j.content?.sha ?? '';
}

/**
 * Envia o backup ESPERA_MS depois da última mudança (e ao ligar). Só sobe se o
 * conteúdo mudou desde o último envio.
 */
export function useGithubSync(doc: PortfolioV4, assets: Record<string, string>, config: SyncConfig | null): { status: SyncStatus; enviarAgora: () => void } {
  const [status, setStatus] = useState<SyncStatus>(config ? { tipo: 'aguardando' } : { tipo: 'desligado' });
  const ultimo = useRef<{ texto: string; sha: string | null; repo: string } | null>(null);
  const atual = useRef({ doc, assets, config });
  atual.current = { doc, assets, config };
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [gatilho, setGatilho] = useState(0);
  const imediato = useRef(true);

  const enviar = async (): Promise<void> => {
    const { doc: d, assets: a, config: c } = atual.current;
    if (!c) return;
    const b = buildBackup(d, a);
    const texto = JSON.stringify({ ...b, savedAt: '' });
    const alvo = `${c.repo}/${c.path}`;
    if (ultimo.current && ultimo.current.repo === alvo && ultimo.current.texto === texto) return;
    setStatus({ tipo: 'enviando' });
    try {
      const sha = await enviarArquivo(c, JSON.stringify(b, null, 2), ultimo.current?.repo === alvo ? ultimo.current.sha : null);
      ultimo.current = { texto, sha, repo: alvo };
      setStatus({ tipo: 'ok', em: new Date().toLocaleTimeString() });
    } catch (e) {
      setStatus({ tipo: 'erro', msg: e instanceof Error ? e.message : String(e) });
    }
  };

  useEffect(() => {
    if (!config) {
      setStatus({ tipo: 'desligado' });
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    const espera = imediato.current ? 0 : ESPERA_MS;
    imediato.current = false;
    timer.current = setTimeout(() => void enviar(), espera);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, assets, config, gatilho]);

  return { status, enviarAgora: () => {
    imediato.current = true;
    setGatilho((n) => n + 1);
  } };
}
