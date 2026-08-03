'use client';

import { useState, useCallback } from 'react';
import { X, Zap, TrendingDown, TrendingUp, RefreshCw, Info } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';

// ── PnL Calculator (pure function with contract multiplier) ─────────────────
function calcPnl({ side, entryPrice, exitPrice, size, multiplier = 1 }) {
  if (!entryPrice || !exitPrice || !size) return 0;
  const direction = side === 'BUY' ? 1 : -1;
  return Math.round((exitPrice - entryPrice) * size * direction * multiplier * 100) / 100;
}

// ── Comparison Row ─────────────────────────────────────────────────────────
const CompareRow = ({ label, original, simulated, format = v => v, higherIsBetter = true }) => {
  const diff = simulated - original;
  const improved = higherIsBetter ? diff > 0 : diff < 0;
  const changed = Math.abs(diff) > 0.001;
  return (
    <div className="flex items-center justify-between py-1.5 border-b theme-border/40 last:border-0">
      <span className="text-[11px] text-slate-400">{label}</span>
      <div className="flex items-center gap-3 font-mono">
        <span className="text-[11px] text-slate-500 line-through">{format(original)}</span>
        <span className={`text-[11px] font-bold ${changed ? (improved ? 'text-emerald-400' : 'text-rose-400') : 'text-slate-300'}`}>
          {format(simulated)}
        </span>
        {changed && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${improved ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
            {format(diff)}
          </span>
        )}
      </div>
    </div>
  );
};

// ── Slider with numeric input ──────────────────────────────────────────────
const SliderInput = ({ label, value, onChange, min, max, step = 0.01, unit = '', color = 'violet' }) => {
  const pct = max > min ? Math.min(100, Math.max(0, Math.round(((value - min) / (max - min)) * 100))) : 50;
  const colorClass = {
    violet: 'accent-violet-500',
    rose: 'accent-rose-500',
    emerald: 'accent-emerald-500',
    amber: 'accent-amber-500',
  }[color] || 'accent-violet-500';

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-[11px] text-slate-400 font-semibold">{label}</label>
        <div className="flex items-center gap-1">
          <input
            type="number"
            value={isNaN(value) ? '' : value}
            onChange={e => {
              const val = parseFloat(e.target.value);
              onChange(isNaN(val) ? 0 : val);
            }}
            step={step}
            className="w-24 theme-card theme-border text-white text-xs rounded-lg px-2 py-1 text-right focus:outline-none focus:border-violet-500 font-mono"
          />
          {unit && <span className="text-[10px] text-slate-500 font-mono">{unit}</span>}
        </div>
      </div>
      <input
        type="range" min={min} max={max} step={step}
        value={isNaN(value) ? min : value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className={`w-full h-1.5 ${colorClass} rounded-full cursor-pointer`}
      />
      <div className="flex justify-between text-[9px] text-slate-600 font-mono">
        <span>{min}</span>
        <span className="text-slate-500">{pct}%</span>
        <span>{max}</span>
      </div>
    </div>
  );
};

// ── Main WhatIfSimulator Modal ─────────────────────────────────────────────
export default function WhatIfSimulator({ trade, onClose }) {
  const { t } = useLanguage();
  const isLossOriginal = trade.pnl < 0;
  const hasSL = trade.stop_loss && parseFloat(trade.stop_loss) > 0;

  const entry = parseFloat(trade.entry_price) || 0;
  const exit = parseFloat(trade.exit_price) || entry;
  const originalSize = parseFloat(trade.size) || 0.1;
  const originalPnl = parseFloat(trade.pnl) || 0;

  // Calculate contract multiplier dynamically from actual trade PnL & prices
  const rawOriginalDiff = (exit - entry) * (trade.side === 'BUY' ? 1 : -1) * originalSize;
  let multiplier = 1;
  if (Math.abs(rawOriginalDiff) > 0.00001 && Math.abs(originalPnl) > 0.00001) {
    multiplier = originalPnl / rawOriginalDiff;
  } else if (trade.asset?.toUpperCase().includes('XAU') || trade.asset?.toUpperCase().includes('GOLD')) {
    multiplier = 100;
  }

  // Step & Decimals based on entry price
  const priceDecimals = entry.toString().includes('.') ? entry.toString().split('.')[1].length : 2;
  const priceStep = priceDecimals >= 4 ? 0.0001 : (priceDecimals >= 3 ? 0.001 : 0.01);

  // Sim state — default to actual values
  const [simExit, setSimExit] = useState(exit);
  const [simSL, setSimSL] = useState(
    parseFloat(trade.stop_loss) || (entry > 0 ? (trade.side === 'BUY' ? entry - priceStep * 50 : entry + priceStep * 50) : 0)
  );
  const [simTP, setSimTP] = useState(
    parseFloat(trade.take_profit) || (entry > 0 ? (trade.side === 'BUY' ? entry + priceStep * 100 : entry - priceStep * 100) : 0)
  );
  const [simSize, setSimSize] = useState(originalSize);

  // Compute simulated PnLs using multiplier
  const simPnl = calcPnl({ side: trade.side, entryPrice: entry, exitPrice: simExit, size: simSize, multiplier });
  const pnlAtSL = calcPnl({ side: trade.side, entryPrice: entry, exitPrice: simSL, size: simSize, multiplier });
  const pnlAtTP = calcPnl({ side: trade.side, entryPrice: entry, exitPrice: simTP, size: simSize, multiplier });

  // Risk metrics
  const riskAmount = Math.abs(pnlAtSL);
  const rewardAmount = Math.abs(pnlAtTP);
  const rr = riskAmount > 0 ? Math.round((rewardAmount / riskAmount) * 100) / 100 : null;

  // Cost of missed SL (only show if original was loss and no SL)
  const missedSLCost = !hasSL && isLossOriginal ? Math.abs(originalPnl) - riskAmount : null;

  const reset = useCallback(() => {
    const e = parseFloat(trade.entry_price) || 0;
    const ex = parseFloat(trade.exit_price) || e;
    const sz = parseFloat(trade.size) || 0.1;
    const dec = e.toString().includes('.') ? e.toString().split('.')[1].length : 2;
    const stp = dec >= 4 ? 0.0001 : (dec >= 3 ? 0.001 : 0.01);
    setSimExit(ex);
    setSimSL(parseFloat(trade.stop_loss) || (e > 0 ? (trade.side === 'BUY' ? e - stp * 50 : e + stp * 50) : 0));
    setSimTP(parseFloat(trade.take_profit) || (e > 0 ? (trade.side === 'BUY' ? e + stp * 100 : e - stp * 100) : 0));
    setSimSize(sz);
  }, [trade]);

  // Price range for sliders
  const basePrice = entry > 0 ? entry : (exit > 0 ? exit : 100);
  const priceRange = Math.max(basePrice * 0.05, priceStep * 100); // ±5% or at least 100 steps
  const priceMin = Math.max(0, Math.round((basePrice - priceRange) * 10000) / 10000);
  const priceMax = Math.round((basePrice + priceRange) * 10000) / 10000;

  // FIXED Volume range for slider based on originalSize (NOT simSize to prevent jumping slider!)
  const sizeMin = Math.max(0.01, Math.round(originalSize * 0.1 * 100) / 100);
  const sizeMax = Math.max(0.1, Math.round(originalSize * 5 * 100) / 100);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center theme-inner-card/85 backdrop-blur-sm p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg theme-card theme-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b theme-border theme-inner-card flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-violet-400" />
            <div>
              <h2 className="text-sm font-bold text-white">Mô Phỏng What-If</h2>
              <p className="text-[10px] text-slate-500 font-mono">
                {trade.asset} · {trade.side} · Entry: {trade.entry_price} · Vol: {trade.size} lot
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={reset} title="Reset về giá trị thực" className="p-1.5 text-slate-500 hover:text-slate-300 transition cursor-pointer">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <button onClick={onClose} className="p-1.5 text-slate-500 hover:text-white transition cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* Original PnL context */}
          <div className={`flex items-center gap-3 p-3 rounded-xl border ${isLossOriginal ? 'bg-rose-500/5 border-rose-500/20' : 'bg-emerald-500/5 border-emerald-500/20'}`}>
            {isLossOriginal ? <TrendingDown className="w-4 h-4 text-rose-400 shrink-0" /> : <TrendingUp className="w-4 h-4 text-emerald-400 shrink-0" />}
            <div>
              <p className="text-xs text-slate-400">PnL thực tế của lệnh này:</p>
              <p className={`text-lg font-bold font-mono ${isLossOriginal ? 'text-rose-400' : 'text-emerald-400'}`}>
                {originalPnl >= 0 ? '+' : ''}{originalPnl}$
              </p>
            </div>
            {!hasSL && isLossOriginal && (
              <div className="ml-auto flex items-center gap-1 text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-2 py-1.5 font-medium">
                <Info className="w-3 h-3" /> Không có SL
              </div>
            )}
          </div>

          {/* Sliders */}
          <div className="space-y-4">
            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Điều chỉnh tham số:</p>

            <SliderInput
              label="Giá Exit (Điểm thoát lệnh)"
              value={simExit} onChange={setSimExit}
              min={priceMin} max={priceMax} step={priceStep}
              color="violet"
            />

            <SliderInput
              label="Stop Loss (Điểm cắt lỗ)"
              value={simSL} onChange={setSimSL}
              min={priceMin} max={priceMax} step={priceStep}
              color="rose"
            />

            <SliderInput
              label="Take Profit (Điểm chốt lời)"
              value={simTP} onChange={setSimTP}
              min={priceMin} max={priceMax} step={priceStep}
              color="emerald"
            />

            <SliderInput
              label="Volume (Khối lượng)"
              value={simSize} onChange={setSimSize}
              min={sizeMin} max={sizeMax} step={0.01}
              unit="lot"
              color="amber"
            />
          </div>

          {/* R:R Indicator */}
          {rr !== null && (
            <div className={`flex items-center justify-between p-3 rounded-xl border text-xs ${rr >= 2 ? 'bg-emerald-500/10 border-emerald-500/20' : rr >= 1 ? 'bg-amber-500/10 border-amber-500/20' : 'bg-rose-500/10 border-rose-500/20'}`}>
              <span className="font-semibold text-slate-300">Tỷ lệ R:R (Risk/Reward) Mô Phỏng</span>
              <span className={`text-base font-bold font-mono ${rr >= 2 ? 'text-emerald-400' : rr >= 1 ? 'text-amber-400' : 'text-rose-400'}`}>
                1:{rr} {rr >= 2 ? '✅' : rr >= 1 ? '⚠️' : '❌'}
              </span>
            </div>
          )}

          {/* Comparison Results */}
          <div className="theme-inner-card rounded-xl p-4 space-y-1">
            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-2">So Sánh Kết Quả Mô Phỏng:</p>
            <CompareRow
              label="PnL tại giá Exit mô phỏng"
              original={originalPnl}
              simulated={simPnl}
              format={v => `${v >= 0 ? '+' : ''}${Math.round(v * 100) / 100}$`}
            />
            <CompareRow
              label="PnL nếu chạm SL mô phỏng"
              original={originalPnl}
              simulated={pnlAtSL}
              format={v => `${v >= 0 ? '+' : ''}${Math.round(v * 100) / 100}$`}
            />
            <CompareRow
              label="PnL nếu chạm TP mô phỏng"
              original={originalPnl}
              simulated={pnlAtTP}
              format={v => `${v >= 0 ? '+' : ''}${Math.round(v * 100) / 100}$`}
            />
            <CompareRow
              label="Khối lượng (Volume)"
              original={originalSize}
              simulated={simSize}
              format={v => `${Math.round(v * 1000) / 1000} lot`}
            />
          </div>

          {/* Key Lesson for Missing SL */}
          {missedSLCost !== null && missedSLCost > 0 && (
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3 text-xs">
              <p className="font-bold text-amber-300 flex items-center gap-1">💡 Bài Học Từ Lệnh Này</p>
              <p className="text-amber-200/80 mt-1 leading-relaxed">
                Nếu bạn tuân thủ SL tại <strong className="font-mono">{simSL}</strong>, lệnh này chỉ lỗ <strong className="font-mono text-amber-300">${Math.abs(pnlAtSL).toFixed(2)}</strong> thay vì lỗ thực tế <strong className="font-mono text-rose-400">${Math.abs(originalPnl).toFixed(2)}</strong>.
                <br />
                Việc thả trôi không SL đã khiến bạn mất thêm <strong className="text-rose-400 font-mono">${missedSLCost.toFixed(2)}</strong> rủi ro không đáng có!
              </p>
            </div>
          )}

          {/* Volume lesson */}
          {simSize < originalSize * 0.8 && isLossOriginal && (
            <div className="bg-sky-500/5 border border-sky-500/20 rounded-xl p-3 text-xs">
              <p className="font-bold text-sky-300 flex items-center gap-1">💡 Bài Học Quản Lý Vốn (Risk Management)</p>
              <p className="text-sky-200/80 mt-1 leading-relaxed">
                Nếu giao dịch với volume <strong className="font-mono">{simSize} lot</strong> thay vì <strong className="font-mono">{originalSize} lot</strong>, mức lỗ giảm xuống chỉ còn <strong className="font-mono text-sky-300">${Math.abs(simPnl).toFixed(2)}</strong>.
                Hãy luôn tính toán khối lượng theo số tiền chịu lỗ tối đa cho phép.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t theme-border theme-inner-card/50 shrink-0 flex justify-between items-center">
          <p className="text-[10px] text-slate-600 italic">Kéo thanh trượt để thử nghiệm các kịch bản</p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs rounded-xl transition cursor-pointer"
          >
            Đã hiểu!
          </button>
        </div>
      </div>
    </div>
  );
}
