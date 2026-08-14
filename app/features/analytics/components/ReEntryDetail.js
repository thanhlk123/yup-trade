import { Target, Info, Activity, AlertTriangle, ShieldCheck, CheckCircle2, TrendingDown, TrendingUp, Minus, HelpCircle, Filter } from 'lucide-react';

function fmt$(n) {
  if (!n && n !== 0) return '$0';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '+';
  if (abs >= 1000) return sign + '$' + (abs / 1000).toFixed(1) + 'k';
  return sign + '$' + abs.toFixed(2);
}

function fmtPct(n) { return (n * 100).toFixed(0) + '%'; }

export function ReEntryDetail({ behavior, onFilterTrades, t }) {
  const { attemptMetrics, baseline, classification, episodesCount, affectedTradeIds } = behavior;
  const isHarmful = classification === 'harmful';
  const isEffective = classification === 'effective';
  const isNeutral = classification === 'neutral';
  
  const attempt2 = attemptMetrics[1] || { count: 0, expectancy: 0 };
  const baselineExpectancy = baseline?.expectancy || 0;
  const edgeDelta = attempt2.expectancy - baselineExpectancy;
  
  let headerText = 'Re-entry Pattern';
  let subHeaderText = 'Đang thu thập dữ liệu...';
  let colorClass = 'text-slate-500';
  let bgGlow = 'bg-slate-500';
  let icon = <Info className="w-5 h-5" />;
  
  if (isHarmful) {
    headerText = 'Re-entry Pattern';
    subHeaderText = '🔴 UNDERPERFORMING — Re-entry lần đầu đang làm suy giảm Edge';
    colorClass = 'text-rose-500 dark:text-rose-400';
    bgGlow = 'bg-rose-500';
    icon = <AlertTriangle className="w-5 h-5 text-rose-500" />;
  } else if (isEffective) {
    headerText = 'Re-entry Pattern';
    subHeaderText = '🟢 EFFECTIVE — Smart Re-entry (Bắt nhịp lại cực kỳ sắc bén)';
    colorClass = 'text-emerald-500 dark:text-emerald-400';
    bgGlow = 'bg-emerald-500';
    icon = <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
  } else if (isNeutral) {
    headerText = 'Re-entry Pattern';
    subHeaderText = '⚪ NEUTRAL — Re-entry không làm thay đổi hiệu suất đáng kể';
    colorClass = 'text-slate-500 dark:text-slate-400';
    bgGlow = 'bg-slate-500';
    icon = <Minus className="w-5 h-5 text-slate-500" />;
  } else if (classification === 'underperforming') {
    headerText = 'Re-entry Pattern';
    subHeaderText = '🟡 UNDERPERFORMING — Re-entry có lãi nhưng kém hơn chờ Setup mới';
    colorClass = 'text-amber-500 dark:text-amber-400';
    bgGlow = 'bg-amber-500';
    icon = <TrendingDown className="w-5 h-5 text-amber-500" />;
  }

  // Attempt Curve Logic
  const attemptsArray = Object.keys(attemptMetrics)
    .sort((a,b) => parseInt(a) - parseInt(b))
    .map(key => ({ attemptNum: parseInt(key) + 1, data: attemptMetrics[key] }));
  
  const maxAbsExpectancy = Math.max(1, ...attemptsArray.map(a => Math.abs(a.data.expectancy)));
  
  let highestPositiveAttempt = -1;
  let hasRecovery = false;
  
  // Find tipping point based on positive expectancy with N >= 3
  for (let i = 1; i < attemptsArray.length; i++) {
    const a = attemptsArray[i];
    if (a.data.count >= 3 && a.data.expectancy > 0) {
      highestPositiveAttempt = a.attemptNum;
      if (a.attemptNum > 2) hasRecovery = true;
    }
  }
  
  let maxReEntriesAllowed = -1;
  if (highestPositiveAttempt !== -1) {
    // Limits at the highest solid positive attempt
    maxReEntriesAllowed = highestPositiveAttempt - 1;
  } else if (attempt2.expectancy < 0) {
    maxReEntriesAllowed = 0;
  }

  return (
    <div className="mt-6 rounded-2xl border theme-border bg-white/80 dark:bg-slate-900/80 backdrop-blur-md p-6 animate-slide-up shadow-xl dark:shadow-2xl relative overflow-hidden">
      <div className={`absolute top-0 right-0 w-64 h-64 opacity-10 dark:opacity-5 pointer-events-none blur-3xl rounded-full ${bgGlow} -translate-y-1/2 translate-x-1/4`}></div>
      
      {/* Header */}
      <div className="flex items-start justify-between mb-6 relative z-10">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            {icon}
            <h4 className={`text-2xl font-black tracking-tight ${colorClass}`}>
              {headerText}
            </h4>
          </div>
          <p className="text-sm font-bold text-slate-700 dark:text-slate-200 mt-1">
            {subHeaderText}
          </p>
          <div className="flex items-center gap-2 mt-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
              {episodesCount} Episodes
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
              {affectedTradeIds?.length} Affected Trades
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
              Confidence {Math.round((behavior.confidence || 0) * 100)}%
            </span>
          </div>
        </div>
        
        {/* Filter Button */}
        <button
          onClick={() => onFilterTrades && onFilterTrades(affectedTradeIds)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-xs font-bold rounded-lg transition-colors border border-indigo-100 dark:border-indigo-500/20"
        >
          <Filter className="w-3.5 h-3.5" />
          Lọc {affectedTradeIds?.length || 0} lệnh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
        
        {/* Left Col: Hero Insight & Capacity */}
        <div className="space-y-6">
          
          <div className="bg-slate-50 dark:bg-slate-950/50 rounded-xl p-5 border border-slate-100 dark:border-slate-800/60">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                <Activity className="w-3 h-3" /> HERO INSIGHT
              </p>
              
              <div className="group relative flex items-center cursor-help text-slate-400 hover:text-indigo-500 transition-colors">
                <HelpCircle className="w-4 h-4" />
                <div className="absolute right-0 top-full mt-2 w-64 p-3 bg-slate-800 dark:bg-slate-700 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 pointer-events-none">
                  <p className="text-white text-xs font-medium leading-relaxed m-0">
                    <strong className="text-indigo-300">Expectancy (Kỳ vọng):</strong> Là số tiền trung bình bạn lãi/lỗ TRÊN MỖI LỆNH. Nó giúp so sánh công bằng hiệu quả giữa các cách đánh khác nhau.
                  </p>
                </div>
              </div>
            </div>

            {isHarmful ? (
              <p className="text-sm font-bold text-rose-500 mb-4 flex items-center gap-1.5"><AlertTriangle className="w-4 h-4"/> Nhịp Re-entry đầu tiên làm giảm lợi thế</p>
            ) : isEffective ? (
              <p className="text-sm font-bold text-emerald-500 mb-4 flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4"/> Nhịp Re-entry đầu tiên cực kỳ chất lượng</p>
            ) : (
              <p className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-4 flex items-center gap-1.5"><Info className="w-4 h-4"/> So sánh hiệu quả</p>
            )}
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Lệnh thông thường (Normal Setup)</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">Trung bình mỗi lệnh</p>
                </div>
                <span className="font-mono font-bold text-slate-700 dark:text-slate-200">{fmt$(baselineExpectancy)}</span>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Nhịp gỡ đầu tiên (Re-entry #1)</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">Trung bình mỗi lệnh</p>
                </div>
                <span className={`font-mono font-bold ${attempt2.expectancy < 0 ? 'text-rose-500' : 'text-emerald-500'}`}>{fmt$(attempt2.expectancy)}</span>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800">
                <span className="text-sm text-slate-500 font-black uppercase">Mức chênh lệch (Delta)</span>
                <span className={`font-mono font-black text-lg ${edgeDelta < 0 ? 'text-rose-500' : 'text-emerald-500'}`}>{fmt$(edgeDelta)}</span>
              </div>
            </div>
            
            {edgeDelta < 0 && (
              <p className="text-xs text-rose-500/80 dark:text-rose-400/80 italic mt-3 bg-rose-50 dark:bg-rose-500/10 p-2 rounded-lg">
                * Việc vội vàng vào lại khiến mỗi lệnh Re-entry của bạn kiếm ít hơn (hoặc lỗ nhiều hơn) bình thường <strong className="font-bold">{fmt$(Math.abs(edgeDelta))}</strong>.
              </p>
            )}
          </div>

          <div className="bg-slate-50 dark:bg-slate-950/50 rounded-xl p-5 border border-slate-100 dark:border-slate-800/60">
            <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-1.5">
              <ShieldCheck className="w-3 h-3" /> YOUR RE-ENTRY CAPACITY
            </p>
            {maxReEntriesAllowed === 0 ? (
              <div>
                <p className="text-sm font-bold text-rose-500 mb-2 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4"/> Tuyệt đối không Re-entry trên setup này!
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Dữ liệu cho thấy ngay từ <strong>nhịp vào gỡ lỗ đầu tiên (Re-entry #1)</strong>, lợi thế của bạn đã chuyển sang số Âm và không có dấu hiệu phục hồi rõ rệt. Hãy kiên nhẫn chờ setup mới!
                </p>
              </div>
            ) : maxReEntriesAllowed > 0 && hasRecovery ? (
              <div>
                <p className="text-sm font-bold text-emerald-500 mb-2 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4"/> Điểm yếu ở nhịp đầu tiên!
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Nhịp Re-entry đầu tiên của bạn khá vội vàng (âm tiền), nhưng dữ liệu cho thấy nếu bạn bám đuổi đến <strong>Re-entry #{maxReEntriesAllowed}</strong> thì lợi thế lại phục hồi rất mạnh. Tipping Point của bạn nằm ở <strong>sau Re-entry #{maxReEntriesAllowed}</strong>. (Lưu ý cẩn thận với các nhịp có Sample Size nhỏ).
                </p>
              </div>
            ) : maxReEntriesAllowed > 0 ? (
               <div>
                <p className="text-sm font-bold text-amber-500 mb-2 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4"/> Re-entry tối đa {maxReEntriesAllowed} lần
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Bạn xử lý khá tốt ở nhịp đầu tiên, nhưng kể từ <strong>nhịp Re-entry #{maxReEntriesAllowed + 1}</strong>, lợi thế của bạn lao dốc. Đó là điểm Tipping Point (giới hạn não bộ). Tuyệt đối không cố chấp bám đuổi thêm!
                </p>
              </div>
            ) : (
              <div>
                <p className="text-sm font-bold text-emerald-500 mb-2 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4"/> Chưa chạm Tipping Point
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">Chưa tìm thấy giới hạn sụt giảm Edge rõ rệt. Các nhịp Re-entry của bạn vẫn đang duy trì lợi thế dương. Hãy tiếp tục giữ vững tâm lý và kỷ luật này.</p>
              </div>
            )}
          </div>
          
        </div>

        {/* Right Col: Attempt Curve */}
        <div className="bg-slate-50 dark:bg-slate-950/50 rounded-xl p-5 border border-slate-100 dark:border-slate-800/60">
           <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1 flex items-center gap-1.5">
              <Activity className="w-3 h-3" /> EXPECTANCY BY ATTEMPT
           </p>
           <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-5 italic">
             * Lãi/lỗ trung bình trên MỖI LỆNH ở từng nhịp gỡ. Nhịp làm mờ (N&lt;5) mang tính tham khảo, độ tin cậy thấp.
           </p>
           
           <div className="space-y-5">
             {attemptsArray.map(a => {
               const isNegative = a.data.expectancy < 0;
               const widthPct = Math.min(100, Math.abs(a.data.expectancy) / maxAbsExpectancy * 100);
               const name = a.attemptNum === 1 ? 'Trigger Loss' : `Re-entry #${a.attemptNum - 1}`;
               const isLowSample = a.data.count < 5;
               
               return (
                 <div key={a.attemptNum} className="flex items-center gap-3">
                   <div className="w-[105px] shrink-0 text-right group relative z-20">
                     <p className={`text-xs font-bold text-slate-700 dark:text-slate-300 cursor-default transition-opacity ${isLowSample ? 'opacity-40 group-hover:opacity-100' : ''}`}>
                       {name} <span className="font-normal text-[10px] text-slate-500 dark:text-slate-400 ml-1">(N={a.data.count})</span>
                     </p>
                     {isLowSample && (
                       <div className="absolute right-0 top-full mt-2 w-max px-2.5 py-1.5 bg-slate-900 dark:bg-slate-700 text-amber-400 dark:text-amber-300 text-[10px] font-medium rounded-md shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible z-50 border border-slate-700 dark:border-slate-600">
                         ⚠️ Dữ liệu quá mỏng (N={a.data.count}), không đủ độ tin cậy thống kê!
                       </div>
                     )}
                   </div>
                   <div className={`w-16 shrink-0 text-right ${isLowSample ? 'opacity-40' : ''}`}>
                     <p className={`text-xs font-mono font-bold ${isNegative ? 'text-rose-500' : 'text-emerald-500'}`}>
                       {fmt$(a.data.expectancy)}
                     </p>
                   </div>
                   <div className="flex-1 h-5 flex items-center relative border-l-2 border-slate-300 dark:border-slate-700 pl-2">
                      <div className={`h-2.5 rounded-r-full transition-opacity ${isLowSample ? 'opacity-40' : ''} ${isNegative ? 'bg-rose-500/80' : 'bg-emerald-500/80'}`} style={{width: `${widthPct}%`}}></div>
                      {isLowSample && (
                        <AlertTriangle className="w-3 h-3 text-amber-500/50 dark:text-amber-400/50 ml-2" />
                      )}
                   </div>
                 </div>
               )
             })}
           </div>
           
           <div className="mt-8 pt-5 border-t border-slate-200 dark:border-slate-800">
              <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                <Info className="w-3 h-3" /> THUẬT TOÁN GOM CHUỖI (WHY DETECTED)
              </p>
              <ul className="text-[11.5px] text-slate-600 dark:text-slate-400 list-disc pl-4 space-y-2 leading-relaxed">
                 <li>Phát hiện <strong>{episodesCount}</strong> chuỗi Re-entry.</li>
                 <li>Mỗi chuỗi bắt đầu từ một lệnh bị cắt lỗ (Trigger Loss).</li>
                 <li>Các lệnh gỡ tiếp theo phải vào <strong>cùng Mã</strong>, <strong>cùng Hướng (Buy/Sell)</strong> và cách lệnh lỗ trước đó <strong>&lt; {behavior.evidence?.derived?.[2]?.match(/<(\d+)/)?.[1] || '15'} phút</strong>.</li>
              </ul>
           </div>
        </div>

      </div>
    </div>
  );
}
