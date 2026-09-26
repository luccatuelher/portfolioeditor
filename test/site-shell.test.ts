import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

/**
 * O editor publica com o runtime do site guardado em src/publish/site-shell.html
 * (gerado do código do site). Mudar o código do site e esquecer de regerar
 * fazia o editor de desenvolvimento — e os testes — publicarem o runtime
 * ANTIGO: aconteceu duas vezes (o card mostrava a foto inteira em vez da
 * miniatura, por exemplo). O build do editor regera sozinho; aqui o arquivo
 * commitado tem de estar em dia. Gera numa pasta à parte (não disputa o
 * arquivo com os testes que o leem) e compara.
 */
describe('runtime do site embutido no editor', () => {
  it('está em dia com o código do site', { timeout: 60_000 }, () => {
    const pasta = mkdtempSync(resolve(tmpdir(), 'shell-'));
    // Sem o ambiente do Vitest (NODE_ENV=test mudaria o React embutido): o build de verdade.
    const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('VITEST') && k !== 'NODE_ENV' && k !== 'TEST'));
    execFileSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--config', 'vite.site.config.ts', '--outDir', pasta, '--emptyOutDir'], { stdio: 'pipe', env: { ...env, NODE_ENV: 'production' } });
    const ler = (p: string): string => readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
    const gerado = ler(resolve(pasta, 'site.html'));
    expect(gerado === ler('src/publish/site-shell.html'), 'rode: npm run gen:shell').toBe(true);
  });
});
