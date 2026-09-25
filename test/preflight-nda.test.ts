import { describe, expect, it } from 'vitest';
import { migrate } from '../src/migrate/migrate';
import { arquivosAoLado, runPreflight } from '../src/publish/preflight';
import { publicSnapshot } from '../src/publish/publicSnapshot';
import { imagensSemDescricao } from '../src/editor/pendencias';
import type { Block, PortfolioV4, Section } from '../src/schema/v4';
import { loadFixture } from './helpers/fixtures';

/**
 * A conferência antes de publicar olha tudo o que vai para o site — inclusive
 * o NDA, que quem tem a senha vai ver. Antes o editor passava só a parte
 * pública: vídeo quebrado, botão sem link ou imagem sem descrição num projeto
 * confidencial saíam sem aviso, e a contagem não batia com o painel Dados.
 */
const problemas = (sufixo: string): Section => ({
  id: `s-${sufixo}`,
  style: {},
  blocks: [
    { id: `emb-${sufixo}`, type: 'embed', span: 12, visibility: 'public', content: { provider: 'youtube', ref: 'isso não é um vídeo' } },
    { id: `btn-${sufixo}`, type: 'button', span: 12, visibility: 'public', content: { label: { pt: `Ver ${sufixo}`, en: '' }, href: '', variant: 'solid' } },
    { id: `cv-${sufixo}`, type: 'button', span: 12, visibility: 'public', content: { label: { pt: 'CV', en: 'CV' }, href: `cv-${sufixo}.pdf`, variant: 'solid' } },
    { id: `img-${sufixo}`, type: 'image', span: 12, visibility: 'public', content: { image: { url: 'https://exemplo.com/a.jpg', alt: { pt: '', en: '' } } } },
  ] as Block[],
});

function doc(): PortfolioV4 {
  const d = migrate(loadFixture('legacy-synthetic-v3.json')).data;
  const nda = d.collections.projects.find((p) => p.visibility === 'nda')!;
  const rascunho = d.collections.projects.find((p) => p.visibility === 'draft')!;
  nda.sections.push(problemas('nda'));
  rascunho.sections.push(problemas('rascunho'));
  return d;
}

describe('preflight: o que vai para o site, NDA incluído', () => {
  it('confere o projeto NDA e diz onde está o problema', () => {
    const d = doc();
    const r = runPreflight(d);
    const nome = d.collections.projects.find((p) => p.visibility === 'nda')!.title.pt;
    expect(r.errors.join('\n')).toContain(`Embed inválido (youtube) — projeto “${nome}” (NDA)`);
    expect(r.warnings.join('\n')).toContain(`Botão "Ver nda": sem link — projeto “${nome}” (NDA)`);
    expect(arquivosAoLado(d)).toContain('cv-nda.pdf');
  });

  it('rascunho não vai para o site: nada dele nos avisos', () => {
    const d = doc();
    const r = runPreflight(d);
    expect([...r.errors, ...r.warnings].join('\n')).not.toMatch(/rascunho”|Ver rascunho/);
    expect(arquivosAoLado(d)).not.toContain('cv-rascunho.pdf');
  });

  it('publicando sem a área NDA (sem senha), o NDA também sai dos avisos', () => {
    const r = runPreflight(publicSnapshot(doc()).data);
    expect([...r.errors, ...r.warnings].join('\n')).not.toContain('(NDA)');
    expect(arquivosAoLado(publicSnapshot(doc()).data)).not.toContain('cv-nda.pdf');
  });

  it('a contagem de imagens sem descrição é a mesma do painel Dados', () => {
    const d = doc();
    const noPainel = imagensSemDescricao(d).length;
    expect(noPainel).toBeGreaterThan(0);
    expect(runPreflight(d).warnings.join('\n')).toContain(`${noPainel} imagem(ns) sem descrição`);
  });
});
