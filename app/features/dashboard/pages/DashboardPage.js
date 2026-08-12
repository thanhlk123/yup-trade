'use client';

import { useEffect } from 'react';
import DashboardHeader from '@/app/features/dashboard/components/DashboardHeader';
import AccountTabs from '@/app/features/dashboard/components/AccountTabs';
import DashboardStats from '@/app/features/dashboard/components/DashboardStats';
import EquityChart from '@/app/features/dashboard/components/EquityChart';

import BehaviorIntelligence from '@/app/features/analytics/components/BehaviorIntelligence';
import TradeList from '@/app/features/trades/components/TradeList';
import TradeFormModal from '@/app/features/trades/components/TradeFormModal';
import TradeCarouselModal from '@/app/features/trades/components/TradeCarouselModal';
import ExportHTMLModal from '@/app/features/trades/components/ExportHTMLModal';
import ChartGeneratorModal from '@/app/features/trades/components/ChartGeneratorModal';
import ZoomImageModal from '@/app/features/trades/components/ZoomImageModal';
import QuickReviewModal from '@/app/features/trades/components/QuickReviewModal';
import TodayReviewModal from '@/app/features/analytics/components/SmartReview/TodayReviewModal';
import WeeklyReviewModal from '@/app/features/analytics/components/SmartReview/WeeklyReviewModal';
import MonthlyReviewModal from '@/app/features/analytics/components/SmartReview/MonthlyReviewModal';
import RecentReviewModal from '@/app/features/analytics/components/SmartReview/RecentReviewModal';
import TradingRules from '@/components/TradingRules';
import TradingImprovementEngine from '@/components/TradingImprovementEngine';
import SetupStats from '@/components/SetupStats';
import { BrainCircuit, Maximize2, BookOpen, Plus } from 'lucide-react';
import { useLanguageStore } from '@/app/core/i18n/store';
import { useDashboardStore } from '@/app/features/dashboard/store/dashboardStore';

export default function DashboardPage() {
  const loadAccountTabs = useDashboardStore(state => state.loadAccountTabs);
  const loading = useDashboardStore(state => state.loading);
  const trades = useDashboardStore(state => state.trades);
  const stats = useDashboardStore(state => state.stats);
  const openTradeForm = useDashboardStore(state => state.openTradeForm);
  const activeTab = useDashboardStore(state => state.activeTab);
  const accountTabs = useDashboardStore(state => state.accountTabs);
  const isAccountTabsLoaded = useDashboardStore(state => state.isAccountTabsLoaded);
  const t = useLanguageStore(state => state.t);

  useEffect(() => {
    loadAccountTabs();
  }, [loadAccountTabs]);

  const isInitialLoading = !isAccountTabsLoaded || (loading && trades.length === 0);

  if (isInitialLoading) {
    return (
      <main className="flex-1 min-h-screen bg-[#f8fafc] dark:bg-[#0f172a] flex items-center justify-center relative overflow-hidden transition-colors duration-500 z-50">
        {/* Animated Background Elements */}
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-emerald-500/10 rounded-full blur-[120px] mix-blend-screen animate-pulse" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-teal-500/10 rounded-full blur-[120px] mix-blend-screen animate-pulse" style={{ animationDelay: '1s' }} />
        
        <div className="relative z-10 flex flex-col items-center gap-8 animate-fade-in">
           {/* Logo Animation */}
           <div className="relative flex items-center justify-center w-28 h-28 bg-white dark:bg-[#1e293b] rounded-[2rem] shadow-[0_0_40px_-10px_rgba(16,185,129,0.3)] border border-slate-200 dark:border-white/10 overflow-hidden group">
             <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 opacity-50 group-hover:opacity-100 transition-opacity duration-700 animate-pulse" />
             <BrainCircuit className="w-14 h-14 text-emerald-500 drop-shadow-[0_0_15px_rgba(16,185,129,0.5)] animate-bounce" style={{ animationDuration: '2s' }} />
           </div>
           
           {/* Text */}
           <div className="text-center space-y-3">
             <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-500 dark:from-emerald-400 dark:to-teal-300 tracking-tight">
               YUP Trade V2.0
             </h1>
             <div className="flex items-center justify-center gap-2 text-slate-500 dark:text-slate-400 font-medium tracking-widest uppercase text-sm">
               <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
               Khởi tạo không gian làm việc...
             </div>
           </div>
           
           {/* Modern Loading Bar */}
           <div className="w-56 h-1 bg-slate-200 dark:bg-slate-800/80 rounded-full overflow-hidden mt-2 relative backdrop-blur-sm border border-slate-300/50 dark:border-slate-700/50">
             <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full animate-pulse" />
           </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 min-h-screen bg-[#f8fafc] dark:bg-[#12151e] transition-colors duration-300">
      
      {/* 1. Dashboard Header */}
      <DashboardHeader />

      {/* 2. Account Tabs */}
      <AccountTabs />

      {/* 3. Main Content Grid */}
      <div className="w-full max-w-[1920px] mx-auto p-4 sm:p-8 space-y-8 mt-4">
        
        <>
          {/* Row 1: Summary Stats */}
          <DashboardStats />

            {trades.length === 0 ? (
              /* Empty State */
              <section className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-12 text-center max-w-2xl mx-auto flex flex-col items-center justify-center gap-4 mt-8">
                <div className="w-16 h-16 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex items-center justify-center text-slate-500 shadow-inner">
                  <BookOpen className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-xl font-bold text-slate-800 dark:text-white">{t('emptyJournalTitle')}</h2>
                  <p className="text-slate-500 dark:text-slate-400 text-sm max-w-md">
                    {t('emptyJournalDesc')}
                  </p>
                </div>
                <div className="flex gap-3 mt-2">
                  <button
                    onClick={() => openTradeForm(null)}
                    className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl transition shadow-lg shadow-emerald-500/10 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" /> {t('addManual')}
                  </button>
                </div>
              </section>
            ) : (
              /* Main Content Grid (Chart + TradeList on left, Analytics on right) */
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 relative z-10 items-start">
                
                {/* Left Column: Chart & Trade List */}
                <div className="space-y-6 xl:col-span-1">
                  <EquityChart />
                  <TradeList />
                  <BehaviorIntelligence />
                </div>

                {/* Right Column: AI Insights & Analytics */}
                <div className="space-y-8 xl:col-span-1 animate-slide-down">
                  

                  <TradingRules 
                    trades={trades} 
                    activeTab={activeTab} 
                    accountTabs={accountTabs} 
                    onViolationChange={() => {}} 
                    onExpand={() => {}} 
                  />

                  <div className="bg-white dark:bg-slate-900/40 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-white/5 relative overflow-hidden flex flex-col">
                    <div className="absolute -top-12 -right-12 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
                    
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-4 relative z-10">
                      <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <BrainCircuit className="w-5 h-5 text-emerald-500 dark:text-emerald-400" /> {t('aiInsightsTitle')}
                      </h3>
                      <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:hover:text-white rounded-xl transition">
                        <Maximize2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="mt-4 mb-2 relative z-10 flex-1">
                      <TradingImprovementEngine trades={trades} activeTab={activeTab} />
                    </div>
                  </div>

                  <SetupStats 
                    stats={stats} 
                    trades={trades} 
                    onExpand={() => {}} 
                  />
                </div>
              </div>
            )}
        </>
      </div>
      <TradeFormModal />
      <QuickReviewModal />
      <TradeCarouselModal />
      <ExportHTMLModal />
      <ChartGeneratorModal />
      <ZoomImageModal />
      <TodayReviewModal />
      <WeeklyReviewModal />
      <MonthlyReviewModal />
      <RecentReviewModal />
    </main>
  );
}
