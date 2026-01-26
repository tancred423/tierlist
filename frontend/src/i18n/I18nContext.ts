import { createContext } from 'react';

export interface I18nContextType {
  language: 'en' | 'de';
  setLanguage: (lang: 'en' | 'de') => void;
  t: (key: string) => string;
}

export const I18nContext = createContext<I18nContextType | null>(null);
