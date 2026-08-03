'use client';

import { Sparkles, BrainCircuit, HeartHandshake, CheckCircle2, AlertTriangle, ArrowRight, Lightbulb, Maximize2 } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';

export default function AIInsights({ trades, isExpanded, onExpand }) {
  const { t } = useLanguage();

  if (!trades || trades.length === 0) {
    return (
      <div className="theme-card rounded-3xl p-6 flex flex-col items-center justify-center text-center h-full min-h-[300px]">
        <BrainCircuit className="w-12 h-12 text-slate-600 mb-3 animate-pulse" />
        <h3 className="text-lg font-semibold text-slate-300">{t('noBehaviorData')}</h3>
      </div>
    );
  }

  // Helper functions for filtering and technical analysis
  const hasContextNotes = (trade) => {
    const notes = (trade.user_notes || '').trim();
    if (!notes || notes.length < 15) return false;
    const notesLower = notes.toLowerCase();
    const bulkKeywords = ['gộp lệnh', 'gộp', 'tổng cộng', 'lệnh gộp', 'chia đều', 'thua nhẹ', 'hòa hết', 'note gộp'];
    if (bulkKeywords.some(keyword => notesLower.includes(keyword))) return false;
    return true;
  };

  const isDcaTrade = (trade) => {
    const notes = (trade.user_notes || '').trim().toLowerCase();
    return notes.includes('giao dịch dca gộp') || notes.includes('dca gộp') || (trade.setup_tag || '').toLowerCase().includes('dca');
  };

  const extractTechnicalWeaknesses = (trade) => {
    const weaknesses = [];
    if (trade.status !== 'LOSS') return weaknesses;

    if (trade.stop_loss === null || trade.stop_loss === undefined || parseFloat(trade.stop_loss) === 0 || trade.stop_loss === '') {
      weaknesses.push(t('techNoSl'));
    }

    if (trade.trade_time && trade.exit_time) {
      const start = new Date(trade.trade_time).getTime();
      const end = new Date(trade.exit_time).getTime();
      if (!isNaN(start) && !isNaN(end)) {
        const diffHours = (end - start) / (1000 * 60 * 60);
        if (diffHours > 24) {
          weaknesses.push(t('techOvernightHold'));
        } else if (diffHours > 0 && diffHours < (5 / 60)) {
          weaknesses.push(t('techPanicExit'));
        }
      }
    }
    return weaknesses;
  };

  // Compile strengths and weaknesses statistics
  const strengthsCounts = {};
  const weaknessesCounts = {};
  let totalRating = 0;
  let ratedCount = 0;

  trades.forEach(trade => {
    let evalData = trade.ai_evaluation;
    if (typeof evalData === 'string') {
      try {
        evalData = JSON.parse(evalData);
      } catch (e) {
        evalData = null;
      }
    }

    if (evalData && evalData.decision_rating !== undefined) {
      totalRating += evalData.decision_rating;
      ratedCount += 1;
    }

    const currentTradeWeaknesses = new Set();
    
    // 1. Technical Weaknesses (All trades)
    if (isDcaTrade(trade)) {
      currentTradeWeaknesses.add(t('techUncontrolledDca'));
    }
    if (trade.status === 'LOSS') {
      const techWeaknesses = extractTechnicalWeaknesses(trade);
      techWeaknesses.forEach(wk => currentTradeWeaknesses.add(wk));
    }

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
    .slice(0, 3);

  const topWeaknesses = Object.entries(weaknessesCounts)
    .map(([text, count]) => ({ text, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  const avgRating = ratedCount > 0 ? Math.round((totalRating / ratedCount) * 10) / 10 : 0;

  // Rating Badge color and text
  let ratingLabel = t('ratingAverage');
  let ratingColor = 'text-sky-400 bg-sky-500/10 border-sky-500/20';
  if (avgRating >= 8) {
    ratingLabel = t('ratingDisciplined');
    ratingColor = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
  } else if (avgRating < 5) {
    ratingLabel = t('ratingNeedsImprovement');
    ratingColor = 'text-rose-400 bg-rose-500/10 border-rose-500/20';
  }

  return (
    <div className={`theme-card rounded-3xl p-6 shadow-2xl relative overflow-hidden ${isExpanded ? 'h-full flex flex-col' : 'space-y-6'}`}>
      
      {/* Background Decorative Blur */}
      <div className="absolute -top-12 -right-12 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>

      {/* Header */}
      <div className="flex items-center justify-between border-b theme-border pb-4 relative z-10">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <BrainCircuit className="w-5 h-5 text-emerald-400" /> {t('aiInsightsTitle')}
        </h3>
        
        <div className="flex items-center gap-3">
          {avgRating > 0 && (
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold ${ratingColor}`}>
              <span>{t('disciplineScoreLabel', { score: avgRating })}</span>
              <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
              <span>{ratingLabel}</span>
            </div>
          )}

          {!isExpanded && onExpand && (
            <button 
              onClick={onExpand} 
              className="p-1.5 hover:bg-white/5 rounded-lg text-slate-400 hover:text-white transition cursor-pointer"
              title={t('closeFullscreen')}
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Correct/Right Actions (Đúng) */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm uppercase tracking-wider">
            <CheckCircle2 className="w-4 h-4" /> {t('topStrengths')}
          </div>
          {topStrengths.length > 0 ? (
            <ul className="space-y-3">
              {topStrengths.map((item, idx) => (
                <li key={idx} className="flex gap-3 theme-inner-card p-3.5 rounded-xl text-slate-300 text-sm leading-relaxed">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400 font-mono text-xs font-bold">
                    {idx + 1}
                  </span>
                  <div>
                    <p className="font-semibold text-slate-200">{item.text}</p>
                    <p className="text-xs text-slate-500 mt-1">{t('tradeOccurrence', { count: item.count })}</p>
                  </div>
                </li>
              ))}
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
            <ul className="space-y-3">
              {topWeaknesses.map((item, idx) => (
                <li key={idx} className="flex gap-3 theme-inner-card border border-rose-500/10 p-3.5 rounded-xl text-slate-300 text-sm leading-relaxed">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-500/10 text-rose-400 font-mono text-xs font-bold">
                    {idx + 1}
                  </span>
                  <div>
                    <p className="font-semibold text-slate-200">{item.text}</p>
                    <p className="text-xs text-slate-500 mt-1">{t('tradeOccurrence', { count: item.count })}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500 italic theme-inner-card/20 p-4 rounded-xl border theme-border">
              {t('noBehaviorData')}
            </p>
          )}
        </div>
      </div>

      {/* AI Coach Actionable Advice Card */}
      {trades.length > 0 && (
        <div className="mt-4 theme-inner-card rounded-xl p-4 flex gap-4 items-start">
          <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg shrink-0">
            <Lightbulb className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-white">{t('aiActionableAdvice')}</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              {topWeaknesses.length > 0 
                ? t('aiInsightsAdviceImprove', { mistake: topWeaknesses[0].text })
                : t('aiInsightsAdviceGood')
              }
            </p>
          </div>
        </div>
      )}

    </div>
  );
}
