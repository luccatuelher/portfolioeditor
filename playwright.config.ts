import { defineConfig, devices } from '@playwright/test';

// E2E/visual: sobe o Vite e tira screenshots de cada página do renderer v4.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  reporter: 'list',
  timeout: 30_000,
  webServer: {
    command: 'npm run dev -- --port 5199 --strictPort',
    url: 'http://localhost:5199/preview.html',
    reuseExistingServer: true,
    timeout: 60_000,
  },
  use: {
    baseURL: 'http://localhost:5199',
    viewport: { width: 1280, height: 900 },
    locale: 'pt-BR',
    // Um backup "recente" registrado: o aviso de proteção do rascunho
    // (editor/armazenamento.ts) não entra no meio dos outros testes. O teste
    // dele (f63) começa com o navegador limpo.
    storageState: 'e2e/fixtures/navegador-com-backup.json',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
