import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { I18n } from '../core/i18n';
import { LangFlag } from '../renderer/Flags';
import type { CampoId } from '../core/camposTexto';
import { useFocoDoCampo } from './focoCampo';

/** Idioma que os campos bilíngues do inspector estão editando (toggle no topo). */
export const EditLangContext = createContext<'pt' | 'en'>('pt');
export const useEditLang = (): 'pt' | 'en' => useContext(EditLangContext);

/**
 * Campo de texto que digita SEM travar o editor.
 *
 * Cada tecla gravava direto no documento, e o documento redesenha o canvas
 * inteiro — numa página com ~90 elementos isso dava ~57 ms por tecla, que se
 * sente. Agora o campo guarda o que você digita e grava na pausa (140 ms), ao
 * sair do campo, ao apertar Enter e ao desmontar — então nada se perde, mas o
 * canvas não é redesenhado a cada letra.
 */
function useTextoAdiado(valor: string, commit: (v: string) => void): {
  valorLocal: string;
  aoDigitar: (v: string) => void;
  aoSair: () => void;
  aoTeclar: (e: React.KeyboardEvent) => void;
} {
  const [local, setLocal] = useState(valor);
  const pendente = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const commitRef = useRef(commit);
  commitRef.current = commit;

  // Valor mudou por fora (outro bloco selecionado, desfazer): acompanha.
  useEffect(() => {
    if (pendente.current === null) setLocal(valor);
  }, [valor]);

  const gravar = (): void => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const v = pendente.current;
    pendente.current = null;
    if (v !== null && v !== valor) commitRef.current(v);
  };

  // Desmontou com algo pendente (trocou de bloco, fechou o painel): grava.
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
    const v = pendente.current;
    if (v !== null) commitRef.current(v);
  }, []);

  return {
    valorLocal: local,
    aoDigitar: (v) => {
      setLocal(v);
      pendente.current = v;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(gravar, 140);
    },
    aoSair: gravar,
    aoTeclar: (e) => {
      if (e.key === 'Enter') gravar();
    },
  };
}

export function Row({ label, children }: { label: string; children: React.ReactNode }): React.ReactElement {
  return (
    <label className="insp-row">
      <span className="insp-label">{label}</span>
      {children}
    </label>
  );
}

export function TextInput({ value, onChange, placeholder, list, label }: { value: string; onChange: (v: string) => void; placeholder?: string; /** id de um <datalist> com sugestões. */ list?: string; label?: string }): React.ReactElement {
  const t = useTextoAdiado(value, onChange);
  return (
    <input
      className="insp-input"
      value={t.valorLocal}
      placeholder={placeholder}
      list={list}
      aria-label={label}
      onChange={(e) => t.aoDigitar(e.target.value)}
      onBlur={t.aoSair}
      onKeyDown={t.aoTeclar}
    />
  );
}

export function NumberInput({ value, onChange, min, max }: { value: number; onChange: (v: number) => void; min?: number; max?: number }): React.ReactElement {
  return (
    <input
      className="insp-input"
      type="number"
      value={value}
      min={min}
      max={max}
      onChange={(e) => {
        const n = Number(e.target.value);
        if (Number.isFinite(n)) onChange(n);
      }}
    />
  );
}

export function RangeInput({ value, onChange, min, max }: { value: number; onChange: (v: number) => void; min: number; max: number }): React.ReactElement {
  return (
    <span className="insp-range">
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <b>{value}</b>
    </span>
  );
}

export function SelectInput<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }): React.ReactElement {
  return (
    <select className="insp-input" value={value} onChange={(e) => onChange(e.target.value as T)}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/** Campo bilíngue: mostra só o idioma escolhido no toggle do inspector. */
/**
 * Campo bilíngue (no idioma em edição). `campo` é o id em camposTexto: com ele,
 * "Traduzir"/"Descrever" das listas trazem o cursor direto para cá.
 */
export function I18nInput({ value, onChange, multiline, campo }: { value: I18n; onChange: (v: I18n) => void; multiline?: boolean; campo?: CampoId }): React.ReactElement {
  const lang = useEditLang();
  const caixa = useRef<HTMLDivElement>(null);
  useFocoDoCampo(campo, caixa);
  const other = lang === 'pt' ? 'en' : 'pt';
  // Mesma digitação adiada do TextInput: a gravação no documento espera a pausa.
  const t = useTextoAdiado(value[lang], (v) => onChange({ ...value, [lang]: v }));
  const common = {
    className: 'insp-input',
    value: t.valorLocal,
    'data-lang': lang,
    placeholder: value[other] ? `(${other.toUpperCase()}) ${value[other]}` : undefined,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => t.aoDigitar(e.target.value),
    onBlur: t.aoSair,
  };
  return (
    <div className="insp-i18n-field" ref={caixa} data-campo={campo}>
      <span className="insp-i18n-tag" title={lang === 'pt' ? 'Português' : 'English'}><LangFlag lang={lang} /></span>
      {multiline ? <textarea rows={4} {...common} /> : <input {...common} />}
    </div>
  );
}
