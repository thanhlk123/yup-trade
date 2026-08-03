'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, 
  BarChart2, 
  RefreshCw, 
  CheckSquare, 
  Sparkles, 
  BookOpen, 
  Layers,
  Zap,
  Globe,
  Sun,
  Moon
} from 'lucide-react';
import TradingViewStudioChart from '@/components/TradingViewStudioChart';
import TradingViewTradeTable from '@/components/TradingViewTradeTable';
import GlobalErrorHandler from '@/components/GlobalErrorHandler';
import LanguageSelector from '@/components/LanguageSelector';
import { LanguageProvider, useLanguage } from '@/lib/i18n/LanguageContext';

function StudioContent() {
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const initialTradeId = searchParams.get('tradeId');
  const [mounted, setMounted] = useState(false);

  const [trades, setTrades] = useState([]);
  const [selectedTradeIds, setSelectedTradeIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState('dark');

  // Load initial theme from localStorage or document
  useEffect(() => {
    const savedTheme = localStorage.getItem('ai_trading_theme');
    const initialTheme = (savedTheme && ['dark', 'light'].includes(savedTheme)) ? savedTheme : 'dark';
    setTheme(initialTheme);
    document.documentElement.setAttribute('data-theme', initialTheme);
  }, []);

  const changeTheme = (newTheme) => {
    setTheme(newTheme);
    localStorage.setItem('ai_trading_theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };
  
  // Fetch trades from database
  const fetchTrades = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/trades');
      const json = await res.json();
      const tradeList = json.data || (Array.isArray(json) ? json : []);
      setTrades(tradeList);
      
      // If tradeId parameter is present in URL, pre-select that trade
      if (initialTradeId) {
        const numId = parseInt(initialTradeId, 10);
        const found = tradeList.find((t) => t.id === numId || t.id === initialTradeId);
        if (found) {
          setSelectedTradeIds([found.id]);
        }
      }
    } catch (e) {
      console.error('Error fetching trades for Studio:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrades();
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleDrawingsUpdated = (e) => {
      const { tradeId, drawings_data } = e.detail;
      setTrades(prev => prev.map(t => t.id === tradeId ? { ...t, drawings_data } : t));
    };
    window.addEventListener('tv_drawings_updated', handleDrawingsUpdated);
    return () => window.removeEventListener('tv_drawings_updated', handleDrawingsUpdated);
  }, []);

  const handleToggleTrade = (trade) => {
    if (!trade) return;
    setSelectedTradeIds((prev) =>
      prev.includes(trade.id)
        ? prev.filter((id) => id !== trade.id)
        : [...prev, trade.id]
    );
  };

  const handleToggleAllTrades = (filteredTrades) => {
    const allFilteredIds = filteredTrades.map((t) => t.id);
    const isAllSelected = allFilteredIds.length > 0 && allFilteredIds.every((id) => selectedTradeIds.includes(id));
    
    if (isAllSelected) {
      setSelectedTradeIds((prev) => prev.filter((id) => !allFilteredIds.includes(id)));
    } else {
      setSelectedTradeIds((prev) => Array.from(new Set([...prev, ...allFilteredIds])));
    }
  };

  const selectedTrades = trades.filter((t) => selectedTradeIds.includes(t.id));

  if (!mounted) {
    return <div className="min-h-screen flex items-center justify-center bg-[#12151e] text-slate-400">Loading Studio...</div>;
  }

  return (
    <div className={`h-screen w-screen overflow-hidden flex flex-col font-sans transition-colors duration-300 ${
      theme === 'light' ? 'bg-slate-100 text-slate-900' : 'bg-[#12151e] text-slate-100'
    }`}>
      <GlobalErrorHandler />
      {/* Top Fixed Header Navigation */}
      <header className={`h-16 px-6 border-b flex items-center justify-between flex-shrink-0 z-30 transition-colors duration-300 ${
        theme === 'light' ? 'bg-white/90 border-slate-200 shadow-sm' : 'bg-[#181c28]/90 border-white/10'
      }`}>
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition border cursor-pointer ${
              theme === 'light' 
                ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300' 
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-white/5'
            }`}
          >
            <ArrowLeft className="w-4 h-4 text-emerald-500" />
            <span>{t('homePage')}</span>
          </Link>

          <div className={`h-5 w-px hidden sm:block ${theme === 'light' ? 'bg-slate-200' : 'bg-white/10'}`} />

          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 flex items-center justify-center text-slate-950 font-bold shadow-lg shadow-emerald-500/20">
              <BarChart2 className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className={`text-sm font-extrabold tracking-tight ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>
                  {t('reviewStudioTitle')}
                </h1>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase border ${
                  theme === 'light'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                }`}>
                  {trades.length} {t('tradesCount')}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Top Actions */}
        <div className="flex items-center gap-3">
          {/* Multi-language Selector */}
          <LanguageSelector />

          {/* Theme Switcher 2-Way Control */}
          <div className={`flex items-center p-1 rounded-xl border shadow-inner ${
            theme === 'light' ? 'bg-slate-100 border-slate-300' : 'bg-slate-900/80 border-white/10'
          }`}>
            <button
              onClick={() => changeTheme('dark')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                theme === 'dark' 
                  ? 'bg-slate-800 text-emerald-400 shadow-sm border border-emerald-500/20' 
                  : 'text-slate-400 hover:text-white'
              }`}
              title={t('darkTheme')}
            >
              <Moon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t('darkTheme')}</span>
            </button>

            <button
              onClick={() => changeTheme('light')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                theme === 'light' 
                  ? 'bg-white text-blue-600 shadow-sm border border-slate-300 font-extrabold' 
                  : 'text-slate-400 hover:text-slate-700'
              }`}
              title={t('lightTheme')}
            >
              <Sun className="w-3.5 h-3.5 text-amber-500" />
              <span className="hidden sm:inline">{t('lightTheme')}</span>
            </button>
          </div>

          {selectedTradeIds.length > 0 && (
            <button
              onClick={() => setSelectedTradeIds([])}
              className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-xl text-xs font-bold transition cursor-pointer ${
                theme === 'light'
                  ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
                  : 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border-rose-500/30'
              }`}
            >
              <RefreshCw className="w-3.5 h-3.5" /> {t('clearSelectionCount', { count: selectedTradeIds.length })}
            </button>
          )}

          <button
            onClick={fetchTrades}
            className={`p-2 rounded-xl text-xs font-bold transition border cursor-pointer ${
              theme === 'light'
                ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-white/5'
            }`}
            title={t('refreshTradeData')}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      {/* Main 2-Panel Dedicated Viewport Layout (Left: Chart, Right: Table) */}
      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        
        {/* Left Panel: 58% Width Candlestick Review Chart Engine */}
        <section className={`w-full lg:w-[58%] h-1/2 lg:h-full border-b lg:border-b-0 lg:border-r flex flex-col relative transition-colors duration-300 ${
          theme === 'light' ? 'border-slate-200 bg-white' : 'border-white/10 bg-slate-950'
        }`}>
          <TradingViewStudioChart
            key={selectedTradeIds.length > 0 ? selectedTradeIds[0] : 'studio'}
            selectedTrades={selectedTrades}
            onClearAllTrades={() => setSelectedTradeIds([])}
            theme={theme}
          />
        </section>

        {/* Right Panel: 42% Width YUP Trade Trade Journal Table */}
        <section className={`w-full lg:w-[42%] h-1/2 lg:h-full flex flex-col overflow-hidden transition-colors duration-300 ${
          theme === 'light' ? 'bg-white' : 'bg-slate-950'
        }`}>
          <TradingViewTradeTable
            trades={trades}
            selectedTradeIds={selectedTradeIds}
            onToggleTrade={handleToggleTrade}
            onToggleAllTrades={handleToggleAllTrades}
            theme={theme}
          />
        </section>

      </main>
    </div>
  );
}

function LoadingFallback() {
  const { t } = useLanguage();
  return (
    <div className="h-screen w-screen bg-slate-950 flex items-center justify-center text-emerald-400 font-bold text-sm">
      <RefreshCw className="w-5 h-5 animate-spin mr-2" /> {t('loadingStudio')}
    </div>
  );
}

export default function StudioPage() {
  return (
    <LanguageProvider>
      <Suspense fallback={<LoadingFallback />}>
        <StudioContent />
      </Suspense>
    </LanguageProvider>
  );
}
