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
  | { tipo: 'verificando' }
  | { tipo: 'aguardando' }
  | { tipo: 'enviando' }
  | { tipo: 'ok'; em: string }
  | { tipo: 'erro'; msg: string };

const CHAVE = 'portfolio-v4:github-sync';
/** sha do arquivo que ESTE navegador enviou ou carregou por último (por repositório/caminho). */
const CHAVE_SHA = 'portfolio-v4:github-sync-sha';
export const CAMINHO_PADRAO = 'portfolio-backup.json';
/** Espera depois da última edição antes de enviar (não sobe a cada tecla). */
export const ESPERA_MS = 60_000;
/** Com o editor aberto, confere o GitHub a cada tanto (e ao voltar para a aba). */
export const CONFERIR_A_CADA_MS = 3 * 60_000;

/** O arquivo do GitHub mudou por fora desde o último envio/carga deste navegador: carregar em vez de gravar por cima. */
export class MudouNoGitHub extends Error {
  constructor() {
    super('O backup do GitHub mudou por fora.');
    this.name = 'MudouNoGitHub';
  }
}

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

export const alvoDe = (c: SyncConfig): string => `${c.repo}/${c.path}`;

function lerRegistro(alvo: string): { sha: string; hash: string | null } | null {
  try {
    const r = JSON.parse(localStorage.getItem(CHAVE_SHA) ?? 'null') as { alvo?: string; sha?: string; hash?: string } | null;
    return r && r.alvo === alvo && typeof r.sha === 'string' ? { sha: r.sha, hash: typeof r.hash === 'string' ? r.hash : null } : null;
  } catch {
    return null;
  }
}

export function lerShaConhecido(alvo: string): string | null {
  return lerRegistro(alvo)?.sha ?? null;
}

/** `hash` = do conteúdo que ESTE navegador enviou (sem ele, o próximo envio sobe de novo). */
export function gravarShaConhecido(alvo: string, sha: string, hash: string | null = null): void {
  try {
    localStorage.setItem(CHAVE_SHA, JSON.stringify({ alvo, sha, ...(hash ? { hash } : {}) }));
  } catch {
    /* sem armazenamento: só perde a conferência na próxima abertura */
  }
}

/** Impressão digital curta de um texto (FNV-1a), para saber se o conteúdo já foi enviado. */
export function hashTexto(texto: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `${texto.length.toString(36)}-${(h >>> 0).toString(36)}`;
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
export async function shaAtual(c: SyncConfig, f: typeof fetch): Promise<string | null> {
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

/** Conteúdo atual do arquivo, cru (a API em JSON corta arquivos acima de 1 MB). */
async function baixarArquivo(c: SyncConfig, f: typeof fetch): Promise<string> {
  const r = await f(`https://api.github.com/repos/${c.repo}/contents/${encodeURI(c.path)}`, {
    headers: { Authorization: `Bearer ${c.token}`, Accept: 'application/vnd.github.raw+json' },
    cache: 'no-store',
  });
  if (!r.ok) throw new Error(explicarHttp(r.status, await r.text().catch(() => '')));
  return r.text();
}

/** Versão do GitHub que vale oferecer para carregar no lugar do que está aberto. */
export interface VersaoRemota {
  sha: string;
  texto: string;
  /** Quando o backup foi gerado (ISO), se o arquivo disser. */
  savedAt: string | null;
}

/**
 * Ao abrir o editor: o backup do GitHub mudou por fora (outro navegador, ou
 * alguém que editou o arquivo) e é diferente do que está aberto? Então vale
 * perguntar antes de o envio automático gravar por cima dele.
 *
 * - mesmo sha que este navegador enviou/carregou por último → nada mudou;
 * - conteúdo igual ao aberto → nada a oferecer (só registra o sha);
 * - sha conhecido e diferente → mudou por fora: oferece;
 * - sem sha conhecido (primeira vez neste navegador) → oferece só se o
 *   backup do GitHub for mais novo que o rascunho daqui.
 */
export async function verificarRemoto(
  c: SyncConfig,
  aberto: PortfolioV4,
  rascunhoSalvoEm: number | undefined,
  conhecido: string | null,
  f: typeof fetch = fetch,
): Promise<{ oferta: VersaoRemota | null; sha: string | null }> {
  const sha = await shaAtual(c, f);
  if (!sha || sha === conhecido) return { oferta: null, sha };
  const texto = await baixarArquivo(c, f);
  let doc: unknown = null;
  let savedAt: string | null = null;
  try {
    const j = JSON.parse(texto) as { doc?: unknown; savedAt?: unknown };
    doc = j.doc ?? null;
    savedAt = typeof j.savedAt === 'string' && j.savedAt ? j.savedAt : null;
  } catch {
    return { oferta: null, sha: null };
  }
  if (JSON.stringify(doc) === JSON.stringify(aberto)) return { oferta: null, sha };
  if (conhecido) return { oferta: { sha, texto, savedAt }, sha: null };
  const remotoEm = savedAt ? Date.parse(savedAt) : NaN;
  const maisNovo = Number.isFinite(remotoEm) && (rascunhoSalvoEm === undefined || remotoEm > rascunhoSalvoEm);
  return { oferta: maisNovo ? { sha, texto, savedAt } : null, sha: null };
}

/**
 * Envia o conteúdo; devolve o novo sha. Com `shaConhecido`, só grava por cima
 * DAQUELA versão: se o GitHub mudou por fora nesse meio-tempo, lança
 * MudouNoGitHub (quem chama carrega a versão de lá). Sem sha conhecido
 * (primeiro envio deste navegador), grava por cima do que houver.
 */
export async function enviarArquivo(c: SyncConfig, conteudo: string, shaConhecido: string | null, f: typeof fetch = fetch): Promise<string> {
  const put = (sha: string | null): Promise<Response> =>
    f(`https://api.github.com/repos/${c.repo}/contents/${encodeURI(c.path)}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${c.token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: `Backup automático ${new Date().toISOString()}`, content: base64Utf8(conteudo), ...(sha ? { sha } : {}) }),
    });
  const r = await put(shaConhecido ?? (await shaAtual(c, f)));
  if (r.status === 409 || r.status === 422) throw new MudouNoGitHub();
  if (!r.ok) throw new Error(explicarHttp(r.status, await r.text().catch(() => '')));
  const j = (await r.json()) as { content?: { sha?: string } };
  return j.content?.sha ?? '';
}

/**
 * Envia o backup ESPERA_MS depois da última mudança (e ao ligar). Só sobe se o
 * conteúdo mudou desde o último envio. Com `pausado` (conferindo se o GitHub
 * tem versão mais nova), não envia nada.
 */
export function useGithubSync(doc: PortfolioV4, assets: Record<string, string>, config: SyncConfig | null, pausado = false, aoMudarNoGitHub?: () => void): { status: SyncStatus; enviarAgora: () => void } {
  const [status, setStatus] = useState<SyncStatus>(!config ? { tipo: 'desligado' } : pausado ? { tipo: 'verificando' } : { tipo: 'aguardando' });
  const ultimo = useRef<{ texto: string; sha: string | null; repo: string } | null>(null);
  const atual = useRef({ doc, assets, config, aoMudarNoGitHub });
  atual.current = { doc, assets, config, aoMudarNoGitHub };
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [gatilho, setGatilho] = useState(0);
  const imediato = useRef(true);

  const enviar = async (): Promise<void> => {
    const { doc: d, assets: a, config: c } = atual.current;
    if (!c) return;
    const b = buildBackup(d, a);
    const texto = JSON.stringify({ ...b, savedAt: '' });
    const alvo = alvoDe(c);
    if (ultimo.current && ultimo.current.repo === alvo && ultimo.current.texto === texto) return;
    const registro = lerRegistro(alvo);
    const hash = hashTexto(texto);
    // Já enviado deste navegador (ex.: reabriu sem mexer): não cria outro commit igual.
    if (!ultimo.current && registro?.hash === hash) {
      ultimo.current = { texto, sha: registro.sha, repo: alvo };
      return;
    }
    setStatus({ tipo: 'enviando' });
    try {
      const conhecido = ultimo.current?.repo === alvo ? ultimo.current.sha : (registro?.sha ?? null);
      // Mudou por fora desde o último envio/carga? Carrega de lá em vez de gravar por cima.
      if (conhecido && (await shaAtual(c, fetch)) !== conhecido) throw new MudouNoGitHub();
      const sha = await enviarArquivo(c, JSON.stringify(b, null, 2), conhecido);
      ultimo.current = { texto, sha, repo: alvo };
      gravarShaConhecido(alvo, sha, hash);
      setStatus({ tipo: 'ok', em: new Date().toLocaleTimeString() });
    } catch (e) {
      if (e instanceof MudouNoGitHub && atual.current.aoMudarNoGitHub) {
        setStatus({ tipo: 'verificando' });
        atual.current.aoMudarNoGitHub();
        return;
      }
      setStatus({ tipo: 'erro', msg: e instanceof Error ? e.message : String(e) });
    }
  };

  useEffect(() => {
    if (!config) {
      setStatus({ tipo: 'desligado' });
      return;
    }
    if (pausado) {
      setStatus({ tipo: 'verificando' });
      return;
    }
    setStatus((s) => (s.tipo === 'verificando' || s.tipo === 'desligado' ? { tipo: 'aguardando' } : s));
    if (timer.current) clearTimeout(timer.current);
    const espera = imediato.current ? 0 : ESPERA_MS;
    imediato.current = false;
    timer.current = setTimeout(() => void enviar(), espera);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, assets, config, gatilho, pausado]);

  return { status, enviarAgora: () => {
    imediato.current = true;
    setGatilho((n) => n + 1);
  } };
}
