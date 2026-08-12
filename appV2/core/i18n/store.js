import { create } from 'zustand';
import { TRANSLATIONS } from './translations';

export const useLanguageStore = create((set, get) => ({
  language: 'vi', // default
  initLanguage: () => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('ai_trading_lang');
      if (saved && TRANSLATIONS[saved]) {
        set({ language: saved });
        document.documentElement.lang = saved;
      } else {
        document.documentElement.lang = 'vi';
      }
    }
  },
  changeLanguage: (lang) => {
    if (TRANSLATIONS[lang]) {
      set({ language: lang });
      if (typeof window !== 'undefined') {
        localStorage.setItem('ai_trading_lang', lang);
        document.documentElement.lang = lang;
      }
    }
  },
  t: (key, params = {}) => {
    const { language } = get();
    const dict = TRANSLATIONS[language] || TRANSLATIONS.vi;
    let text = dict[key] || TRANSLATIONS.vi[key] || key;

    Object.keys(params).forEach(p => {
      text = text.replace(new RegExp(`\\{${p}\\}`, 'g'), params[p]);
    });

    return text;
  }
}));

// Provide a backward-compatible hook for gradual migration
export function useLanguage() {
  const language = useLanguageStore((state) => state.language);
  const changeLanguage = useLanguageStore((state) => state.changeLanguage);
  const t = useLanguageStore((state) => state.t);
  return { language, changeLanguage, t };
}
