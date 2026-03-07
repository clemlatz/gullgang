import en from '../i18n/en.json';
import fr from '../i18n/fr.json';

export type Locale = 'en' | 'fr';

const translations: Record<string, Record<string, string>> = { en, fr };

export function getLocale(acceptLanguage?: string): Locale {
  if (!acceptLanguage) return 'en';
  const langs = acceptLanguage.split(',').map(l => l.split(';')[0].trim().toLowerCase());
  for (const lang of langs) {
    if (lang.startsWith('fr')) return 'fr';
    if (lang.startsWith('en')) return 'en';
  }
  return 'en';
}

export function t(locale: Locale, key: string, vars?: Record<string, string>): string {
  const dict = translations[locale] ?? translations['en'];
  let str = dict[key] ?? translations['en'][key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      str = str.replace(`{${k}}`, v);
    }
  }
  return str;
}
