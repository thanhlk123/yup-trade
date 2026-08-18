import React, { useMemo } from 'react';
import { Target, X, AlertTriangle, Crosshair, BarChart3, Activity, Info, Quote } from 'lucide-react';
import { getTradeMetrics, extractBaselineLosses } from '../../../../lib/behaviors/execution/noSl';

function fmt$(n) {
  if (!n && n !== 0) return '$0';
  const abs = Math.abs(n);
  if (abs >= 1000) return '$' + (abs / 1000).toFixed(1) + 'k';
  return '$' + abs.toFixed(0);
}

function formatDuration(start, end) {
  if (!start || !end) return '-';
  const ms = new Date(end) - new Date(start);
  if (ms < 0) return '-';
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h${mins % 60}m`;
  return `${Math.floor(hrs / 24)}d`;
}

export function NoSlDetail({ behavior, onFilterTrades, onClose, trades, t }) {
  const { affectedTradeIds } = behavior;
  
  const metrics = useMemo(() => {
    const allTrades = trades || [];
    const totalTrades = allTrades.length;
    
    // Affected trades (NoSL)
    const noSlTrades = allTrades.filter(tr => affectedTradeIds.includes(tr.id));
    const noSlCount = noSlTrades.length;
    const noSlRatio = totalTrades > 0 ? (noSlCount / totalTrades) * 100 : 0;
    
    const noSlLosses = noSlTrades.filter(tr => parseFloat(tr.pnl) < 0).map(tr => ({
       ...tr, 
       realizedLossPerSize: getTradeMetrics(tr).realizedLossPerSize,
       realizedLossUsd: getTradeMetrics(tr).realizedLossUsd,
       durationStr: formatDuration(tr.trade_time, tr.exit_time)
    }));
    
    noSlLosses.sort((a, b) => b.realizedLossPerSize - a.realizedLossPerSize); 
    const totalNoSlLossUsd = noSlLosses.reduce((sum, tr) => sum + tr.realizedLossUsd, 0);
    const lossRate = noSlCount > 0 ? (noSlLosses.length / noSlCount) * 100 : 0;

    // Baseline trades (With SL)
    const slLosses = extractBaselineLosses(allTrades);

    const ascendingNoSlLosses = [...noSlLosses].map(tr => tr.realizedLossPerSize).sort((a,b) => a - b);
    
    // Medians
    const medianSl = slLosses.length > 0 ? slLosses[Math.floor(slLosses.length / 2)] : 0;
    const medianNoSl = ascendingNoSlLosses.length > 0 ? ascendingNoSlLosses[Math.floor(ascendingNoSlLosses.length / 2)] : 0;
    const medianMultiplier = medianSl > 0 ? medianNoSl / medianSl : 1;
    const medianPct = medianSl > 0 ? ((medianNoSl / medianSl) - 1) * 100 : 0;

    // P90
    const p90IdxSl = Math.floor((slLosses.length - 1) * 0.9);
    const p90Sl = slLosses.length > 0 && p90IdxSl >= 0 ? slLosses[p90IdxSl] : 0;
    const p90IdxNoSl = Math.floor((ascendingNoSlLosses.length - 1) * 0.9);
    const p90NoSl = ascendingNoSlLosses.length > 0 && p90IdxNoSl >= 0 ? ascendingNoSlLosses[p90IdxNoSl] : 0;
    const p90Pct = p90Sl > 0 ? ((p90NoSl / p90Sl) - 1) * 100 : 0;

    // Max
    const maxSl = slLosses.length > 0 ? slLosses[slLosses.length - 1] : 0;
    const maxNoSl = ascendingNoSlLosses.length > 0 ? ascendingNoSlLosses[ascendingNoSlLosses.length - 1] : 0;
    const maxPct = maxSl > 0 ? ((maxNoSl / maxSl) - 1) * 100 : 0;
    const maxMultiplier = medianSl > 0 ? maxNoSl / medianSl : 1; 

    // Top 3 Damage Concentration
    const top3 = noSlLosses.slice(0, 3);
    const top4 = noSlLosses.slice(0, 4);
    const top4Damage = top4.reduce((sum, tr) => sum + tr.realizedLossUsd, 0);
    const concentrationPct = totalNoSlLossUsd > 0 ? (top4Damage / totalNoSlLossUsd) * 100 : 0;

    // Fingerprint
    const fingerprint = {
      riskPlan: { Violated: 0, Followed: 0 },
      emotion: { Hope: 0, Fear: 0, Neutral: 0 },
      direction: { BUY: 0, SELL: 0 },
      session: { Asia: 0, London: 0, 'New York': 0 }
    };

    noSlTrades.forEach(tr => {
       if (tr.risk_plan === 'Violated' || tr.risk_plan === '#Risk_Violated') fingerprint.riskPlan.Violated++;
       else fingerprint.riskPlan.Followed++;

       let emos = [];
       try { emos = JSON.parse(tr.emotions || "[]"); } catch(e) {}
       if (emos.includes('#Emotion_Hope')) fingerprint.emotion.Hope++;
       if (emos.includes('#Emotion_Fear')) fingerprint.emotion.Fear++;
       if (emos.length === 0) fingerprint.emotion.Neutral++;

       if (tr.side === 'BUY') fingerprint.direction.BUY++;
       else if (tr.side === 'SELL') fingerprint.direction.SELL++;

       if (tr.trade_time) {
         const hour = new Date(tr.trade_time).getUTCHours();
         if (hour >= 0 && hour < 8) fingerprint.session.Asia++;
         else if (hour >= 8 && hour < 14) fingerprint.session.London++;
         else fingerprint.session['New York']++;
       }
    });

    return {
      totalTrades, noSlCount, noSlRatio, lossCount: noSlLosses.length, lossRate, totalNoSlLossUsd,
      medianSl, medianNoSl, medianMultiplier, medianPct,
      p90Sl, p90NoSl, p90Pct,
      maxSl, maxNoSl, maxPct, maxMultiplier,
      top3, concentrationPct, top4Count: top4.length,
      fingerprint, ascendingNoSlLosses, slLosses
    };
  }, [trades, affectedTradeIds]);

  const BarCompare = ({ label, subLabel, valNoSl, valSl, pctChange }) => {
     const maxVal = Math.max(valNoSl, valSl, 1);
     const widthNoSl = (valNoSl / maxVal) * 100;
     const widthSl = (valSl / maxVal) * 100;

     return (
       <div className="mb-6 last:mb-0">
          <div className="flex items-baseline gap-2 mb-2">
             <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">{label}</span>
             {subLabel && <span className="text-[10px] text-slate-400 font-medium">({subLabel})</span>}
          </div>
          <div className="space-y-2.5">
             <div className="flex items-center gap-3">
                <span className="w-16 text-xs font-semibold text-rose-600 dark:text-rose-400">Không SL</span>
                <div className="flex-1 h-3 bg-slate-100 dark:bg-slate-800 rounded-sm overflow-hidden flex items-center">
                   <div className="h-full bg-rose-500 transition-all duration-500" style={{ width: `${widthNoSl}%` }}></div>
                </div>
                <span className="w-14 text-right text-sm font-black text-rose-600 dark:text-rose-400">{fmt$(valNoSl)}</span>
                <span className="w-12 text-right text-xs font-bold text-rose-500">
                  {pctChange > 0 ? '+' : ''}{pctChange.toFixed(0)}%
                </span>
             </div>
             <div className="flex items-center gap-3">
                <span className="w-16 text-xs font-semibold text-slate-500">Lệnh có SL</span>
                <div className="flex-1 h-3 bg-slate-100 dark:bg-slate-800 rounded-sm overflow-hidden flex items-center">
                   <div className="h-full bg-slate-300 dark:bg-slate-600 transition-all duration-500" style={{ width: `${widthSl}%` }}></div>
                </div>
                <span className="w-14 text-right text-sm font-bold text-slate-600 dark:text-slate-400">{fmt$(valSl)}</span>
                <span className="w-12"></span>
             </div>
          </div>
       </div>
     );
  };

  const FingerprintBar = ({ label, count, total, colorClass }) => {
     const pct = total > 0 ? (count / total) * 100 : 0;
     return (
       <div className="flex items-center gap-3 mb-2.5">
          <span className="w-24 text-xs font-semibold text-slate-600 dark:text-slate-300 truncate">{label}</span>
          <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
             <div className={`h-full ${colorClass} transition-all duration-500`} style={{ width: `${pct}%` }}></div>
          </div>
          <span className="w-12 text-right text-[11px] font-bold text-slate-500">{count} / {total}</span>
       </div>
     );
  };

  const DotPlot = ({ dataNoSl, dataSl }) => {
     const maxVal = Math.max(...dataNoSl, ...dataSl, 1);
     
     return (
        <div className="flex flex-col gap-5 mt-6 border-t theme-border pt-6">
           <div className="flex items-center gap-2 mb-1">
             <Info className="w-3.5 h-3.5 text-slate-400" />
             <span className="text-[11px] text-slate-500 font-medium">Sự phân bổ tần suất lệnh lỗ. Lệnh Không SL thường có rủi ro bị kéo giãn ra xa (đuôi rủi ro dài).</span>
           </div>
           <div>
              <div className="text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-2 uppercase tracking-wide">Phân bổ lệnh KHÔNG SL</div>
              <div className="relative h-6 border-b border-slate-200 dark:border-slate-700">
                {dataNoSl.map((v, i) => (
                  <div key={i} className="absolute w-2.5 h-2.5 rounded-full bg-rose-500/60 bottom-0 transform -translate-x-1 translate-y-1" style={{ left: `${(v / maxVal) * 100}%` }}></div>
                ))}
              </div>
           </div>
           <div>
              <div className="text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-2 uppercase tracking-wide">Phân bổ lệnh KỶ LUẬT (CÓ SL)</div>
              <div className="relative h-6 border-b border-slate-200 dark:border-slate-700">
                {dataSl.map((v, i) => (
                  <div key={i} className="absolute w-2.5 h-2.5 rounded-full bg-slate-400/60 bottom-0 transform -translate-x-1 translate-y-1" style={{ left: `${(v / maxVal) * 100}%` }}></div>
                ))}
              </div>
           </div>
        </div>
     );
  };

  return (
    <div className="mt-6 rounded-2xl border theme-border bg-slate-50 dark:bg-slate-900/50 shadow-xl dark:shadow-2xl relative overflow-hidden animate-slide-up">
      {/* Header section */}
      <div className="p-6 border-b theme-border flex flex-col md:flex-row md:items-start justify-between gap-4 bg-white dark:bg-slate-900">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
            <p className="text-[11px] font-black text-rose-600 dark:text-rose-400 uppercase tracking-widest">
              HÀNH VI CẦN SỬA
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <h4 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-none">
              Không đặt Stop Loss
            </h4>
            <div className="text-slate-500 dark:text-slate-400 text-sm font-semibold pb-1">
              {metrics.noSlCount} / {metrics.totalTrades} lệnh · chiếm {metrics.noSlRatio.toFixed(1)}%
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onFilterTrades && onFilterTrades(affectedTradeIds)}
            className="flex items-center gap-1.5 bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300 hover:bg-violet-200 dark:hover:bg-violet-500/30 px-4 py-2.5 rounded-xl font-bold transition-all text-sm"
          >
            <Target className="w-4 h-4" />
            Lọc lệnh ({metrics.noSlCount})
          </button>
          <button onClick={onClose} className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="p-6 grid grid-cols-1 md:grid-cols-12 gap-6">
        
        {/* TẦNG 1: IMPACT HERO */}
        <div className="col-span-12 md:col-span-12 flex flex-col md:flex-row gap-6">
          <div className="bg-white dark:bg-slate-800 border theme-border rounded-2xl p-6 flex-1 flex flex-col justify-center relative overflow-hidden shadow-sm">
             <div className="absolute top-0 right-0 p-4 opacity-5">
               <AlertTriangle className="w-40 h-40 text-rose-500" />
             </div>
             <div className="relative z-10 text-center">
                <div className="text-7xl font-black text-rose-600 dark:text-rose-400 mb-2 tracking-tighter">
                  {metrics.medianMultiplier.toFixed(2)}×
                </div>
                <div className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-6">
                  Mức lỗ trung bình khi bạn thả rông SL
                </div>
                <div className="flex items-center justify-center gap-4 text-base font-semibold">
                  <span className="text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 px-4 py-2 rounded-lg">{fmt$(metrics.medianNoSl)} / lot</span>
                  <span className="text-slate-400 text-sm italic font-medium">so với</span>
                  <span className="text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 px-4 py-2 rounded-lg">{fmt$(metrics.medianSl)} / lot (khi kỷ luật)</span>
                </div>
                {metrics.medianPct > 0 && (
                  <div className="mt-5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 text-xs font-black">
                    +{metrics.medianPct.toFixed(1)}% THIỆT HẠI TĂNG THÊM
                  </div>
                )}
             </div>
          </div>
          
          <div className="w-full md:w-64 flex flex-col gap-3">
             <div className="bg-white dark:bg-slate-800 rounded-xl p-4.5 px-5 border theme-border flex items-center justify-between shadow-sm">
                <span className="text-sm font-bold text-slate-600 dark:text-slate-300">{metrics.noSlCount} <span className="font-medium text-slate-400 ml-1">lệnh Không SL</span></span>
             </div>
             <div className="bg-white dark:bg-slate-800 rounded-xl p-4.5 px-5 border theme-border flex items-center justify-between shadow-sm">
                <span className="text-sm font-bold text-rose-600 dark:text-rose-400">{metrics.lossCount} <span className="font-medium text-rose-400/70 ml-1">lệnh bị thua lỗ</span></span>
                <span className="text-[10px] font-black text-rose-500 bg-rose-50 dark:bg-rose-500/10 px-2 py-1 rounded-md">{metrics.lossRate.toFixed(1)}%</span>
             </div>
             <div className="bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 rounded-xl p-5 shadow-sm flex flex-col justify-center h-full">
                <span className="text-[11px] font-bold text-rose-500 dark:text-rose-400 uppercase tracking-widest mb-1">Tổng tiền thiệt hại</span>
                <span className="text-3xl font-black text-rose-600 dark:text-rose-300">-{fmt$(metrics.totalNoSlLossUsd)}</span>
             </div>
          </div>
        </div>

        {/* TẦNG 2: EVIDENCE (Loss Profile & Damage) */}
        <div className="col-span-12 md:col-span-7 bg-white dark:bg-slate-800 border theme-border rounded-2xl p-6 shadow-sm">
           <div className="flex items-center justify-between mb-6">
             <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-black text-xs uppercase tracking-widest">
               <BarChart3 className="w-4 h-4 text-rose-500" /> HỒ SƠ THIỆT HẠI (QUY ĐỔI 1 LOT)
             </div>
           </div>
           
           <BarCompare 
              label="Trung vị thiệt hại" 
              subLabel="Mức lỗ điển hình nhất"
              valNoSl={metrics.medianNoSl} 
              valSl={metrics.medianSl} 
              pctChange={metrics.medianPct} 
           />
           <BarCompare 
              label="Rủi ro đuôi (P90 Loss)" 
              subLabel="Mức lỗ đại diện cho 10% các lệnh tồi tệ nhất"
              valNoSl={metrics.p90NoSl} 
              valSl={metrics.p90Sl} 
              pctChange={metrics.p90Pct} 
           />
           <BarCompare 
              label="Mức lỗ nặng nhất" 
              subLabel="Max Loss"
              valNoSl={metrics.maxNoSl} 
              valSl={metrics.maxSl} 
              pctChange={metrics.maxPct} 
           />

           <DotPlot dataNoSl={metrics.ascendingNoSlLosses} dataSl={metrics.slLosses} />
        </div>

        <div className="col-span-12 md:col-span-5 bg-white dark:bg-slate-800 border theme-border rounded-2xl p-6 shadow-sm flex flex-col">
           <div className="flex items-center gap-2 mb-2 text-slate-800 dark:text-slate-200 font-black text-xs uppercase tracking-widest">
             <Crosshair className="w-4 h-4 text-rose-500" /> SỰ TẬP TRUNG THIỆT HẠI
           </div>
           <p className="text-[11px] text-slate-500 mb-5">Một số ít lệnh vi phạm có thể phá hủy thành quả của toàn bộ tài khoản.</p>
           
           <div className="mb-6 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border theme-border">
             <div className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-3 text-center">
                Chỉ <span className="text-rose-500 font-black text-base">{metrics.top4Count}</span> lệnh tạo ra <span className="text-rose-500 font-black text-base bg-rose-100 dark:bg-rose-500/20 px-1.5 py-0.5 rounded">{metrics.concentrationPct.toFixed(0)}%</span> tổng thiệt hại
             </div>
             <div className="w-full h-2.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full bg-rose-500 rounded-full" style={{ width: `${metrics.concentrationPct}%` }}></div>
             </div>
           </div>

           <div className="flex-1 flex flex-col">
              <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mb-2.5 uppercase tracking-widest">Top 3 lệnh lỗ nặng nhất</div>
              <div className="space-y-2 flex-1">
                 {metrics.top3.length > 0 ? metrics.top3.map((tr, i) => (
                   <div key={tr.id} className="flex items-center justify-between bg-slate-50 dark:bg-slate-900/50 p-2.5 px-4 rounded-xl border theme-border">
                      <div className="flex items-center gap-3">
                         <span className="text-[10px] font-black text-slate-400 w-4">#{i + 1}</span>
                         <span className="text-sm font-bold text-rose-600 dark:text-rose-400">-{fmt$(tr.realizedLossUsd)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                         <span className="text-[10px] font-medium text-slate-500 bg-slate-200/50 dark:bg-slate-800/50 px-2 py-0.5 rounded">{tr.durationStr}</span>
                         <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded border theme-border">{tr.size} Lot</span>
                      </div>
                   </div>
                 )) : (
                   <div className="text-sm text-slate-400 italic text-center py-4">Không có lệnh lỗ.</div>
                 )}
              </div>
           </div>
        </div>

        {/* TẦNG 3: PATTERN */}
        <div className="col-span-12 md:col-span-6 bg-white dark:bg-slate-800 border theme-border rounded-2xl p-6 shadow-sm">
           <div className="flex items-center gap-2 mb-2 text-slate-800 dark:text-slate-200 font-black text-xs uppercase tracking-widest">
             <Activity className="w-4 h-4 text-violet-500" /> BỘ NHẬN DIỆN HÀNH VI
           </div>
           <p className="text-[11px] text-slate-500 mb-6">Bạn thường có xu hướng bỏ Stop Loss trong những hoàn cảnh nào?</p>
           
           <div className="space-y-6">
              <div>
                <div className="text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-widest">Kế hoạch giao dịch</div>
                <FingerprintBar label="Phá vỡ" count={metrics.fingerprint.riskPlan.Violated} total={metrics.noSlCount} colorClass="bg-rose-500" />
                <FingerprintBar label="Tuân thủ" count={metrics.fingerprint.riskPlan.Followed} total={metrics.noSlCount} colorClass="bg-slate-400" />
              </div>
              
              <div>
                <div className="text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-widest">Trạng thái tâm lý</div>
                <FingerprintBar label="Hy vọng" count={metrics.fingerprint.emotion.Hope} total={metrics.noSlCount} colorClass="bg-amber-500" />
                <FingerprintBar label="Sợ hãi" count={metrics.fingerprint.emotion.Fear} total={metrics.noSlCount} colorClass="bg-purple-500" />
                <FingerprintBar label="Bình tĩnh" count={metrics.fingerprint.emotion.Neutral} total={metrics.noSlCount} colorClass="bg-slate-400" />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <div className="text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-widest">Hướng lệnh</div>
                  <FingerprintBar label="BUY" count={metrics.fingerprint.direction.BUY} total={metrics.noSlCount} colorClass="bg-emerald-500" />
                  <FingerprintBar label="SELL" count={metrics.fingerprint.direction.SELL} total={metrics.noSlCount} colorClass="bg-rose-500" />
                </div>

                <div>
                  <div className="text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-widest">Phiên giao dịch</div>
                  <FingerprintBar label="Phiên Mỹ" count={metrics.fingerprint.session['New York']} total={metrics.noSlCount} colorClass="bg-blue-500" />
                  <FingerprintBar label="Phiên Âu" count={metrics.fingerprint.session.London} total={metrics.noSlCount} colorClass="bg-indigo-400" />
                  <FingerprintBar label="Phiên Á" count={metrics.fingerprint.session.Asia} total={metrics.noSlCount} colorClass="bg-slate-400" />
                </div>
              </div>
           </div>
        </div>

        <div className="col-span-12 md:col-span-6 flex flex-col gap-6">
           <div className="bg-gradient-to-br from-rose-950 to-slate-900 border border-rose-900/50 rounded-2xl p-6 flex-1 flex flex-col justify-center items-center text-center relative overflow-hidden shadow-sm">
              <div className="relative z-10">
                 <div className="flex items-center justify-center gap-2 mb-6 text-rose-500 font-black text-xs uppercase tracking-widest">
                   <AlertTriangle className="w-4 h-4" /> TRƯỜNG HỢP CỰC ĐOAN (TAIL RISK)
                 </div>
                 <div className="text-rose-200/60 font-semibold text-sm mb-2 uppercase tracking-widest">Mức lỗ tồi tệ nhất khi không SL</div>
                 <div className="text-7xl font-black text-rose-500 mb-6 drop-shadow-lg">
                   -{fmt$(metrics.maxNoSl)}
                 </div>
                 <div className="inline-flex items-center gap-2 bg-white/5 px-5 py-2.5 rounded-xl border border-white/10 backdrop-blur-sm">
                   <span className="!text-white font-black text-lg drop-shadow-sm">{metrics.maxMultiplier.toFixed(2)}×</span> 
                   <span className="text-rose-200/80 text-xs font-semibold">so với mức lỗ điển hình khi kỷ luật</span>
                 </div>
              </div>
           </div>
        </div>

        {/* TẦNG 4: AI INSIGHT (QUOTE STYLE) */}
        <div className="col-span-12 mt-4 relative">
           <div className="absolute top-6 left-6 md:top-8 md:left-8">
              <Quote className="w-16 h-16 text-rose-500/10 dark:text-rose-400/10 fill-current transform -scale-x-100" />
           </div>
           <div className="bg-rose-50/50 dark:bg-rose-500/5 rounded-2xl p-8 px-8 md:px-16 border border-rose-100 dark:border-rose-500/10 flex flex-col justify-center">
              <p className="text-slate-700 dark:text-slate-300 text-lg md:text-xl font-medium leading-relaxed italic relative z-10 mt-4 md:mt-2">
                "{behavior?.coaching?.message || 'Thị trường không trừng phạt bạn vì đoán sai hướng, nó trừng phạt bạn vì sự cố chấp. Bạn có thể may mắn 99 lần nhờ gồng lỗ, nhưng chỉ cần 1 cú giật của Rủi ro đuôi (Tail Risk) để thiêu rụi tất cả. Stop Loss không phải là điểm nhận sai, nó là quyền được tồn tại.'}"
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
    </div>
  );
}
