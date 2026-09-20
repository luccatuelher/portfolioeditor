// Gera fixtures v3 carregando o legacy/index.html em jsdom + fake-indexeddb.
// Uso: npm run gen:fixtures
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { JSDOM } from 'jsdom';
import { IDBFactory } from 'fake-indexeddb';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const legacyPath = resolve(root, 'legacy/index.html');
const outPath = resolve(root, 'fixtures/template-v3.json');

let html = readFileSync(legacyPath, 'utf8');

// 1) Rodar no perfil de demonstração (dados de exemplo, store separada).
html = html.replace(/var BUILD_PROFILE = 'personal';/, "var BUILD_PROFILE = 'template';");
// 2) Expor APP (que vive dentro do IIFE) logo após a chamada de initDraft.
html = html.replace(/initDraft\(\);/, 'initDraft();window.__APP__=APP;');

if (!html.includes("var BUILD_PROFILE = 'template';")) throw new Error('Falha ao trocar BUILD_PROFILE.');
if (!html.includes('window.__APP__=APP;')) throw new Error('Falha ao expor APP.');

const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  url: 'http://localhost/',
  beforeParse(window) {
    // IndexedDB isolado por execução.
    window.indexedDB = new IDBFactory();
    // Shims que o script do v3 assume no escopo de window.
    if (typeof window.unescape !== 'function') window.unescape = globalThis.unescape;
    if (typeof window.escape !== 'function') window.escape = globalThis.escape;
  },
});

// Deixa a continuação assíncrona de initDraft assentar (IDB vazio → mantém template).
await new Promise((r) => setTimeout(r, 50));

const app = dom.window.__APP__;
if (!app || !app.data) throw new Error('window.__APP__.data não foi exposto — verifique os patches.');

const data = app.data;
if (data.schemaVersion !== 3) {
  throw new Error(`Esperava schemaVersion 3 (validado), veio ${data.schemaVersion}.`);
}

writeFileSync(outPath, JSON.stringify(data, null, 2), 'utf8');

const count = (arr) => (Array.isArray(arr) ? arr.length : 0);
console.log('Fixture gerada:', outPath);
console.log('  projects:', count(data.projects), '| blog:', count(data.blog), '| gallery:', count(data.gallery), '| sketches:', count(data.sketches));
console.log('  schemaVersion:', data.schemaVersion);

dom.window.close();
