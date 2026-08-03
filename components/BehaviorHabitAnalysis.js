'use client';

import React from 'react';
import { BookOpen, CheckCircle, AlertTriangle, HelpCircle, Info } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { hasContextNotes, isDcaTrade, extractTechnicalWeaknesses, extractTechnicalStrengths } from '@/lib/tradeUtils';



export default function BehaviorHabitAnalysis({
  trades,
  selectedStrengthFilter,
  setSelectedStrengthFilter,
  selectedWeaknessFilter,
  setSelectedWeaknessFilter
}) {
  const { t } = useLanguage();
  // Aggregate stats
  const strengthCounts = {};
  const weaknessCounts = {};

  trades.forEach(trade => {
    const currentTradeWeaknesses = new Set();

    // Check if it is a DCA trade (often indicates uncontrolled DCA / scaling in)
    if (isDcaTrade(trade)) {
      currentTradeWeaknesses.add("DCA mất kiểm soát (Nhồi lệnh / Gồng lỗ)");
    }

    // Bổ sung phân tích kỹ thuật (Technical Weaknesses/Strengths)
    const techStrengths = extractTechnicalStrengths(trade);
    techStrengths.forEach(str => {
      strengthCounts[str] = (strengthCounts[str] || 0) + 1;
    });

    // We now extract weaknesses for all trades (not just LOSS) because winning without SL is a weakness
    const techWeaknesses = extractTechnicalWeaknesses(trade);
    techWeaknesses.forEach(wk => currentTradeWeaknesses.add(wk));

    // Filter: only process AI notes for trades with proper context notes
    if (hasContextNotes(trade)) {
      let ai = trade.ai_evaluation;
      if (typeof ai === 'string') {
        try {
          ai = JSON.parse(ai);
        } catch (e) {}
      }
      if (ai) {
        const isGenericPhrase = (text) => {
          if (!text) return true;
          const t = text.toLowerCase();
          return t.includes('lệnh bị lỗ') || 
                 t.includes('kết thúc có lợi nhuận') || 
                 t.includes('cần kiểm tra lại điểm entry') || 
                 t.includes('không có ghi nhận điểm');
        };

        if (ai.strengths && Array.isArray(ai.strengths)) {
          ai.strengths.forEach(str => {
            const trimmed = str.trim();
            if (trimmed && !isGenericPhrase(trimmed)) {
              strengthCounts[trimmed] = (strengthCounts[trimmed] || 0) + 1;
            }
          });
        }
        if (ai.weaknesses && Array.isArray(ai.weaknesses)) {
          ai.weaknesses.forEach(wk => {
            const trimmed = wk.trim();
            if (trimmed && !isGenericPhrase(trimmed)) currentTradeWeaknesses.add(trimmed);
          });
        }
      }
    }

    // Add unique weaknesses from this trade into global counts
    currentTradeWeaknesses.forEach(wk => {
      weaknessCounts[wk] = (weaknessCounts[wk] || 0) + 1;
    });
  });

  const topStrengths = Object.entries(strengthCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const topWeaknesses = Object.entries(weaknessCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const handleStrengthClick = (name) => {
    if (selectedStrengthFilter === name) {
      setSelectedStrengthFilter(null);
    } else {
      setSelectedStrengthFilter(name);
      setSelectedWeaknessFilter(null); // Clear weakness filter
    }
  };

  const handleWeaknessClick = (name) => {
    if (selectedWeaknessFilter === name) {
      setSelectedWeaknessFilter(null);
    } else {
      setSelectedWeaknessFilter(name);
      setSelectedStrengthFilter(null); // Clear strength filter
    }
  };

  const hasData = topStrengths.length > 0 || topWeaknesses.length > 0;

  return (
    <div className="theme-card rounded-3xl p-5 shadow-xl space-y-4">
      <div className="flex items-center justify-between pb-2 border-b theme-border">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 relative">
          <BookOpen className="w-4 h-4 text-amber-400" /> 📊 {t('behaviorAnalysisTitle')}
          <div className="group flex items-center ml-1">
            <Info className="w-3.5 h-3.5 text-slate-500 hover:text-sky-400 cursor-help transition-colors" />
            <div className="absolute left-0 top-full mt-2 hidden group-hover:block w-[280px] sm:w-[320px] bg-slate-900 text-slate-200 text-[11px] p-3 rounded-xl shadow-2xl border border-slate-700/50 z-50 normal-case tracking-normal font-medium leading-relaxed pointer-events-none">
              <span className="font-bold text-sky-400 block mb-1">Tối ưu sức mạnh AI 💡</span>
              Dữ liệu CSV thô chỉ giúp nhận diện các lỗi cơ bản về kỹ thuật (như SL/TP, thời gian gồng). Để AI có thể <b>"bắt mạch" tâm lý và tư duy</b> thực sự của bạn, hãy bấm vào các lệnh quan trọng và bổ sung thêm <b>Ghi chú (Notes) / Cảm xúc</b> nhé!
            </div>
          </div>
        </h3>
        {(selectedStrengthFilter || selectedWeaknessFilter) && (
          <button 
            onClick={() => {
              setSelectedStrengthFilter(null);
              setSelectedWeaknessFilter(null);
            }}
            className="text-[10px] theme-inner-card hover:bg-slate-850 text-slate-400 hover:text-white px-2.5 py-1 rounded-lg border theme-border transition cursor-pointer font-semibold"
          >
            {t('clearFilter')}
          </button>
        )}
      </div>

      {!hasData ? (
        <div className="text-center py-8 text-slate-500 text-xs">
          <HelpCircle className="w-8 h-8 mx-auto mb-2 text-slate-600 animate-pulse" />
          {t('noBehaviorData')}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Top 10 Hành vi đúng (Strengths) */}
          <div className="space-y-3">
            <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-xs uppercase tracking-wider">
              <CheckCircle className="w-4 h-4 text-emerald-500" /> {t('topStrengths')}
            </div>
            <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
              {topStrengths.length === 0 ? (
                <p className="text-[11px] text-slate-500 italic">{t('noBehaviorData')}</p>
              ) : (
                topStrengths.map((item, idx) => {
                  const isActive = selectedStrengthFilter === item.name;
                  return (
                    <div
                      key={idx}
                      onClick={() => handleStrengthClick(item.name)}
                      className={`flex items-center justify-between gap-3 p-2.5 rounded-xl border text-xs cursor-pointer select-none transition ${
                        isActive
                          ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300 font-semibold'
                          : 'theme-inner-card theme-border hover:theme-border text-slate-300 hover:theme-card/40'
                      }`}
                    >
                      <span className="flex-1 break-words leading-relaxed font-medium">{idx + 1}. {item.name}</span>
                      <span className={`px-2.5 py-1 rounded-full font-mono text-xs font-bold shrink-0 ${
                        isActive ? 'bg-emerald-500 text-white shadow-sm' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      }`}>
                        {item.count}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Top 10 Sai lầm (Weaknesses) */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-rose-400 font-bold text-xs uppercase tracking-wider">
              <AlertTriangle className="w-4 h-4 text-rose-500" /> {t('topWeaknesses')}
            </div>
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {topWeaknesses.length === 0 ? (
                <p className="text-xs text-slate-500 italic">{t('noBehaviorData')}</p>
              ) : (
                topWeaknesses.map((item, idx) => {
                  const isActive = selectedWeaknessFilter === item.name;
                  return (
                    <div
                      key={idx}
                      onClick={() => handleWeaknessClick(item.name)}
                      className={`flex items-center justify-between gap-3 p-3 rounded-xl border text-xs cursor-pointer select-none transition ${
                        isActive
                          ? 'bg-rose-500/10 border-rose-500/40 text-rose-300 font-semibold'
                          : 'theme-inner-card theme-border hover:theme-border text-slate-300 hover:theme-card/40'
                      }`}
                    >
                      <span className="flex-1 break-words leading-relaxed font-medium">{idx + 1}. {item.name}</span>
                      <span className={`px-2.5 py-1 rounded-full font-mono text-xs font-bold shrink-0 ${
                        isActive ? 'bg-rose-500 text-white shadow-sm' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}>
                        {item.count} lần
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
