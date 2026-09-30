// Gera o site a partir do backup pelo MESMO caminho do "Baixar site" do editor
// (miniaturas e imagem de compartilhamento feitas no navegador) e grava na pasta
// do repositório do site (index.html + compartilhar.jpg).
//
// Uso: npm run publicar:site -- [backup.json] [pasta-do-site]
//   padrão: ../portfolio-backup/portfolio-backup.json → ../portfolio
//
// Área NDA: com PUBLISH_NDA_PASSWORD, cifra de novo com ela. Sem ela, reaproveita o
// pacote cifrado que já está no index.html da pasta do site (a senha dos visitantes
// continua a mesma; mudanças no conteúdo NDA só entram quando o editor publicar).
// Navegador: CHROMIUM_PATH (na nuvem, /opt/pw-browsers/chromium) ou o do Playwright.
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [entrada = resolve(root, '../portfolio-backup/portfolio-backup.json'), pastaDoSite = resolve(root, '../portfolio')] = process.argv.slice(2);
const PORTA = 5198;
const senha = process.env.PUBLISH_NDA_PASSWORD || undefined;

const backupTexto = readFileSync(entrada, 'utf8');
const indexAtual = resolve(pastaDoSite, 'index.html');
let pacoteNdaNoAr = null;
if (!senha && existsSync(indexAtual)) {
  const h = readFileSync(indexAtual, 'utf8');
  const i = h.indexOf('<script>window.__NDA__=');
  if (i >= 0) pacoteNdaNoAr = h.slice(i + '<script>window.__NDA__='.length, h.indexOf(';</script>', i));
}

const servidor = spawn(process.execPath, [resolve(root, 'node_modules/vite/bin/vite.js'), '--port', String(PORTA), '--strictPort'], { cwd: root, stdio: 'ignore' });
const encerrar = () => servidor.kill();
process.on('exit', encerrar);

try {
  for (let i = 0; ; i++) {
    try {
      if ((await fetch(`http://127.0.0.1:${PORTA}/preview.html`)).ok) break;
    } catch {
      /* ainda subindo */
    }
    if (i > 60) throw new Error('o servidor do Vite não subiu');
    await new Promise((r) => setTimeout(r, 500));
  }

  const navegador = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const pagina = await navegador.newPage();
  await pagina.goto(`http://127.0.0.1:${PORTA}/preview.html`, { waitUntil: 'load' });
  const r = await pagina.evaluate(async ({ backupTexto, senha, pacoteNdaNoAr }) => {
    const { buildPublishPayload } = await import('/src/publish/buildPayload.ts');
    const { miniaturaDeDataUrl, imagemDeCompartilhar } = await import('/src/assets/importImage.ts');
    const { ARQUIVO_SOCIAL, imagemSocialEmbutida } = await import('/src/publish/imagemSocial.ts');
    const { assembleSiteHtml } = await import('/src/publish/assemble.ts');
    const { parseBackup } = await import('/src/editor/backup.ts');
    const { runPreflight } = await import('/src/publish/preflight.ts');
    const { ndaCount, publicSnapshot } = await import('/src/publish/publicSnapshot.ts');
    const shell = (await import('/src/publish/site-shell.html?raw')).default;

    const bk = parseBackup(backupTexto);
    const payload = await buildPublishPayload({ data: bk.doc, assets: Object.entries(bk.assets).map(([id, dataUrl]) => ({ id, dataUrl, mime: '' })) }, senha, { miniatura: miniaturaDeDataUrl });
    const itensNda = ndaCount(publicSnapshot(bk.doc).nda);
    let nda = 'nenhum item NDA';
    if (itensNda) {
      if (payload.ndaBlob) nda = `${itensNda} item(ns) NDA cifrados de novo`;
      else if (pacoteNdaNoAr) {
        payload.ndaBlob = JSON.parse(pacoteNdaNoAr);
        nda = `${itensNda} item(ns) NDA: pacote cifrado do site no ar reaproveitado`;
      } else nda = `ATENÇÃO: ${itensNda} item(ns) NDA ficaram de fora (sem senha e sem pacote no ar)`;
    }
    const pf = runPreflight(payload.publicData, { assetSizes: payload.assetSizes });
    const social = imagemSocialEmbutida(payload.publicData);
    const fonte = social?.assetId ? bk.assets[social.assetId] : undefined;
    const jpg = fonte && (payload.publicData.site.url ?? '').trim() ? await imagemDeCompartilhar(fonte, social?.crop) : null;
    if (jpg) payload.arquivoSocial = ARQUIVO_SOCIAL;
    const html = assembleSiteHtml(shell, payload);
    let jpgB64 = null;
    if (jpg) {
      const bytes = new Uint8Array(await jpg.arrayBuffer());
      let s = '';
      for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      jpgB64 = btoa(s);
    }
    return { html, jpgB64, arquivoSocial: ARQUIVO_SOCIAL, nda, erros: pf.errors, avisos: pf.warnings };
  }, { backupTexto, senha, pacoteNdaNoAr });
  await navegador.close();

  writeFileSync(indexAtual, r.html);
  if (r.jpgB64) writeFileSync(resolve(pastaDoSite, r.arquivoSocial), Buffer.from(r.jpgB64, 'base64'));
  console.log(`✓ ${indexAtual} · ${(r.html.length / 1048576).toFixed(2)} MB${r.jpgB64 ? ` + ${r.arquivoSocial}` : ''}`);
  console.log(`  NDA: ${r.nda}`);
  for (const e of r.erros) console.log(`  ✗ ${e}`);
  for (const a of r.avisos) console.log(`  ! ${a}`);
  if (r.erros.length) process.exitCode = 1;
} finally {
  encerrar();
}
