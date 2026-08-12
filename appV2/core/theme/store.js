import { create } from 'zustand';

const getStylesForTheme = (theme) => {
  if (theme === 'light') {
    return {
      main: 'bg-slate-100 text-slate-900',
      header: 'bg-white/90 border-slate-200 shadow-sm text-slate-900',
      card: 'bg-white border border-slate-200/80 shadow-sm text-slate-900',
      subtext: 'text-slate-500',
      titleText: 'text-slate-900',
      border: 'border-slate-200',
      innerCard: 'bg-slate-50 border border-slate-200',
      tradeCardBg: 'bg-white border-slate-200 hover:border-slate-300 shadow-sm hover:shadow-md text-slate-900',
      switcherBg: 'bg-slate-200/80 border-slate-300',
    };
  }
  return {
    main: 'bg-slate-950 text-slate-100',
    header: 'bg-slate-950/60 border-white/5 shadow-sm text-white',
    card: 'bg-slate-900/40 backdrop-blur-xl border border-white/5 shadow-2xl text-slate-100',
    subtext: 'text-slate-400',
    titleText: 'text-white',
    border: 'border-white/5',
    innerCard: 'bg-slate-900/40 border border-white/5',
    tradeCardBg: 'bg-slate-900/20 border-white/5 hover:border-white/10 hover:bg-slate-900/40 shadow-md text-slate-100',
    switcherBg: 'bg-slate-900/80 border-white/10',
  };
};

export const useThemeStore = create((set, get) => ({
  theme: 'dark',
  themeStyles: getStylesForTheme('dark'),

  initTheme: () => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('ai_trading_theme') || 'dark';
      set({ theme: saved, themeStyles: getStylesForTheme(saved) });
      document.documentElement.setAttribute('data-theme', saved);
    }
  },

  setTheme: (newTheme) => {
    set({ theme: newTheme, themeStyles: getStylesForTheme(newTheme) });
    if (typeof window !== 'undefined') {
      localStorage.setItem('ai_trading_theme', newTheme);
      document.documentElement.setAttribute('data-theme', newTheme);
    }
  }
}));
