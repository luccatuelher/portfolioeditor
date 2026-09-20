import { describe, expect, it } from 'vitest';
import { embedProvider, embedSource } from '../src/embed/embedSource';

describe('embedSource — porta pura do v3', () => {
  it('YouTube por id de 11 chars', () => {
    expect(embedSource({ type: 'youtube', id: 'aqz-KE-bpKQ' })).toBe(
      'https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ?rel=0',
    );
  });

  it('YouTube por URL watch?v=', () => {
    expect(embedSource({ type: 'youtube', id: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ' })).toContain(
      '/embed/aqz-KE-bpKQ',
    );
  });

  it('YouTube por youtu.be encurtado', () => {
    expect(embedSource({ id: 'https://youtu.be/aqz-KE-bpKQ' })).toContain('/embed/aqz-KE-bpKQ');
  });

  it('Vimeo por id numérico', () => {
    expect(embedSource({ type: 'vimeo', id: '76979871' })).toContain('player.vimeo.com/video/76979871');
  });

  it('Vimeo por URL com hash privado', () => {
    const src = embedSource({ type: 'vimeo', id: 'https://vimeo.com/76979871/abcdef1234' });
    expect(src).toContain('player.vimeo.com/video/76979871');
    expect(src).toContain('h=abcdef1234');
  });

  it('Speaker Deck por hash de 32 hex', () => {
    const id = 'a'.repeat(32);
    expect(embedSource({ type: 'speakerdeck', id })).toBe(`https://speakerdeck.com/player/${id}`);
  });

  it('extrai src de um <iframe> colado', () => {
    const html = '<iframe src="https://www.youtube.com/embed/aqz-KE-bpKQ" allowfullscreen></iframe>';
    expect(embedSource({ id: html })).toContain('/embed/aqz-KE-bpKQ');
  });

  it('aplica opção start no YouTube', () => {
    expect(embedSource({ type: 'youtube', id: 'aqz-KE-bpKQ', start: 30 })).toContain('start=30');
  });

  it('rejeita entradas inválidas', () => {
    expect(embedSource({ type: 'youtube', id: 'curto' })).toBe(''); // < 11 chars
    expect(embedSource({ type: 'youtube', id: 'tem espaço!' })).toBe(''); // chars inválidos
    expect(embedSource({ type: 'youtube', id: '' })).toBe('');
    expect(embedSource(null)).toBe('');
    expect(embedSource({ id: 'https://exemplo.com/video' })).toBe('');
  });

  it('embedProvider identifica o provedor resolvido', () => {
    expect(embedProvider({ type: 'youtube', id: 'aqz-KE-bpKQ' })).toBe('youtube');
    expect(embedProvider({ type: 'vimeo', id: '76979871' })).toBe('vimeo');
    expect(embedProvider({ id: 'nada' })).toBeNull();
  });
});
