'use client';

import { useState, useEffect, useCallback } from 'react';
import { Brain, Moon, Smile, Zap, Target, AlertCircle, CheckCircle2, ChevronDown, ChevronUp, Lightbulb, TrendingUp } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';

// ── Star / Score Selector ─────────────────────────────────────────────────
const ScoreSelector = ({ options, value, onChange }) => (
  <div className="flex gap-2 flex-wrap">
    {options.map(opt => (
      <button
        key={opt.value}
        type="button"
        onClick={() => onChange(opt.value)}
        className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl border text-xs font-semibold transition cursor-pointer ${
          value === opt.value
            ? 'bg-violet-500/20 border-violet-400/50 text-violet-300'
            : 'theme-card theme-border text-slate-400 hover:theme-border'
        }`}
      >
        <span className="text-lg leading-none">{opt.emoji || '●'}</span>
        <span className={opt.color || ''}>{opt.label}</span>
      </button>
    ))}
  </div>
);

const colorMap = {
  sky: 'bg-sky-500/10 border-sky-500/20 text-sky-300',
  rose: 'bg-rose-500/10 border-rose-500/20 text-rose-300',
  emerald: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300',
  amber: 'bg-amber-500/10 border-amber-500/20 text-amber-300',
};

// ── Correlation Insight Card ──────────────────────────────────────────────
const InsightCard = ({ insight }) => (
  <div className={`flex items-start gap-2 p-3 rounded-xl border text-xs ${colorMap[insight.color] || colorMap.sky}`}>
    <span className="text-base shrink-0">{insight.emoji}</span>
    <div>
      <p className="font-bold">{insight.title}</p>
      <p className="text-[11px] opacity-80 mt-0.5">{insight.detail}</p>
    </div>
  </div>
);

// ── Main Component ────────────────────────────────────────────────────────
export default function MindsetJournal() {
  const { t } = useLanguage();
  const today = new Date().toISOString().split('T')[0];

  const MOOD_OPTIONS = [
    { value: 1, emoji: '😞', label: t('moodVeryBad') },
    { value: 2, emoji: '😕', label: t('moodNotGood') },
    { value: 3, emoji: '😐', label: t('moodNormal') },
    { value: 4, emoji: '😊', label: t('moodGood') },
    { value: 5, emoji: '🤩', label: t('moodExcellent') },
  ];

  const STRESS_OPTIONS = [
    { value: 1, label: t('stressCalm'), color: 'text-emerald-400' },
    { value: 2, label: t('stressMild'), color: 'text-emerald-300' },
    { value: 3, label: t('stressModerate'), color: 'text-amber-400' },
    { value: 4, label: t('stressHigh'), color: 'text-orange-400' },
    { value: 5, label: t('stressVeryHigh'), color: 'text-rose-400' },
  ];

  const [todaySession, setTodaySession] = useState(null);
  const [insights, setInsights] = useState([]);
  const [recentSessions, setRecentSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showCheckIn, setShowCheckIn] = useState(false);

  // Form state
  const [mood, setMood] = useState(3);
  const [sleep, setSleep] = useState(7);
  const [stress, setStress] = useState(2);
  const [goal, setGoal] = useState('');
  const [riskWarning, setRiskWarning] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/daily-sessions?days=30');
      const json = await res.json();
      if (json.success) {
        setInsights(json.data.insights || []);
        setRecentSessions(json.data.sessions || []);
        const todayData = json.data.sessions.find(s => s.session_date === today);
        if (todayData) {
          setTodaySession(todayData);
          setMood(todayData.mood_score);
          setSleep(todayData.sleep_hours);
          setStress(todayData.stress_level);
          setGoal(todayData.goal_note || '');
          setRiskWarning(todayData.risk_warning || '');
        }
      }
    } catch (e) { console.error(e); }
  }, [today]);

  useEffect(() => {
    (async () => {
      setLoading(false);
      await fetchData();
    })();
  }, [fetchData]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/daily-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_date: today,
          mood_score: mood,
          sleep_hours: sleep,
          stress_level: stress,
          goal_note: goal,
          risk_warning: riskWarning,
        })
      });
      const json = await res.json();
      if (json.success) {
        setTodaySession(json.data);
        setShowCheckIn(false);
        await fetchData();
      }
    } catch (e) { console.error(e); } finally { setSaving(false); }
  };

  const todayMoodInfo = MOOD_OPTIONS.find(o => o.value === (todaySession?.mood_score ?? mood));
  const todayStressInfo = STRESS_OPTIONS.find(o => o.value === (todaySession?.stress_level ?? stress));

  const hasHighRisk = todaySession && (todaySession.stress_level >= 4 || todaySession.sleep_hours < 6 || todaySession.mood_score <= 2);

  return (
    <div className="theme-card rounded-3xl p-5 shadow-xl space-y-4 relative overflow-hidden">

      {/* Decorative */}
      <div className="absolute -bottom-12 -left-12 w-40 h-40 bg-violet-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b theme-border">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <Brain className="w-4 h-4 text-violet-400" /> 🧘 {t('preSessionMindsetJournalTitle')}
        </h3>
        <button
          onClick={() => setShowCheckIn(v => !v)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[10px] font-bold transition cursor-pointer ${
            todaySession
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : 'bg-violet-500/20 border-violet-500/40 text-violet-300 animate-pulse'
          }`}
        >
          {todaySession ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
          {todaySession ? t('checkedInStatus') : t('checkInNowButton')}
        </button>
      </div>

      {/* High Risk Warning */}
      {hasHighRisk && !showCheckIn && (
        <div className="flex items-start gap-2 bg-rose-500/5 border border-rose-500/20 rounded-xl p-3 text-xs text-rose-300">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 animate-pulse" />
          <div>
            <p className="font-bold">⚠️ {t('mindsetRiskWarningTitle')}</p>
            <p className="opacity-80 mt-0.5">
              {todaySession?.stress_level >= 4 ? t('highStressRisk') : ''}
              {todaySession?.sleep_hours < 6 ? t('lowSleepRisk') : ''}
              {todaySession?.mood_score <= 2 ? t('badMoodRisk') : ''}
              {t('mindsetRiskAdvice')}
            </p>
          </div>
        </div>
      )}

      {/* Today Summary */}
      {todaySession && !showCheckIn && (
        <div className="grid grid-cols-3 gap-2">
          <div className="theme-inner-card/50 border theme-border rounded-xl p-3.5 text-center">
            <p className="text-xs text-slate-400 uppercase font-bold tracking-wider">{t('moodCardTitle')}</p>
            <p className="text-2xl mt-1">{todayMoodInfo?.emoji}</p>
            <p className="text-xs text-slate-300 mt-1 font-medium">{todayMoodInfo?.label}</p>
          </div>
          <div className="theme-inner-card/50 border theme-border rounded-xl p-3.5 text-center">
            <p className="text-xs text-slate-400 uppercase font-bold tracking-wider">{t('sleepCardTitle')}</p>
            <p className={`text-xl font-bold mt-1 ${todaySession.sleep_hours >= 7 ? 'text-emerald-400' : todaySession.sleep_hours >= 6 ? 'text-amber-400' : 'text-rose-400'}`}>
              {todaySession.sleep_hours}h
            </p>
            <p className="text-xs text-slate-300 mt-1 font-medium">{todaySession.sleep_hours >= 7 ? t('sufficientSleep') : t('insufficientSleep')}</p>
          </div>
          <div className="theme-inner-card/50 border theme-border rounded-xl p-3.5 text-center">
            <p className="text-xs text-slate-400 uppercase font-bold tracking-wider">{t('stressCardTitle')}</p>
            <p className={`text-xl font-bold mt-1 ${todayStressInfo?.color || 'text-white'}`}>{todaySession.stress_level}/5</p>
            <p className="text-xs text-slate-300 mt-1 font-medium">{todayStressInfo?.label}</p>
          </div>
          {todaySession.goal_note && (
            <div className="col-span-3 theme-inner-card/30 border theme-border rounded-xl p-3 flex items-start gap-2.5">
              <Target className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" />
              <p className="text-xs text-slate-200 leading-relaxed font-medium">{todaySession.goal_note}</p>
            </div>
          )}
        </div>
      )}

      {/* Check-in Form */}
      {showCheckIn && (
        <div className="space-y-4 theme-inner-card/50 border theme-border rounded-xl p-4">
          {/* Mood */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Smile className="w-3.5 h-3.5 text-amber-400" /> {t('moodQuestion')}
            </label>
            <ScoreSelector options={MOOD_OPTIONS} value={mood} onChange={setMood} />
          </div>

          {/* Sleep */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Moon className="w-3.5 h-3.5 text-sky-400" /> {t('sleepQuestion')}
              <span className={`ml-auto font-mono text-sm ${sleep >= 7 ? 'text-emerald-400' : sleep >= 6 ? 'text-amber-400' : 'text-rose-400'}`}>{sleep}h</span>
            </label>
            <input
              type="range" min="3" max="12" step="0.5"
              value={sleep}
              onChange={e => setSleep(parseFloat(e.target.value))}
              className="w-full accent-violet-500"
            />
            <div className="flex justify-between text-[10px] text-slate-600">
              <span>3h</span><span>6h</span><span>8h</span><span>10h</span><span>12h</span>
            </div>
          </div>

          {/* Stress */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-rose-400" /> {t('stressQuestion')}
            </label>
            <ScoreSelector options={STRESS_OPTIONS} value={stress} onChange={setStress} />
          </div>

          {/* Goal */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-violet-400" /> {t('goalQuestion')}
            </label>
            <input
              type="text"
              value={goal}
              onChange={e => setGoal(e.target.value)}
              placeholder={t('goalPlaceholder')}
              className="w-full theme-card theme-border text-white text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-violet-500 transition"
            />
          </div>

          {/* Risk warning */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-amber-400" /> {t('riskWarningQuestion')}
            </label>
            <input
              type="text"
              value={riskWarning}
              onChange={e => setRiskWarning(e.target.value)}
              placeholder={t('riskWarningPlaceholder')}
              className="w-full theme-card theme-border text-white text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-violet-500 transition"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white font-bold text-xs rounded-xl transition cursor-pointer"
            >
              {saving ? t('saving') : t('saveCheckInToday')}
            </button>
            <button
              onClick={() => setShowCheckIn(false)}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-400 text-xs rounded-xl transition cursor-pointer"
            >
              {t('cancel')}
            </button>
          </div>
        </div>
      )}

      {/* AI Correlation Insights */}
      {insights.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider flex items-center gap-1">
            <Lightbulb className="w-3 h-3 text-amber-400" /> {t('aiCorrelationTitle')}
          </p>
          {insights.map((ins, idx) => <InsightCard key={idx} insight={ins} />)}
        </div>
      )}

      {/* History Toggle */}
      {recentSessions.length > 0 && (
        <div>
          <button
            onClick={() => setShowHistory(v => !v)}
            className="w-full flex items-center justify-between text-[10px] text-slate-500 hover:text-slate-300 uppercase font-semibold tracking-wider transition cursor-pointer py-1"
          >
            <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3" /> {t('history30DaysTitle', { count: recentSessions.length })}</span>
            {showHistory ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {showHistory && (
            <div className="mt-2 space-y-1 max-h-56 overflow-y-auto pr-1">
              {recentSessions.map((s, idx) => {
                const moodInfo = MOOD_OPTIONS.find(o => o.value === s.mood_score);
                return (
                  <div key={idx} className="flex items-center gap-2 px-3 py-2 theme-inner-card rounded-xl text-xs">
                    <span className="text-slate-500 w-16 shrink-0 font-mono">{s.session_date.slice(5)}</span>
                    <span title={moodInfo?.label}>{moodInfo?.emoji}</span>
                    <span className="text-slate-400">{t('sleepHoursCount', { count: s.sleep_hours })}</span>
                    <span className={`${STRESS_OPTIONS.find(o => o.value === s.stress_level)?.color || ''}`}>
                      {t('stressLevelCount', { count: s.stress_level })}
                    </span>
                    {s.day_total_trades > 0 && (
                      <span className="ml-auto flex items-center gap-1">
                        <span className="text-slate-400">{t('countTrades', { count: s.day_total_trades })}</span>
                        <span className={s.day_pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                          {s.day_pnl >= 0 ? '+' : ''}{s.day_pnl}$
                        </span>
                        {s.day_winrate !== null && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${s.day_winrate >= 50 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                            {s.day_winrate}%
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Placeholder nếu chưa có session nào */}
      {!loading && recentSessions.length === 0 && !showCheckIn && (
        <p className="text-[11px] text-slate-600 italic text-center py-2">
          {t('mindsetJournalEmptyPrompt')}
        </p>
      )}
    </div>
  );
}
