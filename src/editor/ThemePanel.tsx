import { useEffect, useId, useRef, useState } from 'react';
import { DEFAULT_LAYOUT, type Theme } from '../schema/v4';
import type { AssetResolver } from '../renderer/context';
import { emptyI18n } from '../core/i18n';
import type { DocApi } from './useDocument';
import { contrastLevel, contrastRatio, legivel } from '../core/contrast';

/**
 * Pares de cor que o leitor realmente vê juntos no site. Cada um vira um aviso
 * de contraste (WCAG 2.1): 4.5:1 para texto normal, 3:1 para texto grande.
 */
const CONTRAST_PAIRS: { fg: keyof Theme['colors']; bg: keyof Theme['colors']; label: string; large?: boolean; ajustaNoSite?: boolean }[] = [
  { fg: 'ink', bg: 'bg', label: 'Texto sobre o fundo' },
  { fg: 'inkSoft', bg: 'bg', label: 'Texto suave sobre o fundo' },
  // Em texto, o site usa esta cor escurecida só o necessário (ver legivel em core/contrast).
  { fg: 'inkPale', bg: 'bg', label: 'Texto claro (legendas)', ajustaNoSite: true },
  { fg: 'ink', bg: 'surface', label: 'Texto sobre superfície' },
  { fg: 'accent', bg: 'bg', label: 'Destaque (links) sobre o fundo', ajustaNoSite: true },
  { fg: 'accent2', bg: 'bg', label: 'Destaque 2 sobre o fundo', large: true },
];

const LEVEL_TEXT: Record<string, string> = {
  AAA: 'AAA',
  AA: 'AA',
  'AA-large': 'só texto grande',
  fail: 'baixo',
};

const COLOR_LABELS: Record<keyof Theme['colors'], string> = {
  bg: 'Fundo',
  surface: 'Superfície',
  ink: 'Tinta',
  inkSoft: 'Tinta suave',
  inkPale: 'Tinta clara',
  rule: 'Régua',
  accent: 'Destaque',
  accent2: 'Destaque 2',
};

type FontRole = 'display' | 'body' | 'mono';

/** Sugestões por papel: nomes exatos do Google Fonts, das mais usadas em portfólio. */
export const FONT_OPTIONS: Record<FontRole, string[]> = {
  display: ['DM Serif Display', 'Playfair Display', 'Fraunces', 'Instrument Serif', 'Cormorant Garamond', 'EB Garamond', 'Libre Baskerville', 'Lora', 'Abril Fatface', 'Bebas Neue', 'Oswald', 'Anton', 'Archivo Black', 'Syne', 'Space Grotesk', 'Unbounded'],
  body: ['DM Sans', 'Inter', 'Manrope', 'Work Sans', 'IBM Plex Sans', 'Source Sans 3', 'Nunito Sans', 'Plus Jakarta Sans', 'Outfit', 'Karla', 'Rubik', 'Lato', 'Open Sans', 'Roboto', 'Lora', 'Source Serif 4', 'Literata', 'Merriweather'],
  mono: ['DM Mono', 'JetBrains Mono', 'IBM Plex Mono', 'Space Mono', 'Fira Code', 'Roboto Mono', 'Source Code Pro', 'Inconsolata', 'Courier Prime'],
};
const FONT_ROLE_LABEL: Record<FontRole, string> = { display: 'Títulos (display)', body: 'Texto corrido (body)', mono: 'Detalhes e menus (mono)' };
const FONT_FALLBACK: Record<FontRole, string> = { display: 'serif', body: 'sans-serif', mono: 'monospace' };
const OUTRA_FONTE = '__outra';

/**
 * Carrega, só enquanto o painel está aberto, um recorte mínimo de cada fonte
 * sugerida (apenas as letras do próprio nome, via `text=`), para a lista
 * mostrar cada nome na sua fonte. A folha entra no INÍCIO do <head>: as fontes
 * completas do tema, carregadas depois, continuam valendo no canvas.
 */
function useFontPreviews(): void {
  useEffect(() => {
    const nomes = [...new Set(Object.values(FONT_OPTIONS).flat())].filter((n) => !n.startsWith('DM '));
    const letras = [...new Set(nomes.join(''))].join('');
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?${nomes.map((n) => `family=${encodeURIComponent(n).replace(/%20/g, '+')}`).join('&')}&text=${encodeURIComponent(letras)}&display=swap`;
    link.setAttribute('data-font-previews', '');
    document.head.prepend(link);
    return () => link.remove();
  }, []);
}

/**
 * Escolha de fonte: lista de sugestões (cada nome desenhado na própria fonte)
 * + "Outra do Google Fonts…", que abre um campo para digitar qualquer nome.
 * Embaixo, uma amostra com a fonte escolhida.
 */
function FontPicker({ role, value, onChange }: { role: FontRole; value: string; onChange: (v: string) => void }): React.ReactElement {
  const lista = FONT_OPTIONS[role];
  // "Outra" vale quando o nome não está na lista, ou enquanto a pessoa escolheu digitar.
  const [digitando, setDigitando] = useState(false);
  const outra = digitando || !lista.includes(value);
  const id = useId();
  const familia = (f: string): string => `'${f.replace(/'/g, '')}', ${FONT_FALLBACK[role]}`;
  return (
    <div className="theme-font">
      <label className="insp-label" htmlFor={id}>{FONT_ROLE_LABEL[role]}</label>
      <select
        id={id}
        className="insp-input theme-font-select"
        value={outra ? OUTRA_FONTE : value}
        style={{ fontFamily: familia(value) }}
        onChange={(e) => {
          const v = e.target.value;
          setDigitando(v === OUTRA_FONTE);
          if (v !== OUTRA_FONTE) onChange(v);
        }}
      >
        {lista.map((f) => (
          <option key={f} value={f} style={{ fontFamily: familia(f) }}>{f}</option>
        ))}
        <option value={OUTRA_FONTE}>{outra && value ? `Outra: ${value}` : 'Outra do Google Fonts…'}</option>
      </select>
      {outra ? (
        <input className="insp-input" aria-label={`Nome da fonte (${FONT_ROLE_LABEL[role]})`} value={value} placeholder="Nome exato no Google Fonts, ex.: Poppins" spellCheck={false} onChange={(e) => onChange(e.target.value)} />
      ) : null}
      <span className="theme-font-sample" style={{ fontFamily: familia(value) }} aria-hidden="true">
        {role === 'mono' ? 'PROJETOS · 2026 · 01/12' : role === 'display' ? 'Storyboard & animação' : 'O rato roeu a roupa do rei de Roma.'}
      </span>
    </div>
  );
}

/** Escalas tipográficas clássicas, descritas pelo efeito (a razão entre um tamanho de texto e o seguinte). */
export const RATIOS: { value: number; label: string }[] = [
  { value: 1.125, label: '1,125 — sutil' },
  { value: 1.2, label: '1,2 — suave' },
  { value: 1.25, label: '1,25 — equilibrada' },
  { value: 1.333, label: '1,333 — marcante' },
  { value: 1.414, label: '1,414 — forte' },
  { value: 1.5, label: '1,5 — dramática' },
  { value: 1.618, label: '1,618 — áurea (contraste máximo)' },
];

/** Tamanhos do texto corrido mais usados na web, pelo efeito na leitura. */
export const BASES: { value: number; label: string }[] = [
  { value: 14, label: '14 px — compacto' },
  { value: 15, label: '15 px' },
  { value: 16, label: '16 px — padrão da web' },
  { value: 17, label: '17 px' },
  { value: 18, label: '18 px — confortável' },
  { value: 20, label: '20 px — grande' },
];

/** Tamanho base do texto: lista + "Outro…" para um número próprio (12 a 24 px). */
function BasePicker({ value, onChange }: { value: number; onChange: (v: number) => void }): React.ReactElement {
  const id = useId();
  const conhecida = BASES.find((b) => b.value === value);
  const [digitando, setDigitando] = useState(false);
  const outra = digitando || !conhecida;
  return (
    <div className="theme-font">
      <label className="insp-label" htmlFor={id}>Tamanho do texto</label>
      <select id={id} className="insp-input" value={outra ? OUTRA_FONTE : String(value)} onChange={(e) => {
        const v = e.target.value;
        setDigitando(v === OUTRA_FONTE);
        if (v !== OUTRA_FONTE) onChange(Number(v));
      }}>
        {BASES.map((b) => <option key={b.value} value={String(b.value)}>{b.label}</option>)}
        <option value={OUTRA_FONTE}>{outra ? `Outro: ${value} px` : 'Outro…'}</option>
      </select>
      {outra ? (
        <input className="insp-input" aria-label="Tamanho do texto (px)" type="number" step="1" min={12} max={24} value={value} onChange={(e) => { const n = Number(e.target.value); if (n >= 12 && n <= 24) onChange(n); }} />
      ) : null}
      <span className="theme-hint" style={{ margin: '4px 0 0', display: 'block' }}>Os títulos crescem a partir dele.</span>
    </div>
  );
}

/** Razão da escala: lista de escalas com nome + "Outra…" para um número próprio. */
function RatioPicker({ value, onChange }: { value: number; onChange: (v: number) => void }): React.ReactElement {
  const id = useId();
  const conhecida = RATIOS.find((r) => Math.abs(r.value - value) < 0.0005);
  const [digitando, setDigitando] = useState(false);
  const outra = digitando || !conhecida;
  return (
    <div className="theme-font">
      <label className="insp-label" htmlFor={id}>Contraste entre tamanhos</label>
      <select id={id} className="insp-input" value={outra ? OUTRA_FONTE : String(conhecida!.value)} onChange={(e) => {
        const v = e.target.value;
        setDigitando(v === OUTRA_FONTE);
        if (v !== OUTRA_FONTE) onChange(Number(v));
      }}>
        {RATIOS.map((r) => <option key={r.value} value={String(r.value)}>{r.label}</option>)}
        <option value={OUTRA_FONTE}>{outra ? `Outra: ${value}` : 'Outra…'}</option>
      </select>
      {outra ? (
        <input className="insp-input" aria-label="Razão da escala (número)" type="number" step="0.01" min={1} max={2} value={value} onChange={(e) => { const n = Number(e.target.value); if (n >= 1 && n <= 2) onChange(n); }} />
      ) : null}
      <span className="theme-hint" style={{ margin: '4px 0 0', display: 'block' }}>Quanto maior, mais os títulos se destacam do texto.</span>
    </div>
  );
}

/** Editor de tokens globais (F5): mudar um token atualiza o site inteiro. */
export function ThemePanel({ doc, onUploadImage, onUploadFavicon, resolveAsset }: { doc: DocApi; onUploadImage?: (f: File) => Promise<string>; onUploadFavicon?: (f: File) => Promise<void>; resolveAsset?: AssetResolver }): React.ReactElement {
  const favFile = useRef<HTMLInputElement>(null);
  const fav = doc.state.site.favicon;
  const theme = doc.state.theme;
  const layout = doc.state.site.layout ?? DEFAULT_LAYOUT;
  const bd = doc.state.site.backdrop;
  const file = useRef<HTMLInputElement>(null);
  const setLayout = (k: 'margin' | 'maxWidth', v: number): void =>
    doc.updateSite((s) => void (s.layout = { ...(s.layout ?? DEFAULT_LAYOUT), [k]: v }), `layout:${k}`);
  const colorKeys = Object.keys(theme.colors) as (keyof Theme['colors'])[];
  const analytics = doc.state.site.analytics ?? '';
  useFontPreviews();
  // Aberto de saída só se já houver algo preenchido (constante: não fecha enquanto se apaga o campo).
  const [avancadoAberto] = useState(() => !!(doc.state.site.url || doc.state.site.analytics));

  return (
    <div className="panel">
      <div className="panel-h">Ícone da aba do navegador</div>
      <div className="theme-fav">
        <div className="theme-fav-tab" title="Prévia da aba">
          {fav && resolveAsset ? <img src={resolveAsset(fav)} alt="" /> : <span className="theme-fav-empty">?</span>}
          {/* O título da aba É o nome do site: editar aqui muda também o cabeçalho. */}
          <input
            className="theme-fav-title"
            aria-label="Título da aba (nome do site)"
            value={doc.state.site.name.pt}
            placeholder="Nome do site"
            spellCheck={false}
            onChange={(e) => {
              const v = e.target.value;
              // O inglês acompanha enquanto for igual ao português (nome próprio quase nunca muda).
              doc.updateSite((s) => void (s.name = { pt: v, en: !s.name.en || s.name.en === s.name.pt ? v : s.name.en }), 'site:name');
            }}
          />
        </div>
        <p className="theme-hint" style={{ margin: 0 }}>O título da aba é o nome do site, o mesmo do cabeçalho. Nas outras páginas ele vem depois do nome da página (“Projetos — {doc.state.site.name.pt || 'Nome'}”).</p>
        <div className="theme-bd-actions">
          <button type="button" className="add-block-btn" onClick={() => favFile.current?.click()} disabled={!onUploadFavicon}>{fav ? 'Trocar ícone' : '＋ Enviar ícone'}</button>
          {fav ? <button type="button" className="add-block-btn" onClick={() => doc.updateSite((s) => void delete s.favicon)}>Remover</button> : null}
        </div>
        <p className="theme-hint" style={{ margin: 0 }}>Qualquer imagem serve: o centro vira um quadrado de 128px. Funciona melhor com desenhos simples e contraste alto.</p>
      </div>
      <input ref={favFile} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f && onUploadFavicon) void onUploadFavicon(f); }} />

      <div className="panel-h">Área da página (safe area)</div>
      <label className="theme-font">
        <span className="insp-label">Margem de respiro em cada lado · {layout.margin}% da tela</span>
        <input type="range" min={0} max={20} step={1} value={layout.margin} onChange={(e) => setLayout('margin', Number(e.target.value))} className="theme-range" />
      </label>
      <label className="theme-font">
        <span className="insp-label">Largura máxima do conteúdo · {layout.maxWidth}px</span>
        <input type="range" min={900} max={3200} step={50} value={layout.maxWidth} onChange={(e) => setLayout('maxWidth', Number(e.target.value))} className="theme-range" />
      </label>
      <p className="theme-hint">Vale no site publicado (no editor o canvas tem largura fixa). No celular a margem é sempre 16px.</p>

      <div className="panel-h">Imagem de fundo</div>
      {bd ? (
        <div className="theme-bd">
          <div className="theme-bd-thumb" style={{ backgroundImage: resolveAsset ? `url("${resolveAsset(bd.image)}")` : undefined }} />
          <div className="theme-bd-modes" role="group" aria-label="Posição da imagem de fundo">
            <button type="button" className={bd.mode === 'sides' ? 'on' : ''} onClick={() => doc.updateSite((s) => void (s.backdrop && (s.backdrop.mode = 'sides')))}>Nas laterais</button>
            <button type="button" className={bd.mode === 'behind' ? 'on' : ''} onClick={() => doc.updateSite((s) => { if (!s.backdrop) return; s.backdrop.mode = 'behind'; if (s.backdrop.veil < 0.6) s.backdrop.veil = 0.8; /* atrás do texto: véu para manter a leitura */ })}>Atrás do site</button>
          </div>
          <label className="theme-font">
            <span className="insp-label">Véu da cor de fundo · {Math.round(bd.veil * 100)}%</span>
            <input type="range" min={0} max={95} step={5} value={Math.round(bd.veil * 100)} onChange={(e) => doc.updateSite((s) => void (s.backdrop && (s.backdrop.veil = Number(e.target.value) / 100)), 'bd:veil')} className="theme-range" />
          </label>
          <div className="theme-bd-actions">
            <button type="button" className="add-block-btn" onClick={() => file.current?.click()}>Trocar imagem</button>
            <button type="button" className="add-block-btn" onClick={() => doc.updateSite((s) => void delete s.backdrop)}>Remover</button>
          </div>
        </div>
      ) : (
        <div className="theme-bd">
          <button type="button" className="insp-upload" onClick={() => file.current?.click()} disabled={!onUploadImage}>＋ Enviar imagem de fundo</button>
          <p className="theme-hint">Aparece nas colunas laterais (fora do conteúdo) ou atrás do site inteiro.</p>
        </div>
      )}
      <input ref={file} type="file" accept="image/*" hidden onChange={(e) => {
        const f = e.target.files?.[0];
        e.target.value = '';
        if (!f || !onUploadImage) return;
        void onUploadImage(f).then((aid) => doc.updateSite((s) => {
          s.backdrop = { mode: s.backdrop?.mode ?? 'sides', veil: s.backdrop?.veil ?? 0, image: { assetId: aid, alt: emptyI18n() } };
        }));
      }} />

      <div className="panel-h">Cores</div>
      {colorKeys.map((k) => (
        <label key={k} className="theme-row">
          <input
            type="color"
            value={theme.colors[k]}
            data-token={k}
            onChange={(e) => doc.updateTheme((t) => void (t.colors[k] = e.target.value), `theme:${k}`)}
          />
          <span className="theme-name">{COLOR_LABELS[k]}</span>
          <code className="theme-val">{theme.colors[k]}</code>
        </label>
      ))}

      <div className="panel-h">Contraste</div>
      <ul className="contrast-list">
        {CONTRAST_PAIRS.map((p) => {
          const original = theme.colors[p.fg];
          // Cor que o visitante vê no texto: a legível, quando o site ajusta este par.
          const cor = p.ajustaNoSite ? legivel(original, theme.colors[p.bg], 4.5, theme.colors.ink) : original;
          const ratio = contrastRatio(cor, theme.colors[p.bg]);
          if (ratio === null) return null;
          const level = contrastLevel(ratio, p.large);
          const ajustada = cor !== original;
          return (
            <li key={p.fg + "-" + p.bg} className={"contrast-row lv-" + level}>
              <span className="contrast-swatch" style={{ background: theme.colors[p.bg], color: cor }}>Aa</span>
              <span className="contrast-name">
                {p.label}
                {ajustada ? <small className="contrast-ajuste" title={`Sua cor (${original}) tem ${(contrastRatio(original, theme.colors[p.bg]) ?? 0).toFixed(1)}:1 — continua nas linhas e bordas.`}>no texto, o site escurece um pouco para ler</small> : null}
              </span>
              <code className="contrast-ratio">{ratio.toFixed(1)}:1</code>
              <span className="contrast-level">{LEVEL_TEXT[level]}</span>
            </li>
          );
        })}
      </ul>
      <p className="panel-hint">Mínimo recomendado (WCAG): 4,5:1 para texto normal e 3:1 para texto grande.</p>

      <div className="panel-h">Fontes</div>
      {(['display', 'body', 'mono'] as const).map((f) => (
        <FontPicker key={f} role={f} value={theme.fonts[f]} onChange={(v) => doc.updateTheme((t) => void (t.fonts[f] = v), `theme:font:${f}`)} />
      ))}

      <p className="theme-hint">Todas vêm do Google Fonts e são carregadas sozinhas no editor e no site. Em “Outra do Google Fonts…” dá para usar qualquer nome de lá.</p>

      <div className="panel-h">Escala tipográfica</div>
      <BasePicker value={theme.type.base} onChange={(b) => doc.updateTheme((t) => void (t.type.base = b), 'theme:base')} />
      <RatioPicker value={theme.type.ratio} onChange={(r) => doc.updateTheme((t) => void (t.type.ratio = r), 'theme:ratio')} />

      {/* Opcionais: o site funciona sem nada disso. Ficam recolhidos para não pesar no painel. */}
      <details className="theme-advanced" open={avancadoAberto}>
      <summary>Avançado (opcional)</summary>
      <div className="panel-h">Endereço do site</div>
      <input
        className="insp-input site-url-input"
        type="url"
        spellCheck={false}
        value={doc.state.site.url ?? ''}
        placeholder="https://seusite.com"
        onChange={(e) => doc.updateSite((s) => void (s.url = e.target.value.trim() || undefined), 'site:url')}
      />
      <p className="panel-hint">Não é obrigatório. Serve para a imagem de prévia aparecer quando alguém compartilha o link (WhatsApp, LinkedIn). No GitHub Pages, é o endereço que ele te dá, tipo https://seu-usuario.github.io/portfolio.</p>

      <div className="panel-h">Analytics</div>
      <textarea
        className="insp-input analytics-input"
        rows={4}
        spellCheck={false}
        value={analytics}
        placeholder={'<script defer data-domain="seusite.com" src="https://plausible.io/js/script.js"></script>'}
        onChange={(e) => doc.updateSite((s) => void (s.analytics = e.target.value.trim() ? e.target.value : undefined), 'site:analytics')}
      />
      <p className="panel-hint">Cole aqui o código que o Plausible, o Google Analytics ou o Fathom te dão. Ele entra no &lt;head&gt; do site publicado — e em nenhum outro lugar. Deixe vazio para não medir nada.</p>
      </details>
    </div>
  );
}
