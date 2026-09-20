/** Todo texto visível no v4 é bilíngue. */
export interface I18n {
  pt: string;
  en: string;
}

export const emptyI18n = (): I18n => ({ pt: '', en: '' });

/** Cria um I18n; quando `en` é omitido, espelha `pt` (usado na migração de chaves não-i18n do v3). */
export const bi = (pt: string, en?: string): I18n => ({ pt: pt ?? '', en: (en ?? pt) ?? '' });

export const isBlankI18n = (v: I18n): boolean => !v.pt.trim() && !v.en.trim();
