import { describe, expect, it } from 'vitest';
import { migrate } from '../src/migrate/migrate';
import { buildPublishPayload } from '../src/publish/buildPayload';
import { upgradeDoc } from '../src/migrate/upgrade';
import { PortfolioV4Schema } from '../src/schema/v4';
import { loadFixture } from './helpers/fixtures';

describe('publicação gera dados válidos', () => {
  it('campos opcionais vazios (undefined) do editor não viram null', async () => {
    const mig = migrate(loadFixture('template-v3.json'));
    const doc = upgradeDoc(mig.data);
    const p = doc.collections.projects[0]!;
    p.visibility = 'public';
    p.thumb.url = undefined; // como o editor faz ao trocar a imagem
    p.preview = { items: [], hideDescription: undefined };
    doc.pages[0]!.sections[0]!.name = undefined;
    const payload = await buildPublishPayload({ data: doc, assets: mig.assets });
    const json = JSON.parse(JSON.stringify(payload.publicData));
    const r = PortfolioV4Schema.safeParse(json);
    expect(r.success ? [] : r.error.issues.map((i) => i.path.join('.'))).toEqual([]);
  });
});
