import { useId, useState } from 'react';
import type { I18n, PortfolioV4 } from '../schema/v4';
import { pick } from '../renderer/text';
import { I18nInput, Row, TextInput } from './fields';

/*
 * Campos de escolha do editor: onde existe um conjunto conhecido de valores,
 * a pessoa escolhe numa lista em vez de precisar saber o que digitar. Sempre
 * com uma saída "Outro…" para o caso que a lista não cobre.
 */

const OUTRO = '__outro';

/** Endereços internos do site que um link pode apontar (páginas e projetos). */
export function destinosInternos(doc: PortfolioV4): { grupo: string; value: string; label: string }[] {
  const paginas = doc.pages
    .filter((p) => p.kind === 'static' && p.visibility !== 'draft')
    .map((p) => ({ grupo: 'Página do site', value: p.id === 'home' ? '#home' : `#${p.slug || p.id}`, label: pick(p.title, 'pt') || p.slug || p.id }));
  const projetos = doc.collections.projects
    .filter((p) => p.visibility !== 'draft')
    .map((p) => ({ grupo: 'Projeto', value: `#project/${p.id}`, label: pick(p.title, 'pt') || p.id }));
  return [...paginas, ...projetos];
}

/**
 * Destino de um botão: uma página ou um projeto do site (escolhidos na lista)
 * ou qualquer outro endereço digitado (https://, mailto:, cv.pdf).
 */
export function LinkPicker({ doc, href, onChange }: { doc: PortfolioV4; href: string; onChange: (v: string) => void }): React.ReactElement {
  const id = useId();
  const destinos = destinosInternos(doc);
  const internos = new Set(destinos.map((d) => d.value));
  const h = href.trim();
  const [digitando, setDigitando] = useState(false);
  const outro = digitando || (h !== '' && h !== '#' && !internos.has(h));
  const grupos = [...new Set(destinos.map((d) => d.grupo))];
  return (
    <>
      <Row label="Leva para">
        <select
          id={id}
          className="insp-input"
          aria-label="Leva para"
          value={outro ? OUTRO : internos.has(h) ? h : ''}
          onChange={(e) => {
            const v = e.target.value;
            setDigitando(v === OUTRO);
            if (v === OUTRO) {
              if (internos.has(h)) onChange(''); // o campo abre vazio para digitar
              return;
            }
            onChange(v);
          }}
        >
          <option value="">— Sem link (o botão não aparece no site)</option>
          {grupos.map((g) => (
            <optgroup key={g} label={g}>
              {destinos.filter((d) => d.grupo === g).map((d) => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </optgroup>
          ))}
          <option value={OUTRO}>Outro endereço (site, e-mail, arquivo)…</option>
        </select>
      </Row>
      {outro ? (
        <Row label="Endereço">
          <TextInput label="Endereço do link" value={href} placeholder="https://…, mailto:voce@email.com ou cv.pdf" onChange={onChange} />
        </Row>
      ) : null}
    </>
  );
}

/** Formatos que o site sabe traduzir (PT/EN); qualquer outro vale como texto livre. */
const FORMATOS: { value: string; label: string }[] = [
  { value: 'storyboard', label: 'Storyboard' },
  { value: 'animatic', label: 'Animatic' },
];

/** Formato do projeto (ficha técnica): Storyboard, Animatic ou outro escrito à mão. */
export function FormatoRow({ value, onChange }: { value: I18n | undefined; onChange: (v: I18n | undefined) => void }): React.ReactElement {
  const pt = (value?.pt ?? '').trim().toLowerCase();
  const conhecido = FORMATOS.find((f) => f.value === pt)?.value;
  const [digitando, setDigitando] = useState(false);
  const temTexto = !!(value?.pt || value?.en);
  const outro = digitando || (!conhecido && temTexto);
  return (
    <>
      <Row label="Formato">
        <select
          className="insp-input"
          aria-label="Formato"
          value={outro ? OUTRO : conhecido ?? ''}
          onChange={(e) => {
            const v = e.target.value;
            setDigitando(v === OUTRO);
            if (v === OUTRO) {
              if (conhecido) onChange(undefined);
              return;
            }
            onChange(v ? { pt: v, en: v } : undefined);
          }}
        >
          <option value="">— Não informar</option>
          {FORMATOS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
          <option value={OUTRO}>Outro…</option>
        </select>
      </Row>
      {outro ? (
        <Row label="Formato (texto)">
          <I18nInput value={value ?? { pt: '', en: '' }} onChange={(v) => onChange(v.pt || v.en ? v : undefined)} />
        </Row>
      ) : null}
    </>
  );
}

/** Redes mais comuns em portfólio de artes visuais: sugestões do rótulo e reconhecimento pelo link. */
export const REDES: { nome: string; dominio: RegExp }[] = [
  { nome: 'Instagram', dominio: /instagram\.com/ },
  { nome: 'LinkedIn', dominio: /linkedin\.com/ },
  { nome: 'Behance', dominio: /behance\.net/ },
  { nome: 'ArtStation', dominio: /artstation\.com/ },
  { nome: 'Vimeo', dominio: /vimeo\.com/ },
  { nome: 'YouTube', dominio: /youtube\.com|youtu\.be/ },
  { nome: 'Dribbble', dominio: /dribbble\.com/ },
  { nome: 'GitHub', dominio: /github\.com/ },
  { nome: 'X', dominio: /(^|\/\/|\.)(x|twitter)\.com/ },
  { nome: 'TikTok', dominio: /tiktok\.com/ },
  { nome: 'Bluesky', dominio: /bsky\.app/ },
  { nome: 'Letterboxd', dominio: /letterboxd\.com/ },
];

/** Nome da rede a partir do link colado (ou undefined se não reconhece). */
export function redeDoLink(href: string): string | undefined {
  const h = href.trim().toLowerCase();
  return REDES.find((r) => r.dominio.test(h))?.nome;
}

/** <datalist> com os nomes das redes, para o campo "Rótulo" sugerir enquanto se digita. */
export function RedesDatalist({ id }: { id: string }): React.ReactElement {
  return (
    <datalist id={id}>
      {REDES.map((r) => <option key={r.nome} value={r.nome} />)}
    </datalist>
  );
}
