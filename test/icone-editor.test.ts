import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * O editor é um arquivo só (editor.html, também publicado no GitHub Pages):
 * o ícone da aba tem de estar embutido no <head>, em SVG e em PNG de reserva.
 */
const html = readFileSync(join(__dirname, '..', 'editor.html'), 'utf8');
const icone = (tipo: string): string | undefined =>
  html.match(new RegExp(`<link rel="icon" type="${tipo}"[^>]*href="([^"]+)"`))?.[1];

describe('ícone da aba do editor', () => {
  it('SVG embutido é um SVG válido, sem depender de arquivo ao lado', () => {
    const href = icone('image/svg\\+xml');
    expect(href, 'link rel=icon em SVG').toMatch(/^data:image\/svg\+xml,/);
    const svg = decodeURIComponent(href!.replace(/^data:image\/svg\+xml,/, ''));
    expect(svg).toMatch(/^<svg xmlns='http:\/\/www\.w3\.org\/2000\/svg' viewBox='0 0 64 64'>/);
    expect(svg).toMatch(/<\/svg>$/);
  });

  it('PNG de reserva é um PNG de verdade', () => {
    const href = icone('image/png');
    expect(href, 'link rel=icon em PNG').toMatch(/^data:image\/png;base64,/);
    const bytes = Buffer.from(href!.replace(/^data:image\/png;base64,/, ''), 'base64');
    expect([...bytes.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
    expect(bytes.readUInt32BE(16)).toBe(64);
    expect(bytes.readUInt32BE(20)).toBe(64);
  });
});
