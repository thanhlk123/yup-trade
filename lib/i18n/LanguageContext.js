'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { TRANSLATIONS } from './translations';

const LanguageContext = createContext();

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState('vi');

  useEffect(() => {
    const saved = localStorage.getItem('ai_trading_lang');
    if (saved && TRANSLATIONS[saved]) {
      setLanguage(saved);
    }
  }, []);

  const changeLanguage = (lang) => {
    if (TRANSLATIONS[lang]) {
      setLanguage(lang);
      localStorage.setItem('ai_trading_lang', lang);
      if (typeof document !== 'undefined') {
        document.documentElement.lang = lang;
      }
    }
  };

  const t = (key, params = {}) => {
    const dict = TRANSLATIONS[language] || TRANSLATIONS.vi;
    let text = dict[key] || TRANSLATIONS.vi[key] || key;

    Object.keys(params).forEach(p => {
      text = text.replace(new RegExp(`\\{${p}\\}`, 'g'), params[p]);
    });

    return text;
  };

  return (
    <LanguageContext.Provider value={{ language, changeLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    // Fallback if rendered outside provider
    return {
      language: 'vi',
      changeLanguage: () => {},
      t: (key, params = {}) => {
        let text = TRANSLATIONS.vi[key] || key;
        Object.keys(params).forEach(p => {
          text = text.replace(new RegExp(`\\{${p}\\}`, 'g'), params[p]);
        });
        return text;
      }
    };
  }
  return context;
}
