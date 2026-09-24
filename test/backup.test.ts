import { describe, expect, it } from 'vitest';
import { migrate } from '../src/migrate/migrate';
import { buildBackup, explicarErroDeImportacao, parseBackup, resumoDoBackup } from '../src/editor/backup';
import { loadFixture } from './helpers/fixtures';
import { upgradeDoc } from '../src/migrate/upgrade';

describe('backup do editor', () => {
  const { data, assets } = migrate(loadFixture('template-v3.json'));
  const map = Object.fromEntries(assets.map((a) => [a.id, a.dataUrl]));

  it('build + parse é round-trip do doc (já atualizado)', () => {
    const doc = upgradeDoc(structuredClone(data));
    const b = buildBackup(doc, map);
    expect(b.format).toBe('portfolio-v4-backup');
    const parsed = parseBackup(JSON.stringify(b));
    expect(parsed.doc).toEqual(doc);
  });

  it('upgrade: o CV do contato vira um bloco Botão (uma vez só)', () => {
    const doc = upgradeDoc(structuredClone(data));
    const blocks = doc.pages.flatMap((p) => p.sections.flatMap((s) => s.blocks));
    const contact = blocks.find((b) => b.type === 'contact');
    const button = blocks.find((b) => b.type === 'button');
    expect(contact?.type === 'contact' && contact.content.cvHref).toBe('');
    expect(button?.type === 'button' && button.content.href).toBeTruthy();
    expect(upgradeDoc(structuredClone(doc))).toEqual(doc);
  });

  it('poda assets não referenciados', () => {
    const b = buildBackup(data, { ...map, asset_naousado: 'data:image/png;base64,QQ==' });
    expect(b.assets['asset_naousado']).toBeUndefined();
  });

  it('aceita um doc v4 nu (sem wrapper)', () => {
    const parsed = parseBackup(JSON.stringify(data));
    expect(parsed.doc.schemaVersion).toBe(4);
    expect(parsed.assets).toEqual({});
  });

  it('rejeita JSON inválido como portfólio', () => {
    expect(() => parseBackup('{"foo":1}')).toThrow();
  });

  it('importa backup do app antigo (v3) migrando na hora', () => {
    const v3 = JSON.stringify(loadFixture('legacy-synthetic-v3.json'));
    const b = parseBackup(v3);
    expect(b.doc.schemaVersion).toBe(4);
    expect(b.doc.collections.projects.some((p) => p.id === 'proj-a')).toBe(true);
    expect(Object.keys(b.assets).length).toBeGreaterThan(0);
  });
});

describe('importação: o que não serve fica de fora, com aviso em português', () => {
  it('só imagens (data:image/…) entram no mapa de imagens', () => {
    const { data } = migrate(loadFixture('template-v3.json'));
    const b = parseBackup(JSON.stringify({
      format: 'portfolio-v4-backup',
      doc: data,
      assets: { boa: 'data:image/png;base64,QQ==', numero: 42, objeto: { x: 1 }, script: 'javascript:alert(1)', html: 'data:text/html,<b>x</b>' },
    }));
    expect(Object.keys(b.assets)).toEqual(['boa']);
  });

  it('JSON cortado vira mensagem clara; resumo conta o que vem no arquivo', () => {
    let erro: unknown;
    try { parseBackup('{"format":"portfolio-v4-'); } catch (e) { erro = e; }
    expect(explicarErroDeImportacao(erro)).toContain('incompleto ou corrompido');
    expect(explicarErroDeImportacao(new Error('Arquivo não parece um backup de portfólio.'))).toContain('Nada foi alterado');
    const { data } = migrate(loadFixture('template-v3.json'));
    expect(resumoDoBackup({ format: 'portfolio-v4-backup', version: 1, savedAt: '', doc: data, assets: { a: 'data:image/png;base64,QQ==' } })).toMatch(/páginas · \d+ projetos? · .* · 1 arquivo de imagem$/);
  });
});
