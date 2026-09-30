import { describe, expect, it, vi } from 'vitest';
import { base64Utf8, enviarArquivo, repoValido } from '../src/editor/githubSync';

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
