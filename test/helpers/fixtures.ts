import { readFileSync } from 'node:fs';

export function loadFixture(name: string): unknown {
  const url = new URL(`../../fixtures/${name}`, import.meta.url);
  return JSON.parse(readFileSync(url, 'utf8'));
}

export const FIXTURES = ['template-v3.json', 'legacy-synthetic-v3.json'] as const;
