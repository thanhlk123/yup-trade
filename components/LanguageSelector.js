'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Globe, ChevronDown } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';

const LANGUAGES = [
  { code: 'vi', name: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
  { code: 'ko', name: '한국어', flag: '🇰🇷' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
];

export default function LanguageSelector() {
  const { language, changeLanguage } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const currentLang = LANGUAGES.find(l => l.code === language) || LANGUAGES[0];

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold theme-inner-card border theme-border theme-text-main hover:opacity-90 transition cursor-pointer shadow-sm"
        title="Change Language / Đổi ngôn ngữ"
      >
        <Globe className="w-3.5 h-3.5 text-sky-400 shrink-0" />
        <span className="font-medium flex items-center gap-1.5">
          <span>{currentLang.flag}</span>
          <span className="hidden sm:inline">{currentLang.name}</span>
          <span className="sm:hidden font-mono uppercase">{currentLang.code}</span>
        </span>
        <ChevronDown className={`w-3.5 h-3.5 theme-text-sub transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-44 rounded-2xl theme-card border theme-border shadow-2xl py-1.5 z-[100] animate-fade-in">
          {LANGUAGES.map((lang) => {
            const isSelected = lang.code === language;
            return (
              <button
                key={lang.code}
                type="button"
                onClick={() => {
                  changeLanguage(lang.code);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2 text-xs transition cursor-pointer ${
                  isSelected 
                    ? 'bg-sky-500/10 text-sky-400 font-bold' 
                    : 'theme-text-main hover:bg-slate-500/10'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">{lang.flag}</span>
                  <span>{lang.name}</span>
                </div>
                {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-sky-400"></span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
