import React from 'react';
import { Target, TrendingDown, Filter, X, ShieldAlert, Lightbulb, Zap, Search, AlertCircle, BrainCircuit } from 'lucide-react';

function fmt$(n) {
  if (!n && n !== 0) return '$0';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '+';
  if (abs >= 1000) return sign + '$' + (abs / 1000).toFixed(1) + 'k';
  return sign + '$' + abs.toFixed(1);
}

export function NoSlDetail({ behavior, onFilterTrades, onClose, trades, t }) {
  const { affectedTradeIds, impact, severity, category, evidence } = behavior;
  const totalTrades = trades?.length || 1;
  const violationCount = affectedTradeIds?.length || behavior.occurrences || 0;
  const violationPct = Math.round((violationCount / totalTrades) * 100);
  const damage = impact?.totalDamage || 0;

  // Trend for the bar chart
  const trend = behavior.trend || {};
  const trendMonths = trend.months || [];
  const trendVals = trendMonths.map(m => trend.monthly[m] || 0);
  const maxTrend = Math.max(...trendVals, 1);

  // Evidence extraction
  const evObserved = evidence?.observed || [];
  const evDeclared = evidence?.declared || [];
  const evContext = evidence?.context || [];

  return (
    <div className="mt-6 rounded-2xl border theme-border bg-white dark:bg-slate-900 shadow-xl dark:shadow-2xl relative overflow-hidden animate-slide-up">
      {/* Header section */}
      <div className="p-6 border-b theme-border relative z-10">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
              <p className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                HÀNH VI CẦN SỬA
              </p>
            </div>
            <h4 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight mb-3">
              Không đặt Stop Loss
            </h4>
            <div className="flex items-center gap-2 text-xs font-semibold">
              <span className="px-2.5 py-1 rounded-md bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300 uppercase">
                CẤP {category || 'Risk'}
              </span>
              <span className="text-slate-300 dark:text-slate-600">•</span>
              <span className="px-2.5 py-1 rounded-md bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300">
                Mức độ nghiêm trọng <span className="font-black">{severity || '8.5'} / 10</span>
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => onFilterTrades && onFilterTrades(affectedTradeIds)}
              className="flex items-center gap-1.5 bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300 hover:bg-violet-200 dark:hover:bg-violet-500/30 px-4 py-2 rounded-xl font-bold transition-all text-sm"
            >
              <Target className="w-4 h-4" />
              Lọc lệnh ({violationCount})
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
          
          {/* Left Box: Stats */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border theme-border shadow-sm flex flex-col justify-between items-center text-center">
            {/* Circular representation */}
            <div className="relative w-40 h-40 flex items-center justify-center mb-4">
               {/* Background Circle */}
               <svg className="absolute inset-0 w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                 <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="6" className="text-slate-100 dark:text-slate-700" />
                 {/* Foreground Circle - Assuming max 283 dasharray */}
                 <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="6" strokeDasharray={`${violationPct * 2.83} 283`} className="text-rose-500 transition-all duration-1000 ease-out" strokeLinecap="round" />
               </svg>
               <div className="relative z-10 flex flex-col items-center">
                 <span className="text-4xl font-black text-slate-900 dark:text-white">{violationCount}</span>
                 <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">lệnh vi phạm</span>
                 <span className="text-[10px] text-slate-400 mt-1">trên tổng {totalTrades} lệnh</span>
               </div>
            </div>

            <div className="w-full bg-rose-50 dark:bg-rose-500/10 rounded-xl p-3 flex items-center justify-between border border-rose-100 dark:border-rose-500/20">
               <span className="text-sm font-semibold text-rose-700 dark:text-rose-300">Tổng thiệt hại ước tính</span>
               <div className="flex items-center gap-2">
                 <span className="text-xl font-black text-rose-600 dark:text-rose-400">{fmt$(damage)}</span>
                 <TrendingDown className="w-5 h-5 text-rose-500" />
               </div>
            </div>
          </div>

          {/* Right Box: Description & Trend */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border theme-border shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2.5 mb-3">
                 <div className="w-8 h-8 rounded-full bg-rose-100 dark:bg-rose-500/20 flex items-center justify-center shrink-0">
                   <AlertCircle className="w-4 h-4 text-rose-500" />
                 </div>
                 <h5 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                   Bạn đang giao dịch mà không có khiên bảo vệ.
                 </h5>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                <strong className="text-slate-800 dark:text-slate-200">{violationCount} lệnh ({violationPct}%)</strong> hoàn toàn thả trôi không cắt lỗ. Đây là một hành vi mang rủi ro cực kỳ cao, có thể dẫn đến việc cháy tài khoản chỉ sau một lệnh duy nhất.
              </p>
            </div>

            <div className="mt-6">
               <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-3">Xu hướng theo thời gian</p>
               <div className="flex items-end gap-3 h-24">
                  {trendMonths.length > 0 ? trendMonths.map((m, i) => {
                    const val = trend.monthly[m] || 0;
                    const hPct = Math.max(10, (val / maxTrend) * 100);
                    const isHigh = i === trendMonths.length - 1; 
                    return (
                      <div key={m} className="flex flex-col items-center justify-end h-full flex-1 group">
                        <div className="w-full flex justify-center items-end h-full pb-2">
                           <div 
                             className={`w-full max-w-[24px] rounded-t-sm transition-all duration-300 ${isHigh || val === maxTrend ? 'bg-rose-500' : 'bg-rose-300/60 dark:bg-rose-500/40 hover:bg-rose-400'}`}
                             style={{ height: `${hPct}%` }}
                           />
                        </div>
                        <span className="text-[11px] font-medium text-slate-500 mt-1">
                          T{parseInt(m.slice(5))}
                        </span>
                      </div>
                    )
                  }) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm italic">Không đủ dữ liệu xu hướng</div>
                  )}
               </div>
            </div>
          </div>

        </div>

        {/* Why it matters Box */}
        <div className="bg-slate-100/50 dark:bg-slate-800/50 rounded-2xl p-6 border theme-border">
          <div className="flex items-center gap-2 mb-6 text-violet-600 dark:text-violet-400 font-black text-xs uppercase tracking-widest">
             <Zap className="w-4 h-4" /> VÌ SAO ĐIỀU NÀY QUAN TRỌNG
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
             <div className="flex items-start gap-4">
                <div className="p-3 rounded-full bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400 shrink-0">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <div>
                  <h6 className="font-bold text-slate-800 dark:text-slate-200 mb-1.5 text-sm">Rủi ro cháy tài khoản</h6>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">Không có SL &rarr; Một lệnh thua có thể quét sạch lợi nhuận của nhiều ngày.</p>
                </div>
             </div>
             <div className="flex items-start gap-4">
                <div className="p-3 rounded-full bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400 shrink-0">
                  <BrainCircuit className="w-6 h-6" />
                </div>
                <div>
                  <h6 className="font-bold text-slate-800 dark:text-slate-200 mb-1.5 text-sm">Tâm lý hy vọng</h6>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">Giá đi ngược &rarr; Gồng lỗ với hy vọng giá quay lại thay vì cắt sớm và chờ cơ hội khác.</p>
                </div>
             </div>
             <div className="flex items-start gap-4">
                <div className="p-3 rounded-full bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400 shrink-0">
                  <TrendingDown className="w-6 h-6" />
                </div>
                <div>
                  <h6 className="font-bold text-slate-800 dark:text-slate-200 mb-1.5 text-sm">Mất kiểm soát hệ thống</h6>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">Rủi ro mở không giới hạn phá vỡ hoàn toàn lợi thế toán học (Edge) dài hạn.</p>
                </div>
             </div>
          </div>
        </div>

        {/* Evidence & Coach Tip */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Evidence */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border theme-border shadow-sm">
             <div className="space-y-6">
                {evObserved.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-200">
                         <span className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]"></span> Chuỗi quan sát được (Observed)
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">PRIMARY</span>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 border border-slate-100 dark:border-slate-700/50 space-y-1">
                       {evObserved[0].split('\n').map((line, idx) => {
                         const isBullet = line.trim().startsWith('•') || line.trim().startsWith('-');
                         return (
                           <div key={idx} className={`text-sm leading-relaxed ${isBullet ? 'ml-2 mt-2 text-slate-600 dark:text-slate-400 flex items-start gap-2' : 'font-semibold text-slate-800 dark:text-slate-200 mb-2'}`}>
                              {isBullet && <span className="text-blue-500 font-black mt-0.5">•</span>}
                              <span>{line.replace(/^[•-]\s*/, '')}</span>
                           </div>
                         );
                       })}
                    </div>
                  </div>
                )}
                
                {evDeclared.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-200">
                         <span className="w-2 h-2 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.8)]"></span> Lời thú nhận (Declared)
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">STRONG</span>
                    </div>
                    <div className="bg-purple-50/50 dark:bg-purple-500/10 rounded-xl p-4 border border-purple-100/50 dark:border-purple-500/20">
                       {evDeclared.map((line, idx) => (
                         <div key={idx} className="text-sm text-purple-900 dark:text-purple-200 font-medium flex items-start gap-2">
                            <span className="text-purple-500 font-black mt-0.5">"</span>
                            <span className="italic">{line}</span>
                            <span className="text-purple-500 font-black mt-0.5">"</span>
                         </div>
                       ))}
                    </div>
                  </div>
                )}

                {evContext.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-200">
                         <span className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]"></span> Bối cảnh tâm lý (Context)
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">SUPPORTING</span>
                    </div>
                    <div className="bg-amber-50/50 dark:bg-amber-500/10 rounded-xl p-4 border border-amber-100/50 dark:border-amber-500/20">
                       {evContext.map((line, idx) => (
                         <div key={idx} className="text-sm text-amber-900 dark:text-amber-200 font-medium">
                            {line}
                         </div>
                       ))}
                    </div>
                  </div>
                )}
             </div>
          </div>

          {/* Coach Tip */}
          <div className="bg-rose-50/50 dark:bg-rose-900/20 rounded-2xl p-6 border border-rose-100 dark:border-rose-500/20 shadow-sm flex flex-col justify-between">
             <div className="flex items-center gap-2 mb-4 text-rose-500 dark:text-rose-400 font-black text-xs uppercase tracking-widest">
                <Lightbulb className="w-4 h-4" /> COACH TIP
             </div>
             <div className="flex gap-3 text-rose-900 dark:text-rose-100 flex-1 items-center">
                <span className="text-4xl text-rose-300 dark:text-rose-600 font-serif leading-none mt-[-10px]">"</span>
                <p className="text-sm font-medium leading-relaxed italic pr-4">
                  Thà chấp nhận một khoản lỗ nhỏ đúng kế hoạch, còn hơn giữ lệnh và cầu nguyện. Stop Loss chính là bảo hiểm sinh mạng cho tài khoản của bạn, hãy luôn bật nó!
                </p>
             </div>
             <div className="text-right text-xs font-bold text-rose-400 dark:text-rose-500 mt-4">
               — Coach AI
             </div>
          </div>
        </div>

        {/* Quick Suggestion */}
        <div className="bg-slate-100 dark:bg-slate-800/60 rounded-xl p-4 border theme-border flex items-center gap-3">
           <div className="flex items-center gap-2 text-violet-600 dark:text-violet-400 font-black text-xs shrink-0">
             <Zap className="w-4 h-4 fill-violet-600 dark:fill-violet-400" /> Gợi ý nhanh:
           </div>
           <div className="text-xs text-slate-600 dark:text-slate-300 font-medium flex items-center flex-wrap gap-x-2 gap-y-1">
             <span>Luôn đặt cứng SL ngay khi vừa khớp lệnh</span>
             <span className="text-slate-400">•</span>
             <span>Tuyệt đối không nới rộng khoảng cách SL</span>
             <span className="text-slate-400">•</span>
             <span>Tuân thủ rủi ro tối đa 1-2% tài khoản cho mỗi lệnh</span>
           </div>
        </div>

      </div>
    </div>
  );
}
