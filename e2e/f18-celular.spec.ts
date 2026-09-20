import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 } });

/**
 * No celular: texto ocupa a largura toda (legibilidade), mas IMAGENS mantêm a
 * proporção horizontal da grade montada no computador — uma fila de cinco logos
 * continua com cinco, só que menor.
 */
test('no celular a fila de imagens fica igual à do computador; texto vai à largura toda', async ({ page }) => {
  await page.route(/youtube|vimeo|speakerdeck/, (r) => r.abort());
  await page.goto('/editor.html?fresh=1', { waitUntil: 'load' });
  await page.waitForSelector('.editor-canvas .block-image');

  const medidas = await page.evaluate(() => {
    const doc = document;
    const modelo = doc.querySelector('.block.block-image') as HTMLElement;
    const grade = modelo.closest('.section-grid') as HTMLElement;
    // emula a janela estreita usando as mesmas regras da prévia de celular
    doc.querySelector('.editor-canvas')!.classList.add('pv-mobile');
    const fila: HTMLElement[] = [];
    for (let i = 0; i < 5; i++) {
      const c = modelo.cloneNode(true) as HTMLElement;
      c.style.setProperty('--gc-m', 'span 2'); // mesma largura do computador
      c.className += ' m-row'; // fila que continua igual no celular
      c.style.setProperty('--ck', String(i));
      c.style.setProperty('--cn', '5');
      c.style.setProperty('--cfree', '2');
      c.style.setProperty('--rb', '1'); // distribuir, como no computador
      c.style.setProperty('--span', '2');
      grade.appendChild(c);
      fila.push(c);
    }
    const txt = doc.querySelector('.block.block-heading, .block.block-text') as HTMLElement;
    return {
      larguras: fila.map((c) => Math.round(c.getBoundingClientRect().width)),
      linhas: new Set(fila.map((c) => Math.round(c.getBoundingClientRect().y))).size,
      larguraGrade: Math.round(grade.getBoundingClientRect().width),
      sobraEsquerda: Math.round(fila[0]!.getBoundingClientRect().x - grade.getBoundingClientRect().x),
      sobraDireita: Math.round(grade.getBoundingClientRect().right - fila[fila.length - 1]!.getBoundingClientRect().right),
      larguraTexto: txt ? Math.round(txt.getBoundingClientRect().width) : null,
    };
  });

  expect(medidas.linhas).toBe(1); // os cinco continuam lado a lado, como no computador
  expect(medidas.sobraEsquerda).toBeLessThan(2); // encostam nas duas bordas
  expect(medidas.sobraDireita).toBeLessThan(2);
  expect(new Set(medidas.larguras).size).toBe(1); // todos do mesmo tamanho
  expect(medidas.larguras.every((w) => w > 0)).toBe(true); // nenhum sumiu para fora da grade
  expect(medidas.larguraTexto).toBe(medidas.larguraGrade); // texto na largura toda
});

test.describe('interface do editor (janela de computador, canvas estreito)', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

test('a prévia do projeto abre logo abaixo do card tocado', async ({ page }) => {
  await page.route(/youtube|vimeo|speakerdeck/, (r) => r.abort());
  await page.goto('/editor.html?fresh=1', { waitUntil: 'load' });
  await page.waitForSelector('.editor-canvas .project-card');
  await page.locator('.tb-devices button').nth(2).click(); // prévia de celular

  const card = page.locator('.editor-canvas .project-card').first();
  await card.click();
  const pv = page.locator('.editor-canvas .home-preview');
  await expect(pv).toBeVisible();

  const dist = await page.evaluate(() => {
    const aberto = document.querySelector('.project-card.is-open')!.getBoundingClientRect();
    const p = document.querySelector('.home-preview')!.getBoundingClientRect();
    return Math.round(p.y - (aberto.y + aberto.height));
  });
  expect(dist).toBeGreaterThanOrEqual(0);
  expect(dist).toBeLessThan(120); // colada no card, não no fim da lista
});

test('prévia de celular do editor: alvos de toque e campos no tamanho do celular', async ({ page }) => {
  await page.route(/youtube|vimeo|speakerdeck/, (r) => r.abort());
  await page.goto('/editor.html?fresh=1', { waitUntil: 'load' });
  await page.waitForSelector('.editor-canvas .nav-link');
  await page.locator('.tb-devices button').nth(2).click(); // celular
  await expect(page.locator('.editor-canvas.pv-mobile')).toBeVisible();

  const medidas = await page.evaluate(() => {
    const alt = (sel: string) => {
      const el = document.querySelector(`.editor-canvas ${sel}`);
      return el ? Math.round(el.getBoundingClientRect().height) : null;
    };
    const fonte = (sel: string) => {
      const el = document.querySelector(`.editor-canvas ${sel}`);
      return el ? parseFloat(getComputedStyle(el).fontSize) : null;
    };
    return { navLink: alt('.nav-link'), bandeira: alt('.flag-btn'), fonteNav: fonte('.nav-link'), fontePapel: fonte('.header-role') };
  });

  expect(medidas.navLink).toBeGreaterThanOrEqual(44);
  expect(medidas.bandeira).toBeGreaterThanOrEqual(44);
  expect(medidas.fonteNav).toBeGreaterThanOrEqual(13);
  expect(medidas.fontePapel).toBeGreaterThanOrEqual(13);
});

test('tablet segue a grade do computador e a prévia ocupa a linha inteira', async ({ page }) => {
  await page.route(/youtube|vimeo|speakerdeck/, (r) => r.abort());
  await page.goto('/editor.html?fresh=1', { waitUntil: 'load' });
  await page.waitForSelector('.editor-canvas .project-card');

  for (const [idx, tela] of [[0, 'desktop'], [1, 'tablet'], [2, 'mobile']] as const) {
    await page.locator('.tb-devices button').nth(idx).click();
    await page.locator('.editor-canvas .project-card').first().click();
    const medida = await page.evaluate(() => {
      const el = document.querySelector('.editor-canvas .home-preview');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const g = el.closest('.collection-grid')!.getBoundingClientRect();
      return { sobra: Math.round(g.width - r.width) };
    });
    expect(medida, `prévia não abriu em ${tela}`).not.toBeNull();
    expect(medida!.sobra, `prévia não ocupa a linha em ${tela}`).toBeLessThan(3);
    await page.locator('.editor-canvas .home-preview .home-preview-close').click();
  }
});
});
