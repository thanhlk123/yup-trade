'use client';

import { useEffect } from 'react';
import { useLanguageStore } from '@/app/core/i18n/store';
import { useThemeStore } from '@/app/core/theme/store';
import GlobalErrorHandler from '@/components/GlobalErrorHandler';

export default function V2Layout({ children }) {
  const initLanguage = useLanguageStore(state => state.initLanguage);
  const initTheme = useThemeStore(state => state.initTheme);

  useEffect(() => {
    initLanguage();
    initTheme();
  }, [initLanguage, initTheme]);

  return (
    <div className="v2-root min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100">
      {children}
    </div>
  );
}
