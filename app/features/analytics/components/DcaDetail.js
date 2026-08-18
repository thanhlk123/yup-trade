import React from 'react';
import { Target, TrendingDown, TrendingUp, X, Lightbulb, Zap, Search, AlertCircle, BrainCircuit, Activity, BarChart2, Scale, Layers, AlertTriangle } from 'lucide-react';

function fmt$(n) {
  if (!n && n !== 0) return '$0';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '+';
  if (abs >= 1000) return sign + '$' + (abs / 1000).toFixed(1) + 'k';
  return sign + '$' + abs.toFixed(2);
}

function fmtR(n) {
  if (!n && n !== 0) return '0.00R';
  const sign = n < 0 ? '-' : '+';
  return sign + Math.abs(n).toFixed(2) + 'R';
}

function fmtPct(n) { return (n * 100).toFixed(1) + '%'; }

export function DcaDetail({ behavior, onFilterTrades, onClose, trades, t }) {
  const { affectedTradeIds, category, evidence, dcaMetrics, nonDcaBaseline, edgeDelta, profile, aiInsight, status } = behavior;
  const violationCount = affectedTradeIds?.length || behavior.occurrences || 0;
  
  const trend = behavior.trend || {};
  const trendMonths = trend.months || [];
  const trendVals = trendMonths.map(m => trend.monthly[m] || 0);
  const maxTrend = Math.max(...trendVals, 1);

  const evObserved = evidence?.observed || [];
  const evDeclared = evidence?.declared || [];

  const insight = aiInsight || {};
  const why = insight.why || {};
  const recovery = insight.recovery || {};

  const isCritical = profile === 'DESTRUCTIVE_DCA' || profile === 'MARTINGALE';
  const isHighRisk = profile === 'AGGRESSIVE_AVERAGING' || isCritical;
  const isMediumRisk = profile === 'AVERAGING_DOWN';
  const isLowRisk = profile === 'CONTROLLED_SCALE_IN' || profile === 'AGGRESSIVE_SCALE_IN';

  const themeColor = isLowRisk ? 'emerald' : isMediumRisk ? 'amber' : 'rose';
  
  const getProfileTitle = () => {
    switch(profile) {
      case 'DESTRUCTIVE_DCA': return 'DCA HỦY DIỆT (DESTRUCTIVE)';
      case 'MARTINGALE': return 'DCA GẤP THẾP (MARTINGALE)';
      case 'AGGRESSIVE_AVERAGING': return 'NHỒI LỖ QUÁ MỨC (AGGRESSIVE)';
      case 'AVERAGING_DOWN': return 'NHỒI KHI LỖ (AVERAGING DOWN)';
      case 'AGGRESSIVE_SCALE_IN': return 'SCALE-IN MẠNH (AGGRESSIVE)';
      case 'CONTROLLED_SCALE_IN': return 'SCALE-IN AN TOÀN (CONTROLLED)';
      default: return 'DCA / NHỒI LỆNH ÂM';
    }
  };

  const getPatternText = (pattern) => {
    switch(pattern) {
      case 'MARTINGALE': return 'Gấp thếp (x2 khối lượng)';
      case 'PROGRESSIVE': return 'Tăng dần khối lượng';
      case 'DECREASING': return 'Dò đáy (giảm dần size)';
      case 'MIXED': return 'Kích thước lộn xộn';
      case 'FLAT': return 'Bình quân giá (Size không đổi)';
      default: return pattern;
    }
  };

  const addedRiskPct = why.sizeMultiplier ? (why.sizeMultiplier - 1) * 100 : 0;
  const useR = insight.outcome?.expectancyR != null;

  return (
    <div className="mt-6 rounded-2xl border theme-border bg-white dark:bg-slate-900 shadow-xl dark:shadow-2xl relative overflow-hidden animate-slide-up">
      {/* Header section */}
      <div className="p-6 border-b theme-border relative z-10">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className={`w-2.5 h-2.5 rounded-full bg-${themeColor}-500`}></span>
              <p className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                {isLowRisk ? 'CHIẾN LƯỢC QUAN SÁT' : 'HÀNH VI CẦN SỬA'}
              </p>
            </div>
            <h4 className={`text-3xl font-black tracking-tight mb-3 ${isCritical ? 'text-rose-600 dark:text-rose-500' : 'text-slate-900 dark:text-white'}`}>
              {getProfileTitle()}
            </h4>
            <div className="flex items-center gap-2 text-xs font-semibold">
              <span className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 uppercase">
                MỨC ĐỘ RỦI RO: <span className={isHighRisk ? 'text-rose-500 font-black' : isMediumRisk ? 'text-amber-500 font-black' : 'text-emerald-500 font-black'}>{insight.riskLevel || 'N/A'}</span>
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
          
          {/* Left Box: Overview Stats */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border theme-border shadow-sm flex flex-col justify-between items-center text-center">
            <div className="flex w-full items-center justify-around mb-6">
               <div className="flex flex-col items-center">
                 <span className="text-4xl font-black text-slate-900 dark:text-white">{behavior.episodes?.total || 0}</span>
                 <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase">Chu kỳ (Episodes)</span>
               </div>
               <div className="h-10 w-px bg-slate-200 dark:bg-slate-700"></div>
               <div className="flex flex-col items-center">
                 <span className="text-4xl font-black text-slate-900 dark:text-white flex items-baseline gap-1">
                   <span className="text-emerald-500">{dcaMetrics?.wins || 0}W</span>
                   <span className="text-xl text-slate-300">-</span>
                   <span className="text-rose-500">{dcaMetrics?.losses || 0}L</span>
                 </span>
                 <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase">Thắng / Thua</span>
               </div>
            </div>

            <div className={`w-full bg-${themeColor}-50 dark:bg-${themeColor}-500/10 rounded-xl p-3 flex items-center justify-between border border-${themeColor}-100 dark:border-${themeColor}-500/20`}>
               <span className={`text-sm font-semibold text-${themeColor}-700 dark:text-${themeColor}-300`}>Lợi nhuận ròng (Total PnL)</span>
               <div className="flex items-center gap-2">
                 <span className={`text-xl font-black text-${themeColor}-600 dark:text-${themeColor}-400`}>
                   {useR ? fmtR(insight.outcome?.pnl) : fmt$(insight.outcome?.pnl)}
                 </span>
               </div>
            </div>
          </div>

          {/* Right Box: Added Exposure & Mechanics */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border theme-border shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2.5 mb-3">
                 <div className={`w-8 h-8 rounded-full bg-${themeColor}-100 dark:bg-${themeColor}-500/20 flex items-center justify-center shrink-0`}>
                   <Layers className={`w-4 h-4 text-${themeColor}-500`} />
                 </div>
                 <h5 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                   Mức độ Bơm Rủi ro (Risk Exposure)
                 </h5>
              </div>
              <ul className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed space-y-2">
                 <li>• Volume tăng tối đa: <strong className="text-slate-900 dark:text-white">{why.sizeMultiplier ? why.sizeMultiplier.toFixed(1) : 1}x</strong> lần lệnh đầu.</li>
                 {why.riskMultiplier && (
                   <li>• Risk tăng tối đa: <strong className="text-rose-500 dark:text-rose-400">{why.riskMultiplier.toFixed(1)}x</strong> lần rủi ro kế hoạch.</li>
                 )}
                 <li>• Mô hình nhồi: <strong className="text-slate-900 dark:text-white uppercase">{getPatternText(why.escalationPattern)}</strong></li>
              </ul>
              
              {why.addToInvalidationRatio > 0.7 && why.addToInvalidationRatio <= 5 && (
                <div className="mt-3 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 p-2.5 rounded-lg flex gap-2 items-start text-xs text-rose-700 dark:text-rose-300">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <p><strong>CẢNH BÁO:</strong> Bạn có xu hướng nhồi lệnh khi giá áp sát vùng Stoploss (={(why.addToInvalidationRatio * 100).toFixed(0)}% SL). Hành vi "cứu lệnh" tuyệt vọng này cực kỳ rủi ro.</p>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Edge Analysis Box */}
        <div className="bg-slate-100/50 dark:bg-slate-800/50 rounded-2xl p-6 border theme-border">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-black text-xs uppercase tracking-widest">
               <Activity className="w-4 h-4" /> PHÂN TÍCH LỢI THẾ TỔNG QUAN (EDGE ANALYSIS)
            </div>
            {useR && <span className="text-[10px] font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded uppercase">Đo bằng R-Multiple</span>}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
             {/* Win Rate */}
             <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700/50 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 p-3 opacity-10">
                  <Target className="w-16 h-16 text-slate-500" />
                </div>
                <h6 className="font-bold text-slate-500 dark:text-slate-400 mb-4 text-xs uppercase tracking-wider relative z-10">Win Rate (Nhồi lệnh)</h6>
                <div className="flex items-end gap-3 mb-2 relative z-10">
                  <span className="text-3xl font-black text-slate-900 dark:text-white leading-none">{fmtPct(dcaMetrics?.winRate || 0)}</span>
                  <div className={`flex items-center text-xs font-bold ${edgeDelta?.winRate < 0 ? 'text-rose-500' : 'text-emerald-500'} mb-1`}>
                    {edgeDelta?.winRate < 0 ? <TrendingDown className="w-3 h-3 mr-1" /> : <TrendingUp className="w-3 h-3 mr-1" />}
                    {fmtPct(Math.abs(edgeDelta?.winRate || 0))}
                  </div>
                </div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 relative z-10">
                  vs <span className="font-bold text-slate-700 dark:text-slate-300">{fmtPct(nonDcaBaseline?.winRate || 0)}</span> (Lệnh không nhồi)
                </p>
             </div>

             {/* Profit Factor */}
             <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700/50 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 p-3 opacity-10">
                  <Scale className="w-16 h-16 text-slate-500" />
                </div>
                <h6 className="font-bold text-slate-500 dark:text-slate-400 mb-4 text-xs uppercase tracking-wider relative z-10">Profit Factor</h6>
                <div className="flex items-end gap-3 mb-2 relative z-10">
                  <span className="text-3xl font-black text-slate-900 dark:text-white leading-none">{useR ? (dcaMetrics?.profitFactorR || 0).toFixed(2) : (dcaMetrics?.profitFactor || 0).toFixed(2)}</span>
                  <div className={`flex items-center text-xs font-bold ${edgeDelta?.profitFactor < 0 ? 'text-rose-500' : 'text-emerald-500'} mb-1`}>
                    {edgeDelta?.profitFactor < 0 ? <TrendingDown className="w-3 h-3 mr-1" /> : <TrendingUp className="w-3 h-3 mr-1" />}
                    {Math.abs(edgeDelta?.profitFactor || 0).toFixed(2)}
                  </div>
                </div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 relative z-10">
                  vs <span className="font-bold text-slate-700 dark:text-slate-300">{useR ? (nonDcaBaseline?.profitFactorR || 0).toFixed(2) : (nonDcaBaseline?.profitFactor || 0).toFixed(2)}</span> (Lệnh không nhồi)
                </p>
             </div>

             {/* Expectancy */}
             <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700/50 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 p-3 opacity-10">
                  <BarChart2 className="w-16 h-16 text-slate-500" />
                </div>
                <h6 className="font-bold text-slate-500 dark:text-slate-400 mb-4 text-xs uppercase tracking-wider relative z-10">Expectancy (Kỳ vọng)</h6>
                <div className="flex items-end gap-3 mb-2 relative z-10">
                  <span className="text-3xl font-black text-slate-900 dark:text-white leading-none">{useR ? fmtR(insight.outcome?.expectancyR) : fmt$(insight.outcome?.expectancy)}</span>
                  <div className={`flex items-center text-xs font-bold ${edgeDelta?.expectancy < 0 ? 'text-rose-500' : 'text-emerald-500'} mb-1`}>
                    {edgeDelta?.expectancy < 0 ? <TrendingDown className="w-3 h-3 mr-1" /> : <TrendingUp className="w-3 h-3 mr-1" />}
                    {useR ? fmtR(Math.abs(insight.outcome?.edgeDeltaExpectancyR || 0)) : fmt$(Math.abs(edgeDelta?.expectancy || 0))}
                  </div>
                </div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 relative z-10">
                  vs <span className="font-bold text-slate-700 dark:text-slate-300">{useR ? fmtR(nonDcaBaseline?.expectancyR) : fmt$(nonDcaBaseline?.expectancy)}</span> (Lệnh không nhồi)
                </p>
             </div>
          </div>
          
          {/* Recovery Behavior - New feature */}
          {recovery && recovery.attempted > 0 && (
            <div className="mt-6 flex flex-col md:flex-row gap-4 items-center bg-white dark:bg-slate-800 p-4 rounded-xl border theme-border">
               <div className="flex-1">
                 <h6 className="font-bold text-sm text-slate-800 dark:text-slate-200 mb-1">Thói quen gồng/cứu lỗ (Recovery Dependency)</h6>
                 <p className="text-xs text-slate-600 dark:text-slate-400">Bạn đã có {recovery.attempted} lần nhồi lệnh khi giá đi ngược. Trong đó {recovery.succeeded} lần hệ thống ghi nhận lệnh chuyển từ Lỗ thành Lãi. (Tỷ lệ: {fmtPct(recovery.recoveryRate)}).</p>
               </div>
               {recovery.recoveryRate > 0.5 ? (
                 <div className="px-3 py-1.5 bg-rose-50 dark:bg-rose-500/10 text-rose-600 text-xs font-bold rounded-lg border border-rose-200">
                    Dễ sinh ảo tưởng "Cứ gồng là sẽ về"
                 </div>
               ) : (
                 <div className="px-3 py-1.5 bg-amber-50 dark:bg-amber-500/10 text-amber-600 text-xs font-bold rounded-lg border border-amber-200">
                    Phần lớn nỗ lực cứu lệnh đều thất bại
                 </div>
               )}
            </div>
          )}

          {/* Dynamic Coach Evaluation */}
          <div className={`mt-6 p-4 rounded-xl flex items-start gap-4 border shadow-sm
            ${isCritical ? 'bg-rose-50/50 border-rose-200 dark:bg-rose-500/10 dark:border-rose-500/30 text-rose-900 dark:text-rose-100' : 
              isHighRisk || isMediumRisk ? 'bg-amber-50/50 border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/30 text-amber-900 dark:text-amber-100' : 
              'bg-emerald-50/50 border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/30 text-emerald-900 dark:text-emerald-100'}`}
          >
             <div className={`p-2.5 rounded-full shrink-0 
                ${isCritical ? 'bg-rose-100 dark:bg-rose-500/30 text-rose-600 dark:text-rose-400' : 
                  isHighRisk || isMediumRisk ? 'bg-amber-100 dark:bg-amber-500/30 text-amber-600 dark:text-amber-400' : 
                  'bg-emerald-100 dark:bg-emerald-500/30 text-emerald-600 dark:text-emerald-400'}`}
             >
               <BrainCircuit className="w-5 h-5" />
             </div>
             <div>
                <h6 className="font-bold mb-1 text-sm">Kết luận từ hệ thống (Behavior Engine):</h6>
                <p className="text-sm font-medium leading-relaxed opacity-90">
                  {profile === 'DESTRUCTIVE_DCA' && 'Hành vi nhồi lỗ của bạn đã ở mức hủy diệt. Khối lượng và rủi ro được bơm vào quá mức cho phép, vượt rào cản SL và không có dấu hiệu kiểm soát. Đây là con đường ngắn nhất dẫn đến cháy tài khoản dù win rate có cao.'}
                  {profile === 'MARTINGALE' && 'Bạn đang có thói quen gấp thếp khối lượng (nhân đôi) để gỡ gạc nhanh khi giá đi ngược. Đây là một trò chơi may rủi nguy hiểm chứ không còn là trading có kiểm soát.'}
                  {profile === 'AGGRESSIVE_AVERAGING' && 'Bạn nhồi lệnh rất mạnh tay khi giá bất lợi (Exposure tăng > 3x). Rủi ro tổng thể đang phình to ngoài kế hoạch.'}
                  {profile === 'AVERAGING_DOWN' && 'Bạn có thói quen nhồi thêm vị thế khi lệnh ban đầu bị âm. Dù chưa quá tay, nhưng Expectancy thường giảm mạnh so với những lệnh không nhồi. Hãy cân nhắc từ bỏ việc trung bình giá xuống.'}
                  {profile === 'AGGRESSIVE_SCALE_IN' && 'Bạn chia nhỏ lệnh vào (Scale-in), nhưng kích thước vào sau đôi khi khá lớn. Hãy đảm bảo Risk luôn nằm trong Budget.'}
                  {profile === 'CONTROLLED_SCALE_IN' && 'Khối lượng nhồi lệnh được kiểm soát tốt (không quá 1.5x) và cấu trúc vào lệnh hợp lý. Đây là một chiến lược quản trị vốn tốt chứ không mang tính hoảng loạn cứu lỗ.'}
                </p>
             </div>
          </div>
        </div>

        {/* Evidence Details */}
        {(evObserved.length > 0 || evDeclared.length > 0) && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border theme-border shadow-sm">
             <div className="flex items-center gap-2 mb-5 text-slate-500 dark:text-slate-400 font-black text-xs uppercase tracking-widest">
                <Search className="w-4 h-4" /> BẰNG CHỨNG GHI NHẬN (EVIDENCE)
             </div>
             <div className="space-y-6">
                {evObserved.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-200">
                         <span className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]"></span> Log trích xuất từ dữ liệu
                      </div>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 border border-slate-100 dark:border-slate-700/50 space-y-2">
                       {evObserved.map((line, idx) => {
                         const isBullet = line.trim().startsWith('•') || line.trim().startsWith('-');
                         return (
                           <div key={idx} className={`text-sm leading-relaxed ${isBullet ? 'ml-2 text-slate-600 dark:text-slate-400 flex items-start gap-2' : 'font-semibold text-slate-800 dark:text-slate-200 mb-1'}`}>
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
                         <span className="w-2 h-2 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.8)]"></span> Lời thú nhận / Hashtag
                      </div>
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
             </div>
          </div>
        )}

      </div>
    </div>
  );
}
