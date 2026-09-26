import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { themeToCssVars } from '../src/renderer/theme';
import { defaultTheme } from '../src/schema/v4';

/**
 * Nenhum controle do Tema sem efeito. "Tamanho do texto", "Contraste entre
 * tamanhos" e a cor "Destaque 2" gravavam valores que nenhuma regra do site
 * lia — mudar não mudava nada. Guarda: toda variável que o Tema define é usada
 * pelo site; e todo tamanho de texto acompanha a escala.
 */
const css = readFileSync('src/renderer/styles.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const componentes = ['blocks.tsx', 'Site.tsx', 'Header.tsx', 'Page.tsx', 'css.ts'].map((f) => readFileSync(`src/renderer/${f}`, 'utf8')).join('\n');

describe('Tema: todo controle faz efeito no site', () => {
  it('toda variável que o Tema define é usada (CSS do site ou componentes)', () => {
    const usadas = (nome: string): boolean => css.includes(`var(${nome}`) || componentes.includes(nome) || /^--ts-/.test(nome);
    const sem = Object.keys(themeToCssVars(defaultTheme())).filter((v) => !usadas(v));
    expect(sem).toEqual([]);
  });

  it('todo tamanho de texto em rem acompanha "Tamanho do texto"', () => {
    const soltos = [...css.matchAll(/font-size:\s*([^;]+);/g)].map((m) => m[1]!).filter((v) => /rem|--ts-size/.test(v) && !v.includes('var(--escala-texto'));
    expect(soltos).toEqual([]);
  });

  it('padrão (16 px, 1,25) não muda nada; os valores viram escala', () => {
    const t = defaultTheme();
    expect(themeToCssVars(t)['--escala-texto']).toBe('1');
    expect(themeToCssVars(t)['--escala-titulos']).toBe('1');
    const grande = { ...t, type: { base: 20, ratio: 1.5 } };
    expect(themeToCssVars(grande)['--escala-texto']).toBe('1.25');
    expect(themeToCssVars(grande)['--escala-titulos']).toBe('1.44');
  });
});
