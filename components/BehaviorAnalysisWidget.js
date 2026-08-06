'use client';

import { CheckCircle2, AlertTriangle, BrainCircuit } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { hasContextNotes, isDcaTrade, extractTechnicalWeaknesses, extractTechnicalStrengths } from '@/lib/tradeUtils';

export default function BehaviorAnalysisWidget({ 
  trades,
  selectedStrengthFilter,
  setSelectedStrengthFilter,
  selectedWeaknessFilter,
  setSelectedWeaknessFilter,
}) {
  const { t } = useLanguage();

  if (!trades || trades.length === 0) {
    return null;
  }

  // Compile strengths and weaknesses statistics
  const strengthsCounts = {};
  const weaknessesCounts = {};

  trades.forEach(trade => {
    let evalData = trade.ai_evaluation;
    if (typeof evalData === 'string') {
      try {
        evalData = JSON.parse(evalData);
      } catch (e) {
        evalData = null;
      }
    }

    const currentTradeWeaknesses = new Set();
    
    // 1. Technical Strengths & Weaknesses (All trades)
    if (isDcaTrade(trade)) {
      currentTradeWeaknesses.add(t('techUncontrolledDca'));
    }
    const techStrengths = extractTechnicalStrengths(trade, t);
    techStrengths.forEach(str => {
      strengthsCounts[str] = (strengthsCounts[str] || 0) + 1;
    });

    const techWeaknesses = extractTechnicalWeaknesses(trade, t);
    techWeaknesses.forEach(wk => currentTradeWeaknesses.add(wk));

    const hasNotes = hasContextNotes(trade);

    // 2. AI Strengths & Weaknesses (ONLY if the trade has proper context notes)
    if (evalData && hasNotes) {
      if (Array.isArray(evalData.strengths)) {
        evalData.strengths.forEach(str => {
          strengthsCounts[str] = (strengthsCounts[str] || 0) + 1;
        });
      }
      if (Array.isArray(evalData.weaknesses)) {
        evalData.weaknesses.forEach(weak => {
          currentTradeWeaknesses.add(weak);
        });
      }
    }

    // Add unique weaknesses for this trade
    currentTradeWeaknesses.forEach(wk => {
      weaknessesCounts[wk] = (weaknessesCounts[wk] || 0) + 1;
    });
  });

  const topStrengths = Object.entries(strengthsCounts)
    .map(([text, count]) => ({ text, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const topWeaknesses = Object.entries(weaknessesCounts)
    .map(([text, count]) => ({ text, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  if (topStrengths.length === 0 && topWeaknesses.length === 0) {
    return null;
  }

  return (
    <div className="theme-card rounded-3xl p-6 shadow-xl w-full border theme-border mt-6 animate-slide-up">
      
      <div className="flex items-center justify-between border-b theme-border pb-4 mb-4">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <BrainCircuit className="w-5 h-5 text-sky-400" /> {t('behaviorTitle')}
        </h3>
        
        {(selectedStrengthFilter || selectedWeaknessFilter) && (
          <button 
            onClick={() => {
              if (setSelectedStrengthFilter) setSelectedStrengthFilter(null);
              if (setSelectedWeaknessFilter) setSelectedWeaknessFilter(null);
            }}
            className="text-[10px] theme-inner-card hover:bg-slate-800 text-slate-400 hover:text-white px-2.5 py-1 rounded-lg border theme-border transition cursor-pointer font-semibold"
          >
            {t('clearFilter')}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Good Habits (Đúng) */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm uppercase tracking-wider">
            <CheckCircle2 className="w-4 h-4" /> {t('topStrengths')}
          </div>
          {topStrengths.length > 0 ? (
            <ul className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {topStrengths.map((item, idx) => {
                const isActive = selectedStrengthFilter === item.text;
                return (
                <li 
                  key={idx} 
                  onClick={() => {
                    if (setSelectedStrengthFilter) setSelectedStrengthFilter(isActive ? null : item.text);
                    if (setSelectedWeaknessFilter) setSelectedWeaknessFilter(null);
                  }}
                  className={`flex gap-3 p-2.5 rounded-xl text-sm leading-relaxed border transition cursor-pointer items-center justify-between ${
                    isActive 
                      ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300 font-semibold' 
                      : 'theme-inner-card theme-border hover:theme-border text-slate-300 hover:bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-mono text-xs font-bold ${isActive ? 'bg-emerald-500 text-white shadow-sm' : 'bg-emerald-500/10 text-emerald-400'}`}>
                      {idx + 1}
                    </span>
                    <p className={`font-semibold text-xs ${isActive ? 'text-emerald-300' : 'text-slate-200'}`}>{item.text}</p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full font-mono text-xs font-bold shrink-0 border ${isActive ? 'bg-emerald-500 text-white shadow-sm border-transparent' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'}`}>
                    {item.count} {t('times', { defaultValue: 'lần' })}
                  </span>
                </li>
              )})}
            </ul>
          ) : (
            <p className="text-sm text-slate-500 italic theme-inner-card/20 p-4 rounded-xl border theme-border">
              {t('noBehaviorData')}
            </p>
          )}
        </div>

        {/* Wrong/Sub-optimal Actions (Sai) */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-rose-400 font-semibold text-sm uppercase tracking-wider">
            <AlertTriangle className="w-4 h-4" /> {t('topWeaknesses')}
          </div>
          {topWeaknesses.length > 0 ? (
            <ul className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {topWeaknesses.map((item, idx) => {
                const isActive = selectedWeaknessFilter === item.text;
                return (
                <li 
                  key={idx} 
                  onClick={() => {
                    if (setSelectedWeaknessFilter) setSelectedWeaknessFilter(isActive ? null : item.text);
                    if (setSelectedStrengthFilter) setSelectedStrengthFilter(null);
                  }}
                  className={`flex gap-3 p-2.5 rounded-xl text-sm leading-relaxed border transition cursor-pointer items-center justify-between ${
                    isActive
                      ? 'bg-rose-500/10 border-rose-500/40 text-rose-300 font-semibold'
                      : 'theme-inner-card theme-border hover:theme-border text-slate-300 hover:bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-mono text-xs font-bold ${isActive ? 'bg-rose-500 text-white shadow-sm' : 'bg-rose-500/10 text-rose-400'}`}>
                      {idx + 1}
                    </span>
                    <p className={`font-semibold text-xs ${isActive ? 'text-rose-300' : 'text-slate-200'}`}>{item.text}</p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full font-mono text-xs font-bold shrink-0 border ${isActive ? 'bg-rose-500 text-white shadow-sm border-transparent' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'}`}>
                    {item.count} {t('times', { defaultValue: 'lần' })}
                  </span>
                </li>
              )})}
            </ul>
          ) : (
            <p className="text-sm text-slate-500 italic theme-inner-card/20 p-4 rounded-xl border theme-border">
              {t('noBehaviorData')}
            </p>
          )}
        </div>

      </div>
    </div>
  );
}
