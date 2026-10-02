import { describe, expect, it } from 'vitest';
import { base64Bytes, enviarSite, quaisFaltam, shaGit, validarConfigSite, type SiteConfig } from '../src/editor/githubSite';

const cfg: SiteConfig = { repo: 'dono/portfolio', token: 'github_pat_segredo', branch: 'main' };
const bytes = (s: string): Uint8Array => new TextEncoder().encode(s);

/** GitHub de mentira: guarda arquivos por caminho e registra cada chamada. */
function githubFalso(arquivos: Record<string, string>, opts: { negar?: number } = {}) {
  const chamadas: { metodo: string; path: string; corpo?: { content: string; sha?: string; branch: string; message: string }; auth: string | null }[] = [];
  const f = (async (url: string, init: RequestInit = {}): Promise<Response> => {
    const path = decodeURIComponent(new URL(url).pathname.replace(/^\/repos\/[^/]+\/[^/]+\/contents\//, ''));
    const metodo = init.method ?? 'GET';
    const corpo = init.body ? (JSON.parse(String(init.body)) as never) : undefined;
    chamadas.push({ metodo, path, corpo, auth: (init.headers as Record<string, string>).Authorization ?? null });
    if (opts.negar) return new Response('{}', { status: opts.negar });
    if (metodo === 'GET') {
      return path in arquivos ? new Response(JSON.stringify({ sha: await shaGit(bytes(arquivos[path]!)) }), { status: 200 }) : new Response('{}', { status: 404 });
    }
    return new Response(JSON.stringify({ content: { sha: 'novo' } }), { status: path in arquivos ? 200 : 201 });
  }) as unknown as typeof fetch;
  return { f, chamadas };
}

describe('enviar o site ao GitHub', () => {
  it('shaGit é o sha de blob do git (mesmo valor que o GitHub devolve)', async () => {
    // `printf 'hello\n' | git hash-object --stdin`
    expect(await shaGit(bytes('hello\n'))).toBe('ce013625030ba8dba906f756967f9e9ca394464a');
    expect(await shaGit(bytes(''))).toBe('e69de29bb2d1d6434b8b29ae775ad8c2e48c5391');
  });

  it('base64 de bytes bate com o do navegador, inclusive acima de 32 KB', () => {
    expect(base64Bytes(bytes('olá'))).toBe(btoa(String.fromCharCode(...bytes('olá'))));
    const grande = new Uint8Array(100_000).map((_, i) => i % 251);
    expect(atob(base64Bytes(grande)).length).toBe(100_000);
  });

  it('manda só o que mudou, com o sha antigo, e deixa o index.html por último', async () => {
    const g = githubFalso({ 'index.html': '<antigo>', 'compartilhar.jpg': 'foto' });
    const r = await enviarSite(cfg, [{ path: 'index.html', bytes: bytes('<novo>') }, { path: 'compartilhar.jpg', bytes: bytes('foto') }], 'Site', g.f);
    expect(r).toEqual({ enviados: ['index.html'], iguais: ['compartilhar.jpg'] });
    const puts = g.chamadas.filter((c) => c.metodo === 'PUT');
    expect(puts).toHaveLength(1);
    expect(puts[0]!.path).toBe('index.html');
    expect(puts[0]!.corpo!.sha).toBe(await shaGit(bytes('<antigo>')));
    expect(puts[0]!.corpo!.branch).toBe('main');
    expect(atob(puts[0]!.corpo!.content)).toBe('<novo>');
  });

  it('arquivo novo vai sem sha; o index.html é o último a subir', async () => {
    const g = githubFalso({});
    const r = await enviarSite(cfg, [{ path: 'index.html', bytes: bytes('a') }, { path: 'compartilhar.jpg', bytes: bytes('b') }], 'Site', g.f);
    expect(r.enviados).toEqual(['compartilhar.jpg', 'index.html']);
    expect(g.chamadas.filter((c) => c.metodo === 'PUT').every((c) => c.corpo!.sha === undefined)).toBe(true);
  });

  it('nada mudou: nenhum commit', async () => {
    const g = githubFalso({ 'index.html': 'igual' });
    const r = await enviarSite(cfg, [{ path: 'index.html', bytes: bytes('igual') }], 'Site', g.f);
    expect(r).toEqual({ enviados: [], iguais: ['index.html'] });
    expect(g.chamadas.some((c) => c.metodo === 'PUT')).toBe(false);
  });

  it('o token só vai no cabeçalho, nunca no corpo nem no endereço', async () => {
    const g = githubFalso({});
    await enviarSite(cfg, [{ path: 'index.html', bytes: bytes('a') }], 'Site', g.f);
    expect(g.chamadas.every((c) => c.auth === 'Bearer github_pat_segredo')).toBe(true);
    expect(JSON.stringify(g.chamadas.map((c) => c.corpo))).not.toContain('segredo');
  });

  it('sem permissão: a mensagem diz o que fazer (em português)', async () => {
    const g = githubFalso({}, { negar: 403 });
    await expect(enviarSite(cfg, [{ path: 'index.html', bytes: bytes('a') }], 'Site', g.f)).rejects.toThrow(/permissão de escrita/);
    await expect(enviarSite(cfg, [{ path: 'index.html', bytes: bytes('a') }], 'Site', githubFalso({}, { negar: 401 }).f)).rejects.toThrow(/Token inválido/);
  });

  it('quaisFaltam lista o que o site espera ao lado e não está no repositório', async () => {
    expect(await quaisFaltam(cfg, ['cv.pdf', 'outro.pdf'], githubFalso({ 'cv.pdf': 'x' }).f)).toEqual(['outro.pdf']);
  });

  it('valida repositório e token antes de tentar', () => {
    expect(validarConfigSite({ repo: 'sem-barra', token: 'x' })).toMatch(/dono\/nome/);
    expect(validarConfigSite({ repo: 'a/b', token: '  ' })).toMatch(/token/);
    expect(validarConfigSite({ repo: 'a/b', token: 'x' })).toBeNull();
  });
});
