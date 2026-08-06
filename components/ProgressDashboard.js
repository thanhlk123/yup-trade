'use client';

import { useState, useEffect } from 'react';
import { Trophy, ShieldCheck, Flame, Lightbulb, CheckCircle2, AlertTriangle, Maximize2, Award, Zap, Filter, FileText } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';

export default function ProgressDashboard({ activeTab, isExpanded, onExpand }) {
  const { language, t } = useLanguage();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('week'); // 'today' | 'week' | 'month' | 'all'
  const [dataFilter, setDataFilter] = useState('all'); // 'all' | 'rich'

  useEffect(() => {
    if (!data) setLoading(true);

    fetch(`/api/progress-stats?type=${activeTab}&timeRange=${timeRange}&dataFilter=${dataFilter}&lang=${language}`)
      .then(r => r.json())
      .then(res => {
        if (res.success) setData(res.data);
      })
      .catch(console.error)
      .finally(() => {
        setLoading(false);
      });
  }, [activeTab, timeRange, dataFilter, language]);

  const gradeColors = {
    S: 'from-amber-500/20 to-yellow-500/20 text-amber-400 border-amber-500/30',
    A: 'from-emerald-500/20 to-teal-500/20 text-emerald-400 border-emerald-500/30',
    B: 'from-sky-500/20 to-blue-500/20 text-sky-400 border-sky-500/30',
    C: 'from-orange-500/20 to-amber-500/20 text-orange-400 border-orange-500/30',
    D: 'from-rose-500/20 to-pink-500/20 text-rose-400 border-rose-500/30',
  };

  const getPeriodLabel = () => {
    if (timeRange === 'today') return t('periodCompareToday');
    if (timeRange === 'month') return t('periodCompareMonth');
    if (timeRange === 'all') return t('periodCompareAll');
    return t('periodCompareWeek');
  };

  return (
    <div className={`theme-card rounded-3xl p-5 shadow-xl relative overflow-hidden ${isExpanded ? 'h-full flex flex-col space-y-5 overflow-y-auto' : 'space-y-4'}`}>

      {/* Decorative blur */}
      <div className="absolute -top-16 -right-16 w-48 h-48 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header & Controls */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-3 border-b theme-border relative z-10">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-400" /> {t('progressTitle')}
        </h3>

        {/* Filters bar */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Time Range Selector */}
          <div className="flex items-center gap-1 theme-inner-card rounded-xl p-1 border theme-border text-[10px]">
            {[
              { id: 'today', label: t('timeToday') },
              { id: 'week', label: t('timeWeek') },
              { id: 'month', label: t('timeMonth') },
              { id: 'all', label: t('timeAll') },
            ].map(rangeItem => (
              <button
                key={rangeItem.id}
                onClick={() => setTimeRange(rangeItem.id)}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-colors duration-150 cursor-pointer ${
                  timeRange === rangeItem.id
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'text-slate-400 hover:text-white border border-transparent'
                }`}
              >
                {rangeItem.label}
              </button>
            ))}
          </div>

          {/* Data Filter Toggle */}
          <button
            onClick={() => setDataFilter(v => v === 'all' ? 'rich' : 'all')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[10px] font-semibold transition-colors duration-150 cursor-pointer ${
              dataFilter === 'rich'
                ? 'bg-violet-500/20 text-violet-300 border-violet-500/40'
                : 'theme-inner-card theme-border text-slate-400 hover:text-white'
            }`}
            title={t('filterRichTitle')}
          >
            <Filter className="w-3 h-3 text-violet-400 shrink-0" />
            <span>{dataFilter === 'rich' ? t('filterRichOnly') : t('filterAllData')}</span>
          </button>

          {!isExpanded && onExpand && (
            <button onClick={onExpand} className="p-1.5 hover:bg-white/5 rounded-xl text-slate-400 hover:text-white transition" title={t('closeFullscreen')}>
              <Maximize2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Content Rendering */}
      {loading && !data ? (
        <div className="flex flex-col items-center justify-center min-h-[250px] gap-3 text-slate-500">
          <Trophy className="w-8 h-8 animate-pulse text-amber-400" />
          <p className="text-xs">{t('loadingProgress')}</p>
        </div>
      ) : !data || !data.summary || data.summary.totalTrades === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[250px] gap-3 text-slate-500">
          <Award className="w-8 h-8 text-slate-600" />
          <p className="text-xs">{t('noProgressData')}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Data Source Transparency Banner */}
          {data.dataMeta && (
            <div className="rounded-xl border theme-border theme-inner-card/60 px-3.5 py-2.5 text-xs flex items-center justify-between text-slate-400">
              <span className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-sky-400 shrink-0" />
                <span>{t('dataSourceLabel', { total: data.summary.totalTrades, csv: data.dataMeta.rawCsvCount, rich: data.dataMeta.richJournalCount })}</span>
              </span>
              <span className="text-xs text-amber-400/90 font-mono font-bold">
                {getPeriodLabel()}
              </span>
            </div>
          )}

          {/* 1. Consistency Scorecard Gauge */}
          <div className="theme-inner-card border theme-border rounded-2xl p-5 space-y-4 relative overflow-hidden shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="text-xs theme-text-sub uppercase font-extrabold tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" /> {t('consistencyGaugeTitle')}
                </p>
                <div className="flex items-center gap-3 pt-1">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-4xl font-extrabold theme-text-main leading-none">{data.consistency.score}</span>
                    <span className="text-xs theme-text-sub font-semibold">/ 100</span>
                  </div>
                  <div className={`px-2.5 py-0.5 rounded-lg border bg-gradient-to-r ${gradeColors[data.consistency.grade] || gradeColors.C} flex items-center justify-center font-bold text-xs uppercase shadow-sm`}>
                    Hạng {data.consistency.grade}
                  </div>
                </div>
              </div>
            </div>

            {/* Progress bar */}
            <div className="h-2.5 bg-slate-500/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-amber-400 rounded-full transition-all duration-300"
                style={{ width: `${data.consistency.score}%` }}
              />
            </div>

            {/* Metrics Sub-row */}
            <div className="grid grid-cols-3 gap-3 pt-1">
              <div className="theme-card/60 p-2.5 rounded-xl border theme-border text-center">
                <p className="text-[11px] theme-text-sub uppercase font-bold">{t('slRate')}</p>
                <p className="text-sm font-extrabold text-emerald-400 mt-0.5">{data.consistency.slRate}%</p>
              </div>
              <div className="theme-card/60 p-2.5 rounded-xl border theme-border text-center">
                <p className="text-[11px] theme-text-sub uppercase font-bold">{t('noDcaRate')}</p>
                <p className="text-sm font-extrabold text-sky-400 mt-0.5">{data.consistency.noDcaRate}%</p>
              </div>
              <div className="theme-card/60 p-2.5 rounded-xl border theme-border text-center">
                <p className="text-[11px] theme-text-sub uppercase font-bold">{t('periodWinrate')}</p>
                <p className="text-sm font-extrabold text-amber-400 mt-0.5">{data.summary.winrate}%</p>
              </div>
            </div>
          </div>

          {/* 2. Personal Achievements & Milestones */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="theme-inner-card border theme-border rounded-2xl p-4 flex items-center gap-3.5">
              <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-400 shrink-0 border border-amber-500/20">
                <Flame className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs theme-text-sub uppercase font-bold tracking-wider">{t('maxWinStreak')}</p>
                <p className="text-lg font-bold text-amber-400 leading-tight">{t('countTrades', { count: data.milestones.maxWinStreak })}</p>
                <p className="text-xs theme-text-sub mt-0.5">{t('winStreakSub')}</p>
              </div>
            </div>

            <div className="theme-inner-card border theme-border rounded-2xl p-4 flex items-center gap-3.5">
              <div className={`p-3 rounded-2xl shrink-0 border ${
                data.milestones.bestTradePnl > 0
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : data.milestones.bestTradePnl < 0
                  ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                  : 'bg-slate-500/10 text-slate-400 border-slate-500/20'
              }`}>
                <Zap className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs theme-text-sub uppercase font-bold tracking-wider">
                  {data.milestones.bestTradePnl > 0 ? t('bestTrade') : t('bestTradeGeneral')}
                </p>
                <p className={`text-lg font-bold font-mono leading-tight ${
                  data.milestones.bestTradePnl > 0 
                    ? 'text-emerald-500 dark:text-emerald-400' 
                    : data.milestones.bestTradePnl < 0 
                    ? 'text-rose-500 dark:text-rose-400' 
                    : 'theme-text-sub'
                }`}>
                  {data.milestones.bestTradePnl > 0 ? '+' : ''}{data.milestones.bestTradePnl} USD
                </p>
                <p className="text-xs theme-text-sub mt-0.5">{t('profitableCount', { count: data.milestones.totalProfitableTrades })}</p>
              </div>
            </div>
          </div>

          {/* 3. Improvements vs Regressions Analysis Cards */}
          {data.comparison && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* 🟢 Improvements (Week vs Week Comparison) */}
              <div className="theme-inner-card border border-emerald-500/30 rounded-2xl p-4 space-y-2 shadow-sm col-span-1 md:col-span-2">
                <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> 🟢 {t('improvements')}
                </p>
                <ul className="space-y-1.5">
                  {data.comparison.improvements.map((item, idx) => (
                    <li key={idx} className="text-xs theme-text-main flex items-start gap-2 leading-relaxed">
                      <span className="text-emerald-500 font-bold mt-0.5">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

        </div>
      )}

    </div>
  );
}
