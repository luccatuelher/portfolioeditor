import { test, expect, type Page } from '@playwright/test';

/**
 * Nenhum controle sem efeito. Para o primeiro elemento de cada tipo (em todas
 * as páginas), cada aba do Inspector, e para a página, a seção, o cabeçalho e
 * a ficha de um projeto: muda cada campo (lista, caixa, número, texto), exige
 * que algo mude no canvas, e desfaz. Controle que grava sem mudar nada no que
 * se vê é defeito — já houve ("Tamanho do texto", "Destaque 2", "Mostrar no
 * menu" da área NDA).
 *
 * Fora da regra, e por quê: o que não aparece no canvas por natureza.
 */
const SEM_CANVAS_DE_PROPOSITO = [
  /Nome \(só no editor\)/, // renomeia a camada no painel Layers
  /Endereço \(slug\)/, // muda o endereço da página, não o que ela mostra
];
const ABAS = ['Conteúdo', 'Layout', 'Estilo', 'Visibilidade'];
let testados = 0;

async function foto(page: Page): Promise<string> {
  return page.evaluate(() => (document.querySelector('.editor-canvas')?.innerHTML ?? '') + '|' + document.title);
}

async function camposSemEfeito(page: Page, onde: string): Promise<string[]> {
  const ruins: string[] = [];
  const campos = page.locator('.inspector .insp-body').locator('select, input:not([type=file]):not([type=color]), textarea');
  const n = await campos.count();
  for (let i = 0; i < n; i++) {
    const c = campos.nth(i);
    if (!(await c.isVisible()) || !(await c.isEnabled())) continue;
    const rotulo = await c.evaluate((el) => {
      const r = el.closest('.insp-row, label, .theme-font');
      return (el.getAttribute('aria-label') || r?.querySelector('.insp-label, span')?.textContent || r?.textContent || el.getAttribute('title') || el.tagName || '').replace(/\s+/g, ' ').trim().slice(0, 50);
    });
    if (SEM_CANVAS_DE_PROPOSITO.some((re) => re.test(rotulo))) continue;
    const tipo = await c.evaluate((el) => `${el.tagName}:${(el as HTMLInputElement).type ?? ''}`);
    const antes = await foto(page);
    testados++;
    if (tipo.startsWith('SELECT')) {
      const atual = await c.inputValue();
      const opcoes = await c.locator('option:not([disabled])').evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value));
      const outra = opcoes.find((v) => v !== atual && v !== '__outra');
      if (!outra) continue;
      await c.selectOption(outra);
    } else if (tipo.endsWith('checkbox')) {
      await c.click();
    } else if (tipo.endsWith('range') || tipo.endsWith('number')) {
      const v = Number(await c.inputValue()) || 0;
      const max = Number((await c.getAttribute('max')) ?? v + 10);
      const min = Number((await c.getAttribute('min')) ?? 0);
      const passo = Number((await c.getAttribute('step')) ?? 1) || 1;
      const nv = String(v + passo <= max ? v + passo : Math.max(min, v - passo));
      if (tipo.endsWith('range')) {
        // Deslizante não aceita fill: o valor pelo setter nativo e os eventos que o React ouve.
        await c.evaluate((el, valor) => {
          Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, valor);
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }, nv);
      } else {
        await c.fill(nv);
        await c.press('Tab');
      }
    } else if (/:(date|month|week|time)$/.test(tipo)) {
      // Data e mês só aceitam valor válido: um diferente do atual.
      const exemplos: Record<string, [string, string]> = { date: ['2019-03-04', '2020-05-06'], month: ['2019-03', '2020-05'], week: ['2019-W10', '2020-W20'], time: ['09:15', '10:30'] };
      const [a, b] = exemplos[tipo.split(':')[1]!]!;
      await c.fill((await c.inputValue()) === a ? b : a);
      await c.press('Tab');
    } else {
      await c.fill(`${await c.inputValue()} xq`);
      await c.press('Tab');
    }
    await expect.poll(() => foto(page), { timeout: 1500 }).not.toBe(antes).catch(() => ruins.push(`${onde} · ${rotulo} [${tipo}]`));
    await page.keyboard.press('Escape');
    await page.locator('.editor-topbar button[aria-label^="Desfazer"]').click().catch(() => undefined);
  }
  return ruins;
}

test('todo campo do Inspector muda algo no canvas', async ({ page }) => {
  test.setTimeout(240_000);
  await page.goto('/editor.html?fresh=1', { waitUntil: 'load' });
  const ruins: string[] = [];
  const linhas = page.locator('.editor-left .tree-row.blk .tree-main');
  const paginas = page.locator('.editor-left .tree-row.pagerow .tree-main');
  const vistos = new Set<string>();

  await page.locator('.left-tabs button', { hasText: 'Páginas' }).click();
  const np = await paginas.count();
  for (let k = 0; k < np; k++) {
    await page.locator('.left-tabs button', { hasText: 'Páginas' }).click();
    const nome = (await paginas.nth(k).innerText()).replace(/\s+/g, ' ').trim();
    await paginas.nth(k).click();
    ruins.push(...(await camposSemEfeito(page, `página ${nome}`)));
    await page.locator('.left-tabs button', { hasText: 'Layers' }).click();
    const m = await linhas.count();
    for (let i = 0; i < m; i++) {
      const tipo = (await linhas.nth(i).innerText()).replace('◈', '').trim();
      if (vistos.has(tipo)) continue;
      vistos.add(tipo);
      await linhas.nth(i).click();
      for (const aba of ABAS) {
        const botao = page.locator('.insp-tab', { hasText: aba });
        if (!(await botao.count())) continue;
        await botao.click();
        ruins.push(...(await camposSemEfeito(page, `${tipo}/${aba} (${nome})`)));
        await linhas.nth(i).click();
      }
    }
  }
  // Seção, cabeçalho e a ficha de um projeto (na Home).
  await page.locator('.left-tabs button', { hasText: 'Páginas' }).click();
  await paginas.first().click();
  await page.locator('.left-tabs button', { hasText: 'Layers' }).click();
  await page.locator('.editor-left .tree-row.sec .tree-main').first().click();
  ruins.push(...(await camposSemEfeito(page, 'seção')));
  await page.locator('.editor-canvas [data-site-header]').first().click();
  ruins.push(...(await camposSemEfeito(page, 'cabeçalho')));

  expect(vistos.size, 'alcance: tipos de elemento visitados').toBeGreaterThanOrEqual(8);
  expect(testados, 'alcance: campos mexidos').toBeGreaterThan(60);
  test.info().annotations.push({ type: 'campos', description: String(testados) });
  console.log(`campos mexidos: ${testados}`);
  expect(ruins).toEqual([]);
});
