import React from 'react';
import { Target, Info, Activity, AlertTriangle, ShieldCheck, CheckCircle2, TrendingDown, Minus, Filter, List, Layers } from 'lucide-react';

function fmt$(n) {
  if (!n && n !== 0) return '$0';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '+';
  if (abs >= 1000) return sign + '$' + (abs / 1000).toFixed(1) + 'k';
  return sign + '$' + abs.toFixed(2);
}

export function PositionSizingDetail({ behavior, onFilterTrades, t }) {
  const { classification, affectedTradeIds, affectedRatio, metrics, confidence, coaching } = behavior;
  const { topAffectedAsset, totalAnomalyCount, assetStats } = metrics || {};
  
  const isHarmful = classification === 'harmful';
  const isEffective = classification === 'effective';
  const isNeutral = classification === 'neutral';
  const isUnderperforming = classification === 'underperforming';
  const isMixed = classification === 'mixed';
  const isDeclaredViolation = classification === 'declared_violation';
  
  let headerText = 'Position Sizing';
  let subHeaderText = 'Đang phân tích...';
  let colorClass = 'text-slate-500';
  let bgGlow = 'bg-slate-500';
  let icon = <Info className="w-5 h-5" />;
  
  if (isHarmful) {
    subHeaderText = '🔴 HARMFUL — Đánh Volume lớn đang phá hủy lợi thế (Edge) của bạn';
    colorClass = 'text-rose-500 dark:text-rose-400';
    bgGlow = 'bg-rose-500';
    icon = <AlertTriangle className="w-5 h-5 text-rose-500" />;
  } else if (isEffective) {
    subHeaderText = '🟢 EFFECTIVE — Sizing lớn mang lại lợi thế xuất sắc (High Conviction)';
    colorClass = 'text-emerald-500 dark:text-emerald-400';
    bgGlow = 'bg-emerald-500';
    icon = <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
  } else if (isNeutral) {
    subHeaderText = '⚪ NEUTRAL — Volume lớn không làm thay đổi hiệu suất đáng kể';
    colorClass = 'text-slate-500 dark:text-slate-400';
    bgGlow = 'bg-slate-500';
    icon = <Minus className="w-5 h-5 text-slate-500" />;
  } else if (isUnderperforming) {
    subHeaderText = '🟡 UNDERPERFORMING — Vẫn có lãi nhưng hiệu suất (Edge) kém hơn đánh bình thường';
    colorClass = 'text-amber-500 dark:text-amber-400';
    bgGlow = 'bg-amber-500';
    icon = <TrendingDown className="w-5 h-5 text-amber-500" />;
  } else if (isMixed) {
    subHeaderText = '🟣 MIXED — Hiệu suất khi đánh Volume lớn bất nhất giữa các mã tài sản';
    colorClass = 'text-purple-500 dark:text-purple-400';
    bgGlow = 'bg-purple-500';
    icon = <Activity className="w-5 h-5 text-purple-500" />;
  } else if (isDeclaredViolation) {
    subHeaderText = '🟠 DECLARED — Tự khai báo vi phạm, chưa đủ dữ liệu thống kê';
    colorClass = 'text-orange-500 dark:text-orange-400';
    bgGlow = 'bg-orange-500';
    icon = <ShieldCheck className="w-5 h-5 text-orange-500" />;
  }

  const sortedAssets = assetStats ? Object.values(assetStats).sort((a, b) => b.anomalyCount - a.anomalyCount) : [];
  
  const statConf = confidence?.statistical || 0;
  const statConfText = statConf > 0.9 ? 'Rất cao' : statConf > 0.7 ? 'Cao' : statConf > 0.5 ? 'Trung bình' : 'Thấp';
  const statConfPct = Math.round(statConf * 100);

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
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
              {affectedTradeIds?.length} AFFECTED · {((affectedRatio || 0) * 100).toFixed(1)}% OF ALL TRADES
            </span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border 
              ${statConf > 0.7 ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800' : 
                statConf > 0.5 ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800' :
                'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'}`} 
              title="Statistical Confidence (Based on Sample Size)">
              Độ tin cậy: {statConfText} ({statConfPct}%)
            </span>
            {confidence?.declared > 0 && (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-800/50">
                Tự khai báo: YES
              </span>
            )}
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
        
        {/* Left Col: Hero Insight & Edge Comparison */}
        <div className="space-y-6">
          
          <div className="bg-slate-50 dark:bg-slate-950/50 rounded-xl p-5 border border-slate-100 dark:border-slate-800/60">
            <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-1.5">
              <Activity className="w-3 h-3" /> EDGE DEGRADATION
            </p>

            {topAffectedAsset && topAffectedAsset.assetClass !== 'insufficient_baseline' ? (
              <>
                <p className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4">
                  Phân tích độ lệch Edge trên <span className="text-indigo-500 px-1">{topAffectedAsset.asset}</span>
                </p>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Volume Bình thường</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">Expectancy</p>
                    </div>
                    <span className="font-mono font-bold text-slate-700 dark:text-slate-200">{fmt$(topAffectedAsset.normExp)} <span className="text-[10px] text-slate-400">/ trade</span></span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Volume Lớn (Vượt P90)</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">Expectancy</p>
                    </div>
                    <span className={`font-mono font-bold ${topAffectedAsset.anomExp < 0 ? 'text-rose-500' : 'text-emerald-500'}`}>{fmt$(topAffectedAsset.anomExp)} <span className="text-[10px] text-slate-400">/ trade</span></span>
                    <span className={`font-mono font-bold ${topAffectedAsset.anomExp < 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                      {topAffectedAsset.anomExp > 0 ? '+' : ''}{topAffectedAsset.anomExp?.toFixed(2)}{topAffectedAsset.usedMetric === 'R' ? 'R' : '$'}
                      <span className="text-[10px] text-slate-400"> / trade</span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800">
                    <div>
                      <span className="text-sm text-slate-500 font-black uppercase block">Edge Delta</span>
                      <span className="text-[10px] text-slate-400 block mt-0.5 max-w-[150px]">Expectancy lost when sizing above your baseline</span>
                    </div>
                    <span className={`font-black text-2xl ${isEffective ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {topAffectedAsset.delta > 0 ? '+' : ''}{topAffectedAsset.delta.toFixed(2)}{topAffectedAsset.usedMetric === 'R' ? 'R' : '$'} 
                      <span className="text-xs text-slate-400 font-medium">/ trade</span>
                    </span>
                  </div>
                </div>
              </>
            ) : (
               <div className="flex items-center justify-center py-6">
                 <p className="text-sm text-slate-500 italic text-center">Chưa đủ dữ liệu lệnh Normal làm cơ sở so sánh (Baseline) để tính Edge Delta.</p>
               </div>
            )}
          </div>

          <div className="bg-slate-50 dark:bg-slate-950/50 rounded-xl p-5 border border-slate-100 dark:border-slate-800/60">
            <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <Target className="w-3 h-3" /> TIÊU CHÍ PHÁT HIỆN (DETECTION)
            </p>
            <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-2 list-disc list-inside">
              <li>Volume lệnh lớn hơn <strong>Top 10%</strong> (Ngưỡng P90) của chính bạn.</li>
              <li>Volume lớn <strong>gấp 1.5 lần</strong> mức trung vị (Median) thông thường.</li>
            </ul>
          </div>

          <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-xl p-5 border border-indigo-100 dark:border-indigo-800/30">
             <p className="text-[10px] font-black text-indigo-400 dark:text-indigo-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <Info className="w-3 h-3" /> INSIGHT
            </p>
            <p className="text-sm font-medium text-indigo-900 dark:text-indigo-200 leading-relaxed">
              {coaching}
            </p>
          </div>

        </div>

        {/* Right Col: Asset Breakdown & Snapshot */}
        <div className="space-y-6">
          
          {/* Sizing Snapshot */}
          {topAffectedAsset && topAffectedAsset.baseline && (
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-200 dark:border-slate-700">
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2">
                <Layers className="w-4 h-4 text-slate-500" />
                Baseline Analysis ({topAffectedAsset.asset})
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                  <p className="text-xs text-slate-400 mb-1">Median Size (P50)</p>
                  <p className="font-mono font-bold text-slate-700 dark:text-slate-200">{topAffectedAsset.baseline.medSize?.toFixed(2)}</p>
                </div>
                <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                  <p className="text-xs text-slate-400 mb-1">Threshold (P90)</p>
                  <p className="font-mono font-bold text-slate-700 dark:text-slate-200">{topAffectedAsset.baseline.p90Size?.toFixed(2)}</p>
                </div>
                <div className="p-3 bg-rose-50 dark:bg-rose-500/10 rounded-xl border border-rose-100 dark:border-rose-500/20">
                  <p className="text-xs text-rose-500/70 mb-1">Anomaly Target</p>
                  <p className="font-mono font-bold text-rose-500 dark:text-rose-400">{'>'} {topAffectedAsset.baseline.p90Size?.toFixed(2)}</p>
                </div>
                <div className="p-3 bg-rose-50 dark:bg-rose-500/10 rounded-xl border border-rose-100 dark:border-rose-500/20">
                  <p className="text-xs text-rose-500/70 mb-1">Your Max Size</p>
                  <p className="font-mono font-black text-rose-600 dark:text-rose-400">{topAffectedAsset.largestSize?.toFixed(2)}</p>
                  {topAffectedAsset.baseline.p90Size > 0 && (
                    <p className="text-[9px] text-rose-400">{(topAffectedAsset.largestSize / topAffectedAsset.baseline.p90Size).toFixed(1)}x your P90</p>
                  )}
                </div>
              </div>
            </div>
          )}
          
          <div className="bg-slate-50 dark:bg-slate-950/50 rounded-xl p-5 border border-slate-100 dark:border-slate-800/60 h-full">
            <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-1.5">
              <List className="w-3 h-3" /> CHI TIẾT THEO MÃ TÀI SẢN (ASSETS)
            </p>
            
            {sortedAssets.length > 0 ? (
              <div className="space-y-3">
                {sortedAssets.map(ast => (
                  <div key={ast.asset} className="flex items-center justify-between p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/50 shadow-sm">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">{ast.asset}</span>
                        {ast.assetClass === 'harmful' && <span className="w-2 h-2 rounded-full bg-rose-500" title="Harmful"></span>}
                        {ast.assetClass === 'effective' && <span className="w-2 h-2 rounded-full bg-emerald-500" title="Effective"></span>}
                        {ast.assetClass === 'underperforming' && <span className="w-2 h-2 rounded-full bg-amber-500" title="Underperforming"></span>}
                        {ast.assetClass === 'insufficient_baseline' && <span className="w-2 h-2 rounded-full bg-slate-400" title="Insufficient Baseline"></span>}
                      </div>
                      <p className="text-[10px] text-slate-500 mt-0.5">{ast.anomalyCount} lệnh bất thường / {ast.normalCount} bình thường</p>
                      {ast.baseline && (
                        <p className="text-[10px] text-slate-400 mt-0.5">P90: <strong className="text-slate-500 dark:text-slate-300">{ast.baseline.p90Size?.toFixed(2)}</strong> | Med: {ast.baseline.medSize?.toFixed(2)}</p>
                      )}
                    </div>
                    
                    {ast.assetClass !== 'insufficient_baseline' ? (
                       <div className="text-right">
                         <div className="flex items-center gap-2 justify-end">
                            <span className="text-[10px] text-slate-400 w-16">Normal</span>
                            <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                                {ast.normExp > 0 ? '+' : ''}{ast.normExp?.toFixed(2)}{ast.usedMetric === 'R' ? 'R' : '$'}
                            </p>
                         </div>
                         <div className="flex items-center gap-2 justify-end">
                            <span className="text-[10px] text-slate-400 w-16">Oversize</span>
                            <p className={`text-sm font-black ${ast.anomExp > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                {ast.anomExp > 0 ? '+' : ''}{ast.anomExp?.toFixed(2)}{ast.usedMetric === 'R' ? 'R' : '$'}
                            </p>
                         </div>
                       </div>
                    ) : (
                       <div className="text-right">
                         <p className="text-xs text-slate-400 italic">No Baseline</p>
                       </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
               <p className="text-sm text-slate-500 italic">Không có dữ liệu phân bổ mã tài sản.</p>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
