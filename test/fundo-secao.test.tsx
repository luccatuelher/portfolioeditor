import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { corDoTema, fundoInverteTexto, themeToCssVars } from '../src/renderer/theme';
import { defaultTheme } from '../src/schema/v4';
import { migrate } from '../src/migrate/migrate';
import { dataUrlResolver } from '../src/renderer/dataUrlResolver';
import { Site } from '../src/renderer/Site';
import { loadFixture } from './helpers/fixtures';

// Fundo de bloco e de seção: a cor escolhida precisa apontar para uma variável
// que o Tema realmente define ("Tinta suave" apontava para --inkSoft, que não existe).
describe('cor de fundo (bloco e seção)', () => {
  it('toda cor do tema vira uma variável que o tema define', () => {
    const tema = defaultTheme();
    const definidas = Object.keys(themeToCssVars(tema));
    for (const token of Object.keys(tema.colors)) {
      const nome = corDoTema(token).replace(/^var\(|\)$/g, '');
      expect(definidas, `cor "${token}"`).toContain(nome);
    }
  });

  it('seção com fundo sai com a classe e a cor; sem fundo, nada muda', () => {
    const { data, assets } = migrate(loadFixture('template-v3.json'));
    const html = (): string => renderToStaticMarkup(<Site data={data} resolveAsset={dataUrlResolver(assets)} initialRoute="home" initialLang="pt" />);
    expect(html()).not.toContain('has-bg');
    data.pages.find((p) => p.id === 'home')!.sections[0]!.style.bg = 'inkSoft';
    expect(html()).toMatch(/class="section [^"]*has-bg/);
    expect(html()).toContain('--sec-bg:var(--ink-soft)');
  });

  it('fundo escuro num tema claro troca a cor do texto; fundo claro não', () => {
    const tema = defaultTheme();
    tema.colors.bg = '#faf9f7';
    tema.colors.surface = '#f0eee9';
    tema.colors.ink = '#1c1b18';
    expect(fundoInverteTexto(tema, 'ink')).toBe(true);
    expect(fundoInverteTexto(tema, 'surface')).toBe(false);
    expect(fundoInverteTexto(tema, 'bg')).toBe(false);
    expect(fundoInverteTexto(tema, 'naoExiste')).toBe(false);
  });
});
