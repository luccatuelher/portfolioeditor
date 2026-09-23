import type { I18n } from '../schema/v4';

export type ProjectCategory = 'professional' | 'personal';

export const CATEGORY_LABEL: Record<ProjectCategory, I18n> = {
  professional: { pt: 'Profissional', en: 'Professional' },
  personal: { pt: 'Pessoal', en: 'Personal' },
};

const semAcento = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

/**
 * Categoria de um projeto, como o filtro do site entende. O campo já foi texto
 * livre: quem escreveu "Profissional", "Pessoal" ou "Personal" (em qualquer
 * idioma, com ou sem acento) cai na categoria certa em vez de sumir do filtro.
 * Valor que não é nenhuma das duas: sem categoria (o texto continua exibido).
 */
export function projectCategory(value: I18n | undefined): ProjectCategory | undefined {
  for (const raw of [value?.pt, value?.en]) {
    const v = semAcento(raw ?? '');
    if (!v) continue;
    if (/^(profess|profiss|trabalho|work)/.test(v)) return 'professional';
    if (/^(personal|pessoal|autoral)/.test(v)) return 'personal';
  }
  return undefined;
}
