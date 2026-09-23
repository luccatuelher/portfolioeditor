import { describe, expect, it } from 'vitest';
import { embedProvider, embedSource, segundosDoTempo, motivoDoEmbedVazio } from '../src/embed/embedSource';

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

  it('YouTube copiado do celular (m.youtube.com) e do YouTube Music', () => {
    expect(embedSource({ id: 'https://m.youtube.com/watch?v=aqz-KE-bpKQ&t=90' })).toBe('https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ?rel=0&start=90');
    expect(embedSource({ id: 'https://music.youtube.com/watch?v=aqz-KE-bpKQ' })).toContain('/embed/aqz-KE-bpKQ');
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

describe('tempo no link do vídeo', () => {
  it('lê os formatos que o botão "copiar a partir daqui" produz', () => {
    expect(segundosDoTempo('90')).toBe('90');
    expect(segundosDoTempo('90s')).toBe('90');
    expect(segundosDoTempo('1m30s')).toBe('90');
    expect(segundosDoTempo('1h2m3s')).toBe('3723');
    expect(segundosDoTempo('0')).toBeNull();
    expect(segundosDoTempo('depois do meio')).toBeNull();
    expect(segundosDoTempo(null)).toBeNull();
  });

  it('YouTube começa no momento escolhido', () => {
    expect(embedSource({ id: 'https://youtu.be/dQw4w9WgXcQ?t=42' })).toContain('start=42');
    expect(embedSource({ id: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1m30s' })).toContain('start=90');
  });

  it('Vimeo usa o fragmento, que é como o player dele aceita', () => {
    const src = embedSource({ id: 'https://vimeo.com/123456789#t=90s' });
    expect(src).toContain('#t=90s');
    expect(src).not.toContain('start=');
  });

  it('link sem tempo continua começando do início', () => {
    expect(embedSource({ id: 'https://youtu.be/dQw4w9WgXcQ' })).not.toContain('start=');
  });
});

describe('por que o embed não virou player', () => {
  it('a página do Speaker Deck explica que ali precisa do código', () => {
    const m = motivoDoEmbedVazio({ id: 'https://speakerdeck.com/lucca/minha-apresentacao' });
    expect(m).toContain('Speaker Deck');
    expect(m).toContain('Embed');
  });

  it('link de site não suportado diz quais valem', () => {
    expect(motivoDoEmbedVazio({ id: 'https://exemplo.com/video/1' })).toContain('YouTube');
  });

  it('campo vazio pede o link, sem drama', () => {
    expect(motivoDoEmbedVazio({ id: '' })).toContain('Cole o link');
  });

  it('link de YouTube quebrado não é confundido com campo vazio', () => {
    expect(motivoDoEmbedVazio({ id: 'https://youtube.com/watch?v=' })).toContain('YouTube não reconhecido');
  });
});
