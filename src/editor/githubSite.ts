import { explicarHttp, lerConfig, repoValido } from './githubSync';

/**
 * "Enviar ao portfólio": grava o site gerado (index.html + compartilhar.jpg)
 * direto no repositório do GitHub Pages, sem baixar e subir à mão. Usa a API
 * de conteúdo do GitHub com um token só deste navegador (como o backup).
 */
export interface SiteConfig {
  /** "dono/repositorio" do site. */
  repo: string;
  token: string;
  branch: string;
}

export interface ArquivoSite {
  /** Caminho no repositório (ex.: "index.html"). */
  path: string;
  bytes: Uint8Array;
}

export interface ResultadoEnvio {
  enviados: string[];
  /** Já estavam no repositório exatamente assim: não geram commit. */
  iguais: string[];
}

const CHAVE = 'portfolio-v4:github-site';
export const REPO_DO_SITE_PADRAO = 'luccatuelher/portfolio';
export const BRANCH_PADRAO = 'main';

export function lerConfigSite(): SiteConfig | null {
  try {
    const raw = localStorage.getItem(CHAVE);
    if (!raw) return null;
    const c = JSON.parse(raw) as Partial<SiteConfig>;
    if (typeof c.repo !== 'string' || typeof c.token !== 'string' || !c.repo || !c.token) return null;
    return { repo: c.repo, token: c.token, branch: typeof c.branch === 'string' && c.branch ? c.branch : BRANCH_PADRAO };
  } catch {
    return null;
  }
}

export function gravarConfigSite(c: SiteConfig | null): void {
  try {
    if (c) localStorage.setItem(CHAVE, JSON.stringify(c));
    else localStorage.removeItem(CHAVE);
  } catch {
    /* sem armazenamento: vale só nesta aba */
  }
}

/**
 * Config usada no envio: a do site, se já foi salva; senão o token do backup
 * no repositório padrão do site (pode não ter permissão — aí o erro explica e
 * o editor pede o token certo).
 */
export function configSiteEfetiva(): SiteConfig | null {
  const propria = lerConfigSite();
  if (propria) return propria;
  const backup = lerConfig();
  return backup ? { repo: REPO_DO_SITE_PADRAO, token: backup.token, branch: BRANCH_PADRAO } : null;
}

/** sha que o git dá ao conteúdo ("blob <tamanho>\0<bytes>"): igual ao do GitHub, para saber se mudou. */
export async function shaGit(bytes: Uint8Array): Promise<string> {
  const cab = new TextEncoder().encode(`blob ${bytes.length}\0`);
  const todo = new Uint8Array(cab.length + bytes.length);
  todo.set(cab, 0);
  todo.set(bytes, cab.length);
  const h = new Uint8Array(await crypto.subtle.digest('SHA-1', todo));
  return [...h].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Base64 de bytes quaisquer, em pedaços (btoa direto estoura a pilha em MBs). */
export function base64Bytes(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

const urlDe = (c: SiteConfig, path: string): string => `https://api.github.com/repos/${c.repo}/contents/${encodeURI(path)}`;
const cabecalhos = (c: SiteConfig): Record<string, string> => ({ Authorization: `Bearer ${c.token}`, Accept: 'application/vnd.github+json' });

/** sha do arquivo na branch (null = não existe). Erros de acesso viram mensagem em português. */
export async function shaNoSite(c: SiteConfig, path: string, f: typeof fetch = fetch): Promise<string | null> {
  const r = await f(`${urlDe(c, path)}?ref=${encodeURIComponent(c.branch)}`, { headers: cabecalhos(c), cache: 'no-store' });
  if (r.status === 404) {
    // Arquivo novo — ou repositório/branch inexistente ou sem acesso: o PUT seguinte diz qual.
    return null;
  }
  if (!r.ok) throw new Error(explicarHttp(r.status, await r.text().catch(() => '')));
  const j = (await r.json()) as { sha?: string };
  return j.sha ?? null;
}

/** Os arquivos existem no repositório? (os que o site espera ao lado, como o cv.pdf) */
export async function quaisFaltam(c: SiteConfig, paths: string[], f: typeof fetch = fetch): Promise<string[]> {
  const faltam: string[] = [];
  for (const p of paths) if ((await shaNoSite(c, p, f)) === null) faltam.push(p);
  return faltam;
}

export function validarConfigSite(c: { repo: string; token: string }): string | null {
  if (!repoValido(c.repo)) return 'Escreva o repositório do site como dono/nome.';
  if (!c.token.trim()) return 'Cole o token do GitHub.';
  return null;
}

/**
 * Grava os arquivos na branch, um commit por arquivo que mudou. O que já está
 * igual no repositório não gera commit. O index.html vai por último: quando a
 * página muda, os arquivos que ela usa já estão lá.
 */
export async function enviarSite(c: SiteConfig, arquivos: ArquivoSite[], mensagem: string, f: typeof fetch = fetch): Promise<ResultadoEnvio> {
  const enviados: string[] = [];
  const iguais: string[] = [];
  const ordem = [...arquivos].sort((a, b) => Number(a.path === 'index.html') - Number(b.path === 'index.html'));
  for (const a of ordem) {
    const atual = await shaNoSite(c, a.path, f);
    if (atual && atual === (await shaGit(a.bytes))) {
      iguais.push(a.path);
      continue;
    }
    const r = await f(urlDe(c, a.path), {
      method: 'PUT',
      headers: { ...cabecalhos(c), 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: mensagem, content: base64Bytes(a.bytes), branch: c.branch, ...(atual ? { sha: atual } : {}) }),
    });
    if (r.status === 409 || r.status === 422) throw new Error(`O GitHub recusou ${a.path} porque o site mudou no meio do envio. Tente de novo.`);
    if (!r.ok) throw new Error(explicarHttp(r.status, await r.text().catch(() => '')));
    enviados.push(a.path);
  }
  return { enviados, iguais };
}
