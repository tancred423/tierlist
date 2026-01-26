import { useState, ReactNode } from 'react';
import { I18nContext } from './I18nContext';
import en from './translations/en.json';
import de from './translations/de.json';

type Language = 'en' | 'de';

const translations = { en, de };

function getNestedValue(obj: Record<string, unknown>, path: string): string {
  const keys = path.split('.');
  let result: unknown = obj;
  for (const key of keys) {
    if (result && typeof result === 'object' && key in result) {
      result = (result as Record<string, unknown>)[key];
    } else {
      return path;
    }
  }
  return typeof result === 'string' ? result : path;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    const stored = localStorage.getItem('language');
    if (stored === 'en' || stored === 'de') return stored;
    const browserLang = navigator.language.split('-')[0];
    return browserLang === 'de' ? 'de' : 'en';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('language', lang);
  };

  const t = (key: string): string => {
    return getNestedValue(translations[language] as Record<string, unknown>, key);
  };

  return (
    <I18nContext.Provider value={{ language, setLanguage, t }}>{children}</I18nContext.Provider>
  );
}
