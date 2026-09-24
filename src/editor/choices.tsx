import { useId, useState } from 'react';
import { hrefDaPagina, problemaDoLink } from '../core/links';
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
  // Rascunhos entram marcados: um botão que já aponta para um deles continua
  // reconhecível na lista (o aviso embaixo diz que ele não vai para o site).
  const rascunho = (v: string): string => (v === 'draft' ? ' (rascunho)' : '');
  const paginas = doc.pages
    .filter((p) => p.kind === 'static')
    .map((p) => ({ grupo: 'Página do site', value: hrefDaPagina(p), label: `${pick(p.title, 'pt') || p.slug || p.id}${p.id === 'home' ? '' : rascunho(p.visibility)}` }));
  const projetos = doc.collections.projects
    .map((p) => ({ grupo: 'Projeto', value: `#project/${p.id}`, label: `${pick(p.title, 'pt') || p.id}${rascunho(p.visibility)}` }));
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
  const problema = problemaDoLink(doc, h);
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
      {problema ? <div className="insp-note insp-warn">Este link {problema}.</div> : null}
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

/** Anos oferecidos na lista: do próximo até 1990 (projeto em andamento entra também). */
function anosDaLista(): number[] {
  const agora = new Date().getFullYear();
  return Array.from({ length: agora + 2 - 1990 }, (_, i) => agora + 1 - i);
}

/** Ano do projeto: lista de anos; "Outro…" para período ("2021–2023") ou texto próprio. */
export function AnoRow({ value, onChange }: { value: I18n | undefined; onChange: (v: I18n | undefined) => void }): React.ReactElement {
  const pt = (value?.pt || value?.en || '').trim();
  const anos = anosDaLista();
  const conhecido = /^\d{4}$/.test(pt) && anos.includes(Number(pt)) && (!value?.en || value.en.trim() === pt) ? pt : '';
  const [digitando, setDigitando] = useState(false);
  const outro = digitando || (!conhecido && !!pt);
  return (
    <>
      <Row label="Ano">
        <select
          className="insp-input"
          aria-label="Ano"
          value={outro ? OUTRO : conhecido}
          onChange={(e) => {
            const v = e.target.value;
            setDigitando(v === OUTRO);
            if (v === OUTRO) return;
            onChange(v ? { pt: v, en: v } : undefined);
          }}
        >
          <option value="">— Não informar</option>
          {anos.map((a) => <option key={a} value={String(a)}>{a}</option>)}
          <option value={OUTRO}>Outro (ex.: 2021–2023)…</option>
        </select>
      </Row>
      {outro ? (
        <Row label="Ano (texto)">
          <I18nInput value={value ?? { pt: '', en: '' }} onChange={(v) => onChange(v.pt || v.en ? v : undefined)} />
        </Row>
      ) : null}
    </>
  );
}

const MESES_PT = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const MESES_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/**
 * Lê uma data escrita como o editor escreve ("Setembro 2026", "September 2026",
 * "2026"). Devolve mês (1–12, 0 = sem mês) e ano, ou null se for outro texto.
 */
export function lerMesAno(value: I18n | undefined): { mes: number; ano: number } | null {
  const sem = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const txt = sem((value?.pt || value?.en || '').trim());
  if (!txt) return null;
  const soAno = txt.match(/^(\d{4})$/);
  if (soAno) return { mes: 0, ano: Number(soAno[1]) };
  const m = txt.match(/^([a-z]+)\s+(?:de\s+)?(\d{4})$/);
  if (!m) return null;
  const i = [...MESES_PT, ...MESES_EN].map(sem).indexOf(m[1]!);
  return i < 0 ? null : { mes: (i % 12) + 1, ano: Number(m[2]) };
}

/** Escreve mês/ano nos dois idiomas: "Setembro 2026" / "September 2026". */
export function escreverMesAno(mes: number, ano: number): I18n {
  return mes ? { pt: `${MESES_PT[mes - 1]} ${ano}`, en: `${MESES_EN[mes - 1]} ${ano}` } : { pt: String(ano), en: String(ano) };
}

/**
 * Data de uma nota: mês e ano em listas, escritos sozinhos em português e em
 * inglês. "Escrever à mão" guarda qualquer outro texto (ex.: "Primavera 2024").
 */
export function DataRow({ value, onChange }: { value: I18n; onChange: (v: I18n) => void }): React.ReactElement {
  const lida = lerMesAno(value);
  const [digitando, setDigitando] = useState(false);
  const temTexto = !!(value.pt || value.en);
  const livre = digitando || (temTexto && !lida);
  const mes = lida?.mes ?? 0;
  const ano = lida?.ano ?? 0;
  const anos = anosDaLista();
  const gravar = (m: number, a: number): void => onChange(a ? escreverMesAno(m, a) : { pt: '', en: '' });
  return (
    <>
      <Row label="Data">
        <div className="insp-data-row">
          <select className="insp-input" aria-label="Mês" value={livre ? '' : String(mes)} disabled={livre} onChange={(e) => gravar(Number(e.target.value), ano || new Date().getFullYear())}>
            <option value="0">— Mês</option>
            {MESES_PT.map((m, i) => <option key={m} value={String(i + 1)}>{m}</option>)}
          </select>
          <select
            className="insp-input"
            aria-label="Ano da nota"
            value={livre ? OUTRO : String(ano)}
            onChange={(e) => {
              const v = e.target.value;
              setDigitando(v === OUTRO);
              if (v === OUTRO) return;
              gravar(mes, Number(v));
            }}
          >
            <option value="0">— Ano</option>
            {anos.map((a) => <option key={a} value={String(a)}>{a}</option>)}
            <option value={OUTRO}>Escrever à mão…</option>
          </select>
        </div>
      </Row>
      {livre ? (
        <Row label="Data (texto)">
          <I18nInput value={value} onChange={onChange} />
        </Row>
      ) : null}
    </>
  );
}
