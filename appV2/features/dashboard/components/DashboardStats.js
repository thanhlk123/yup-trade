'use client';

import { TrendingUp, TrendingDown, Layers, Flame, BookOpen } from 'lucide-react';
import { useLanguageStore } from '@/appV2/core/i18n/store';
import { useDashboardStore } from '@/appV2/features/dashboard/store/dashboardStore';

export default function DashboardStats() {
  const t = useLanguageStore(state => state.t);
  const stats = useDashboardStore(state => state.stats);

  return (
    <section className="rounded-3xl p-6 relative overflow-hidden transition-colors duration-300 bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-white/5 shadow-sm dark:shadow-2xl">
      {/* Subtle Gradient Aura in background */}
      <div className="absolute -top-24 -right-24 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl pointer-events-none"></div>
      
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 relative z-10">
        {/* Total PnL */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-widest">
            {stats.summary?.totalPnl >= 0 ? <TrendingUp className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" /> : <TrendingDown className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" />}
            {t('netPnL')}
          </div>
          <div className="flex items-baseline gap-1">
            <span className={`text-3xl font-extrabold tracking-tight ${stats.summary?.totalPnl >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
              {stats.summary?.totalPnl >= 0 ? '+' : ''}{stats.summary?.totalPnl?.toLocaleString() || 0}
            </span>
            <span className="text-xs text-slate-500 font-bold">USD</span>
          </div>
        </div>

        {/* Total Trades */}
        <div className="space-y-2 lg:border-l lg:border-slate-200 lg:dark:border-white/5 lg:pl-8">
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-widest">
            <Layers className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400" />
            {t('totalTrades')}
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-extrabold tracking-tight text-slate-800 dark:text-white">
              {stats.summary?.totalTrades || 0}
            </span>
          </div>
          <div className="text-[11px] text-slate-500 font-medium">
            <span className="text-emerald-500 dark:text-emerald-400/80">{stats.summary?.wins || 0}W</span> - <span className="text-rose-500 dark:text-rose-400/80">{stats.summary?.losses || 0}L</span> - <span className="text-slate-500 dark:text-slate-400/80">{stats.summary?.breakevens || 0}BE</span>
          </div>
        </div>

        {/* Win Rate */}
        <div className="space-y-2 lg:border-l lg:border-slate-200 lg:dark:border-white/5 lg:pl-8">
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-widest">
            <Flame className="w-3.5 h-3.5 text-orange-500 dark:text-orange-400" />
            {t('winRate')}
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-extrabold tracking-tight text-slate-800 dark:text-white">
              {stats.summary?.winRate || 0}%
            </span>
          </div>
          <div className="w-full bg-slate-200 dark:bg-slate-800/50 h-1.5 rounded-full overflow-hidden mt-2">
            <div 
              className="bg-gradient-to-r from-orange-500 to-amber-400 h-full rounded-full"
              style={{ width: `${stats.summary?.winRate || 0}%` }}
            ></div>
          </div>
        </div>

        {/* Average PnL */}
        <div className="space-y-2 lg:border-l lg:border-slate-200 lg:dark:border-white/5 lg:pl-8">
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-widest">
            <BookOpen className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
            {t('avgR')}
          </div>
          <div className="flex items-baseline gap-1">
            <span className={`text-3xl font-extrabold tracking-tight ${stats.summary?.avgPnl >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
              {stats.summary?.avgPnl >= 0 ? '+' : ''}{stats.summary?.avgPnl?.toLocaleString() || 0}
            </span>
            <span className="text-xs text-slate-500 font-bold">USD</span>
          </div>
        </div>
      </div>
    </section>
  );
}
