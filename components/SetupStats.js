'use client';

import { useState } from 'react';
import { useLanguage } from '@/lib/i18n/LanguageContext';

function hasContextNotes(trade) {
  const notes = (trade.user_notes || '').trim();
  if (!notes) return false;
  
  if (notes.length < 15) return false;
  
  const notesLower = notes.toLowerCase();
  const bulkKeywords = ['gộp lệnh', 'gộp', 'tổng cộng', 'lệnh gộp', 'chia đều', 'thua nhẹ', 'hòa hết', 'note gộp'];
  if (bulkKeywords.some(keyword => notesLower.includes(keyword))) {
    return false;
  }
  
  return true;
}

function normalizeSetupTag(tag) {
  if (!tag) return 'Discretionary';
  const cleanTag = tag.trim().toLowerCase();
  
  if (cleanTag.includes('fbo') || cleanTag.includes('fakeout') || cleanTag.includes('phá vỡ giả')) {
    return 'FBO';
  }
  if (cleanTag.includes('breakout') || cleanTag.includes('phá vỡ')) {
    return 'Breakout';
  }
  if (cleanTag.includes('lhretest') || cleanTag.includes('retest') || cleanTag.includes('pullback') || cleanTag.includes('hồi') || cleanTag.includes('test lại')) {
    return 'LHRetest';
  }
  if (
    cleanTag.includes('keylevel') || 
    cleanTag.includes('bounce') || 
    cleanTag.includes('hỗ trợ') || 
    cleanTag.includes('kháng cự') || 
    cleanTag.includes('cản') || 
    cleanTag.includes('support') || 
    cleanTag.includes('resistance')
  ) {
    return 'Keylevel';
  }
  if (cleanTag.includes('fomo') || cleanTag.includes('cảm xúc') || cleanTag.includes('đuổi')) {
    return 'FOMO';
  }
  if (cleanTag.includes('trend') || cleanTag.includes('xu hướng') || cleanTag.includes('ema') || cleanTag.includes('ma')) {
    return 'Trend Following';
  }
  
  return 'Discretionary';
}

import { 
  Target, 
  Award, 
  ShieldAlert, 
  Filter, 
  TrendingUp, 
  TrendingDown, 
  Info, 
  CheckCircle,
  HelpCircle,
  Clock,
  Zap,
  BookOpen,
  Maximize2
} from 'lucide-react';

export default function SetupStats({ stats, trades, isExpanded, onExpand }) {
  const { t } = useLanguage();
  // Filter States
  const [minWinRate, setMinWinRate] = useState(60);
  const [minTrades, setMinTrades] = useState(3);
  const [selectedSetup, setSelectedSetup] = useState(null);

  if (!stats || !stats.setups || stats.setups.length === 0) {
    return (
      <div className="theme-card rounded-3xl p-8 flex flex-col items-center justify-center text-center h-full min-h-[360px] space-y-5 border theme-border shadow-xl">
        <div className="p-4 bg-emerald-500/10 rounded-2xl text-emerald-400 border border-emerald-500/20 shadow-inner">
          <Target className="w-10 h-10 animate-pulse" />
        </div>
        
        <div className="space-y-2 max-w-md">
          <h3 className="text-lg font-extrabold text-white">{t('noSetupStatsTitle')}</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            {t('noSetupStatsDesc')}
          </p>
          <p className="text-[11px] text-emerald-400 font-medium bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-2.5 leading-relaxed">
            💡 {t('setupReassurance')}
          </p>
        </div>

        {/* Popular setup hashtags examples */}
        <div className="flex flex-col items-center gap-2">
          <span className="text-[11px] text-amber-400 font-bold uppercase tracking-wider">{t('setupTagsExampleTitle')}</span>
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            {['#Breakout', '#FBO', '#Keylevel', '#LHRetest', '#FOMO', '#Trend'].map(tag => (
              <span key={tag} className="text-xs font-mono px-2.5 py-1 rounded-xl bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-bold">
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* Helpful Tips Guidance Card */}
        <div className="theme-inner-card border theme-border rounded-2xl p-4 text-left w-full max-w-lg space-y-2.5 text-xs">
          <div className="flex items-center gap-2 text-amber-400 font-bold uppercase tracking-wider text-[11px]">
            <BookOpen className="w-4 h-4" /> {t('setupGuideTitle')}
          </div>
          <ul className="space-y-2 text-slate-300 leading-relaxed">
            <li className="flex items-start gap-2">
              <span className="text-emerald-400 font-bold">•</span>
              <span>{t('setupGuideMethod1')}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-400 font-bold">•</span>
              <span>{t('setupGuideMethod2')}</span>
            </li>
          </ul>
        </div>
      </div>
    );
  }

  const setups = stats.setups;

  // Filter setups to find "Golden Setups"
  const goldenSetups = setups.filter(
    (s) => s.winRate >= minWinRate && s.total >= minTrades && s.totalPnl > 0
  );

  // Helper to extract AI guidelines for a setup from history logs
  const getSetupDetails = (setupName) => {
    const setupTrades = trades.filter((t) => {
      if (!hasContextNotes(t)) return false;
      
      let ai = t.ai_evaluation;
      if (typeof ai === 'string') {
        try {
          ai = JSON.parse(ai);
        } catch (e) {
          ai = null;
        }
      }
      
      const rawTag = (ai && ai.setup_tag && ai.setup_tag !== 'Unclassified')
        ? ai.setup_tag
        : (t.setup_tag || 'Unclassified');
        
      return normalizeSetupTag(rawTag) === setupName;
    });
    const wins = setupTrades.filter((t) => t.status === 'WIN');
    const losses = setupTrades.filter((t) => t.status === 'LOSS');

    const keyStrengths = [];
    wins.forEach((t) => {
      let ai = t.ai_evaluation;
      if (typeof ai === 'string') {
        try {
          ai = JSON.parse(ai);
        } catch (e) {
          ai = null;
        }
      }
      if (ai?.strengths) {
        ai.strengths.forEach((s) => {
          if (!keyStrengths.includes(s)) keyStrengths.push(s);
        });
      }
    });

    const keyWeaknesses = [];
    losses.forEach((t) => {
      let ai = t.ai_evaluation;
      if (typeof ai === 'string') {
        try {
          ai = JSON.parse(ai);
        } catch (e) {
          ai = null;
        }
      }
      if (ai?.weaknesses) {
        ai.weaknesses.forEach((w) => {
          if (!keyWeaknesses.includes(w)) keyWeaknesses.push(w);
        });
      }
    });

    return {
      total: setupTrades.length,
      wins: wins.length,
      losses: losses.length,
      strengths: keyStrengths.slice(0, 3),
      weaknesses: keyWeaknesses.slice(0, 3),
      recentNotes: setupTrades.slice(0, 2).map(t => t.user_notes)
    };
  };

  return (
    <div className={`space-y-6 ${isExpanded ? 'h-full flex flex-col' : ''}`}>
      
      {/* 1. Filtering Controls Card */}
      <div className="theme-card rounded-3xl p-5 shadow-xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b theme-border">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Filter className="w-4 h-4 text-emerald-400" /> {t('setupFilterTitle')}
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-400 font-medium hidden sm:inline-block">{t('findGoldenSetup')}</span>
            {!isExpanded && onExpand && (
              <button onClick={onExpand} className="p-1 hover:bg-white/5 rounded-lg text-slate-400 hover:text-white transition" title={t('closeFullscreen')}>
                <Maximize2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Win Rate Slider */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400 font-semibold uppercase tracking-wider">{t('minWinRateLabel')}</span>
              <span className="text-emerald-400 font-bold font-mono">{minWinRate}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={minWinRate}
              onChange={(e) => setMinWinRate(Number(e.target.value))}
              className="w-full h-1.5 theme-inner-card rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
            <span className="text-[10px] text-slate-500 block">
              {t('minWinRateSub', { winRate: minWinRate })}
            </span>
          </div>

          {/* Min Trades Input */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400 font-semibold uppercase tracking-wider">{t('minTradesLabel')}</span>
              <span className="text-emerald-400 font-bold font-mono">{t('countTrades', { count: minTrades })}</span>
            </div>
            <input
              type="range"
              min="1"
              max="15"
              step="1"
              value={minTrades}
              onChange={(e) => setMinTrades(Number(e.target.value))}
              className="w-full h-1.5 theme-inner-card rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
            <span className="text-[10px] text-slate-500 block">
              {t('minTradesSub')}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Golden Setups Cards Section */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
          {t('goldenSetupsTitle', { count: goldenSetups.length })}
        </h4>
        
        {goldenSetups.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {goldenSetups.map((setup) => {
              const rrLabel = setup.actualRR === 999 ? 'N/A' : `1 : ${setup.actualRR}`;
              return (
                <div 
                  key={setup.setup}
                  onClick={() => setSelectedSetup(selectedSetup === setup.setup ? null : setup.setup)}
                  className={`cursor-pointer relative overflow-hidden bg-gradient-to-br from-amber-500/10 to-emerald-500/5 backdrop-blur-md border border-amber-500/30 hover:border-amber-500/50 rounded-2xl p-5 transition shadow-lg hover:shadow-amber-500/5 flex flex-col justify-between min-h-[160px] group ${
                    selectedSetup === setup.setup ? 'ring-1 ring-amber-500' : ''
                  }`}
                >
                  {/* Decorative golden badge */}
                  <div className="absolute right-3 top-3 bg-amber-500/10 text-amber-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-500/20 group-hover:scale-105 transition">
                    GOLDEN
                  </div>

                  <div className="space-y-1">
                    <span className="text-xs text-slate-400 font-bold uppercase font-mono tracking-wider">{t('digitizedSetup')}</span>
                    <h5 className="text-base font-bold text-white leading-tight group-hover:text-amber-300 transition">
                      {setup.setup}
                    </h5>
                  </div>

                  {/* Quantitative Metrics Grid */}
                  <div className="grid grid-cols-3 gap-2.5 mt-4 pt-3 border-t theme-border text-center font-mono">
                    <div className="theme-inner-card p-2.5 rounded-xl border theme-border">
                      <span className="text-slate-400 block text-xs uppercase font-sans font-bold">{t('winRate')}</span>
                      <span className="text-emerald-400 text-sm font-bold mt-0.5 block">{setup.winRate}%</span>
                    </div>
                    <div className="theme-inner-card p-2.5 rounded-xl border theme-border">
                      <span className="text-slate-400 block text-xs uppercase font-sans font-bold">{t('profitFactor')}</span>
                      <span className="text-white text-sm font-bold mt-0.5 block">
                        {setup.profitFactor === 999 ? '∞' : setup.profitFactor}
                      </span>
                    </div>
                    <div className="theme-inner-card p-2.5 rounded-xl border theme-border">
                      <span className="text-slate-400 block text-xs uppercase font-sans font-bold">{t('actualRR')}</span>
                      <span className="text-amber-400 text-sm font-bold mt-0.5 block">{rrLabel}</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-xs text-slate-400 mt-3 pt-1 font-medium">
                    <span>{t('totalProfit')}: <strong className="text-emerald-400 font-bold">+{setup.totalPnl.toLocaleString()} USD</strong></span>
                    <span className="text-slate-400 flex items-center gap-1">
                      <Info className="w-4 h-4 text-slate-400" /> {t('ruleDetails')}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-6 theme-inner-card border theme-border rounded-2xl text-center space-y-3">
            <ShieldAlert className="w-8 h-8 text-amber-400 mx-auto opacity-80" />
            <p className="text-xs text-slate-400 leading-relaxed max-w-md mx-auto">
              {t('noGoldenSetupMessage')}
            </p>
            <button
              onClick={() => { setMinWinRate(0); setMinTrades(1); }}
              className="px-3.5 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-bold transition cursor-pointer"
            >
              {t('resetFilterBtn')}
            </button>
          </div>
        )}
      </div>

      {/* 3. Setup Rules Guide (Expandable Details) */}
      {selectedSetup && (
        <div className="theme-card border border-amber-500/20 rounded-2xl p-5 shadow-2xl animate-fade-in space-y-4">
          <div className="flex justify-between items-center pb-3 border-b theme-border">
            <div>
              <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">{t('aiRecommendedRules')}</span>
              <h4 className="text-base font-bold text-white">{t('rulesTitleFor', { setup: selectedSetup })}</h4>
            </div>
            <button 
              onClick={() => setSelectedSetup(null)}
              className="text-slate-400 hover:text-white text-xs px-2.5 py-1 theme-inner-card border theme-border rounded-lg hover:bg-slate-800 cursor-pointer"
            >
              {t('close')}
            </button>
          </div>

          {(() => {
            const details = getSetupDetails(selectedSetup);
            return (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs leading-relaxed">
                {/* Rules Checklist */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold uppercase tracking-wider text-[10px]">
                    <CheckCircle className="w-4 h-4" /> {t('validConditions')}
                  </div>
                  {details.strengths.length > 0 ? (
                    <ul className="space-y-2 theme-inner-card p-3.5 rounded-xl">
                      {details.strengths.map((str, idx) => (
                        <li key={idx} className="flex gap-2 text-slate-350">
                          <span className="text-emerald-400 shrink-0 font-bold">✔</span>
                          <span>{str}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-slate-500 italic theme-inner-card/20 p-3 rounded-lg border theme-border">
                      {t('noValidRules')}
                    </p>
                  )}
                  <p className="text-[10px] text-slate-500 italic">
                    {t('validRulesHint')}
                  </p>
                </div>

                {/* Things to Avoid */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-rose-400 font-bold uppercase tracking-wider text-[10px]">
                    <ShieldAlert className="w-4 h-4" /> {t('avoidConditions')}
                  </div>
                  {details.weaknesses.length > 0 ? (
                    <ul className="space-y-2 theme-inner-card p-3.5 rounded-xl">
                      {details.weaknesses.map((weak, idx) => (
                        <li key={idx} className="flex gap-2 text-slate-350">
                          <span className="text-rose-400 shrink-0 font-bold">✘</span>
                          <span>{weak}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-slate-500 italic theme-inner-card/20 p-3 rounded-lg border theme-border">
                      {t('noErrorsForSetup')}
                    </p>
                  )}
                  <p className="text-[10px] text-slate-500 italic">
                    {t('avoidRulesHint')}
                  </p>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* 4. Complete Setups Leaderboard Table */}
      <div className="theme-card rounded-3xl overflow-hidden shadow-xl">
        <div className="px-6 py-4 border-b theme-border flex justify-between items-center theme-card/40">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Target className="w-4 h-4 text-emerald-400" /> {t('setupLeaderboardTitle')}
          </h3>
          <span className="text-xs text-slate-400 font-medium">{t('countSetupsRecorded', { count: setups.length })}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b theme-border text-xs font-bold text-slate-400 uppercase tracking-wider theme-inner-card/20">
                <th className="py-4 px-6">Setup</th>
                <th className="py-4 px-6 text-center">{t('totalTrades')}</th>
                <th className="py-4 px-6">{t('winRate')} (%)</th>
                <th className="py-4 px-6 text-right">{t('netPnL')} (USD)</th>
                <th className="py-4 px-6 text-right">{t('expectancy')}</th>
                <th className="py-4 px-6 text-center">{t('profitFactor')}</th>
                <th className="py-4 px-6 text-center">{t('actualRR')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-sm">
              {setups.map((row, index) => {
                const winRateColor = row.winRate >= 60 
                  ? 'text-emerald-400 font-bold' 
                  : row.winRate >= 45 
                    ? 'text-sky-400' 
                    : 'text-rose-400';

                const pnlColor = row.totalPnl > 0 
                  ? 'text-emerald-400 font-medium' 
                  : row.totalPnl < 0 
                    ? 'text-rose-400 font-medium' 
                    : 'text-slate-400';

                const expectancyColor = row.avgPnl > 0 
                  ? 'text-emerald-400/90' 
                  : row.avgPnl < 0 
                    ? 'text-rose-400/90' 
                    : 'text-slate-400';

                const rrLabel = row.actualRR === 999 ? 'N/A' : `1 : ${row.actualRR}`;

                return (
                  <tr 
                    key={index} 
                    onClick={() => setSelectedSetup(selectedSetup === row.setup ? null : row.setup)}
                    className="hover:bg-slate-850/40 cursor-pointer transition"
                  >
                    {/* Setup Name */}
                    <td className="py-4 px-6 font-semibold text-white">
                      {row.setup}
                    </td>

                    {/* Total Trades */}
                    <td className="py-4 px-6 text-center text-slate-300 font-mono">
                      {row.total}
                    </td>

                    {/* Win Rate */}
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <span className={`font-mono ${winRateColor}`}>{row.winRate}%</span>
                        <div className="w-16 bg-slate-800 h-1 rounded-full overflow-hidden shrink-0 hidden sm:block">
                          <div 
                            className={`h-full rounded-full ${
                              row.winRate >= 60 
                                ? 'bg-gradient-to-r from-emerald-500 to-teal-500' 
                                : row.winRate >= 45 
                                  ? 'bg-gradient-to-r from-sky-500 to-indigo-500' 
                                  : 'bg-gradient-to-r from-rose-500 to-orange-500'
                            }`}
                            style={{ width: `${row.winRate}%` }}
                          ></div>
                        </div>
                      </div>
                    </td>

                    {/* Total PnL */}
                    <td className={`py-4 px-6 text-right font-mono ${pnlColor}`}>
                      {row.totalPnl > 0 ? '+' : ''}{row.totalPnl.toLocaleString()}
                    </td>

                    {/* Expectancy */}
                    <td className={`py-4 px-6 text-right font-mono ${expectancyColor}`}>
                      {row.avgPnl > 0 ? '+' : ''}{row.avgPnl.toLocaleString()} USD
                    </td>

                    {/* Profit Factor */}
                    <td className="py-4 px-6 text-center font-mono">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                        row.profitFactor >= 2.0 
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                          : row.profitFactor >= 1.0 
                            ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20' 
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}>
                        {row.profitFactor === 999 ? '∞' : row.profitFactor.toFixed(2)}
                      </span>
                    </td>

                    {/* Actual R:R */}
                    <td className="py-4 px-6 text-center font-mono text-slate-300">
                      {rrLabel}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
