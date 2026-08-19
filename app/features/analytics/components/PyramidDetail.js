import React from 'react';
import { Target, Search, AlertTriangle, X, Terminal, BrainCircuit, Quote, Activity, Crosshair, TrendingUp, ShieldAlert } from 'lucide-react';

function fmt$(n) {
   if (!n && n !== 0) return '$0';
   const abs = Math.abs(n);
   const sign = n < 0 ? '-' : '+';
   if (abs >= 1000) return sign + '$' + (abs / 1000).toFixed(1) + 'k';
   return sign + '$' + abs.toFixed(2);
}

function fmtPct(n) { return (n * 100).toFixed(1) + '%'; }

export function PyramidDetail({ behavior, onFilterTrades, onClose }) {
   const { affectedTradeIds, metrics, baseline, estimatedEdgeDamage, episodes, aiInsight, evidence, profile } = behavior;
   const violationCount = affectedTradeIds?.length || 0;

   const worstTradePyramid = metrics?.worstEpisodePnl || 0;
   const worstTradeNormal = baseline?.worstEpisodePnl || -0.01;
   const normalLoss = baseline?.avgLoss || -0.01;
   const ratio = Math.max(1, (Math.abs(worstTradePyramid) / Math.abs(normalLoss))).toFixed(1);

   // Total Damage value: always negative, matching actual total PnL of affected trades
   const totalDamageVal = metrics?.totalPnl != null && metrics.totalPnl < 0
     ? metrics.totalPnl
     : -Math.abs(estimatedEdgeDamage || metrics?.totalPnl || 0);

   // Average size
   const initialSize = metrics?.avgInitialSize || 0;
   const pyramidTotalAvgSize = initialSize + (metrics?.avgAddedSize || 0);
   const normalSize = baseline?.avgInitialSize || 0;

   const top3 = [...(episodes?.details || [])].sort((a, b) => a.pnl - b.pnl).slice(0, 3);
   const mismanagedCount = episodes?.losses || 0;
   const mismanagedPct = episodes?.total ? (mismanagedCount / episodes.total) : 0;

   const evObserved = evidence?.observed || [];
   const evContext = evidence?.context || [];

   return (
      <div className="mt-6 rounded-3xl border theme-border bg-slate-50/50 dark:bg-slate-900 shadow-xl dark:shadow-2xl relative overflow-hidden animate-slide-up p-8">

         {/* Top Header Controls */}
         <div className="flex justify-between items-center mb-8">
            <div className="flex items-center gap-3">
               <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-amber-600 dark:text-amber-400" />
               </div>
               <div>
                  <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Hội Chứng Nhồi Thuận (Scale-in) Thất Bại</h2>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Hồ Sơ Thiệt Hại (Pain Profile)</p>
               </div>
            </div>
            <div className="flex gap-3">
               <button onClick={() => onFilterTrades && onFilterTrades(affectedTradeIds)} className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 px-4 py-2 rounded-xl font-bold text-sm transition-colors cursor-pointer">
                  <Crosshair className="w-4 h-4 text-amber-500" /> Bóc tách lệnh ({violationCount})
               </button>
               <button onClick={onClose} className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 transition-colors cursor-pointer">
                  <X className="w-5 h-5" />
               </button>
            </div>
         </div>

         <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* LEFT COLUMN (70%) */}
            <div className="lg:col-span-2 flex flex-col gap-6">

               {/* Worst Trade Box */}
               <div className="bg-white dark:bg-slate-800 rounded-3xl p-10 border border-amber-100 dark:border-amber-900/30 shadow-sm text-center relative overflow-hidden flex flex-col items-center justify-center min-h-[280px]">
                  <div className="absolute inset-0 flex items-center justify-center opacity-[0.02] pointer-events-none">
                     <AlertTriangle className="w-96 h-96 text-amber-500 transform translate-y-8" />
                  </div>
                  <h1 className="text-8xl font-black text-amber-600 dark:text-amber-500 tracking-tighter mb-4 relative z-10">{fmt$(worstTradePyramid)}</h1>
                  <p className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-6 relative z-10">
                     VẾT THƯƠNG TRÍ MẠNG (CHU KỲ NHỒI THUẬN TỆ NHẤT)
                  </p>
                  <div className="inline-block bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 px-6 py-2.5 rounded-full font-semibold text-sm border border-amber-200 dark:border-amber-500/30 relative z-10 shadow-sm">
                     Khoản lỗ phình to <strong className="font-black text-amber-800 dark:text-amber-200 text-base">Gấp {ratio} lần</strong> so với mức cắt lỗ kỷ luật trung bình ({fmt$(normalLoss)})
                  </div>
               </div>

               {/* AI Terminal - Coaching & Evidence */}
               <div className="bg-slate-50 dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 shadow-xl relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 to-rose-500"></div>
                  <div className="flex items-center gap-2 mb-6">
                     <Terminal className="w-5 h-5 text-amber-500" />
                     <span className="text-amber-500 font-mono text-xs font-bold tracking-widest">SYSTEM_EVALUATION_ROOT</span>
                  </div>

                  {/* Evidence Logs */}
                  {(evContext.length > 0 || evObserved.length > 0) && (
                     <div className="bg-slate-100 dark:bg-black/40 rounded-2xl p-5 border border-slate-200 dark:border-white/5">
                        <div className="text-xs font-mono text-slate-500 mb-3">&raquo; Trích xuất bằng chứng (Evidence Logs):</div>
                        <div className="space-y-2">
                           {[...evContext, ...evObserved].map((line, idx) => {
                              const isHighlight = line.includes('🚨') || line.includes('💥') || line.includes('📉') || line.includes('🪤');
                              const isBullet = line.trim().startsWith('•') || line.trim().startsWith('-');
                              const text = line.replace(/^[•-]\s*/, '');
                              return (
                                 <div key={idx} className={`font-mono text-sm flex gap-3 ${isHighlight ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-slate-700 dark:text-slate-400'}`}>
                                    <span className="text-slate-400 dark:text-slate-600 shrink-0">{`[LOG_${idx + 1}]`}</span>
                                    <span>{isBullet && <span className="text-amber-500 mr-2">›</span>}{text}</span>
                                 </div>
                              );
                           })}
                        </div>
                     </div>
                  )}
               </div>

            </div>

            {/* RIGHT COLUMN (30%) */}
            <div className="lg:col-span-1 flex flex-col gap-6">

               {/* Total Damage */}
               <div className="bg-amber-500 dark:bg-amber-600 rounded-3xl p-6 shadow-[0_8px_30px_rgba(245,158,11,0.3)] flex flex-col justify-center min-h-[150px] text-white relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-15">
                     <AlertTriangle className="w-20 h-20 text-white" />
                  </div>
                  <p className="text-xs font-black text-white/90 uppercase tracking-wider mb-1.5 relative z-10">TỔNG THIỆT HẠI</p>
                  <p className="text-3xl sm:text-4xl font-black text-white tracking-tight relative z-10 truncate">{fmt$(totalDamageVal)}</p>
                  <p className="text-sm font-medium text-white/90 mt-2 relative z-10">Lợi nhuận bị bốc hơi do nhồi thuận sai cách.</p>
               </div>

               {/* Stats Boxes */}
               <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border theme-border shadow-sm flex items-center justify-between">
                  <div>
                     <p className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">SỐ LẦN NHỒI THUẬN (EPISODES)</p>
                     <p className="text-3xl font-black text-slate-800 dark:text-white">{episodes?.total || 0}</p>
                  </div>
               </div>

               <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border theme-border shadow-sm flex items-center justify-between">
                  <div>
                     <p className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">SỐ CHU KỲ CHÁY LÃI / LỖ NẶNG</p>
                     <p className="text-3xl font-black text-amber-500">{mismanagedCount}</p>
                  </div>
                  <div className="text-xs font-bold bg-amber-50 dark:bg-amber-500/10 text-amber-600 px-3 py-1.5 rounded-lg border border-amber-100">
                     {fmtPct(mismanagedPct)} Fail
                  </div>
               </div>

               {/* Top 3 Worst Trades */}
               <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border theme-border shadow-sm flex-1">
                  <div className="flex items-center gap-2 mb-2 text-slate-900 dark:text-white font-black text-sm uppercase tracking-widest">
                     <Target className="w-5 h-5 text-amber-500" /> TOP 3 CỤM NHỒI "BAY LÃI"
                  </div>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-5 leading-relaxed">
                     Những đợt Scale-in tàn phá vị thế nhất
                  </p>

                  <div className="space-y-4">
                     {top3.map((ep, idx) => (
                        <div key={ep.id || idx} className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl border border-amber-100 dark:border-amber-900/30 bg-amber-50/30 dark:bg-amber-500/5">
                           <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-amber-400">#{idx + 1}</span>
                              <span className="text-base sm:text-lg font-black text-amber-600 dark:text-amber-500">{fmt$(ep.pnl)}</span>
                           </div>
                           <div className="flex items-center gap-2">
                              <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-700 px-2 py-1 rounded border border-slate-200 dark:border-slate-600 shadow-sm truncate max-w-[80px]">{ep.asset}</span>
                              <span className="text-[10px] font-bold text-slate-500 uppercase bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded whitespace-nowrap flex-shrink-0">
                                 <span className="text-slate-700 dark:text-slate-300 mr-1">{(ep.totalSize || 0).toFixed(2)}</span>Lot
                              </span>
                           </div>
                        </div>
                     ))}
                     {top3.length === 0 && (
                        <p className="text-xs text-slate-400 italic text-center py-8">Không có dữ liệu</p>
                     )}
                  </div>
               </div>

            </div>
         </div>

         {/* Minimalist Fintech Comparison Table */}
         <div className="mt-6 bg-white dark:bg-slate-900 rounded-3xl p-6 border theme-border shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-6 pb-4 border-b theme-border">
               <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold">
                     <Crosshair className="w-4 h-4" />
                  </div>
                  <div>
                     <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">Đối Chiếu Chỉ Số: Nhồi Thuận vs Giữ Kỷ Luật</h3>
                     <p className="text-[11px] font-medium text-slate-400">Bảng đo lường tác hại và độ lệch hiệu suất chi tiết</p>
                  </div>
               </div>
            </div>

            {/* Table Container */}
            <div className="overflow-x-auto">
               <table className="w-full text-left border-collapse">
                  <thead>
                     <tr className="border-b theme-border text-[10px] font-black uppercase text-slate-400 tracking-wider">
                        <th className="py-3 px-4">Tên Chỉ Số</th>
                        <th className="py-3 px-4 text-amber-500">Nhồi Thuận (Pyramid)</th>
                        <th className="py-3 px-4 text-slate-500">Giữ Kỷ Luật</th>
                        <th className="py-3 px-4 text-right">Mức Tác Hại / Độ Lệch</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y theme-border text-xs font-semibold">
                     {/* Row 1: Expectancy */}
                     <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-4 px-4 font-bold text-slate-800 dark:text-slate-200">
                           Kỳ Vọng Lợi Nhuận
                           <span className="block text-[10px] font-normal text-slate-400">Expectancy / lần click</span>
                        </td>
                        <td className="py-4 px-4 font-black text-amber-600 dark:text-amber-400">
                           {fmt$(metrics?.expectancy || 0)}
                        </td>
                        <td className="py-4 px-4 font-bold text-slate-600 dark:text-slate-400">
                           {fmt$(baseline?.expectancy || 0)}
                        </td>
                        <td className="py-4 px-4 text-right">
                           <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                              Tệ hơn {fmt$(Math.abs((metrics?.expectancy || 0) - (baseline?.expectancy || 0)))}
                           </span>
                        </td>
                     </tr>

                     {/* Row 2: Volume */}
                     <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-4 px-4 font-bold text-slate-800 dark:text-slate-200">
                           Volume Trung Bình
                           <span className="block text-[10px] font-normal text-slate-400">Tổng Volume bơm vào mỗi đợt</span>
                        </td>
                        <td className="py-4 px-4 font-black text-amber-600 dark:text-amber-400">
                           {pyramidTotalAvgSize.toFixed(2)} Lot
                        </td>
                        <td className="py-4 px-4 font-bold text-slate-600 dark:text-slate-400">
                           {normalSize.toFixed(2)} Lot
                        </td>
                        <td className="py-4 px-4 text-right">
                           <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20">
                              Bơm x{(normalSize > 0 ? (pyramidTotalAvgSize / normalSize) : 1).toFixed(1)} Volume
                           </span>
                        </td>
                     </tr>

                     {/* Row 3: Win Rate */}
                     <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-4 px-4 font-bold text-slate-800 dark:text-slate-200">
                           Tỷ Lệ Thắng
                           <span className="block text-[10px] font-normal text-slate-400">Win Rate khi nhồi thuận</span>
                        </td>
                        <td className="py-4 px-4 font-black text-emerald-600 dark:text-emerald-400">
                           {fmtPct(metrics?.winRate || 0)}
                        </td>
                        <td className="py-4 px-4 font-bold text-slate-600 dark:text-slate-400">
                           {fmtPct(baseline?.winRate || 0)}
                        </td>
                        <td className="py-4 px-4 text-right">
                           <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                              {metrics?.winRate >= baseline?.winRate ? 'Chiến thuật tốt' : 'Thấp hơn kỷ luật'}
                           </span>
                        </td>
                     </tr>

                     {/* Row 4: Avg Loss */}
                     <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-4 px-4 font-bold text-slate-800 dark:text-slate-200">
                           Cắt Lỗ Trung Bình
                           <span className="block text-[10px] font-normal text-slate-400">Mức lỗ trung bình khi cắt</span>
                        </td>
                        <td className="py-4 px-4 font-black text-amber-600 dark:text-amber-400">
                           {fmt$(metrics?.avgLoss || 0)}
                        </td>
                        <td className="py-4 px-4 font-bold text-slate-600 dark:text-slate-400">
                           {fmt$(normalLoss)}
                        </td>
                        <td className="py-4 px-4 text-right">
                           <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                              Phình to x{(normalLoss < 0 ? (metrics?.avgLoss / normalLoss) : 1).toFixed(1)} lần
                           </span>
                        </td>
                     </tr>

                     {/* Row 5: Worst Trade */}
                     <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-4 px-4 font-bold text-slate-800 dark:text-slate-200">
                           Khoản Lỗ Nặng Nhất
                           <span className="block text-[10px] font-normal text-slate-400">Worst Single Episode</span>
                        </td>
                        <td className="py-4 px-4 font-black text-amber-600 dark:text-amber-400">
                           {fmt$(worstTradePyramid)}
                        </td>
                        <td className="py-4 px-4 font-bold text-slate-600 dark:text-slate-400">
                           {fmt$(worstTradeNormal)}
                        </td>
                        <td className="py-4 px-4 text-right">
                           <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                              Hố đen x{ratio} lần
                           </span>
                        </td>
                     </tr>
                  </tbody>
               </table>
            </div>
         </div>

         {/* QUOTE SECTION (AI TRADING COACH STYLE) */}
         <div className="mt-4 relative">
            <div className="absolute top-6 left-6 md:top-8 md:left-8">
               <Quote className="w-16 h-16 text-amber-500/10 dark:text-amber-400/10 fill-current transform -scale-x-100" />
            </div>
            <div className="bg-amber-50/50 dark:bg-amber-500/5 rounded-2xl p-8 px-8 md:px-16 border border-amber-100 dark:border-amber-500/10 flex flex-col justify-center">
               <p className="text-slate-700 dark:text-slate-300 text-lg md:text-xl font-medium leading-relaxed italic relative z-10 mt-4 md:mt-2">
                  "Nhồi lệnh thuận khi đang lãi là nghệ thuật của các Trader hàng đầu, nhưng nhồi lệnh mà KHÔNG dời Stop-Loss lên hòa vốn là sự mạo hiểm vô ích. Đừng biến vị thế thắng thành khoản lỗ ngớ ngẩn!"
               </p>
               <div className="mt-8 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/30">
                     <Activity className="w-5 h-5 text-white" />
                  </div>
                  <div>
                     <div className="text-sm font-bold text-slate-800 dark:text-slate-200">Behavior Intelligence</div>
                     <div className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">AI TRADING COACH</div>
                  </div>
               </div>
            </div>
         </div>

      </div>
   );
}
