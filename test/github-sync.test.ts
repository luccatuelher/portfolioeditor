import { describe, expect, it, vi } from 'vitest';
import { base64Utf8, enviarArquivo, repoValido, verificarRemoto } from '../src/editor/githubSync';
import type { PortfolioV4 } from '../src/schema/v4';

const cfg = { repo: 'eu/portfolio-backup', token: 't', path: 'portfolio-backup.json' };
const resp = (status: number, body: unknown = {}): Response => new Response(JSON.stringify(body), { status });

describe('githubSync', () => {
  it('base64 de UTF-8 volta ao texto original', () => {
    const t = 'Ilustrações ✨ '.repeat(5000);
    expect(new TextDecoder().decode(Uint8Array.from(atob(base64Utf8(t)), (c) => c.charCodeAt(0)))).toBe(t);
  });

  it('valida dono/repositório', () => {
    expect(repoValido('eu/portfolio-backup')).toBe(true);
    expect(repoValido('portfolio-backup')).toBe(false);
  });

  it('cria o arquivo quando ainda não existe', async () => {
    const f = vi.fn().mockResolvedValueOnce(resp(404)).mockResolvedValueOnce(resp(201, { content: { sha: 'novo' } }));
    expect(await enviarArquivo(cfg, '{}', null, f)).toBe('novo');
    expect(JSON.parse(f.mock.calls[1]![1].body).sha).toBeUndefined();
  });

  it('com sha velho, busca o atual e tenta de novo', async () => {
    const f = vi.fn()
      .mockResolvedValueOnce(resp(409))
      .mockResolvedValueOnce(resp(200, { sha: 'atual' }))
      .mockResolvedValueOnce(resp(200, { content: { sha: 'depois' } }));
    expect(await enviarArquivo(cfg, '{}', 'velho', f)).toBe('depois');
    expect(JSON.parse(f.mock.calls[2]![1].body).sha).toBe('atual');
  });

  it('explica token sem permissão', async () => {
    const f = vi.fn().mockResolvedValue(resp(403));
    await expect(enviarArquivo(cfg, '{}', 'x', f)).rejects.toThrow(/permissão/);
  });
});

describe('verificarRemoto (ao abrir o editor)', () => {
  const aberto = { schemaVersion: 4, site: { name: 'daqui' } } as unknown as PortfolioV4;
  const outro = { schemaVersion: 4, site: { name: 'do GitHub' } };
  const remoto = (doc: unknown, savedAt: string): string => JSON.stringify({ format: 'portfolio-v4-backup', version: 1, savedAt, doc, assets: {} });
  const github = (sha: string | null, texto = '') =>
    vi.fn((_url: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      if (!sha) return Promise.resolve(resp(404));
      const raw = String((init?.headers as Record<string, string>)?.Accept).includes('raw');
      return Promise.resolve(raw ? new Response(texto, { status: 200 }) : resp(200, { sha }));
    });

  it('mesmo sha que este navegador conhece: nada muda e nem baixa o arquivo', async () => {
    const f = github('abc');
    expect(await verificarRemoto(cfg, aberto, 0, 'abc', f)).toEqual({ oferta: null, sha: 'abc' });
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('sha diferente do conhecido e conteúdo diferente: oferece carregar', async () => {
    const r = await verificarRemoto(cfg, aberto, Date.now(), 'velho', github('novo', remoto(outro, '2020-01-01T00:00:00Z')));
    expect(r.oferta?.sha).toBe('novo');
  });

  it('conteúdo igual ao aberto: não oferece, só registra o sha', async () => {
    expect(await verificarRemoto(cfg, aberto, 0, 'velho', github('novo', remoto(aberto, '2030-01-01T00:00:00Z')))).toEqual({ oferta: null, sha: 'novo' });
  });

  it('primeira vez neste navegador: oferece só se o GitHub for mais novo que o rascunho', async () => {
    const rascunho = Date.parse('2026-09-30T02:00:00Z');
    expect((await verificarRemoto(cfg, aberto, rascunho, null, github('s', remoto(outro, '2026-09-30T03:00:00Z')))).oferta).not.toBeNull();
    expect((await verificarRemoto(cfg, aberto, rascunho, null, github('s', remoto(outro, '2026-09-30T01:00:00Z')))).oferta).toBeNull();
  });

  it('sem arquivo no repositório: nada a oferecer', async () => {
    expect(await verificarRemoto(cfg, aberto, 0, null, github(null))).toEqual({ oferta: null, sha: null });
  });
});
