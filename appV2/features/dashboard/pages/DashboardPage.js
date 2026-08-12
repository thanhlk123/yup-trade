'use client';

import { useEffect } from 'react';
import DashboardHeader from '@/appV2/features/dashboard/components/DashboardHeader';
import AccountTabs from '@/appV2/features/dashboard/components/AccountTabs';
import DashboardStats from '@/appV2/features/dashboard/components/DashboardStats';
import EquityChart from '@/appV2/features/dashboard/components/EquityChart';

import BehaviorIntelligence from '@/appV2/features/analytics/components/BehaviorIntelligence';
import TradeList from '@/appV2/features/trades/components/TradeList';
import TradeFormModal from '@/appV2/features/trades/components/TradeFormModal';
import TradeCarouselModal from '@/appV2/features/trades/components/TradeCarouselModal';
import ExportHTMLModal from '@/appV2/features/trades/components/ExportHTMLModal';
import ChartGeneratorModal from '@/appV2/features/trades/components/ChartGeneratorModal';
import ZoomImageModal from '@/appV2/features/trades/components/ZoomImageModal';
import QuickReviewModal from '@/appV2/features/trades/components/QuickReviewModal';
import TodayReviewModal from '@/appV2/features/analytics/components/SmartReview/TodayReviewModal';
import WeeklyReviewModal from '@/appV2/features/analytics/components/SmartReview/WeeklyReviewModal';
import MonthlyReviewModal from '@/appV2/features/analytics/components/SmartReview/MonthlyReviewModal';
import RecentReviewModal from '@/appV2/features/analytics/components/SmartReview/RecentReviewModal';
import TradingRules from '@/components/TradingRules';
import TradingImprovementEngine from '@/components/TradingImprovementEngine';
import SetupStats from '@/components/SetupStats';
import { BrainCircuit, Maximize2, BookOpen, Plus } from 'lucide-react';
import { useLanguageStore } from '@/appV2/core/i18n/store';
import { useDashboardStore } from '@/appV2/features/dashboard/store/dashboardStore';

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

  return (
    <main className="flex-1 min-h-screen bg-[#f8fafc] dark:bg-[#12151e] transition-colors duration-300">
      
      {/* 1. Dashboard Header */}
      <DashboardHeader />

      {/* 2. Account Tabs */}
      <AccountTabs />

      {/* 3. Main Content Grid */}
      <div className="w-full max-w-[1920px] mx-auto p-4 sm:p-8 space-y-8 mt-4">
        
        {loading && trades.length === 0 ? (
          <div className="flex items-center justify-center h-[50vh]">
             <div className="flex flex-col items-center gap-3">
               <div className="w-10 h-10 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
               <p className="text-sm text-slate-400">Đang tải dữ liệu V2...</p>
             </div>
          </div>
        ) : (
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
        )}
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
