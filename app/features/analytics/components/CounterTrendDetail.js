import React from 'react';
import { Target, TrendingDown, TrendingUp, X, AlertTriangle, ShieldCheck, Compass, Activity, ArrowLeftRight, CheckCircle, Search, Layers } from 'lucide-react';

function fmt$(n) {
  if (!n && n !== 0) return '$0';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '+';
  if (abs >= 1000) return sign + '$' + (abs / 1000).toFixed(1) + 'k';
  return sign + '$' + abs.toFixed(2);
}

function fmtPct(n) { return (n * 100).toFixed(1) + '%'; }

export function CounterTrendDetail({ behavior, onFilterTrades, onClose, trades, t }) {
  // Extract affected trades from behavior
  const affectedTrades = behavior.affectedTrades || [];
  const violationCount = affectedTrades.length;

  if (violationCount === 0) return null;

  let totalPnl = 0;
  let totalWins = 0;
  let totalLosses = 0;
  
  let explicitCount = 0;
  let confirmedCount = 0;
  let exposureOnlyCount = 0;
  let blindCount = 0;
  let proHtfCount = 0;

  affectedTrades.forEach(a => {
      const pnl = a.trade.pnl || 0;
      totalPnl += pnl;
      if (a.trade.status === 'WIN') totalWins++;
      if (a.trade.status === 'LOSS') totalLosses++;

      if (a.classification === 'EXPLICIT_VIOLATION') explicitCount++;
      if (a.classification === 'CONFIRMED_VIOLATION') confirmedCount++;
      if (a.classification === 'EXPOSURE_ONLY') exposureOnlyCount++;

      if (a.signals?.isBlindCounterTrend) blindCount++;
      if (a.signals?.isProHtf) proHtfCount++;
  });

  const winRate = violationCount > 0 ? totalWins / violationCount : 0;
  
  const isHighRisk = winRate < 0.4 || blindCount > 0;
  const isMediumRisk = winRate >= 0.4 && winRate < 0.6;
  const isLowRisk = winRate >= 0.6;

  const themeColor = isLowRisk ? 'emerald' : isMediumRisk ? 'amber' : 'rose';
  const riskLabel = isHighRisk ? 'NGUY HIỂM (CẢN TÀU)' : isMediumRisk ? 'TRUNG BÌNH' : 'KỸ NĂNG TỐT (REVERSAL)';

  return (
    <div className="mt-6 rounded-2xl border theme-border bg-white dark:bg-slate-900 shadow-xl dark:shadow-2xl relative overflow-hidden animate-slide-up">
      {/* Header section */}
      <div className="p-6 border-b theme-border relative z-10">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className={`w-2.5 h-2.5 rounded-full bg-${themeColor}-500`}></span>
              <p className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                PRICE ACTION INTELLIGENCE
              </p>
            </div>
            <h4 className={`text-3xl font-black tracking-tight mb-3 ${isHighRisk ? 'text-rose-600 dark:text-rose-500' : 'text-slate-900 dark:text-white'}`}>
              ĐÁNH NGƯỢC XU HƯỚNG
            </h4>
            <div className="flex items-center gap-2 text-xs font-semibold">
              <span className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 uppercase">
                MỨC ĐỘ RỦI RO: <span className={isHighRisk ? 'text-rose-500 font-black' : isMediumRisk ? 'text-amber-500 font-black' : 'text-emerald-500 font-black'}>{riskLabel}</span>
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => onFilterTrades && onFilterTrades(affectedTrades.map(t => t.tradeId))}
              className="flex items-center gap-1.5 bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300 hover:bg-violet-200 dark:hover:bg-violet-500/30 px-4 py-2 rounded-xl font-bold transition-all text-sm"
            >
              <Target className="w-4 h-4" />
              Lọc {violationCount} lệnh
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6 relative z-10 bg-slate-50/50 dark:bg-slate-900/50">
        
        {/* Top Two Boxes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Left Box: Overview Stats */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border theme-border shadow-sm flex flex-col justify-between items-center text-center">
            <div className="flex w-full items-center justify-around mb-6">
               <div className="flex flex-col items-center">
                 <span className="text-4xl font-black text-slate-900 dark:text-white flex items-baseline gap-1">
                   <span className="text-emerald-500">{totalWins}W</span>
                   <span className="text-xl text-slate-300">-</span>
                   <span className="text-rose-500">{totalLosses}L</span>
                 </span>
                 <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mt-1">Kết quả Exposure</span>
               </div>
               <div className="h-10 w-px bg-slate-200 dark:bg-slate-700"></div>
               <div className="flex flex-col items-center">
                 <span className={`text-4xl font-black ${isLowRisk ? 'text-emerald-500' : isHighRisk ? 'text-rose-500' : 'text-slate-900 dark:text-white'}`}>
                    {fmtPct(winRate)}
                 </span>
                 <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mt-1">Win Rate (Cản tàu)</span>
               </div>
            </div>

            <div className={`w-full bg-${themeColor}-50 dark:bg-${themeColor}-500/10 rounded-xl p-3 flex items-center justify-between border border-${themeColor}-100 dark:border-${themeColor}-500/20`}>
               <span className={`text-sm font-semibold text-${themeColor}-700 dark:text-${themeColor}-300`}>Lợi nhuận ròng (Total PnL)</span>
               <div className="flex items-center gap-2">
                 <span className={`text-xl font-black text-${themeColor}-600 dark:text-${themeColor}-400`}>
                   {fmt$(totalPnl)}
                 </span>
               </div>
            </div>
          </div>

          {/* Right Box: Classification Breakdown */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border theme-border shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2.5 mb-3">
                 <div className={`w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center shrink-0`}>
                   <Layers className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                 </div>
                 <h5 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                   Phân rã Trạng thái
                 </h5>
              </div>
              <ul className="text-sm font-medium text-slate-600 dark:text-slate-400 space-y-3 mt-4">
                 <li className="flex items-center justify-between p-2 rounded-lg bg-emerald-50/50 dark:bg-emerald-500/5 border border-emerald-100 dark:border-emerald-500/10">
                     <div className="flex items-center gap-2">
                         <ShieldCheck className="w-4 h-4 text-emerald-500" />
                         <span>Exposure Hợp lệ (Setup tốt, Win)</span>
                     </div>
                     <strong className="text-emerald-600 dark:text-emerald-400">{exposureOnlyCount} lệnh</strong>
                 </li>
                 <li className="flex items-center justify-between p-2 rounded-lg bg-rose-50/50 dark:bg-rose-500/5 border border-rose-100 dark:border-rose-500/10">
                     <div className="flex items-center gap-2">
                         <AlertTriangle className="w-4 h-4 text-rose-500" />
                         <span>Vi phạm Mù quáng (Thiếu POI, Loss)</span>
                     </div>
                     <strong className="text-rose-600 dark:text-rose-400">{confirmedCount} lệnh</strong>
                 </li>
                 <li className="flex items-center justify-between p-2 rounded-lg bg-amber-50/50 dark:bg-amber-500/5 border border-amber-100 dark:border-amber-500/10">
                     <div className="flex items-center gap-2">
                         <CheckCircle className="w-4 h-4 text-amber-500" />
                         <span>Tự nhận Lỗi (Explicit)</span>
                     </div>
                     <strong className="text-amber-600 dark:text-amber-400">{explicitCount} lệnh</strong>
                 </li>
              </ul>
            </div>
          </div>

        </div>

        {/* MTF Analysis Box */}
        {proHtfCount > 0 && (
            <div className="bg-indigo-50 dark:bg-indigo-500/10 rounded-2xl p-6 border border-indigo-100 dark:border-indigo-500/20">
            <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-black text-xs uppercase tracking-widest mb-3">
                <Compass className="w-4 h-4" /> ĐA KHUNG THỜI GIAN (MULTI-TIMEFRAME)
            </div>
            <p className="text-sm font-medium text-indigo-900 dark:text-indigo-200">
                Tuyệt vời! Bạn có <strong>{proHtfCount} lệnh</strong> đánh ngược sóng nhỏ nhưng <strong>đồng pha với sóng lớn (HTF)</strong>. 
                BRS ghi nhận đây là những lệnh Pullback kinh điển và không đánh giá là lỗi cản tàu.
            </p>
            </div>
        )}

        {/* Evidence Logs */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border theme-border shadow-sm">
            <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-black text-xs uppercase tracking-widest mb-4">
               <Search className="w-4 h-4" /> TRÍCH XUẤT BẰNG CHỨNG (EVIDENCE LOGS)
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                {behavior.evidence?.observed?.map((msg, i) => (
                    <div key={`obs-${i}`} className="p-3 text-sm text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-500/10 rounded-lg border border-rose-100 dark:border-rose-500/20">
                        {msg}
                    </div>
                ))}
                {behavior.evidence?.declared?.map((msg, i) => (
                    <div key={`dec-${i}`} className="p-3 text-sm text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10 rounded-lg border border-amber-100 dark:border-amber-500/20">
                        {msg}
                    </div>
                ))}
                {behavior.evidence?.context?.filter(msg => msg.includes('Trade #')).map((msg, i) => (
                    <div key={`ctx-${i}`} className="p-3 text-sm text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 rounded-lg border border-emerald-100 dark:border-emerald-500/20">
                        {msg}
                    </div>
                ))}
            </div>
        </div>

      </div>
    </div>
  );
}
