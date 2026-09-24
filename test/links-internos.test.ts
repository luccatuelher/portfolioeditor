import { describe, expect, it } from 'vitest';
import { migrate } from '../src/migrate/migrate';
import { upgradeDoc } from '../src/migrate/upgrade';
import { destinoDoLink, hrefPublico, linksDoDocumento, linksPorId, rotaCanonica } from '../src/core/links';
import { destinosInternos } from '../src/editor/choices';
import { runPreflight } from '../src/publish/preflight';
import { resolveRoute } from '../src/renderer/Site';
import { loadFixture } from './helpers/fixtures';
import type { Block, PortfolioV4 } from '../src/schema/v4';

const base = (): PortfolioV4 => migrate(loadFixture('template-v3.json')).data;
const botao = (id: string, href: string): Block => ({ id, type: 'button', span: 4, visibility: 'public', content: { label: { pt: 'Sobre mim', en: 'About me' }, href, variant: 'solid' } }) as Block;
const pagina = (d: PortfolioV4, id: string) => d.pages.find((p) => p.id === id)!;

describe('links internos', () => {
  it('link para página escolhido no editor sobrevive à troca do endereço da página', () => {
    const d = base();
    const sobre = d.pages.find((p) => p.kind === 'static' && p.id !== 'home')!;
    const escolhido = destinosInternos(d).find((x) => x.label.startsWith(sobre.title.pt))!.value;
    pagina(d, 'home').sections[0]!.blocks.push(botao('b1', escolhido));
    sobre.slug = 'quem-sou';
    const d2 = destinoDoLink(d, escolhido);
    expect(d2.tipo === 'pagina' && d2.page.id).toBe(sobre.id);
    // No site o link aparece pelo endereço novo, e a rota abre a página certa.
    expect(hrefPublico(d, escolhido)).toBe('#quem-sou');
    expect(resolveRoute(d, rotaCanonica(d, escolhido.slice(1))).page.id).toBe(sobre.id);
  });

  it('dados antigos (link pelo endereço) passam a ser pelo id — botão, CV e link dentro de texto', () => {
    const d = base();
    const sobre = d.pages.find((p) => p.kind === 'static' && p.id !== 'home')!;
    sobre.slug = 'sobre-mim';
    const home = pagina(d, 'home').sections[0]!;
    home.blocks.push(botao('b1', '#sobre-mim'));
    home.blocks.push({ id: 't1', type: 'text', span: 12, visibility: 'public', content: { html: { pt: '<p>Veja <a href="#sobre-mim">quem sou</a>.</p>', en: '<p>See <a href="#sobre-mim">me</a>.</p>' } } } as Block);
    upgradeDoc(d);
    const hrefs = linksDoDocumento(d).filter((l) => l.blockId === 'b1' || l.blockId === 't1').map((l) => l.href);
    expect(hrefs).toEqual([`#${sobre.id}`, `#${sobre.id}`]);
    expect(linksPorId(d)).toBe(0); // idempotente
  });

  it('link externo, projeto e âncora vazia ficam como estão', () => {
    const d = base();
    const home = pagina(d, 'home').sections[0]!;
    const proj = d.collections.projects[0]!;
    home.blocks.push(botao('b1', 'https://exemplo.com'), botao('b2', `#project/${proj.id}`), botao('b3', '#'));
    upgradeDoc(d);
    expect(linksDoDocumento(d).filter((l) => ['b1', 'b2', 'b3'].includes(l.blockId)).map((l) => l.href)).toEqual(['https://exemplo.com', `#project/${proj.id}`, '#']);
  });

  it('o aviso de publicação aponta link para página excluída ou em rascunho', () => {
    const d = base();
    const sobre = d.pages.find((p) => p.kind === 'static' && p.id !== 'home')!;
    const home = pagina(d, 'home').sections[0]!;
    home.blocks.push(botao('b1', `#${sobre.id}`), botao('b2', '#nao-existe'));
    sobre.visibility = 'draft';
    const avisos = runPreflight(d).warnings.join('\n');
    expect(avisos).toContain('Botão “Sobre mim” · página');
    expect(avisos).toContain('está em rascunho');
    expect(avisos).toContain('não existe mais');
  });
});
