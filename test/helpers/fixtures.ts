import { readFileSync } from 'node:fs';
import { URL as NodeURL, fileURLToPath } from 'node:url';

// O URL do Node, não o global: num teste com `@vitest-environment jsdom` o
// global é o do jsdom, e o caminho do Windows saía errado (C:\fixtures\…).
export function loadFixture(name: string): unknown {
  const url = new NodeURL(`../../fixtures/${name}`, import.meta.url);
  return JSON.parse(readFileSync(fileURLToPath(url), 'utf8'));
}

export const FIXTURES = ['template-v3.json', 'legacy-synthetic-v3.json'] as const;
