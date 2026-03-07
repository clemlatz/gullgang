import { useMemo } from 'react';
import en from '../i18n/en.json';
import fr from '../i18n/fr.json';

type Locale = 'en' | 'fr';
const translations: Record<Locale, Record<string, any>> = { en, fr };

function detectLocale(): Locale {
  if (typeof navigator === 'undefined') return 'en';
  const lang = navigator.language?.substring(0, 2).toLowerCase();
  return lang === 'fr' ? 'fr' : 'en';
}

function getNestedValue(obj: Record<string, any>, path: string): string | undefined {
  return path.split('.').reduce((acc, key) => acc?.[key], obj as any);
}

export function useTranslation() {
  const locale = useMemo(detectLocale, []);
  const t = (key: string, vars?: Record<string, string | number>): string => {
    const dict = translations[locale] ?? translations['en'];
    let text: string = getNestedValue(dict, key) ?? getNestedValue(translations['en'], key) ?? key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        text = text.replaceAll(`{${k}}`, String(v));
      }
    }
    return text;
  };
  return { t, locale };
}
