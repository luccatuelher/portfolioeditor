import { describe, expect, it } from 'vitest';
import { migrate } from '../src/migrate/migrate';
import { assetIdFromContent } from '../src/core/ids';
import { PortfolioV4Schema } from '../src/schema/v4';
import { FIXTURES, loadFixture } from './helpers/fixtures';
import * as C from './helpers/counters';

describe.each(FIXTURES)('migrate(%s) — sem perda de conteúdo', (name) => {
  const v3 = loadFixture(name);
  const { data, assets } = migrate(v3);

  it('produz um documento v4 válido pelo schema Zod', () => {
    const result = PortfolioV4Schema.safeParse(data);
    expect(result.success, result.success ? '' : JSON.stringify(result.error.issues, null, 2)).toBe(true);
    expect(data.schemaVersion).toBe(4);
  });

  it('preserva a contagem de imagens (ocorrências)', () => {
    expect(C.countV4Images(data)).toBe(C.countV3Images(v3));
  });

  it('preserva a contagem de embeds', () => {
    expect(C.countV4Embeds(data)).toBe(C.countV3Embeds(v3));
  });

  it('preserva os itens NDA', () => {
    expect(C.countV4NdaItems(data)).toBe(C.countV3NdaItems(v3));
  });

  it('não perde nenhum texto PT/EN', () => {
    const before = C.collectV3Texts(v3);
    const after = C.collectV4Texts(data);
    const lost = [...before].filter((t) => !after.has(t));
    expect(lost).toEqual([]);
  });

  it('é pura e determinística (mesma entrada → mesma saída)', () => {
    const again = migrate(v3);
    expect(again.data).toEqual(data);
    expect(again.assets).toEqual(assets);
  });

  it('registra um asset por data URL, sem data: URLs no documento', () => {
    // data.assets guarda só metadados; os data URLs a materializar vão em `assets`.
    expect(JSON.stringify(data)).not.toContain('data:image');
    for (const a of assets) expect(data.assets[a.id]).toBeDefined();
  });
});

describe('migrate — fixture sintética legada (sem rows/pageBlocks/richFields, com NDA)', () => {
  const v3 = loadFixture('legacy-synthetic-v3.json');
  const { data, assets } = migrate(v3);

  it('reconstrói seções a partir de images/embeds/text do legado', () => {
    const projA = data.collections.projects.find((p) => p.id === 'proj-a');
    expect(projA).toBeDefined();
    const kinds = projA!.sections.flatMap((s) => s.blocks.map((b) => b.type));
    expect(kinds).toContain('image');
    expect(kinds).toContain('embed');
    expect(kinds).toContain('text');
  });

  it('preserva ids de entidades existentes', () => {
    expect(data.collections.projects.map((p) => p.id)).toEqual(['proj-a', 'proj-b', 'proj-c']);
    expect(data.collections.blog.map((b) => b.id)).toEqual(['note-x', 'note-y']);
    expect(data.collections.gallery.map((g) => g.id)).toEqual(['gal-1', 'gal-2']);
    expect(data.collections.sketches.map((s) => s.id)).toEqual(['sk-1', 'sk-2']);
  });

  it('mapeia visibility a partir de published/nda', () => {
    const vis = Object.fromEntries(data.collections.projects.map((p) => [p.id, p.visibility]));
    expect(vis['proj-a']).toBe('public');
    expect(vis['proj-b']).toBe('nda');
    expect(vis['proj-c']).toBe('draft');
  });

  it('faz dedupe de imagens idênticas (mesma data URL → 1 asset)', () => {
    const dup = 'data:image/png;base64,IMGDATA0001';
    const dupId = assetIdFromContent(dup);
    expect(assets.filter((a) => a.id === dupId)).toHaveLength(1);
    expect(data.assets[dupId]).toBeDefined();
  });

  it('sinaliza dica de senha NDA quando havia ndaPassword', () => {
    expect(data.site.ndaPasswordHint).toBeDefined();
  });

  it('preserva e-mail/telefone/sociais no bloco de contato', () => {
    const contact = data.pages.find((p) => p.id === 'contact')!;
    const block = contact.sections[0]!.blocks[0]!;
    expect(block.type).toBe('contact');
    if (block.type === 'contact') {
      expect(block.content.email).toBe('teste@exemplo.com');
      expect(block.content.socials[0]!.href).toBe('https://linkedin.com/in/teste');
    }
  });
});

describe('migrate — overrides de texto (meta.elementText)', () => {
  it('preserva overrides rich por id de DOM, respeitando sufixo ::pt/::en', () => {
    const v3 = {
      schemaVersion: 3,
      projects: [], blog: [], gallery: [], sketches: [],
      texts: { siteName: 'X' },
      meta: {
        elementText: {
          'txt-site-name': '<strong>Estúdio</strong>',
          'about-bio::pt': '<em>bio pt</em>',
          'about-bio::en': '<em>bio en</em>',
        },
      },
    };
    const { data } = migrate(v3);
    expect(data.site.textOverrides).toBeDefined();
    expect(data.site.textOverrides!['txt-site-name']).toEqual({ pt: '<strong>Estúdio</strong>', en: '<strong>Estúdio</strong>' });
    expect(data.site.textOverrides!['about-bio']).toEqual({ pt: '<em>bio pt</em>', en: '<em>bio en</em>' });
  });
});

describe('migrate — preservação de ids de linha/item na fixture template', () => {
  const { data } = migrate(loadFixture('template-v3.json'));

  it('mantém o id de linha do v3 como id de seção', () => {
    const proj = data.collections.projects.find((p) => p.id === 'demo-sequencia')!;
    const sectionIds = proj.sections.map((s) => s.id);
    // demo-texto, demo-imagens-a, demo-imagens-b, demo-video vêm das rows do v3.
    expect(sectionIds).toContain('demo-texto');
    expect(sectionIds).toContain('demo-video');
  });
});
