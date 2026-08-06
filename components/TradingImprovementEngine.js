'use client';
import { useState, useEffect, useCallback } from 'react';
import {
  Zap, Target, CheckCircle2, ChevronRight, Loader2, RefreshCw,
  TrendingDown, TrendingUp, AlertTriangle, ShieldCheck, BarChart3, ArrowRight,
  BookCheck, Flame, ChevronUp, ChevronDown, ScanSearch, Eye
} from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';

// ─── Sub-components ────────────────────────────────────────────────────────────

function MetricCard({ label, value, sub, color = 'slate' }) {
  const colors = {
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    rose: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
    amber: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    sky: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
    slate: 'text-slate-300 bg-slate-800/40 border-slate-700/50',
  };
  return (
    <div className={`flex flex-col gap-1 px-4 py-3 rounded-xl border ${colors[color]}`}>
      <span className="text-[10px] uppercase tracking-widest font-semibold opacity-70">{label}</span>
      <span className="text-lg font-bold leading-none">{value}</span>
      {sub && <span className="text-[11px] opacity-60">{sub}</span>}
    </div>
  );
}

function HabitBadge({ habit, rank }) {
  const trendIcon = habit.trend === 'Increasing'
    ? <TrendingUp className="w-3 h-3 text-rose-400" />
    : habit.trend === 'Decreasing'
    ? <TrendingDown className="w-3 h-3 text-emerald-400" />
    : null;

  return (
    <div className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-slate-900/50 border border-slate-800/60">
      <div className="flex items-center gap-2.5">
        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-rose-500/15 text-rose-400 text-[10px] font-bold shrink-0">
          {rank}
        </span>
        <span className="text-sm text-slate-200 font-medium leading-tight">{habit.habit}</span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {trendIcon}
        <span className="text-xs font-mono text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
          {habit.frequency}×
        </span>
      </div>
    </div>
  );
}

function MissionItem({ text, completed, onToggle }) {
  return (
    <button
      onClick={onToggle}
      className={`w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-all cursor-pointer ${
        completed
          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
          : 'bg-slate-900/40 border-slate-800/60 text-slate-300 hover:border-slate-700'
      }`}
    >
      <span className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${
        completed ? 'bg-emerald-500 border-emerald-500' : 'border-slate-600'
      }`}>
        {completed && <span className="w-2 h-2 bg-white rounded-full" />}
      </span>
      <span className={`text-sm font-medium leading-relaxed ${completed ? 'line-through opacity-70' : ''}`}>
        {text}
      </span>
    </button>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function TradingImprovementEngine({ trades, activeTab }) {
  const { language, t } = useLanguage();
  const [state, setState] = useState('idle'); // idle | loading | done | error
  const [coachData, setCoachData] = useState(null);
  const [missionChecked, setMissionChecked] = useState({});
  const [errorMsg, setErrorMsg] = useState('');
  const [showDetails, setShowDetails] = useState(false);
  const [timeframe, setTimeframe] = useState('last_50');
  const tradeType = activeTab || 'ALL';

  // Load last saved session on mount
  useEffect(() => {
    async function loadLast() {
      try {
        const res = await fetch(`/api/engine/coach?type=${tradeType}`);
        const data = await res.json();
        if (data.success && data.data) {
          setCoachData(data.data);
          setState('done');
        }
      } catch (_) {}
    }
    loadLast();
  }, [tradeType]);

  const generateCoaching = useCallback(async () => {
    if (!trades || trades.length < 5) {
      setErrorMsg(t('needMin5Trades'));
      setState('error');
      return;
    }
    setState('loading');
    setErrorMsg('');
    try {
      const res = await fetch('/api/engine/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: tradeType, lang: language, timeframe }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || t('unknownError'));
      setCoachData({ coaching: data.data.coaching, context: data.data.context, sessionDate: new Date().toISOString().split('T')[0] });
      setMissionChecked({});
      setState('done');
    } catch (err) {
      setErrorMsg(err.message);
      setState('error');
    }
  }, [trades, tradeType, language, timeframe]);

  const toggleMission = (idx) => {
    setMissionChecked(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  // ── Render: Empty / Idle ─────────────────────────────────────────────────
  if (state === 'idle') {
    return (
      <div className="rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-500/5 to-fuchsia-500/5 p-6 flex flex-col items-center gap-4 text-center">
        <div className="w-12 h-12 rounded-2xl bg-violet-500/15 flex items-center justify-center">
          <Zap className="w-6 h-6 text-violet-400" />
        </div>
        <div>
          <h3 className="font-bold text-white text-base">Trading Improvement Engine</h3>
          <p className="text-sm text-slate-400 mt-1 max-w-xs mx-auto">
            {t('coachDescription')}
          </p>
        </div>
        <button
          onClick={generateCoaching}
          className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg shadow-violet-500/20"
        >
          <Zap className="w-4 h-4" /> {t('generatePlanBtn')}
        </button>
      </div>
    );
  }

  // ── Render: Loading ───────────────────────────────────────────────────────
  if (state === 'loading') {
    return (
      <div className="rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-500/5 to-fuchsia-500/5 p-8 flex flex-col items-center gap-4 text-center">
        <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
        <div>
          <p className="font-bold text-white">{t('analyzingData')}</p>
          <p className="text-xs text-slate-400 mt-1">Behavior Engine → Pattern Engine → Gemini Coach</p>
        </div>
      </div>
    );
  }

  // ── Render: Error ─────────────────────────────────────────────────────────
  if (state === 'error') {
    return (
      <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-5 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="font-bold text-rose-300 text-sm">{t('cannotGeneratePlan')}</p>
          <p className="text-xs text-slate-400 mt-1">{errorMsg}</p>
        </div>
        <button onClick={generateCoaching} className="text-xs text-slate-400 hover:text-white transition flex items-center gap-1 shrink-0">
          <RefreshCw className="w-3 h-3" /> {t('retryBtn')}
        </button>
      </div>
    );
  }

  // ── Render: Done ──────────────────────────────────────────────────────────
  const { coaching, context } = coachData || {};
  if (!coaching) return null;

  const actionPlan = Array.isArray(coaching.action_plan) ? coaching.action_plan : [];
  const improvementTrend = context?.improvementTrend || [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-violet-500/20 flex items-center justify-center">
            <Zap className="w-4 h-4 text-violet-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Trading Diagnosis (AI Coach)</h3>
            {coachData?.sessionDate && (
              <p className="text-[10px] text-slate-500">{t('diagnosedAt', { date: coachData.sessionDate })}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value)}
            className="bg-transparent border border-slate-700 text-slate-300 text-[11px] rounded-lg px-2 py-1.5 focus:outline-none focus:border-violet-500 cursor-pointer"
          >
            <option value="last_50">{t('last50Trades')}</option>
            <option value="last_30_days">{t('last30Days')}</option>
            <option value="all_time">{t('allTime')}</option>
          </select>
          <button
            onClick={generateCoaching}
            className="flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-white border border-slate-700 hover:border-slate-600 px-2.5 py-1.5 rounded-lg transition"
          >
            <RefreshCw className="w-3 h-3" /> {t('regenerateBtn')}
          </button>
        </div>
      </div>

      {/* NEW: Coach Memory Block */}
      {coaching.coach_memory && coaching.coach_memory.progress_comparison && (
        <div className="bg-gradient-to-r from-violet-500/10 to-fuchsia-500/10 border border-violet-500/30 p-4 rounded-2xl flex gap-3 mt-4 mb-2">
          <div className="w-8 h-8 rounded-full bg-violet-500/20 flex items-center justify-center shrink-0 border border-violet-500/30">
            <Zap className="w-4 h-4 text-violet-500 dark:text-violet-400" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-violet-600 dark:text-violet-400 uppercase tracking-widest block mb-1">AI Coach Memory</span>
            {coaching.coach_memory.last_session_recall && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{coaching.coach_memory.last_session_recall}</p>
            )}
            <p className="text-sm text-slate-800 dark:text-slate-200 font-medium">{coaching.coach_memory.progress_comparison}</p>
          </div>
        </div>
      )}

      {/* 1. Trading Profile & Health */}
      <div className="flex flex-col md:flex-row gap-4 mt-2">
        <div className="theme-inner-card border theme-border rounded-2xl p-5 shadow-lg flex-1 md:flex-[0.4] flex flex-col justify-center">
          <div className="flex justify-between items-start mb-4">
            <div>
              <span className="text-[10px] uppercase tracking-widest font-bold text-slate-400 block mb-1">Trading Health</span>
              <div className="flex items-baseline gap-2">
                <span className={`text-5xl font-black ${coaching.health?.current_score >= 80 ? 'text-emerald-500 dark:text-emerald-400' : coaching.health?.current_score >= 50 ? 'text-amber-500 dark:text-amber-400' : 'text-rose-500 dark:text-rose-400'}`}>
                  {coaching.health?.current_score || coaching.health_score || 0}
                </span>
                <div className="flex flex-col">
                  <span className="text-xs text-slate-500 font-bold leading-none">/ 100</span>
                  {coaching.health?.status && (
                    <span className={`text-[10px] font-black uppercase mt-1 leading-none ${coaching.health.current_score >= 80 ? 'text-emerald-500' : coaching.health.current_score >= 50 ? 'text-amber-500' : 'text-rose-500'}`}>
                      {coaching.health.status}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          <div className="space-y-2 mt-auto">
            {['discipline', 'risk', 'execution', 'psychology'].map(metric => {
              const score = coaching.health?.[metric] || 0;
              return (
                <div key={metric} className="flex items-center justify-between text-xs font-medium">
                  <span className="text-slate-500 dark:text-slate-400 capitalize w-20">{t(`health${metric.charAt(0).toUpperCase() + metric.slice(1)}`, { defaultValue: metric })}</span>
                  <div className="flex-1 mx-3 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${score >= 80 ? 'bg-emerald-400' : score >= 50 ? 'bg-amber-400' : 'bg-rose-400'}`} style={{ width: `${score}%` }}></div>
                  </div>
                  <span className="text-slate-700 dark:text-slate-300 w-6 text-right">{score}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 2. AI Diagnosis */}
        <div className="flex-1 rounded-2xl bg-gradient-to-br from-rose-600/15 to-orange-600/10 border border-rose-500/25 p-5 flex flex-col justify-center shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 bg-slate-800/10 border-b border-l border-slate-500/20 px-3 py-1 rounded-bl-xl">
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" /> {t('basedOnTrades', { count: context?.summary?.totalTrades || 0 })}
            </span>
          </div>
          
          <div className="flex items-center gap-1.5 mb-2 mt-2">
            <AlertTriangle className="w-4 h-4 text-rose-500 dark:text-rose-400" />
            <span className="text-[10px] font-bold text-rose-500 dark:text-rose-400 uppercase tracking-widest">{t('aiDiagnosis')}</span>
          </div>
          <h4 className="text-3xl font-black text-slate-900 dark:text-white mb-3">{coaching.diagnosis?.disease || coaching.biggest_disease}</h4>
          
          {/* Diagnosis Flow */}
          <div className="space-y-3 mb-4">
            <div className="flex gap-3">
               <div className="w-1 bg-rose-500/30 rounded-full shrink-0"></div>
               <div className="space-y-3 text-sm text-slate-800 dark:text-slate-200">
                  {coaching.diagnosis?.evidence && (
                    <div><span className="text-[10px] font-bold text-rose-500 dark:text-rose-400 uppercase block mb-0.5">{t('evidence')}</span><p>{Array.isArray(coaching.diagnosis.evidence) ? coaching.diagnosis.evidence[0] : coaching.diagnosis.evidence}</p></div>
                  )}
                  {(coaching.diagnosis?.reason || coaching.diagnosis?.reasoning) && (
                    <div><span className="text-[10px] font-bold text-rose-500 dark:text-rose-400 uppercase block mb-0.5">{t('rootCause')}</span><p>{coaching.diagnosis.reason || coaching.diagnosis.reasoning}</p></div>
                  )}
                  {coaching.diagnosis?.trigger && (
                    <div><span className="text-[10px] font-bold text-rose-500 dark:text-rose-400 uppercase block mb-0.5">{t('trigger')}</span><p>{coaching.diagnosis.trigger}</p></div>
                  )}
               </div>
            </div>
          </div>
          
          
          <div className="flex gap-6 mt-auto pt-3 border-t border-rose-500/15">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 block mb-0.5">{t('impactScore')}</span>
              <span className="text-xl font-bold text-slate-800 dark:text-slate-200">{coaching.diagnosis?.impact_score || 0}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 block mb-0.5">{t('lossPercent')}</span>
              <span className="text-xl font-bold text-slate-800 dark:text-slate-200">{coaching.diagnosis?.loss_percent || 0}%</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 block mb-0.5">{t('damageAmount')}</span>
              <span className="text-xl font-bold text-rose-600 dark:text-rose-400">-${coaching.diagnosis?.loss_usd || coaching.cost_usd || 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* NEW: Trading Personality */}
      {coaching.trading_personality && typeof coaching.trading_personality === 'object' && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
          <div className="theme-inner-card border theme-border rounded-2xl p-4 shadow-sm flex flex-col items-center justify-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">{t('archetype')}</span>
            <span className="text-lg font-black text-violet-500">{coaching.trading_personality.archetype}</span>
          </div>
          <div className="theme-inner-card border theme-border rounded-2xl p-4 shadow-sm flex flex-col justify-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{t('execution')}</span>
            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{coaching.trading_personality.execution_style}</span>
          </div>
          <div className="theme-inner-card border theme-border rounded-2xl p-4 shadow-sm flex flex-col justify-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{t('emotion')}</span>
            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{coaching.trading_personality.emotion}</span>
          </div>
          <div className="theme-inner-card border theme-border rounded-2xl p-4 shadow-sm flex flex-col justify-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{t('risk')}</span>
            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{coaching.trading_personality.risk}</span>
          </div>
        </div>
      )}

      {/* NEW: Coach Timeline & Recovery Progress */}
      {context?.coachTimeline && context.coachTimeline.length > 0 && (
        <div className="theme-inner-card border theme-border rounded-2xl p-5 mt-4 shadow-inner">
           <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
            <span className="text-[10px] font-bold text-emerald-500 dark:text-emerald-400 uppercase tracking-widest">Recovery Progress & Timeline</span>
          </div>
          
          <div className="flex flex-col md:flex-row gap-6">
            {/* Timeline */}
            <div className="flex-1 space-y-3">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">History of Diagnosis</span>
              {context.coachTimeline.map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs font-mono text-slate-400 w-16">{item.session}</span>
                  <div className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-700"></div>
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{item.disease}</span>
                </div>
              ))}
            </div>
            
            {/* Recovery Graph */}
            {context.recoveryProgress && context.recoveryProgress.length > 0 && (
              <div className="flex-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">Frequency Trend (Current Issue)</span>
                <div className="flex items-end gap-2 h-20 mt-4">
                  {context.recoveryProgress.map((val, i) => {
                    const max = Math.max(...context.recoveryProgress);
                    const height = max > 0 ? (val / max) * 100 : 0;
                    return (
                      <div key={i} className="flex flex-col items-center gap-1 flex-1">
                        <div className="w-full bg-emerald-500/20 rounded-t-sm flex items-end justify-center" style={{ height: '100%' }}>
                           <div className="w-full bg-emerald-500 rounded-t-sm transition-all" style={{ height: `${height}%` }}></div>
                        </div>
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-400">{val}</span>
                      </div>
                    );
                  })}
                </div>
                {context.recoveryProgress.length > 1 && (
                  <p className="text-[10px] font-bold text-emerald-500 mt-2 text-center">
                    Cải thiện {Math.round(((context.recoveryProgress[0] - context.recoveryProgress[context.recoveryProgress.length - 1]) / context.recoveryProgress[0]) * 100)}%
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. Trading Story */}
      <div className="theme-inner-card border theme-border rounded-2xl p-5 shadow-inner mt-4">
        <div className="flex items-center gap-2 mb-3">
          <ScanSearch className="w-4 h-4 text-sky-500 dark:text-sky-400" />
          <span className="text-[10px] font-bold text-sky-500 dark:text-sky-400 uppercase tracking-widest">{t('reconstructScene')}</span>
        </div>
        <p className="text-sm text-slate-700 dark:text-slate-300 font-mono leading-relaxed bg-slate-900/5 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800 border-l-4 border-l-sky-400">
          {coaching.trading_story || "Không có dữ liệu kể chuyện."}
        </p>
      </div>

      {/* 4. Root Cause & Pattern */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        <div className="rounded-2xl bg-gradient-to-br from-violet-500/10 to-fuchsia-500/10 border border-violet-500/20 p-5 shadow-lg">
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-4 h-4 text-fuchsia-500 dark:text-fuchsia-400" />
            <span className="text-[10px] font-bold text-fuchsia-500 dark:text-fuchsia-400 uppercase tracking-widest">{t('rootCause')}</span>
          </div>
          <p className="text-base font-bold text-slate-900 dark:text-white leading-relaxed">
            "{coaching.root_cause || coaching.root_cause_punchy || coaching.root_cause_contradiction}"
          </p>
        </div>

        <div className="theme-inner-card border theme-border rounded-2xl p-5 shadow-inner flex flex-col justify-center">
          <div className="flex items-center gap-2 mb-2">
            <Eye className="w-4 h-4 text-amber-500 dark:text-amber-400" />
            <span className="text-[10px] font-bold text-amber-500 dark:text-amber-400 uppercase tracking-widest">{t('hiddenPattern')}</span>
          </div>
          <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
            {coaching.hidden_pattern}
          </p>
        </div>
      </div>

      {/* NEW: AI vs You */}
      {coaching.ai_vs_you && (
        <div className="rounded-2xl bg-slate-900/5 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 mt-4 shadow-xl text-center md:text-left">
          <div className="flex flex-col md:flex-row items-center gap-4">
            <div className="flex-1 space-y-2 w-full">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">{t('youThink')}</span>
              <p className="text-sm text-slate-700 dark:text-slate-400 italic">"{coaching.ai_vs_you.you_think}"</p>
            </div>
            <div className="shrink-0 w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center border border-slate-300 dark:border-slate-700 mx-auto">
              <span className="text-[10px] font-black text-slate-500 dark:text-slate-400">VS</span>
            </div>
            <div className="flex-1 space-y-2 w-full">
              <span className="text-[10px] font-bold text-sky-600 dark:text-sky-400 uppercase tracking-widest block">{t('aiSees')}</span>
              <p className="text-sm text-sky-700 dark:text-sky-100 font-medium">"{coaching.ai_vs_you.ai_sees}"</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        {/* 5. What If Simulation */}
        <div className="rounded-2xl bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/30 p-5 shadow-lg">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">{t('ifFixed')}</span>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between bg-white/50 dark:bg-slate-900/50 rounded-xl p-3 border border-emerald-500/20">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold">{t('profitFactor')}</span>
              <div className="flex items-center gap-2">
                {context?.summary?.profitFactor ? (
                  <>
                    <span className="text-sm text-slate-400 line-through">{context.summary.profitFactor}</span>
                    <ArrowRight className="w-3 h-3 text-emerald-500" />
                  </>
                ) : (
                  <span className="text-[10px] font-bold text-emerald-500 uppercase">{t('expected')}</span>
                )}
                <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">{coaching.what_if?.projected_pf || coaching.what_if_simulation?.projected_pf || '2.18'}</span>
              </div>
            </div>
            <div className="flex items-center justify-between bg-white/50 dark:bg-slate-900/50 rounded-xl p-3 border border-emerald-500/20">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold">{t('maxDrawdown')}</span>
              <div className="flex items-center gap-2">
                {context?.summary?.maxDrawdown ? (
                  <>
                    <span className="text-sm text-slate-400 line-through">-${context.summary.maxDrawdown}</span>
                    <ArrowRight className="w-3 h-3 text-emerald-500" />
                  </>
                ) : (
                  <span className="text-[10px] font-bold text-emerald-500 uppercase">{t('expected')}</span>
                )}
                <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">-${coaching.what_if?.projected_max_dd_usd || coaching.what_if_simulation?.projected_max_dd || 0}</span>
              </div>
            </div>
          </div>
        </div>

        {/* NEW: Prediction */}
        {coaching.prediction && (
          <div className="rounded-2xl bg-gradient-to-r from-rose-500/10 to-orange-500/10 border border-rose-500/30 p-5 shadow-lg flex flex-col">
            <div className="flex items-center gap-2 mb-4">
              <TrendingDown className="w-5 h-5 text-rose-600 dark:text-rose-400" />
              <span className="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-widest">{t('ifIgnored')}</span>
            </div>
            
            {coaching.prediction.explanation && (
              <p className="text-sm text-slate-700 dark:text-slate-300 mb-4">{coaching.prediction.explanation}</p>
            )}

            <div className="space-y-3 mt-auto">
              <div className="flex items-center justify-between bg-white/50 dark:bg-slate-900/50 rounded-xl p-3 border border-rose-500/20">
                <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold">{t('aiConfidence')}</span>
                <span className="text-lg font-black text-rose-600 dark:text-rose-400">{coaching.prediction.probability_percent || 0}%</span>
              </div>
              <div className="flex items-center justify-between bg-white/50 dark:bg-slate-900/50 rounded-xl p-3 border border-rose-500/20">
                <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold">{t('projectedPnl20Trades')}</span>
                <span className="text-lg font-black text-rose-600 dark:text-rose-400">-${Math.abs(coaching.prediction.if_ignored_pnl_usd || 0)}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 6. The Mission */}
      <div className="mt-4">
        <div 
          onClick={() => toggleMission(0)}
          className={`flex flex-col md:flex-row items-start md:items-center gap-4 p-5 rounded-2xl border transition-all cursor-pointer shadow-lg ${
            missionChecked[0] 
              ? 'bg-emerald-500/10 border-emerald-500/40 opacity-75'
              : 'bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-amber-500/40 hover:border-amber-500/60'
          }`}
        >
          <div className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center border-2 transition-colors ${
            missionChecked[0] ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-amber-500 text-amber-600 dark:text-amber-400'
          }`}>
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div className="flex-1 w-full">
            <span className={`text-[10px] font-black uppercase tracking-widest block mb-1 ${missionChecked[0] ? 'text-emerald-600' : 'text-amber-600 dark:text-amber-400'}`}>
              {t('thisWeekMission')}
            </span>
            <p className={`text-lg font-black leading-relaxed mb-2 ${missionChecked[0] ? 'text-emerald-600 dark:text-emerald-400 line-through' : 'text-slate-900 dark:text-white'}`}>
              {coaching.mission?.title || coaching.one_single_mission}
            </p>
            {coaching.mission?.why_this_mission && (
              <p className="text-xs text-slate-600 dark:text-slate-400 italic mb-4">
                "{coaching.mission.why_this_mission}"
              </p>
            )}
            
            {/* Impact stats */}
            {(coaching.mission?.success_probability || coaching.mission?.expected_health_improvement) && (
              <div className="flex items-center gap-4 mb-4">
                {coaching.mission.success_probability && (
                  <div className="flex items-center gap-1.5">
                    <Target className="w-4 h-4 text-emerald-500" />
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{t('successProbability')} <span className="text-emerald-500">{coaching.mission.success_probability}%</span></span>
                  </div>
                )}
                {coaching.mission.expected_health_improvement && (
                  <div className="flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4 text-sky-500" />
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{t('expectedHealth')} <span className="text-sky-500">+{coaching.mission.expected_health_improvement}</span></span>
                  </div>
                )}
              </div>
            )}
            
            {/* Progress Bar Mockup */}
            <div className="flex items-center gap-3 mt-4">
              <div className="flex-1 h-2.5 bg-slate-200 dark:bg-slate-800/80 rounded-full overflow-hidden shadow-inner">
                <div className="h-full bg-amber-500 rounded-full" style={{ width: '0%' }}></div>
              </div>
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap">
                0 / {coaching.mission?.duration_trades || 20} {t('trades')}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* NEW: Trading DNA */}
      {coaching.trading_dna && (
        <div className="theme-inner-card border theme-border rounded-2xl p-5 mt-4 shadow-inner text-sm">
          <div className="flex items-center gap-2 mb-4">
            <ScanSearch className="w-4 h-4 text-slate-500" />
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t('yourTradingDna')}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="space-y-1 bg-emerald-500/5 border border-emerald-500/10 p-4 rounded-xl">
              <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest block">{t('strength')}</span>
              <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{coaching.trading_dna.strength}</p>
            </div>
            <div className="space-y-1 bg-rose-500/5 border border-rose-500/10 p-4 rounded-xl">
              <span className="text-[10px] font-bold text-rose-500 uppercase tracking-widest block">{t('weakness')}</span>
              <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{coaching.trading_dna.weakness}</p>
            </div>
            {coaching.trading_dna.superpower && (
              <div className="space-y-1 bg-sky-500/5 border border-sky-500/10 p-4 rounded-xl">
                <span className="text-[10px] font-bold text-sky-500 uppercase tracking-widest block">{t('superpower')}</span>
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{coaching.trading_dna.superpower}</p>
              </div>
            )}
            {coaching.trading_dna.blind_spot && (
              <div className="space-y-1 bg-amber-500/5 border border-amber-500/10 p-4 rounded-xl">
                <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest block">{t('blindSpot')}</span>
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{coaching.trading_dna.blind_spot}</p>
              </div>
            )}
          </div>
          {coaching.trading_dna.ideal_style && (
            <div className="mb-4">
               <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">{t('idealStyle')}</span>
               <div className="inline-block px-3 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-bold text-slate-800 dark:text-slate-200">
                 {coaching.trading_dna.ideal_style}
               </div>
            </div>
          )}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
            <span className="text-[10px] font-bold text-violet-500 uppercase tracking-widest block mb-2">{t('coachConclusionTitle')}</span>
            <p className="font-bold text-slate-900 dark:text-white text-base">"{coaching.trading_dna.coach_conclusion}"</p>
          </div>
        </div>
      )}

      {coaching.brutal_advice && !coaching.trading_dna && (
        <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 text-center shadow-inner mt-4">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300 italic">
            "{coaching.brutal_advice}"
          </p>
        </div>
      )}
    </div>
  );
}
