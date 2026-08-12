import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Brain, Moon, Sun, BarChart2, FileSpreadsheet, Plus, MoreHorizontal, ChevronDown, Award, Calendar, Sparkles, RotateCcw } from 'lucide-react';
import LanguageSelector from '@/app/features/settings/components/LanguageSelector';
import { useLanguageStore } from '@/app/core/i18n/store';
import { useThemeStore } from '@/app/core/theme/store';
import { useDashboardStore } from '@/app/features/dashboard/store/dashboardStore';
import { useSmartReviewStore } from '@/app/features/analytics/store/smartReviewStore';
import ImportCSVModal from '@/app/features/trades/components/ImportCSVModal';

export default function DashboardHeader() {
  const t = useLanguageStore(state => state.t);
  const theme = useThemeStore(state => state.theme);
  const setTheme = useThemeStore(state => state.setTheme);
  
  const trades = useDashboardStore(state => state.trades);
  const accountTabs = useDashboardStore(state => state.accountTabs);
  const activeTab = useDashboardStore(state => state.activeTab);
  const fetchDashboardData = useDashboardStore(state => state.fetchDashboardData);
  const openTradeForm = useDashboardStore(state => state.openTradeForm);
  const handleResetHistory = useDashboardStore(state => state.handleResetHistory);

  const handleTodayReview = useSmartReviewStore(state => state.handleTodayReview);
  const handleWeeklyReview = useSmartReviewStore(state => state.handleWeeklyReview);
  const handleMonthlyReview = useSmartReviewStore(state => state.handleMonthlyReview);
  const handleRecentReview = useSmartReviewStore(state => state.handleRecentReview);
  const loadingToday = useSmartReviewStore(state => state.loadingToday);
  const loadingWeekly = useSmartReviewStore(state => state.loadingWeekly);
  const loadingMonthly = useSmartReviewStore(state => state.loadingMonthly);
  const loadingRecent = useSmartReviewStore(state => state.loadingRecent);
  
  const [isCSVImportOpen, setIsCSVImportOpen] = useState(false);
  const [isReviewMenuOpen, setIsReviewMenuOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.more-menu-container')) {
        setIsMoreMenuOpen(false);
      }
      if (!event.target.closest('.smart-review-container')) {
        setIsReviewMenuOpen(false);
      }
    };
    
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsMoreMenuOpen(false);
        setIsReviewMenuOpen(false);
      }
    };
    
    document.addEventListener('click', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);
  
  return (
    <>
      <header className="border-b sticky top-0 z-30 backdrop-blur-xl px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-slate-200 dark:border-white/5 bg-white/90 dark:bg-slate-950/60 text-slate-900 dark:text-white">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-tr from-emerald-500 to-teal-400 rounded-xl shadow-lg shadow-emerald-500/20 text-slate-950">
            <Brain className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold flex items-center gap-2 tracking-tight">
              YUP Trade <span className="text-[10px] bg-sky-500/10 text-sky-400 border border-sky-500/20 px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider">v2.0</span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">{t('appSubTitle')}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Real Theme Switcher */}
          <div className="flex items-center p-1 rounded-xl border bg-slate-200/50 dark:bg-slate-800/50 border-slate-300 dark:border-slate-700 shadow-inner mr-2">
            <button 
              onClick={() => setTheme('dark')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                theme === 'dark' 
                  ? 'bg-slate-800 text-emerald-400 shadow-sm border border-emerald-500/20' 
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
              }`}
            >
              <Moon className="w-3.5 h-3.5" />
              <span>{t('darkTheme') || 'Dark'}</span>
            </button>
            
            <button 
              onClick={() => setTheme('light')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                theme === 'light' 
                  ? 'bg-white text-blue-600 shadow-sm border border-slate-300 font-extrabold' 
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
              }`}
            >
              <Sun className="w-3.5 h-3.5 text-amber-500" />
              <span>{t('lightTheme') || 'Light'}</span>
            </button>
          </div>

          <LanguageSelector />

          <Link href="/studio" className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-teal-500/20 hover:shadow-teal-500/40 hover:-translate-y-0.5 cursor-pointer">
            <BarChart2 className="w-4 h-4 font-bold" />
            <span>Studio Live Chart & Vị Thế</span>
          </Link>

          <button 
            onClick={() => setIsCSVImportOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-emerald-500/20 cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" /> {t('importCSV')}
          </button>

          <button 
            onClick={() => openTradeForm()}
            className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 border border-emerald-500/40 rounded-xl text-xs font-bold transition shadow cursor-pointer hover:bg-emerald-50 dark:hover:bg-slate-700"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">{t('addManual')}</span>
          </button>

          <div className="relative smart-review-container z-50">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsReviewMenuOpen(!isReviewMenuOpen);
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-purple-100 dark:bg-purple-500/20 hover:bg-purple-200 dark:hover:bg-purple-500/30 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-500/30 rounded-xl text-xs font-bold transition shadow-[0_0_15px_rgba(168,85,247,0.15)] cursor-pointer"
            >
              <Brain className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <span className="hidden sm:inline">AI Smart Review</span>
              <ChevronDown className="w-3 h-3 text-purple-600 dark:text-purple-400" />
            </button>

            {isReviewMenuOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden p-2 space-y-1">
                <div className="px-3 py-2 border-b border-white/5 mb-1">
                  <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">{t('reviewSelectTimeframe') || 'CHỌN MỐC THỜI GIAN'}</p>
                </div>

                <button 
                  onClick={() => { handleTodayReview(activeTab, 'vi'); setIsReviewMenuOpen(false); }}
                  disabled={loadingToday}
                  className="w-full flex flex-col px-3 py-2 hover:bg-slate-800 rounded-xl text-left cursor-pointer transition disabled:opacity-50"
                >
                  <div className="flex items-center gap-2 text-sm font-bold text-emerald-400">
                    <Award className="w-4 h-4" /> {t('reviewTodayTitle') || 'Đánh giá Hôm nay'}
                  </div>
                  <p className="text-[10px] text-slate-500 ml-6 mt-0.5">{t('reviewTodayDesc') || 'Tập trung vào kỷ luật & tâm lý trong ngày'}</p>
                </button>

                <button 
                  onClick={() => { handleWeeklyReview(activeTab, 'vi'); setIsReviewMenuOpen(false); }}
                  disabled={loadingWeekly}
                  className="w-full flex flex-col px-3 py-2 hover:bg-slate-800 rounded-xl text-left cursor-pointer transition disabled:opacity-50"
                >
                  <div className="flex items-center gap-2 text-sm font-bold text-sky-400">
                    <Calendar className="w-4 h-4" /> {t('reviewWeeklyTitle') || 'Đánh giá Tuần này'}
                  </div>
                  <p className="text-[10px] text-slate-500 ml-6 mt-0.5">{t('reviewWeeklyDesc') || 'Nhìn lại phong độ ngắn hạn (7 ngày)'}</p>
                </button>

                <button 
                  onClick={() => { handleMonthlyReview(activeTab, 'vi'); setIsReviewMenuOpen(false); }}
                  disabled={loadingMonthly}
                  className="w-full flex flex-col px-3 py-2 hover:bg-slate-800 rounded-xl text-left cursor-pointer transition disabled:opacity-50"
                >
                  <div className="flex items-center gap-2 text-sm font-bold text-purple-400">
                    <BarChart2 className="w-4 h-4" /> {t('reviewMonthlyTitle') || 'Đánh giá Tháng này'}
                  </div>
                  <p className="text-[10px] text-slate-500 ml-6 mt-0.5">{t('reviewMonthlyDesc') || 'Phân tích chiến lược dài hạn (30 ngày)'}</p>
                </button>

                <div className="my-1 border-t border-white/5"></div>

                <button 
                  onClick={() => { handleRecentReview(activeTab, 'vi'); setIsReviewMenuOpen(false); }}
                  disabled={loadingRecent}
                  className="w-full flex flex-col px-3 py-2 hover:bg-slate-800 rounded-xl text-left cursor-pointer transition disabled:opacity-50"
                >
                  <div className="flex items-center gap-2 text-sm font-bold text-amber-400">
                    <Sparkles className="w-4 h-4" /> {t('reviewRecent20Title') || 'Đánh giá 20 Lệnh'}
                  </div>
                  <p className="text-[10px] text-slate-500 ml-6 mt-0.5">{t('reviewRecent20Desc') || 'Đánh giá chu kỳ vi mô gần nhất'}</p>
                </button>
              </div>
            )}
          </div>
          
          <div className="relative more-menu-container">
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setIsMoreMenuOpen(!isMoreMenuOpen);
              }}
              className="p-2.5 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-white/5 rounded-xl transition shadow-sm cursor-pointer"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>

            {isMoreMenuOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50 p-2 space-y-1">
                <button 
                  onClick={() => { handleResetHistory(); setIsMoreMenuOpen(false); }} 
                  className="w-full flex items-center gap-3 px-3 py-2 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl text-xs text-rose-600 dark:text-rose-400 transition text-left cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" /> {t('resetHistoryTitle') || 'Reset Lịch Sử'}
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <ImportCSVModal 
        isOpen={isCSVImportOpen} 
        onClose={() => setIsCSVImportOpen(false)} 
        onSuccess={() => fetchDashboardData()}
        existingTrades={trades}
        accountTabs={accountTabs}
        activeTab={activeTab}
      />
    </>
  );
}
