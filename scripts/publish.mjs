// Publica o site público self-contained em dist/site.html.
// Uso: npm run publish   (opcional: PUBLISH_FIXTURE=legacy-synthetic-v3.json PUBLISH_NDA_PASSWORD=senha)
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const node = process.execPath;
const run = (args) => execFileSync(node, args, { cwd: root, stdio: 'inherit', env: process.env });

console.log('1/2 · build do runtime público (single-file)…');
run([resolve(root, 'node_modules/vite/bin/vite.js'), 'build', '--config', 'vite.site.config.ts']);

console.log('2/2 · injetando dados + NDA cifrado…');
run([resolve(root, 'node_modules/vitest/vitest.mjs'), 'run', '--config', 'vite.emit.config.ts']);

console.log('✓ Publicado em dist/site.html');
