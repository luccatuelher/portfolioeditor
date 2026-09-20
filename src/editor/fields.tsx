import { createContext, useContext } from 'react';
import type { I18n } from '../core/i18n';
import { LangFlag } from '../renderer/Flags';

/** Idioma que os campos bilíngues do inspector estão editando (toggle no topo). */
export const EditLangContext = createContext<'pt' | 'en'>('pt');
export const useEditLang = (): 'pt' | 'en' => useContext(EditLangContext);

export function Row({ label, children }: { label: string; children: React.ReactNode }): React.ReactElement {
  return (
    <label className="insp-row">
      <span className="insp-label">{label}</span>
      {children}
    </label>
  );
}

export function TextInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }): React.ReactElement {
  return <input className="insp-input" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />;
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
export function I18nInput({ value, onChange, multiline }: { value: I18n; onChange: (v: I18n) => void; multiline?: boolean }): React.ReactElement {
  const lang = useEditLang();
  const other = lang === 'pt' ? 'en' : 'pt';
  const common = {
    className: 'insp-input',
    value: value[lang],
    'data-lang': lang,
    placeholder: value[other] ? `(${other.toUpperCase()}) ${value[other]}` : undefined,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange({ ...value, [lang]: e.target.value }),
  };
  return (
    <div className="insp-i18n-field">
      <span className="insp-i18n-tag" title={lang === 'pt' ? 'Português' : 'English'}><LangFlag lang={lang} /></span>
      {multiline ? <textarea rows={4} {...common} /> : <input {...common} />}
    </div>
  );
}
