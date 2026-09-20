import { useRef } from 'react';
import { DEFAULT_LAYOUT, type Theme } from '../schema/v4';
import type { AssetResolver } from '../renderer/context';
import { emptyI18n } from '../core/i18n';
import type { DocApi } from './useDocument';
import { contrastLevel, contrastRatio } from '../core/contrast';

/**
 * Pares de cor que o leitor realmente vê juntos no site. Cada um vira um aviso
 * de contraste (WCAG 2.1): 4.5:1 para texto normal, 3:1 para texto grande.
 */
const CONTRAST_PAIRS: { fg: keyof Theme['colors']; bg: keyof Theme['colors']; label: string; large?: boolean }[] = [
  { fg: 'ink', bg: 'bg', label: 'Texto sobre o fundo' },
  { fg: 'inkSoft', bg: 'bg', label: 'Texto suave sobre o fundo' },
  { fg: 'inkPale', bg: 'bg', label: 'Texto claro (legendas)' },
  { fg: 'ink', bg: 'surface', label: 'Texto sobre superfície' },
  { fg: 'accent', bg: 'bg', label: 'Destaque (links) sobre o fundo' },
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

  return (
    <div className="panel">
      <div className="panel-h">Ícone da aba do navegador</div>
      <div className="theme-fav">
        <div className="theme-fav-tab" title="Prévia da aba">
          {fav && resolveAsset ? <img src={resolveAsset(fav)} alt="" /> : <span className="theme-fav-empty">?</span>}
          <span className="theme-fav-title">{doc.state.site.name.pt || 'Portfolio'}</span>
        </div>
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
          const ratio = contrastRatio(theme.colors[p.fg], theme.colors[p.bg]);
          if (ratio === null) return null;
          const level = contrastLevel(ratio, p.large);
          return (
            <li key={p.fg + "-" + p.bg} className={"contrast-row lv-" + level}>
              <span className="contrast-swatch" style={{ background: theme.colors[p.bg], color: theme.colors[p.fg] }}>Aa</span>
              <span className="contrast-name">{p.label}</span>
              <code className="contrast-ratio">{ratio.toFixed(1)}:1</code>
              <span className="contrast-level">{LEVEL_TEXT[level]}</span>
            </li>
          );
        })}
      </ul>
      <p className="panel-hint">Mínimo recomendado (WCAG): 4,5:1 para texto normal e 3:1 para texto grande.</p>

      <div className="panel-h">Fontes</div>
      {(['display', 'body', 'mono'] as const).map((f) => (
        <label key={f} className="theme-font">
          <span className="insp-label">{f}</span>
          <input className="insp-input" value={theme.fonts[f]} onChange={(e) => doc.updateTheme((t) => void (t.fonts[f] = e.target.value), `theme:font:${f}`)} />
        </label>
      ))}

      <p className="theme-hint">Use o nome exato de uma fonte do Google Fonts (ex.: Inter, Playfair Display) — ela é carregada automaticamente no editor e no site.</p>

      <div className="panel-h">Escala tipográfica</div>
      <label className="theme-font">
        <span className="insp-label">Base (px)</span>
        <input className="insp-input" type="number" value={theme.type.base} onChange={(e) => doc.updateTheme((t) => void (t.type.base = Number(e.target.value) || t.type.base), 'theme:base')} />
      </label>
      <label className="theme-font">
        <span className="insp-label">Razão</span>
        <input className="insp-input" type="number" step="0.05" value={theme.type.ratio} onChange={(e) => doc.updateTheme((t) => void (t.type.ratio = Number(e.target.value) || t.type.ratio), 'theme:ratio')} />
      </label>

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
    </div>
  );
}
