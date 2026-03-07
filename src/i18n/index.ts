import en from './en.json';
import fr from './fr.json';

export type Locale = 'en' | 'fr';

const translations: Record<Locale, Record<string, any>> = { en, fr };

export const SUPPORTED_LOCALES: Locale[] = ['en', 'fr'];

export function detectLocale(acceptLanguage: string | null): Locale {
  if (!acceptLanguage) return 'en';
  const langs = acceptLanguage
    .split(',')
    .map((l) => l.trim().split(';')[0].toLowerCase().substring(0, 2));
  for (const lang of langs) {
    if (SUPPORTED_LOCALES.includes(lang as Locale)) return lang as Locale;
  }
  return 'en';
}

function getNestedValue(obj: Record<string, any>, path: string): string | undefined {
  return path.split('.').reduce((acc, key) => acc?.[key], obj);
}

export function t(locale: Locale, key: string, vars?: Record<string, string | number>): string {
  const dict = translations[locale] ?? translations['en'];
  let text = getNestedValue(dict, key) ?? getNestedValue(translations['en'], key) ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replaceAll(`{{${k}}}`, String(v));
    }
  }
  return text;
}
