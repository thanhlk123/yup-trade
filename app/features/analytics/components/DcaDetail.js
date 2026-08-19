import React from 'react';
import { Target, Search, AlertTriangle, X, Terminal, BrainCircuit, Quote, Activity, Crosshair, ShieldAlert } from 'lucide-react';

function fmt$(n) {
   if (!n && n !== 0) return '$0';
   const abs = Math.abs(n);
   const sign = n < 0 ? '-' : '+';
   if (abs >= 1000) return sign + '$' + (abs / 1000).toFixed(1) + 'k';
   return sign + '$' + abs.toFixed(2);
}

function fmtPct(n) { return (n * 100).toFixed(1) + '%'; }

export function DcaDetail({ behavior, onFilterTrades, onClose }) {
   const { affectedTradeIds, dcaMetrics, nonDcaBaseline, estimatedEdgeDamage, episodes, aiInsight, evidence, profile } = behavior;
   const violationCount = affectedTradeIds?.length || 0;

   const worstTradeDca = dcaMetrics?.worstEpisodePnl || 0;
   const worstTradeNormal = nonDcaBaseline?.worstEpisodePnl || -0.01;
   const normalLoss = nonDcaBaseline?.avgLoss || -0.01;
   const ratio = Math.max(1, (worstTradeDca / normalLoss)).toFixed(1);

   // Total Damage value: always negative, matching actual total PnL of affected trades
   const totalDamageVal = dcaMetrics?.totalPnl != null && dcaMetrics.totalPnl < 0
     ? dcaMetrics.totalPnl
     : -Math.abs(estimatedEdgeDamage || dcaMetrics?.totalPnl || 0);

   // Average size
   const dcaSize = dcaMetrics?.avgInitialSize || 0;
   const dcaTotalAvgSize = dcaSize + (dcaMetrics?.avgAddedSize || 0);
   const normalSize = nonDcaBaseline?.avgInitialSize || 0;

   // Stats for Bar Charts (Tailored for DCA)
   const metricsList = [
      { label: 'KỲ VỌNG LỢI NHUẬN (Expectancy / lần)', format: 'money', dca: dcaMetrics?.expectancy || 0, normal: nonDcaBaseline?.expectancy || 0 },
      { label: 'VOLUME TRUNG BÌNH BƠM VÀO (Avg Size)', format: 'raw', dca: dcaTotalAvgSize, normal: normalSize },
      { label: 'TỈ LỆ THẮNG (Win Rate - Cố gồng về bờ)', format: 'percent', dca: dcaMetrics?.winRate || 0, normal: nonDcaBaseline?.winRate || 0 },
      { label: 'MỨC CẮT LỖ TRUNG BÌNH (AVG LOSS)', format: 'money', dca: dcaMetrics?.avgLoss || 0, normal: normalLoss },
      { label: 'KHOẢN LỖ NẶNG NHẤT (WORST TRADE)', format: 'money', dca: worstTradeDca, normal: worstTradeNormal },
   ];

   const renderBar = (dcaVal, normalVal, format) => {
      const maxVal = Math.max(Math.abs(dcaVal), Math.abs(normalVal), 0.01);
      const dcaPct = (Math.abs(dcaVal) / maxVal) * 100;
      const normalPct = (Math.abs(normalVal) / maxVal) * 100;

      // In DCA context, larger size is bad (red). Expectancy and Worst Trade negative is bad (red).
      let dcaColor = 'bg-rose-500';
      let dcaText = 'text-rose-500';
      if (format === 'percent' || (format === 'money' && dcaVal > 0)) {
         dcaColor = dcaVal < 0 ? 'bg-rose-500' : 'bg-emerald-500';
         dcaText = dcaVal < 0 ? 'text-rose-500' : 'text-emerald-500';
      } else if (format === 'raw') {
         dcaColor = 'bg-rose-500'; // high volume in DCA is always represented as a warning
         dcaText = 'text-rose-500';
      }

      const normalColor = 'bg-slate-400';

      const fmtRaw = (v) => v.toFixed(2) + ' Lot';
      const dcaStr = format === 'money' ? fmt$(dcaVal) : (format === 'raw' ? fmtRaw(dcaVal) : fmtPct(dcaVal));
      const normalStr = format === 'money' ? fmt$(normalVal) : (format === 'raw' ? fmtRaw(normalVal) : fmtPct(normalVal));

      return (
         <div className="space-y-3 mb-6">
            <div className="flex items-center gap-4">
               <div className="w-24 text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Nhồi lệnh</div>
               <div className="flex-1 rounded-full h-3 flex items-center">
                  <div className={`h-3 rounded-full ${dcaColor}`} style={{ width: `${dcaPct}%` }}></div>
               </div>
               <div className={`w-24 text-right text-sm font-black ${dcaText}`}>{dcaStr}</div>
            </div>
            <div className="flex items-center gap-4">
               <div className="w-24 text-xs font-bold text-slate-500 dark:text-slate-500 uppercase tracking-wider">Kỷ luật</div>
               <div className="flex-1 rounded-full h-3 flex items-center">
                  <div className={`h-3 rounded-full ${normalColor}`} style={{ width: `${normalPct}%` }}></div>
               </div>
               <div className="w-24 text-right text-sm font-bold text-slate-600 dark:text-slate-400">{normalStr}</div>
            </div>
         </div>
      );
   };

   const top3 = [...(episodes?.details || [])].sort((a, b) => a.pnl - b.pnl).slice(0, 3);
   const oversizedCount = episodes?.losses || 0; // Losses in DCA episodes
   const oversizedPct = episodes?.total ? (oversizedCount / episodes.total) : 0;

   const evObserved = evidence?.observed || [];
   const evContext = evidence?.context || [];

   return (
      <div className="mt-6 rounded-3xl border theme-border bg-slate-50/50 dark:bg-slate-900 shadow-xl dark:shadow-2xl relative overflow-hidden animate-slide-up p-8">

         {/* Top Header Controls */}
         <div className="flex justify-between items-center mb-8">
            <div className="flex items-center gap-3">
               <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-500/20 flex items-center justify-center">
                  <ShieldAlert className="w-5 h-5 text-rose-600 dark:text-rose-400" />
               </div>
               <div>
                  <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Hội Chứng Gồng Lỗ / Nhồi Lệnh</h2>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Hồ Sơ Thiệt Hại (Pain Profile)</p>
               </div>
            </div>
            <div className="flex gap-3">
               <button onClick={() => onFilterTrades && onFilterTrades(affectedTradeIds)} className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 px-4 py-2 rounded-xl font-bold text-sm transition-colors">
                  <Crosshair className="w-4 h-4" /> Bóc tách lệnh ({violationCount})
               </button>
               <button onClick={onClose} className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 transition-colors">
                  <X className="w-5 h-5" />
               </button>
            </div>
         </div>

         <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* LEFT COLUMN (70%) */}
            <div className="lg:col-span-2 flex flex-col gap-6">

               {/* Worst Trade Box */}
               <div className="bg-white dark:bg-slate-800 rounded-3xl p-10 border border-rose-100 dark:border-rose-900/30 shadow-sm text-center relative overflow-hidden flex flex-col items-center justify-center min-h-[280px]">
                  <div className="absolute inset-0 flex items-center justify-center opacity-[0.02] pointer-events-none">
                     <AlertTriangle className="w-96 h-96 text-rose-500 transform translate-y-8" />
                  </div>
                  <h1 className="text-8xl font-black text-rose-600 dark:text-rose-500 tracking-tighter mb-4 relative z-10">{fmt$(worstTradeDca)}</h1>
                  <p className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-6 relative z-10">
                     VẾT THƯƠNG TRÍ MẠNG (CHU KỲ NHỒI LỆNH TỆ NHẤT)
                  </p>
                  <div className="inline-block bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 px-6 py-2.5 rounded-full font-semibold text-sm border border-rose-200 dark:border-rose-500/30 relative z-10 shadow-sm">
                     Khoản lỗ phình to <strong className="font-black text-rose-800 dark:text-rose-200 text-base">Gấp {ratio} lần</strong> so với mức cắt lỗ kỷ luật trung bình ({fmt$(normalLoss)})
                  </div>
               </div>

               {/* AI Terminal - Coaching & Evidence */}
               <div className="bg-slate-50 dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 shadow-xl relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-rose-500 to-orange-500"></div>
                  <div className="flex items-center gap-2 mb-6">
                     <Terminal className="w-5 h-5 text-rose-500" />
                     <span className="text-rose-500 font-mono text-xs font-bold tracking-widest">SYSTEM_EVALUATION_ROOT</span>
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
                                 <div key={idx} className={`font-mono text-sm flex gap-3 ${isHighlight ? 'text-rose-600 dark:text-rose-400 font-bold' : 'text-slate-700 dark:text-slate-400'}`}>
                                    <span className="text-slate-400 dark:text-slate-600 shrink-0">{`[LOG_${idx + 1}]`}</span>
                                    <span>{isBullet && <span className="text-rose-500 mr-2">›</span>}{text}</span>
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
               <div className="bg-rose-500 dark:bg-rose-600 rounded-3xl p-6 shadow-[0_8px_30px_rgb(225,29,72,0.3)] flex flex-col justify-center min-h-[150px] text-white relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-15">
                     <AlertTriangle className="w-20 h-20 text-white" />
                  </div>
                  <p className="text-xs font-black text-white/90 uppercase tracking-wider mb-1.5 relative z-10">TỔNG THIỆT HẠI</p>
                  <p className="text-3xl sm:text-4xl font-black text-white tracking-tight relative z-10 truncate">{fmt$(totalDamageVal)}</p>
                  <p className="text-sm font-medium text-white/90 mt-2 relative z-10">Số tiền ném qua cửa sổ vì cố chấp ngược xu hướng.</p>
               </div>

               {/* Stats Boxes */}
               <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border theme-border shadow-sm flex items-center justify-between">
                  <div>
                     <p className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">SỐ LẦN NHỒI LỆNH (EPISODES)</p>
                     <p className="text-3xl font-black text-slate-800 dark:text-white">{episodes?.total || 0}</p>
                  </div>
               </div>

               <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border theme-border shadow-sm flex items-center justify-between">
                  <div>
                     <p className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">SỐ CHU KỲ CHÁY/THUA LỖ</p>
                     <p className="text-3xl font-black text-rose-500">{oversizedCount}</p>
                  </div>
                  <div className="text-xs font-bold bg-rose-50 dark:bg-rose-500/10 text-rose-600 px-3 py-1.5 rounded-lg border border-rose-100">
                     {fmtPct(oversizedPct)} Fail
                  </div>
               </div>

               {/* Top 3 Worst Trades */}
               <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border theme-border shadow-sm flex-1">
                  <div className="flex items-center gap-2 mb-2 text-slate-900 dark:text-white font-black text-sm uppercase tracking-widest">
                     <Target className="w-5 h-5 text-rose-500" /> TOP 3 HỐ ĐEN TÀI KHOẢN
                  </div>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-5 leading-relaxed">
                     Những chu kỳ cứu lệnh tệ nhất
                  </p>

                  <div className="space-y-4">
                     {top3.map((ep, idx) => (
                        <div key={ep.id || idx} className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl border border-rose-100 dark:border-rose-900/30 bg-rose-50/30 dark:bg-rose-500/5">
                           <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-rose-400">#{idx + 1}</span>
                              <span className="text-base sm:text-lg font-black text-rose-600 dark:text-rose-500">{fmt$(ep.pnl)}</span>
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
             <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center font-bold">
               <Crosshair className="w-4 h-4" />
             </div>
             <div>
               <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">Đối Chiếu Chỉ Số: Nhồi Lệnh vs Giữ Kỷ Luật</h3>
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
                <th className="py-3 px-4 text-rose-500">Nhồi Lệnh (DCA)</th>
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
                <td className="py-4 px-4 font-black text-rose-600 dark:text-rose-400">
                  {fmt$(dcaMetrics?.expectancy || 0)}
                </td>
                <td className="py-4 px-4 font-bold text-slate-600 dark:text-slate-400">
                  {fmt$(nonDcaBaseline?.expectancy || 0)}
                </td>
                <td className="py-4 px-4 text-right">
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                    Tệ hơn {fmt$(Math.abs((dcaMetrics?.expectancy || 0) - (nonDcaBaseline?.expectancy || 0)))}
                  </span>
                </td>
              </tr>

              {/* Row 2: Volume */}
              <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                <td className="py-4 px-4 font-bold text-slate-800 dark:text-slate-200">
                  Volume Trung Bình
                  <span className="block text-[10px] font-normal text-slate-400">Tổng Volume bơm vào mỗi đợt</span>
                </td>
                <td className="py-4 px-4 font-black text-rose-600 dark:text-rose-400">
                  {dcaTotalAvgSize.toFixed(2)} Lot
                </td>
                <td className="py-4 px-4 font-bold text-slate-600 dark:text-slate-400">
                  {normalSize.toFixed(2)} Lot
                </td>
                <td className="py-4 px-4 text-right">
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20">
                    Bơm x{(normalSize > 0 ? (dcaTotalAvgSize / normalSize) : 1).toFixed(1)} Volume
                  </span>
                </td>
              </tr>

              {/* Row 3: Win Rate */}
              <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                <td className="py-4 px-4 font-bold text-slate-800 dark:text-slate-200">
                  Tỷ Lệ Thắng
                  <span className="block text-[10px] font-normal text-slate-400">Win Rate cố gồng về bờ</span>
                </td>
                <td className="py-4 px-4 font-black text-emerald-600 dark:text-emerald-400">
                  {fmtPct(dcaMetrics?.winRate || 0)}
                </td>
                <td className="py-4 px-4 font-bold text-slate-600 dark:text-slate-400">
                  {fmtPct(nonDcaBaseline?.winRate || 0)}
                </td>
                <td className="py-4 px-4 text-right">
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    {dcaMetrics?.winRate >= nonDcaBaseline?.winRate ? 'Ảo tưởng gồng về bờ' : 'Thấp hơn kỷ luật'}
                  </span>
                </td>
              </tr>

              {/* Row 4: Avg Loss */}
              <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                <td className="py-4 px-4 font-bold text-slate-800 dark:text-slate-200">
                  Cắt Lỗ Trung Bình
                  <span className="block text-[10px] font-normal text-slate-400">Mức lỗ trung bình khi cắt</span>
                </td>
                <td className="py-4 px-4 font-black text-rose-600 dark:text-rose-400">
                  {fmt$(dcaMetrics?.avgLoss || 0)}
                </td>
                <td className="py-4 px-4 font-bold text-slate-600 dark:text-slate-400">
                  {fmt$(normalLoss)}
                </td>
                <td className="py-4 px-4 text-right">
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                    Phình to x{(normalLoss < 0 ? (dcaMetrics?.avgLoss / normalLoss) : 1).toFixed(1)} lần
                  </span>
                </td>
              </tr>

              {/* Row 5: Worst Trade */}
              <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                <td className="py-4 px-4 font-bold text-slate-800 dark:text-slate-200">
                  Khoản Lỗ Nặng Nhất
                  <span className="block text-[10px] font-normal text-slate-400">Worst Single Episode</span>
                </td>
                <td className="py-4 px-4 font-black text-rose-600 dark:text-rose-400">
                  {fmt$(worstTradeDca)}
                </td>
                <td className="py-4 px-4 font-bold text-slate-600 dark:text-slate-400">
                  {fmt$(worstTradeNormal)}
                </td>
                <td className="py-4 px-4 text-right">
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
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
               <Quote className="w-16 h-16 text-rose-500/10 dark:text-rose-400/10 fill-current transform -scale-x-100" />
            </div>
            <div className="bg-rose-50/50 dark:bg-rose-500/5 rounded-2xl p-8 px-8 md:px-16 border border-rose-100 dark:border-rose-500/10 flex flex-col justify-center">
               <p className="text-slate-700 dark:text-slate-300 text-lg md:text-xl font-medium leading-relaxed italic relative z-10 mt-4 md:mt-2">
                  "Trung bình giá (DCA) khi đang lỗ không phải là chiến lược, đó là sự tuyệt vọng. Bạn có thể đúng 9 lần và thoát nạn, nhưng lần thứ 10 sai xu hướng sẽ xóa sổ toàn bộ tài khoản và niềm tin của bạn."
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
