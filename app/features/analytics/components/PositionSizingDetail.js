import React from 'react';
import { AlertTriangle, ShieldAlert, BarChart3, Clock, Hash, CheckCircle2, TrendingDown, Minus, Quote, Activity } from 'lucide-react';

function fmt$(n) {
  if (!n && n !== 0) return '$0';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '+';
  if (abs >= 1000) return sign + '$' + (abs / 1000).toFixed(1) + 'k';
  return sign + '$' + abs.toFixed(2);
}

function fmtR(n) {
  if (!n && n !== 0) return '0.00R';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '+';
  return sign + abs.toFixed(2) + 'R';
}

export function PositionSizingDetail({ behavior, onFilterTrades, t }) {
  const { classification, affectedTradeIds, confidence, metrics } = behavior;
  const { wow } = metrics || {};
  
  const isHarmful = classification === 'harmful' || classification === 'underperforming';

  // Defaults if wow is missing
  const damage = wow?.damage || {};
  const norm = wow?.normal || {};
  const anom = wow?.oversized || {};

  const totalDamage = damage.estimatedRiskAdjustedDamage || 0;
  const damagePerTrade = damage.damagePerTrade || 0;
  
  const normAvg = norm.avgPnL || 0;
  const anomAvg = anom.avgPnL || 0;
  
  // Calculate relative bars for PnL (Shift to positive scale for width if needed, or use absolute width with sign color)
  const maxPnL = Math.max(Math.abs(normAvg), Math.abs(anomAvg)) || 1;
  const normPnLPct = (Math.abs(normAvg) / maxPnL) * 100;
  const anomPnLPct = (Math.abs(anomAvg) / maxPnL) * 100;

  const normWinPct = (norm.winRate || 0) * 100;
  const anomWinPct = (anom.winRate || 0) * 100;

  const normWorst = norm.worstPnL || 0;
  const anomWorst = anom.worstPnL || 0;
  const maxWorst = Math.max(Math.abs(normWorst), Math.abs(anomWorst)) || 1;
  const normWorstPct = (Math.abs(normWorst) / maxWorst) * 100;
  const anomWorstPct = (Math.abs(anomWorst) / maxWorst) * 100;
  const normBest = norm.bestPnL || 0;
  const anomBest = anom.bestPnL || 0;
  const maxBest = Math.max(Math.abs(normBest), Math.abs(anomBest)) || 1;
  const normBestPct = (Math.abs(normBest) / maxBest) * 100;
  const anomBestPct = (Math.abs(anomBest) / maxBest) * 100;

  const top3 = anom.top3WorstTrades || [];

  return (
    <div className="mt-6 animate-slide-up grid grid-cols-1 lg:grid-cols-3 gap-6 relative">
      
      {/* Left Column: Hero & Profile */}
      <div className="lg:col-span-2 space-y-6">
        
        {/* HERO SECTION */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 border theme-border shadow-xl relative overflow-hidden flex flex-col items-center justify-center text-center">
           <AlertTriangle className="absolute -right-8 -bottom-8 w-64 h-64 text-rose-50 dark:text-rose-900/10 opacity-50 pointer-events-none" />
           
           {isHarmful ? (
             <>
               <h2 className="text-6xl md:text-7xl font-black tracking-tighter text-rose-600 dark:text-rose-500 mb-4">
                 {fmt$(anomWorst)}
               </h2>
               <p className="text-sm md:text-base font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                 Khoản lỗ nặng nhất trong 1 lệnh vượt size
               </p>
               <div className="mt-6 flex flex-wrap justify-center items-center gap-3">
                 <span className="px-4 py-2 bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded-xl text-sm font-bold border border-rose-100 dark:border-rose-800">
                   Gấp {Math.abs(normWorst) > 0 ? (Math.abs(anomWorst) / Math.abs(normWorst)).toFixed(1) : 0} lần <span className="text-rose-400 dark:text-rose-500 font-medium ml-1">so với mức lỗ lớn nhất khi đánh kỷ luật ({fmt$(normWorst)})</span>
                 </span>
               </div>
             </>
           ) : (
             <>
               <h2 className="text-6xl md:text-8xl font-black tracking-tighter text-slate-400 dark:text-slate-500 mb-4">
                 NEUTRAL
               </h2>
               <p className="text-sm md:text-base font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                 Chưa đủ dữ liệu hoặc không có chênh lệch đáng kể
               </p>
             </>
           )}
        </div>

        {/* HỒ SƠ THIỆT HẠI */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 border theme-border shadow-xl">
           <h4 className="text-sm font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-8 flex items-center gap-2">
             <BarChart3 className="w-5 h-5" /> HỒ SƠ THIỆT HẠI (QUY ĐỔI RA TIỀN)
           </h4>

           <div className="space-y-8">
              {/* TRUNG VỊ EXPECTANCY */}
              <div>
                 <p className="text-xs font-black uppercase text-slate-700 dark:text-slate-300 mb-4">
                   Lợi nhuận trung bình <span className="text-slate-400 font-medium normal-case">(Expectancy / lệnh)</span>
                 </p>
                 <div className="space-y-3 text-sm font-bold">
                    <div className="flex items-center gap-4">
                       <span className="w-24 text-rose-600 dark:text-rose-400">Vượt Size</span>
                       <div className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-full h-3 overflow-hidden">
                          <div className={`h-full ${anomAvg >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`} style={{ width: `${anomPnLPct}%` }}></div>
                       </div>
                       <span className={`w-20 text-right ${anomAvg >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{fmt$(anomAvg)}</span>
                    </div>
                    <div className="flex items-center gap-4">
                       <span className="w-24 text-slate-500">Bình thường</span>
                       <div className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-full h-3 overflow-hidden">
                          <div className={`h-full ${normAvg >= 0 ? 'bg-emerald-400' : 'bg-slate-400'}`} style={{ width: `${normPnLPct}%` }}></div>
                       </div>
                       <span className={`w-20 text-right ${normAvg >= 0 ? 'text-emerald-500' : 'text-slate-500'}`}>{fmt$(normAvg)}</span>
                    </div>
                 </div>
              </div>

              {/* THẮNG TỐI ĐA */}
              <div>
                 <p className="text-xs font-black uppercase text-slate-700 dark:text-slate-300 mb-4">
                   Thắng đậm nhất <span className="text-slate-400 font-medium normal-case">(Best Win)</span>
                 </p>
                 <div className="space-y-3 text-sm font-bold">
                    <div className="flex items-center gap-4">
                       <span className="w-24 text-rose-600 dark:text-rose-400">Vượt Size</span>
                       <div className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-full h-3 overflow-hidden">
                          <div className="h-full bg-emerald-500 opacity-60" style={{ width: `${anomBestPct}%` }}></div>
                       </div>
                       <span className="w-20 text-right text-emerald-600 dark:text-emerald-400">{fmt$(anomBest)}</span>
                    </div>
                    <div className="flex items-center gap-4">
                       <span className="w-24 text-slate-500">Bình thường</span>
                       <div className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-full h-3 overflow-hidden">
                          <div className="h-full bg-emerald-500" style={{ width: `${normBestPct}%` }}></div>
                       </div>
                       <span className="w-20 text-right text-emerald-500">{fmt$(normBest)}</span>
                    </div>
                 </div>
              </div>

              {/* TỈ LỆ THẮNG */}
              <div>
                 <p className="text-xs font-black uppercase text-slate-700 dark:text-slate-300 mb-4">
                   Tỉ lệ thắng <span className="text-slate-400 font-medium normal-case">(Win Rate)</span>
                 </p>
                 <div className="space-y-3 text-sm font-bold">
                    <div className="flex items-center gap-4">
                       <span className="w-24 text-rose-600 dark:text-rose-400">Vượt Size</span>
                       <div className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-full h-3 overflow-hidden">
                          <div className="h-full bg-rose-400" style={{ width: `${anomWinPct}%` }}></div>
                       </div>
                       <span className="w-20 text-right text-rose-600">{anomWinPct.toFixed(1)}%</span>
                    </div>
                    <div className="flex items-center gap-4">
                       <span className="w-24 text-slate-500">Bình thường</span>
                       <div className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-full h-3 overflow-hidden">
                          <div className="h-full bg-slate-400" style={{ width: `${normWinPct}%` }}></div>
                       </div>
                       <span className="w-20 text-right text-slate-500">{normWinPct.toFixed(1)}%</span>
                    </div>
                 </div>
              </div>

              {/* LỖ NẶNG NHẤT */}
              <div>
                 <p className="text-xs font-black uppercase text-slate-700 dark:text-slate-300 mb-4">
                   Mức lỗ nặng nhất <span className="text-slate-400 font-medium normal-case">(Worst Trade)</span>
                 </p>
                 <div className="space-y-3 text-sm font-bold">
                    <div className="flex items-center gap-4">
                       <span className="w-24 text-rose-600 dark:text-rose-400">Vượt Size</span>
                       <div className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-full h-3 overflow-hidden">
                          <div className="h-full bg-rose-600" style={{ width: `${anomWorstPct}%` }}></div>
                       </div>
                       <span className="w-20 text-right text-rose-600">{fmt$(anomWorst)}</span>
                    </div>
                    <div className="flex items-center gap-4">
                       <span className="w-24 text-slate-500">Bình thường</span>
                       <div className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-full h-3 overflow-hidden">
                          <div className="h-full bg-slate-400" style={{ width: `${normWorstPct}%` }}></div>
                       </div>
                       <span className="w-20 text-right text-slate-500">{fmt$(normWorst)}</span>
                    </div>
                 </div>
              </div>

           </div>
        </div>
      </div>

      {/* Right Column: Stats & Top Trades */}
      <div className="space-y-6 flex flex-col">
        
        {/* SMALL STAT CARDS */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border theme-border shadow-sm flex items-center justify-between">
           <div>
             <p className="text-xs font-bold text-slate-400 uppercase">Lệnh Vượt Size</p>
             <p className="text-2xl font-black text-slate-700 dark:text-slate-200 mt-1">{anom.count || 0}</p>
           </div>
           {onFilterTrades && (
             <button
                onClick={() => onFilterTrades(affectedTradeIds)}
                className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold rounded-lg transition-colors"
             >
                Lọc lệnh
             </button>
           )}
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border theme-border shadow-sm flex items-center justify-between">
           <div>
             <p className="text-xs font-bold text-slate-400 uppercase">Lệnh Lỗ (Oversized)</p>
             <p className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">{(anom.count - (anom.winCount || 0))}</p>
           </div>
           <span className="text-xs font-bold text-rose-500 bg-rose-50 dark:bg-rose-900/20 px-2 py-1 rounded-md">
             {100 - anomWinPct.toFixed(1)}%
           </span>
        </div>

        <div className="bg-rose-50 dark:bg-rose-900/20 rounded-3xl p-6 border border-rose-100 dark:border-rose-800/30">
           <p className="text-xs font-bold text-rose-500/80 dark:text-rose-400/80 uppercase">Tổng tiền thiệt hại (Ước tính)</p>
           <p className="text-4xl font-black text-rose-600 dark:text-rose-400 mt-2">
             {totalDamage > 0 ? '-' : ''}{fmt$(totalDamage).replace('-', '').replace('+', '')}
           </p>
        </div>

        {/* TOP 3 WORST TRADES */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border theme-border shadow-xl flex-1">
           <h4 className="text-sm font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest mb-2 flex items-center gap-2">
             <ShieldAlert className="w-5 h-5 text-rose-500" /> TOP 3 LỆNH LỖ NẶNG NHẤT
           </h4>
           <p className="text-xs text-slate-500 mb-6 leading-relaxed">
             Một số ít lệnh vi phạm có thể phá hủy thành quả của toàn bộ tài khoản.
           </p>

           <div className="space-y-3">
             {top3.length > 0 ? top3.map((t, idx) => (
               <div key={t.id || idx} className="flex items-center justify-between p-3 border border-slate-100 dark:border-slate-800 rounded-2xl">
                 <div className="flex items-center gap-3">
                   <span className="text-xs font-black text-slate-400">#{idx + 1}</span>
                   <span className="text-base font-black text-rose-600 dark:text-rose-400">{fmt$(t.pnl)}</span>
                 </div>
                 <div className="flex items-center gap-2">
                   <span className="text-[10px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">{t.asset}</span>
                   <span className="text-[10px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">{t.size} Lot</span>
                 </div>
               </div>
             )) : (
               <p className="text-sm text-slate-400 italic">Không có dữ liệu chi tiết lệnh.</p>
             )}
           </div>
        </div>
      </div>

      {/* QUOTE SECTION (AI TRADING COACH STYLE) */}
      <div className="lg:col-span-3 mt-4 relative">
         <div className="absolute top-6 left-6 md:top-8 md:left-8">
            <Quote className="w-16 h-16 text-rose-500/10 dark:text-rose-400/10 fill-current transform -scale-x-100" />
         </div>
         <div className="bg-rose-50/50 dark:bg-rose-500/5 rounded-2xl p-8 px-8 md:px-16 border border-rose-100 dark:border-rose-500/10 flex flex-col justify-center">
            <p className="text-slate-700 dark:text-slate-300 text-lg md:text-xl font-medium leading-relaxed italic relative z-10 mt-4 md:mt-2">
              "Quan trọng không phải là bạn đúng hay sai, mà là bạn kiếm được bao nhiêu tiền khi đúng và mất bao nhiêu tiền khi sai. Hậu quả cuối cùng của việc đánh lớn vượt mức cho phép là bào mòn tài khoản nhanh gấp nhiều lần tốc độ bạn có thể kiếm lại khi đánh đúng kỷ luật."
            </p>
            <div className="mt-8 flex items-center gap-3">
               <div className="w-10 h-10 rounded-full bg-gradient-to-br from-rose-400 to-rose-600 flex items-center justify-center shadow-lg shadow-rose-500/30">
                  <Activity className="w-5 h-5 text-white" />
               </div>
               <div>
                  <div className="text-sm font-bold text-slate-800 dark:text-slate-200">Behavior Intelligence</div>
                  <div className="text-[10px] font-bold text-rose-500 uppercase tracking-widest">AI TRADING COACH</div>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}
