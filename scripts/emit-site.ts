import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { test, expect } from 'vitest';
import { migrate } from '../src/migrate/migrate';
import { buildPublishPayload } from '../src/publish/buildPayload';
import { runPreflight } from '../src/publish/preflight';
import { parseBackup } from '../src/editor/backup';
import { assembleSiteHtml } from '../src/publish/assemble';
import type { MigratedAsset } from '../src/migrate/migrate';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// "Teste" usado como emissor: injeta o payload no shell buildado (dist/site.html).
test('emite dist/site.html com dados públicos + NDA cifrado', async () => {
  const pw = process.env.PUBLISH_NDA_PASSWORD || undefined;
  // PUBLISH_INPUT = caminho para um backup/doc; senão PUBLISH_FIXTURE em fixtures/.
  const inputPath = process.env.PUBLISH_INPUT
    ? resolve(root, process.env.PUBLISH_INPUT)
    : resolve(root, 'fixtures', process.env.PUBLISH_FIXTURE || 'template-v3.json');
  const parsed: unknown = JSON.parse(readFileSync(inputPath, 'utf8'));

  // Backup v4 (doc + imagens) ou fixture v3.
  const p = parsed as Record<string, unknown>;
  const isV4 = p?.['format'] === 'portfolio-v4-backup' || p?.['schemaVersion'] === 4;
  const migrated = isV4
    ? (() => {
        const b = parseBackup(JSON.stringify(parsed));
        const assets: MigratedAsset[] = Object.entries(b.assets).map(([id, dataUrl]) => ({ id, dataUrl, mime: '' }));
        return { data: b.doc, assets };
      })()
    : migrate(parsed);
  const payload = await buildPublishPayload(migrated, pw);

  // PUBLISH_SHELL/PUBLISH_OUTPUT (opcionais): outro shell (ex.: o site-shell.html
  // já gerado, sem rodar o build) e outro arquivo de saída — os testes que
  // publicam em paralelo não disputam o mesmo dist/site.html.
  const shellPath = resolve(root, process.env.PUBLISH_SHELL || 'dist/site.html');
  const outPath = resolve(root, process.env.PUBLISH_OUTPUT || shellPath);
  expect(existsSync(shellPath), 'rode "vite build --config vite.site.config.ts" antes').toBe(true);
  const shell = readFileSync(shellPath, 'utf8');
  const html = assembleSiteHtml(shell, payload);
  writeFileSync(outPath, html, 'utf8');

  const pf = runPreflight(payload.publicData, { assetSizes: payload.assetSizes });
  const sizeMB = (Object.values(payload.assetSizes).reduce((a, b) => a + b, 0) / (1024 * 1024)).toFixed(2);
  // eslint-disable-next-line no-console
  console.log(`[publish] ${inputPath.split(/[\\/]/).pop()} → dist/site.html · ${sizeMB} MB · NDA:${payload.ndaBlob ? 'cifrado' : 'não'} · preflight ${pf.errors.length} erros / ${pf.warnings.length} avisos`);
  expect(html).toContain('window.__PORTFOLIO_DATA__');
});
