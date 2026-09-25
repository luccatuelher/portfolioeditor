import { test, expect } from '@playwright/test';

/**
 * O leitor de tamanho pelo cabeçalho (src/core/dimensoesImagem.ts) concorda
 * com o navegador em arquivos DE VERDADE: o próprio Chrome codifica PNG, JPEG
 * e WebP (com e sem transparência) em tamanhos variados, decodifica cada um e
 * o leitor tem de dar o mesmo tamanho. Os testes unitários usam cabeçalhos
 * montados à mão; este pega o que um codificador real escreve.
 */
test('tamanho lido do cabeçalho = tamanho que o navegador decodifica', async ({ page }) => {
  await page.goto('/preview.html');
  const resultado = await page.evaluate(async () => {
    const mod = (await import('/src/core/dimensoesImagem.ts' as string)) as typeof import('../src/core/dimensoesImagem');
    const tamanhos = [[1, 1], [37, 913], [1600, 900], [2400, 7], [513, 511]] as const;
    const out: { caso: string; lido: unknown; navegador: unknown }[] = [];
    for (const [w, h] of tamanhos) {
      for (const tipo of ['image/png', 'image/jpeg', 'image/webp']) {
        for (const opaca of [true, false]) {
          const c = document.createElement('canvas');
          c.width = w;
          c.height = h;
          const ctx = c.getContext('2d')!;
          if (opaca) {
            ctx.fillStyle = '#c1440e';
            ctx.fillRect(0, 0, w, h);
          } else {
            ctx.fillStyle = 'rgba(23, 50, 77, 0.5)';
            ctx.fillRect(0, 0, Math.ceil(w / 2), h);
          }
          const url = c.toDataURL(tipo, 0.8);
          const img = new Image();
          img.src = url;
          await img.decode();
          out.push({ caso: `${tipo} ${w}×${h}${opaca ? '' : ' transparente'}`, lido: mod.dimensoesDaImagem(url), navegador: { w: img.naturalWidth, h: img.naturalHeight } });
        }
      }
    }
    return out;
  });
  expect(resultado.length).toBe(30);
  for (const r of resultado) expect(r.lido, r.caso).toEqual(r.navegador);
});
