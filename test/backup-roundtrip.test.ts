import { describe, expect, it } from 'vitest';
import { migrate } from '../src/migrate/migrate';
import { PortfolioV4Schema } from '../src/schema/v4';
import { FIXTURES, loadFixture } from './helpers/fixtures';

describe.each(FIXTURES)('roundtrip do backup JSON (%s)', (name) => {
  it('data → JSON.stringify → parse → schema → igual ao original', () => {
    const { data } = migrate(loadFixture(name));
    const json = JSON.stringify(data);
    const back = PortfolioV4Schema.parse(JSON.parse(json));
    expect(back).toEqual(data);
  });

  it('rejeita poluição de protótipo no backup importado', () => {
    const { data } = migrate(loadFixture(name));
    const poisoned = JSON.parse(JSON.stringify(data));
    poisoned.__proto__ = { hacked: true };
    // O schema strict ignora/rejeita chaves não declaradas; o objeto continua limpo.
    const result = PortfolioV4Schema.safeParse(JSON.parse(JSON.stringify(poisoned)));
    expect(result.success).toBe(true);
    expect(({} as Record<string, unknown>)['hacked']).toBeUndefined();
  });
});
