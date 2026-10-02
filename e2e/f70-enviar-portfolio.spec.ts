import { test, expect, type Page } from '@playwright/test';
import { createHash } from 'node:crypto';
import { auditarAcessibilidade } from './helpers/axe';

/**
 * "Enviar ao portfólio": ao lado do "Baixar site", grava o site gerado direto
 * no repositório do GitHub Pages. Aqui o GitHub é de mentira (page.route): o
 * teste confere o que o editor pergunta, o que ele manda e o que ele diz.
 */
interface Put { path: string; sha?: string; branch: string; texto: string; auth: string | null }

async function githubFalso(page: Page, opts: { negar?: number; inicial?: Record<string, string> } = {}): Promise<{ puts: Put[]; arquivos: Record<string, string> }> {
  const arquivos: Record<string, string> = { ...(opts.inicial ?? {}) };
  const puts: Put[] = [];
  const gitSha = (s: string): string => createHash('sha1').update(`blob ${Buffer.byteLength(s)}\0`).update(s).digest('hex');
  await page.route('https://api.github.com/**', async (route) => {
    const req = route.request();
    const path = decodeURIComponent(new URL(req.url()).pathname.replace(/^\/repos\/[^/]+\/[^/]+\/contents\//, ''));
    if (opts.negar) return route.fulfill({ status: opts.negar, body: '{}' });
    if (req.method() === 'GET') {
      return path in arquivos ? route.fulfill({ status: 200, json: { sha: gitSha(arquivos[path]!) } }) : route.fulfill({ status: 404, body: '{}' });
    }
    const corpo = req.postDataJSON() as { content: string; sha?: string; branch: string };
    const texto = Buffer.from(corpo.content, 'base64').toString('utf8');
    puts.push({ path, sha: corpo.sha, branch: corpo.branch, texto, auth: req.headers()['authorization'] ?? null });
    arquivos[path] = texto;
    return route.fulfill({ status: 201, json: { content: { sha: gitSha(texto) } } });
  });
  return { puts, arquivos };
}

test.beforeEach(async ({ page }) => {
  await page.route(/youtube|vimeo|speakerdeck/, (r) => r.abort());
  // Sem token de nenhum tipo neste navegador.
  await page.addInitScript(() => {
    for (const k of ['portfolio-v4:github-site', 'portfolio-v4:github-sync']) localStorage.removeItem(k);
  });
  await page.goto('/editor.html', { waitUntil: 'load' });
  await expect(page.locator('.editor-topbar')).toBeVisible();
});

const botao = (page: Page) => page.locator('.tb-btn', { hasText: /Enviar ao portfólio|Enviando/ });

test('fica ao lado do "Baixar site"', async ({ page }) => {
  const nomes = await page.locator('.tb-right > .tb-btn.primary').allTextContents();
  expect(nomes).toEqual(['Baixar site', 'Enviar ao portfólio']);
});

test('primeira vez: pede repositório e token, confirma e grava o index.html na main', async ({ page }) => {
  const gh = await githubFalso(page);
  await botao(page).click();
  const dialogo = page.getByRole('dialog', { name: 'Enviar ao portfólio' });
  await expect(dialogo.getByLabel('Repositório do site (dono/nome)')).toHaveValue('luccatuelher/portfolio');
  await expect(dialogo.getByRole('button', { name: 'Salvar e enviar' })).toBeDisabled();
  await auditarAcessibilidade(page, 'editor · janela Enviar ao portfólio');
  await dialogo.getByLabel('Token do GitHub').fill('github_pat_teste');
  await dialogo.getByRole('button', { name: 'Salvar e enviar' }).click();

  const confirma = page.getByRole('alertdialog', { name: 'Enviar o site para o portfólio?' });
  await expect(confirma).toContainText('luccatuelher/portfolio');
  await confirma.getByRole('button', { name: 'Enviar', exact: true }).click();

  await expect(page.locator('.aviso', { hasText: 'Site enviado para luccatuelher/portfolio' })).toBeVisible();
  const index = gh.puts.find((p) => p.path === 'index.html');
  expect(index, 'gravou o index.html').toBeTruthy();
  expect(index!.branch).toBe('main');
  expect(index!.auth).toBe('Bearer github_pat_teste');
  expect(index!.texto).toContain('Studio Quadro');
  expect(index!.texto.startsWith('<!doctype html>') || index!.texto.startsWith('<!DOCTYPE html>')).toBe(true);

  // O token fica guardado: a próxima vez não pergunta de novo.
  await botao(page).click();
  await expect(page.getByRole('dialog', { name: 'Enviar ao portfólio' })).toHaveCount(0);
  await expect(page.getByRole('alertdialog', { name: 'Enviar o site para o portfólio?' })).toBeVisible();
});

test('mandar o mesmo site duas vezes não cria outro commit', async ({ page }) => {
  const gh = await githubFalso(page);
  await page.evaluate(() => localStorage.setItem('portfolio-v4:github-site', JSON.stringify({ repo: 'luccatuelher/portfolio', token: 'github_pat_teste', branch: 'main' })));
  for (const vez of [1, 2]) {
    await botao(page).click();
    await page.getByRole('alertdialog', { name: 'Enviar o site para o portfólio?' }).getByRole('button', { name: 'Enviar', exact: true }).click();
    await expect(page.locator('.aviso', { hasText: vez === 1 ? 'Site enviado' : 'já está igual' })).toBeVisible();
  }
  expect(gh.puts.filter((p) => p.path === 'index.html')).toHaveLength(1);
});

test('token sem permissão: o diálogo volta explicando e pedindo o token certo', async ({ page }) => {
  await githubFalso(page, { negar: 403 });
  await page.evaluate(() => localStorage.setItem('portfolio-v4:github-site', JSON.stringify({ repo: 'luccatuelher/portfolio', token: 'github_pat_errado', branch: 'main' })));
  await botao(page).click();
  await page.getByRole('alertdialog', { name: 'Enviar o site para o portfólio?' }).getByRole('button', { name: 'Enviar', exact: true }).click();
  const dialogo = page.getByRole('dialog', { name: 'Enviar ao portfólio' });
  await expect(dialogo.getByRole('alert')).toContainText('permissão de escrita');
  await expect(botao(page)).toBeEnabled();
});

test('cancelar na confirmação não manda nada', async ({ page }) => {
  const gh = await githubFalso(page);
  await page.evaluate(() => localStorage.setItem('portfolio-v4:github-site', JSON.stringify({ repo: 'luccatuelher/portfolio', token: 'x', branch: 'main' })));
  await botao(page).click();
  await page.getByRole('alertdialog', { name: 'Enviar o site para o portfólio?' }).getByRole('button', { name: 'Cancelar' }).click();
  expect(gh.puts).toHaveLength(0);
});
