'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  BrainCircuit, TrendingDown, TrendingUp, Minus, ChevronRight, X,
  ShieldCheck, Target, Zap, AlertTriangle, CheckCircle2, Info,
  BarChart2, ArrowRight, Activity
} from 'lucide-react';
import { useLanguageStore } from '@/app/core/i18n/store';
import { useDashboardStore } from '@/app/features/dashboard/store/dashboardStore';
import { runBehaviorEngine } from '@/lib/behaviorEngine';
import { ReEntryDetail } from './ReEntryDetail';
import { PositionSizingDetail } from './PositionSizingDetail';
import { NoTpDetail } from './NoTpDetail';
import { NoSlDetail } from './NoSlDetail';
import { RevengeDetail } from './RevengeDetail';
import { DcaDetail } from './DcaDetail';
import { CounterTrendDetail } from './CounterTrendDetail';
import { PyramidDetail } from './PyramidDetail';

// ── Helpers ──────────────────────────────────────────────────

function fmt$(n) {
  if (!n && n !== 0) return '$0';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '+';
  if (abs >= 1000) return sign + '$' + (abs / 1000).toFixed(1) + 'k';
  return sign + '$' + abs.toFixed(0);
}

function fmtPct(n) { return (n * 100).toFixed(0) + '%'; }

function StatusBadge({ status, severity }) {
  const finalStatus = status || (severity >= 8 ? 'critical' : severity >= 6 ? 'high' : severity >= 4 ? 'medium' : 'low');
  const map = {
    critical: 'bg-rose-500/15 text-rose-500 dark:text-rose-400 border-rose-500/30',
    high:     'bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30',
    medium:   'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
    low:      'bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30',
  };
  return (
    <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border ${map[finalStatus] || map.medium}`}>
      {finalStatus}
    </span>
  );
}

function EvidenceBadge({ quality }) {
  const map = {
    high:   'text-emerald-400',
    medium: 'text-amber-400',
    low:    'text-rose-400',
  };
  return (
    <span className={`text-[10px] font-bold uppercase ${map[quality] || map.medium}`}>
      {quality}
    </span>
  );
}

function TrendPill({ trend }) {
  if (!trend) return null;
  if (trend.direction === 'improving') return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400">
      <TrendingDown className="w-3 h-3" /> {trend.change}%
    </span>
  );
  if (trend.direction === 'worsening') return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-400">
      <TrendingUp className="w-3 h-3" /> +{trend.change}%
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-400">
      <Minus className="w-3 h-3" /> Stable
    </span>
  );
}

function ConfidenceBar({ value }) {
  const color = value >= 85 ? 'from-emerald-400 to-emerald-500' : value >= 65 ? 'from-amber-400 to-amber-500' : 'from-rose-400 to-rose-500';
  const shadow = value >= 85 ? 'shadow-emerald-500/50' : value >= 65 ? 'shadow-amber-500/50' : 'shadow-rose-500/50';
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800/80 rounded-full overflow-hidden border border-slate-200 dark:border-slate-700/50">
        <div className={`h-full rounded-full bg-gradient-to-r ${color} shadow-[0_0_8px_rgba(0,0,0,0.1)] dark:shadow-[0_0_8px_rgba(0,0,0,0.5)] ${shadow}`} style={{ width: value + '%' }} />
      </div>
      <span className="text-xs font-black text-slate-700 dark:text-slate-200 w-9 text-right">{value}%</span>
    </div>
  );
}

function MonthlySparkline({ trend }) {
  if (!trend || !trend.months || trend.months.length < 2) return null;
  const vals = trend.months.map(m => trend.monthly[m] || 0);
  const max = Math.max(...vals, 1);
  return (
    <div className="flex items-end gap-1.5 h-12 mt-1">
      {vals.map((v, i) => (
        <div key={i} className="flex flex-col items-center justify-end h-full flex-1 group">
          <div className="w-full flex items-end justify-center h-full pb-1">
            <div
              className={`w-full max-w-[12px] rounded-t-sm transition-all duration-500 ${
                trend.direction === 'improving' ? 'bg-emerald-500/80 group-hover:bg-emerald-400' : 
                trend.direction === 'worsening' ? 'bg-rose-500/80 group-hover:bg-rose-400' : 
                'bg-slate-200 dark:bg-slate-600/80 group-hover:bg-slate-300 dark:group-hover:bg-slate-500'
              }`}
              style={{ height: Math.max(4, (v / max) * 100) + '%' }}
            />
          </div>
          <span className="text-[9px] font-medium text-slate-400 dark:text-slate-500 mt-1">T{parseInt(trend.months[i].slice(5))}</span>
        </div>
      ))}
    </div>
  );
}

// ── Detail Panel ─────────────────────────────────────────────

function BehaviorDetailPanel({ behavior, trades, t, onClose, onFilterTrades }) {
  const [insight, setInsight] = useState(null);
  const [isLoadingInsight, setIsLoadingInsight] = useState(false);

  // Reset insight when behavior changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInsight(null);
  }, [behavior?.id]);

  if (!behavior) return null;
  const { impact, trend, coverage, confidence, relatedBehaviors, falsePositiveNote, evidenceQuality } = behavior;
  const isGood = behavior.category === 'good';
  const metrics = behavior.metrics;

  const handleEnrich = async () => {
    if (!trades || !behavior.affectedTradeIds) return;
    setIsLoadingInsight(true);
    setInsight(null);
    try {
      const affectedTrades = trades.filter(t => behavior.affectedTradeIds.includes(t.id));
      const res = await fetch('/api/ai/enrich-behavior', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          behavior: {
            id: behavior.id,
            name: t(behavior.nameKey) || behavior.nameKey,
            severity: behavior.severity
          },
          summary: {
            occurrences: behavior.occurrences,
            affectedRatio: fmtPct(behavior.affectedRatio || 0),
            impact_pnl: behavior.impact?.totalDamage,
            winRate_vs_baseline: `${fmtPct(behavior.impact?.winrate || 0)} vs ${fmtPct((behavior.impact?.winrate || 0) + (behavior.impact?.winrateDrop || 0))}`,
            trend: behavior.trend?.direction || 'N/A',
            confidence: fmtPct(behavior.confidence || 0)
          },
          evidence: Array.isArray(behavior.evidence) ? { observed: behavior.evidence } : (behavior.evidence || {}),
          trades: affectedTrades.slice(0, 5),
          dataCoverage: behavior.dataQuality ?? null,
          evidenceQuality: behavior.evidenceQuality ?? 'medium',
          tradingMonths: behavior.trend?.months?.length ?? null,
        })
      });
      const data = await res.json();
      if (res.ok && data.insight) {
        setInsight(data.insight);
      } else {
        setInsight('Không thể phân tích dữ liệu lúc này: ' + (data.error || 'Lỗi không xác định'));
      }
    } catch (err) {
      setInsight('Lỗi kết nối tới AI: ' + err.message);
    } finally {
      setIsLoadingInsight(false);
    }
  };


  return (
    <div className="mt-6 rounded-2xl border theme-border bg-white/80 dark:bg-slate-900/80 backdrop-blur-md p-6 animate-slide-up shadow-xl dark:shadow-2xl relative overflow-hidden">
      {/* Background glow effect */}
      <div className={`absolute top-0 right-0 w-64 h-64 opacity-10 dark:opacity-5 pointer-events-none blur-3xl rounded-full ${isGood ? 'bg-emerald-500' : 'bg-rose-500'} -translate-y-1/2 translate-x-1/4`}></div>

      {/* Header */}
      <div className="flex items-start justify-between mb-6 relative z-10">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className={`w-2 h-2 rounded-full ${isGood ? 'bg-emerald-400' : 'bg-rose-400'}`}></span>
            <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em]">
              {isGood ? t('bhDetailGood') : t('bhDetailBad')}
            </p>
          </div>
          <h4 className={`text-2xl font-black tracking-tight ${isGood ? 'text-emerald-500 dark:text-emerald-400' : 'text-slate-900 dark:text-white'}`}>
            {t(behavior.nameKey) || behavior.nameKey}
          </h4>
          <div className="flex items-center gap-2 mt-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
              {t('bhLevel')} {behavior.level}
            </span>
            <span className="text-xs font-medium text-slate-400 dark:text-slate-500 capitalize">
              {behavior.category}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {!isGood && (
            <button
              onClick={() => onFilterTrades && onFilterTrades(behavior.affectedTradeIds)}
              className="group flex items-center gap-1.5 text-xs bg-violet-100 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-500/20 text-violet-600 dark:text-violet-300 hover:bg-violet-200 dark:hover:bg-violet-500/20 px-4 py-2 rounded-xl font-bold transition-all cursor-pointer shadow-sm shadow-violet-500/5"
            >
              <Target className="w-3.5 h-3.5" />
              {t('bhFilterTrades')} ({behavior.affectedTradeIds?.length})
            </button>
          )}
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer border border-transparent hover:border-slate-200 dark:hover:border-slate-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
        {/* Col 1: Impact / Metrics */}
        <div className="bg-slate-50 dark:bg-slate-950/50 rounded-xl p-4 border border-slate-100 dark:border-slate-800/60">
          <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-1.5">
            <Activity className="w-3 h-3" /> WHY IT MATTERS (Impact)
          </p>
          {isGood && metrics ? (
            <div className="space-y-3">
              {'consistency' in metrics && (
                <div className="flex items-center justify-between py-1 border-b border-slate-200 dark:border-slate-800/50">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('bhConsistency')}</span>
                  <span className="text-sm font-black text-emerald-500 dark:text-emerald-400">{metrics.consistency}%</span>
                </div>
              )}
              {'protectedAmount' in metrics && metrics.protectedAmount > 0 && (
                <div className="flex items-center justify-between py-1 border-b border-slate-200 dark:border-slate-800/50">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('bhProtected')}</span>
                  <span className="text-sm font-black text-emerald-500 dark:text-emerald-400">+${metrics.protectedAmount}</span>
                </div>
              )}
              {'avgRr' in metrics && metrics.avgRr > 0 && (
                <div className="flex items-center justify-between py-1 border-b border-slate-200 dark:border-slate-800/50">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('bhAvgRr')}</span>
                  <span className="text-sm font-black text-sky-500 dark:text-sky-400">{metrics.avgRr}R</span>
                </div>
              )}
              {'winrate' in metrics && (
                <div className="flex items-center justify-between py-1 border-b border-slate-200 dark:border-slate-800/50">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('bhWinrate')}</span>
                  <span className="text-sm font-black text-emerald-500 dark:text-emerald-400">{metrics.winrate}%</span>
                </div>
              )}
            </div>
          ) : impact ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between py-1 border-b border-slate-200 dark:border-slate-800/50">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('bhTotalDamage')}</span>
                <span className={`text-base font-black ${impact.totalDamage < 0 ? 'text-rose-500 dark:text-rose-400' : 'text-emerald-500 dark:text-emerald-400'}`}>
                  {fmt$(impact.totalDamage)}
                </span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-200 dark:border-slate-800/50">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('bhAvgDamage')}</span>
                <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{fmt$(impact.avgDamage)}</span>
              </div>
              {impact.worstSingle < 0 && (
                <div className="flex items-center justify-between py-1 border-b border-slate-200 dark:border-slate-800/50">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('bhWorstSingle')}</span>
                  <span className="text-sm font-bold text-rose-500 dark:text-rose-400">{fmt$(impact.worstSingle)}</span>
                </div>
              )}
              <div className="flex items-center justify-between py-1 border-b border-slate-200 dark:border-slate-800/50">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('bhWinrate')}</span>
                <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{fmtPct(impact.winrate || 0)}</span>
              </div>
              {impact.profitFactor > 0 && (
                <div className="flex items-center justify-between py-1 border-b border-slate-200 dark:border-slate-800/50">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">PF</span>
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{impact.profitFactor.toFixed(2)}</span>
                </div>
              )}
              {impact.avgEntriesPerOccurrence && (
                <div className="flex items-center justify-between py-1 border-b border-slate-200 dark:border-slate-800/50">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('bhAvgEntries')}</span>
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{impact.avgEntriesPerOccurrence}</span>
                </div>
              )}
              {impact.isOpportunityCost && (
                <p className="text-[10px] text-amber-500 dark:text-amber-400/80 italic mt-2 flex items-start gap-1">
                  <Info className="w-3 h-3 shrink-0 mt-0.5" />
                  {impact.note}
                </p>
              )}
            </div>
          ) : null}
        </div>

        {/* Col 2: Evidence & Trend */}
        <div className="bg-slate-50 dark:bg-slate-950/50 rounded-xl p-4 border border-slate-100 dark:border-slate-800/60 flex flex-col space-y-4">
          
          {/* Trend Section */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                <BarChart2 className="w-3 h-3" /> {t('bhTrend')}
              </p>
              {trend && <TrendPill trend={trend} />}
            </div>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mb-2">
              Tần suất vi phạm theo tháng
            </p>
            <div className="bg-white dark:bg-slate-900/50 rounded-lg p-2 border border-slate-200 dark:border-slate-800/50">
              <MonthlySparkline trend={trend} />
            </div>
          </div>
          
          {/* Evidence Section */}
          <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800/50 flex-1">
            <div>
              <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5"><BrainCircuit className="w-3 h-3" /> EVIDENCE</span>
                <EvidenceBadge quality={evidenceQuality || 'medium'} />
              </p>
              
              <div className="bg-white dark:bg-slate-900/50 p-3 rounded-lg border border-slate-200 dark:border-slate-800/50 shadow-sm mt-3 mb-4">
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                      <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                      Observed
                    </span>
                    <span className="font-medium text-slate-700 dark:text-slate-200">
                      {behavior.evidence && !Array.isArray(behavior.evidence) ? behavior.evidence.observed?.length || 0 : 0} mục
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                      <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                      Declared
                    </span>
                    <span className="font-medium text-slate-700 dark:text-slate-200">
                      {behavior.evidence && !Array.isArray(behavior.evidence) ? behavior.evidence.declared?.length || 0 : 0} mục
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                      <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                      Context
                    </span>
                    <span className="font-medium text-slate-700 dark:text-slate-200">
                      {behavior.evidence && !Array.isArray(behavior.evidence) ? behavior.evidence.context?.length || 0 : 0} mục
                    </span>
                  </div>
                </div>
              </div>

              <ConfidenceBar value={Math.round((confidence || 0) * 100)} />
            </div>
            

          </div>
        </div>

        {/* Col 3: Related + Notes */}
        <div className="flex flex-col space-y-4">
          {relatedBehaviors && relatedBehaviors.length > 0 && (
            <div className="bg-slate-50 dark:bg-slate-950/50 rounded-xl p-4 border border-slate-100 dark:border-slate-800/60">
              <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                <BrainCircuit className="w-3 h-3" /> {t('bhRelated')}
              </p>
              <div className="flex flex-wrap gap-2">
                {relatedBehaviors.map(id => (
                  <span key={id} className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 text-[11px] text-slate-600 dark:text-slate-300 font-semibold cursor-default capitalize">
                    {id.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            </div>
          )}
          
          {falsePositiveNote && (
            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 shadow-inner">
              <div className="flex items-start gap-2.5">
                <div className="bg-amber-100 dark:bg-amber-500/20 p-1 rounded-md shrink-0">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase text-amber-600 dark:text-amber-500/80 tracking-wider mb-0.5">Guard</p>
                  <p className="text-xs text-amber-800 dark:text-amber-200/90 leading-relaxed font-medium">{falsePositiveNote}</p>
                </div>
              </div>
            </div>
          )}

          {/* AI Insights Section */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 border border-indigo-100 dark:border-indigo-500/20 shadow-inner flex flex-col h-full">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-black text-indigo-500 dark:text-indigo-400 uppercase tracking-widest flex items-center gap-1.5">
                <BrainCircuit className="w-4 h-4" /> BEHAVIOR INSIGHT
              </p>
              {!insight && !isLoadingInsight && !isGood && (
                <button
                  onClick={handleEnrich}
                  className="px-3 py-1 text-[10px] font-bold bg-indigo-500 text-white rounded-md shadow-md hover:bg-indigo-600 transition"
                >
                  ✨ Phân tích sâu
                </button>
              )}
            </div>

            {isLoadingInsight ? (
              <div className="flex items-center gap-2 text-xs font-medium text-indigo-400 animate-pulse mt-2">
                <div className="w-3 h-3 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin"></div>
                Đang nhờ AI phân tích các lệnh vi phạm...
              </div>
            ) : insight ? (
              <div className="text-xs font-medium text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed mt-1 flex-1">
                {insight}
              </div>
            ) : (
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 italic">
                {isGood ? 'Hành vi tốt không yêu cầu phân tích sâu.' : 'Bấm nút để AI phân tích chi tiết bối cảnh của lỗi này.'}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Full Width 'Why detected?' Section */}
      {behavior.evidence && !Array.isArray(behavior.evidence) && (
        <div className="mt-6 bg-slate-50 dark:bg-slate-950/50 rounded-xl p-5 border border-slate-100 dark:border-slate-800/60">
          <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-1.5">
            <BrainCircuit className="w-3.5 h-3.5" /> CHI TIẾT BẰNG CHỨNG PHÂN TÍCH (WHY DETECTED?)
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
            {behavior.evidence.observed?.length > 0 && (
              <div>
                <span className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                  Bằng chứng Dữ liệu (Observed)
                </span>
                <ul className="text-[12px] text-slate-600 dark:text-slate-400 list-disc pl-4 space-y-2">
                  {behavior.evidence.observed.map((e, i) => <li key={`obs-${i}`} className="leading-relaxed">{e}</li>)}
                </ul>
              </div>
            )}
            {behavior.evidence.context?.length > 0 && (
              <div>
                <span className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  Bối cảnh dữ liệu (Context)
                </span>
                <ul className="text-[12px] text-slate-600 dark:text-slate-400 list-disc pl-4 space-y-2">
                  {behavior.evidence.context.map((e, i) => <li key={`ctx-${i}`} className="leading-relaxed">{e}</li>)}
                </ul>
              </div>
            )}
            {behavior.evidence.declared?.length > 0 && (
              <div className="md:col-span-2">
                <span className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">
                  <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                  Tự Khai báo (Declared)
                </span>
                <ul className="text-[12px] text-slate-600 dark:text-slate-400 list-disc pl-4 space-y-2">
                  {behavior.evidence.declared.map((e, i) => <li key={`dec-${i}`} className="leading-relaxed">{e}</li>)}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* V1 backward compatibility */}
      {Array.isArray(behavior.evidence) && behavior.evidence.length > 0 && (
        <div className="mt-6 bg-slate-50 dark:bg-slate-950/50 rounded-xl p-5 border border-slate-100 dark:border-slate-800/60">
          <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-1.5">
            <BrainCircuit className="w-3.5 h-3.5" /> WHY DETECTED?
          </p>
          <ul className="text-[12px] text-slate-600 dark:text-slate-400 list-disc pl-4 space-y-2">
            {behavior.evidence.slice(0, 3).map((e, i) => <li key={`v1-${i}`} className="leading-relaxed">{e}</li>)}
          </ul>
        </div>
      )}

    </div>
  );
}

// ── Bad Behavior Row ──────────────────────────────────────────

function BadBehaviorRow({ behavior, rank, isActive, onClick, t }) {
  const damage = behavior.impact?.totalDamage || 0;
  const isOpCost = behavior.impact?.isOpportunityCost;
  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-3 p-3 rounded-xl border transition cursor-pointer group ${
        isActive
          ? 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/30 shadow-sm'
          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-600'
      }`}
    >
      {/* Rank */}
      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-black ${
        isActive ? 'bg-rose-500 dark:bg-rose-600 !text-white shadow-md shadow-rose-500/20' :
        rank === 1 ? 'bg-rose-500/20 text-rose-400' :
        rank === 2 ? 'bg-orange-500/20 text-orange-400' :
        'bg-amber-500/20 text-amber-400'
      }`}>{rank}</span>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className={`text-sm font-bold truncate ${isActive ? 'text-rose-600 dark:text-rose-300' : 'text-slate-900 dark:text-slate-200'}`}>
            {t(behavior.nameKey) || behavior.nameKey}
          </p>
          <TrendPill trend={behavior.trend} />
        </div>
        <p className="text-[10px] text-slate-500 dark:text-slate-500 mt-0.5">
          {(() => {
            const occ = behavior.occurrences;
            const trades = behavior.affectedTradeIds?.length || occ;
            const cat = behavior.category;
            const confVal = typeof behavior.confidence === 'object' && behavior.confidence !== null 
              ? Math.max(behavior.confidence.statistical || 0, behavior.confidence.declared || 0)
              : (behavior.confidence || 0);
            if (cat === 'sequence') {
              const label = trades === occ ? 'lệnh' : 'lần';
              return `${occ} ${label} · ${trades} lệnh · Confidence: ${Math.round(confVal * 100)}%`;
            }
            return `${occ} ${t('bhOccurrences')} · Confidence: ${Math.round(confVal * 100)}%`;
          })()}
        </p>
      </div>

      {/* Damage + status */}
      <div className="text-right shrink-0">
        <p className={`text-sm font-black ${isOpCost ? 'text-amber-500 dark:text-amber-400' : 'text-rose-500 dark:text-rose-400'}`}>
          {fmt$(damage)}
        </p>
        <StatusBadge status={behavior.status} severity={behavior.severity} />
      </div>

      <ChevronRight className={`w-4 h-4 text-slate-600 group-hover:text-slate-400 transition shrink-0 ${isActive ? 'rotate-90' : ''}`} />
    </div>
  );
}

// ── Good Behavior Row ─────────────────────────────────────────

function GoodBehaviorRow({ behavior, isActive, onClick, t }) {
  const m = behavior.metrics || {};
  return (
    <div
      onClick={onClick}
      className={`p-3 rounded-xl border transition cursor-pointer group ${
        isActive
          ? 'bg-emerald-500/10 border-emerald-500/30'
          : 'theme-inner-card theme-border hover:border-slate-600'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-bold ${isActive ? 'text-emerald-600 dark:text-emerald-300' : 'text-slate-900 dark:text-slate-200'}`}>
            {t(behavior.nameKey) || behavior.nameKey}
          </p>
          <div className="flex gap-3 mt-1.5 flex-wrap">
            {'consistency' in m && (
              <span className="text-xs font-black text-emerald-400">{m.consistency}% {t('bhConsistency')}</span>
            )}
            {'protectedAmount' in m && m.protectedAmount > 0 && (
              <span className="text-xs text-emerald-400">+${m.protectedAmount} {t('bhProtected')}</span>
            )}
            {'winrate' in m && (
              <span className="text-xs text-sky-400">{m.winrate}% WR</span>
            )}
            {'avgRr' in m && m.avgRr > 0 && (
              <span className="text-xs text-violet-400">{m.avgRr}R {t('bhAvgRr')}</span>
            )}
          </div>
        </div>
        <ChevronRight className={`w-4 h-4 text-slate-600 group-hover:text-slate-400 transition shrink-0 mt-0.5 ${isActive ? 'rotate-90' : ''}`} />
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────

export default function BehaviorIntelligence() {
  const t = useLanguageStore(state => state.t);
  const trades = useDashboardStore(state => state.trades);
  const setBehaviorFilterIds = useDashboardStore(state => state.setBehaviorFilterIds);
  
  const onFilterByBehavior = (tradeIds) => {
    setBehaviorFilterIds(tradeIds);
    document.getElementById('trade-list-section')?.scrollIntoView({ behavior: 'smooth' });
  };
  const [selectedId, setSelectedId] = useState(null);

  const { bad, good, dataQuality, dataCoverage } = useMemo(() => {
    const res = runBehaviorEngine(trades || []);
    res.bad.forEach(b => b.dataQuality = res.dataQuality);
    res.good.forEach(b => b.dataQuality = res.dataQuality);
    return res;
  }, [trades]);

  if (!trades || trades.length < 3 || (bad.length === 0 && good.length === 0)) return null;

  const selectedBehavior = [...bad, ...good].find(b => b.id === selectedId) || null;

  const handleSelect = (id) => {
    const next = id === selectedId ? null : id;
    setSelectedId(next);
    if (!next && onFilterByBehavior) onFilterByBehavior(null);
  };

  const handleFilterTrades = (ids) => {
    if (onFilterByBehavior) onFilterByBehavior(ids);
  };

  return (
    <div className="theme-card rounded-3xl p-6 shadow-xl w-full border theme-border mt-6 animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between border-b theme-border pb-4 mb-5">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-violet-500 dark:text-violet-400" />
          <h3 className="text-lg font-black text-slate-900 dark:text-white">{t('bhTitle')}</h3>
          <span className="px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-500/15 border border-violet-200 dark:border-violet-500/30 text-[10px] text-violet-600 dark:text-violet-400 font-bold uppercase">
            {t('bhEngineLabel')}
          </span>
          {dataCoverage != null && (
            <div className="group relative flex items-center">
              <span 
                className={`px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase cursor-help ${
                  dataCoverage >= 0.7 
                    ? 'bg-emerald-100 dark:bg-emerald-500/15 border-emerald-200 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                    : dataCoverage >= 0.4
                    ? 'bg-amber-100 dark:bg-amber-500/15 border-amber-200 dark:border-amber-500/30 text-amber-600 dark:text-amber-400'
                    : 'bg-rose-100 dark:bg-rose-500/15 border-rose-200 dark:border-rose-500/30 text-rose-500 dark:text-rose-400'
                }`}
              >
                DATA COVERAGE {Math.round(dataCoverage * 100)}%
              </span>
              <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-[180px] p-2 bg-slate-800 dark:bg-slate-700 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 pointer-events-none">
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-slate-800 dark:bg-slate-700 rotate-45 rounded-[2px]" />
                <p className="relative z-10 !text-white text-[11px] font-medium leading-relaxed text-center normal-case m-0">
                  {Math.round(dataCoverage * 100)}% lệnh có đủ context để phân tích sâu
                </p>
              </div>
            </div>
          )}
        </div>
        {selectedId && (
          <button
            onClick={() => { setSelectedId(null); if (onFilterByBehavior) onFilterByBehavior(null); }}
            className="text-[10px] theme-inner-card hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white px-2.5 py-1 rounded-lg border theme-border transition cursor-pointer font-semibold"
          >
            {t('clearFilter')}
          </button>
        )}
      </div>

      {/* Body */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* LEFT: Good Behaviors */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-widest">
            <CheckCircle2 className="w-4 h-4" />
            {t('bhWhatsWorking')}
          </div>
          {good.length > 0 ? (
            <div className="space-y-2">
              {good.map(b => (
                <GoodBehaviorRow
                  key={b.id}
                  behavior={b}
                  isActive={selectedId === b.id}
                  onClick={() => handleSelect(b.id)}
                  t={t}
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500 italic p-4 rounded-xl theme-inner-card border theme-border">
              {t('bhNoGoodData')}
            </p>
          )}
        </div>

        {/* RIGHT: Bad Behaviors */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-rose-400 font-bold text-xs uppercase tracking-widest">
            <AlertTriangle className="w-4 h-4" />
            {t('bhCostingYouMoney')}
          </div>
          {bad.length > 0 ? (
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {bad.map((b, idx) => (
                <BadBehaviorRow
                  key={b.id}
                  behavior={b}
                  rank={idx + 1}
                  isActive={selectedId === b.id}
                  onClick={() => handleSelect(b.id)}
                  t={t}
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500 italic p-4 rounded-xl theme-inner-card border theme-border">
              {t('bhNoBadData')}
            </p>
          )}
        </div>
      </div>

      {/* Detail Panel */}
      {selectedBehavior && selectedBehavior.id === 'compulsive_re_entry' ? (
        <ReEntryDetail
          behavior={selectedBehavior}
          onFilterTrades={handleFilterTrades}
          t={t}
        />
      ) : selectedBehavior && selectedBehavior.id === 'oversized' ? (
        <PositionSizingDetail
          behavior={selectedBehavior}
          onFilterTrades={handleFilterTrades}
          t={t}
        />
      ) : selectedBehavior && selectedBehavior.id === 'no_tp' ? (
        <NoTpDetail
          behavior={selectedBehavior}
          onFilterTrades={handleFilterTrades}
          onClose={() => { setSelectedId(null); if (onFilterByBehavior) onFilterByBehavior(null); }}
          t={t}
          trades={trades}
        />
      ) : selectedBehavior && selectedBehavior.id === 'no_sl' ? (
        <NoSlDetail
          behavior={selectedBehavior}
          onFilterTrades={handleFilterTrades}
          onClose={() => { setSelectedId(null); if (onFilterByBehavior) onFilterByBehavior(null); }}
          t={t}
          trades={trades}
        />
      ) : selectedBehavior && selectedBehavior.id === 'revenge_trading' ? (
        <RevengeDetail
          behavior={selectedBehavior}
          onFilterTrades={handleFilterTrades}
          onClose={() => { setSelectedId(null); if (onFilterByBehavior) onFilterByBehavior(null); }}
          t={t}
          trades={trades}
        />

      ) : selectedBehavior && selectedBehavior.id === 'dca' ? (
        <DcaDetail
          behavior={selectedBehavior}
          onFilterTrades={handleFilterTrades}
          onClose={() => { setSelectedId(null); if (onFilterByBehavior) onFilterByBehavior(null); }}
          t={t}
          trades={trades}
        />
      ) : selectedBehavior && selectedBehavior.id === 'counter_trend' ? (
        <CounterTrendDetail
          behavior={selectedBehavior}
          onFilterTrades={handleFilterTrades}
          onClose={() => { setSelectedId(null); if (onFilterByBehavior) onFilterByBehavior(null); }}
          t={t}
          trades={trades}
        />
      ) : selectedBehavior && selectedBehavior.id === 'pyramid_mismanagement' ? (
        <PyramidDetail
          behavior={selectedBehavior}
          onFilterTrades={handleFilterTrades}
          onClose={() => { setSelectedId(null); if (onFilterByBehavior) onFilterByBehavior(null); }}
          t={t}
          trades={trades}
        />
      ) : selectedBehavior ? (
        <BehaviorDetailPanel
          behavior={selectedBehavior}
          trades={trades}
          t={t}
          onClose={() => { setSelectedId(null); if (onFilterByBehavior) onFilterByBehavior(null); }}
          onFilterTrades={handleFilterTrades}
        />
      ) : null}
    </div>
  );
}
