// Gera o cv.pdf do site a partir de cv/cv.html (A4, uma página, fontes do site embutidas).
// Uso: npm run gerar:cv -- [saida.pdf]   (padrão: ../portfolio/cv.pdf, ao lado do index.html)
// Navegador: CHROMIUM_PATH (na nuvem, /opt/pw-browsers/chromium) ou o do Playwright.
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const saida = process.argv[2] ? resolve(process.argv[2]) : resolve(root, '../portfolio/cv.pdf');

const navegador = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const pagina = await navegador.newPage();
await pagina.goto(pathToFileURL(resolve(root, 'cv/cv.html')).href, { waitUntil: 'load' });
await pagina.evaluate(() => document.fonts.ready);
const falhou = await pagina.evaluate(() => [...document.fonts].filter((f) => f.status === 'error').map((f) => f.family));
if (falhou.length) throw new Error(`fontes do CV não carregaram: ${falhou.join(', ')}`);
// Tudo numa página: o conteúdo não pode passar da folha.
const passou = await pagina.evaluate(() => { const f = document.querySelector('.folha'); return f ? f.scrollHeight - f.clientHeight : 0; });
if (passou > 1) throw new Error(`o CV passou da página em ${passou}px — encurte o conteúdo`);
await pagina.pdf({ path: saida, format: 'A4', printBackground: true, margin: { top: '0', right: '0', bottom: '0', left: '0' } });
await navegador.close();
console.log(`✓ ${saida}`);
