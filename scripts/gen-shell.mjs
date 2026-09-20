// Gera o "shell" do site (site.html buildado, SEM dados) e o embute em
// src/publish/site-shell.html, para o editor conseguir montar o site no navegador
// (botão "Baixar site"). Rode quando o runtime público mudar: npm run gen:shell
import { execFileSync } from 'node:child_process';
import { copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
execFileSync(process.execPath, [resolve(root, 'node_modules/vite/bin/vite.js'), 'build', '--config', 'vite.site.config.ts'], {
  cwd: root,
  stdio: 'inherit',
});
copyFileSync(resolve(root, 'dist/site.html'), resolve(root, 'src/publish/site-shell.html'));
console.log('✓ src/publish/site-shell.html atualizado');
