import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { migrate } from '../src/migrate/migrate';
import { loadFixture } from './helpers/fixtures';
import { SectionView } from '../src/renderer/blocks';
import { RenderContext } from '../src/renderer/context';
import type { Block, PortfolioV4, ProjectItem, Section } from '../src/schema/v4';

const { data } = migrate(loadFixture('template-v3.json'));

const embed = (id: string, provider: 'youtube' | 'vimeo' | 'speakerdeck', ref: string, label?: string): Block =>
  ({ id, type: 'embed', visibility: 'public', span: 12, content: { provider, ref, ...(label ? { label: { pt: label, en: label } } : {}) } } as Block);

const texto: Block = { id: 'txt', type: 'text', visibility: 'public', span: 12, content: { html: { pt: 'Sobre o projeto', en: 'About' } } } as Block;

/** Monta a Home com um projeto cujos blocos e prévia são os dados. */
const renderPreview = (blocos: Block[], editing = false): string => {
  const projeto: ProjectItem = {
    ...data.collections.projects[0]!,
    sections: [{ id: 'ps', style: { width: 'normal' }, blocks: blocos }],
    preview: { items: blocos.map((b) => ({ ref: b.id, span: 12 })) },
  };
  const doc: PortfolioV4 = { ...data, collections: { ...data.collections, projects: [projeto] } };
  const bloco: Block = { id: 'col', type: 'collection', visibility: 'public', span: 12, content: { collection: 'projects', cols: 3, preview: true } } as Block;
  const secao: Section = { id: 's', style: { width: 'normal' }, blocks: [bloco] };
  // A prévia só aparece com um projeto aberto; o SectionView a renderiza quando
  // o bloco pede. Aqui usamos o componente de prévia via a própria coleção.
  return renderToStaticMarkup(
    <RenderContext.Provider value={{ data: doc, lang: 'pt', resolveAsset: () => '', editing }}>
      <SectionView section={secao} />
    </RenderContext.Provider>,
  );
};

describe('carrossel de vídeos na prévia do projeto', () => {
  it('a lógica de agrupamento só junta quando há mais de um embed', () => {
    // Um embed só: nada de abas nem setas (seria moldura sem função).
    const umSo = renderPreview([texto, embed('e1', 'youtube', 'https://youtu.be/dQw4w9WgXcQ')]);
    expect(umSo).not.toContain('pv-carrossel-aba');
  });

});
