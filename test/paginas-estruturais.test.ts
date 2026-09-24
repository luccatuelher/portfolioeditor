import { describe, expect, it } from 'vitest';
import { migrate } from '../src/migrate/migrate';
import { repairDoc } from '../src/migrate/repair';
import { garantirPaginasEstruturais, upgradeDoc } from '../src/migrate/upgrade';
import { resolveRoute } from '../src/renderer/Site';
import { loadFixture } from './helpers/fixtures';

/**
 * Invariante: todo documento aberto tem a Home e os modelos de detalhe. O
 * editor abre um projeto pelo modelo "project-detail" — sem ele, derrubava a
 * tela inteira; o site sem Home não abria.
 */
describe('páginas estruturais', () => {
  it('backup sem a Home e sem os modelos: o reparo repõe, e o site abre um projeto', () => {
    const d = migrate(loadFixture('template-v3.json')).data;
    const cru = structuredClone(d) as unknown as { pages: { id: string }[] };
    cru.pages = cru.pages.filter((p) => !['home', 'project-detail', 'blog-detail'].includes(p.id));
    const { doc } = repairDoc(cru);
    expect(doc).not.toBeNull();
    const ids = doc!.pages.map((p) => p.id);
    expect(ids[0]).toBe('home');
    expect(ids).toContain('project-detail');
    expect(ids).toContain('blog-detail');
    const proj = doc!.collections.projects[0]!;
    const r = resolveRoute(doc!, `project/${proj.id}`);
    expect(r.page.id).toBe('project-detail');
    expect(r.item?.id).toBe(proj.id);
  });

  it('não mexe em quem já tem, e rodar de novo não duplica', () => {
    const d = upgradeDoc(migrate(loadFixture('template-v3.json')).data);
    const antes = JSON.stringify(d.pages);
    upgradeDoc(d);
    garantirPaginasEstruturais(d);
    expect(JSON.stringify(d.pages)).toBe(antes);
  });
});
