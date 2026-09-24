import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { migrate } from '../src/migrate/migrate';
import { textoUi, UI_PADRAO } from '../src/renderer/ui';
import { loadFixture } from './helpers/fixtures';

const DIR = new URL('../src/renderer/', import.meta.url);

describe('textos da interface do site', () => {
  it('nenhum componente do site escreve texto por idioma na mão (vai no dicionário ui.ts)', () => {
    const achados: string[] = [];
    for (const f of readdirSync(DIR).filter((n) => /\.tsx?$/.test(n) && !['ui.ts', 'text.tsx'].includes(n))) {
      readFileSync(new URL(f, DIR), 'utf8').split('\n').forEach((linha, i) => {
        // `lang === 'en' ? 'Close' : 'Fechar'` e `en ? '…' : '…'`
        if (/(lang === 'en'|\ben) \? ['`"][^'`"]*[A-Za-zÀ-ú]/.test(linha)) achados.push(`${f}:${i + 1}: ${linha.trim().slice(0, 90)}`);
      });
    }
    expect(achados).toEqual([]);
  });

  it('todo texto do dicionário existe nos dois idiomas', () => {
    for (const [k, v] of Object.entries(UI_PADRAO)) {
      expect(v.pt.trim(), k).not.toBe('');
      expect(v.en.trim(), k).not.toBe('');
    }
  });

  it('o rótulo personalizado do site antigo vale; só em português, não vale para o inglês', () => {
    const d = migrate(loadFixture('legacy-synthetic-v3.json')).data;
    expect(textoUi(d, 'pt', 'allProjects')).toBe('Todos os Projetos');
    expect(textoUi(d, 'en', 'allProjects')).toBe('All Projects');
    d.site.ui['ndaBtn'] = { pt: 'Abrir', en: '' };
    expect(textoUi(d, 'pt', 'ndaBtn')).toBe('Abrir');
    expect(textoUi(d, 'en', 'ndaBtn')).toBe('Unlock');
  });
});
