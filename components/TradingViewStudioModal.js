'use client';

import { useState } from 'react';
import { X, Sparkles, Layers, RefreshCw, BarChart2 } from 'lucide-react';
import TradingViewStudioChart from '@/components/TradingViewStudioChart';
import TradingViewTradeTable from '@/components/TradingViewTradeTable';
import { useLanguage } from '@/lib/i18n/LanguageContext';

export default function TradingViewStudioModal({ isOpen, onClose, trades = [], theme = 'dark' }) {
  const { t } = useLanguage();
  const [selectedTradeIds, setSelectedTradeIds] = useState([]);

  if (!isOpen) return null;

  const handleToggleTrade = (trade) => {
    if (!trade) return;
    setSelectedTradeIds((prev) =>
      prev.includes(trade.id)
        ? prev.filter((id) => id !== trade.id)
        : [...prev, trade.id]
    );
  };

  const handleToggleAllTrades = (filteredTrades) => {
    const allFilteredIds = filteredTrades.map((t) => t.id);
    const isAllSelected = allFilteredIds.length > 0 && allFilteredIds.every((id) => selectedTradeIds.includes(id));
    
    if (isAllSelected) {
      setSelectedTradeIds((prev) => prev.filter((id) => !allFilteredIds.includes(id)));
    } else {
      setSelectedTradeIds((prev) => Array.from(new Set([...prev, ...allFilteredIds])));
    }
  };

  const selectedTrades = trades.filter((t) => selectedTradeIds.includes(t.id));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/85 backdrop-blur-md overflow-y-auto animate-fade-in">
      <div className="relative w-full max-w-[1600px] my-auto bg-slate-950 border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Modal Top Navigation Bar (YUP Trade Style) */}
        <div className="p-5 px-8 bg-slate-900/90 border-b border-white/10 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 flex items-center justify-center text-slate-950 shadow-lg shadow-emerald-500/20">
              <BarChart2 className="w-5 h-5 font-bold" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-white tracking-tight">
                  YUP Trade Multi-Position Replay Studio
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase">
                  XAUUSD REALTIME FEED
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Tích chọn các ô checkbox ở bảng lịch sử bên dưới để chiếu & vẽ vị thế (Buy/Sell, TP, SL, Mốc thời gian) trực tiếp lên nến biểu đồ
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {selectedTradeIds.length > 0 && (
              <button
                onClick={() => setSelectedTradeIds([])}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition border border-white/5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Bỏ chọn tất cả ({selectedTradeIds.length})
              </button>
            )}

            <button
              onClick={onClose}
              className="p-2.5 bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded-xl transition border border-white/5 cursor-pointer"
              title="Đóng Studio"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Main Body Scrollable */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Top Section: TradingView Studio Candlestick Chart Engine (YUP Trade Exact Renderer) */}
          <section>
            <TradingViewStudioChart
              key={selectedTradeIds.length > 0 ? selectedTradeIds[0] : 'modal'}
              selectedTrades={selectedTrades}
              onClearAllTrades={() => setSelectedTradeIds([])}
              theme={theme}
            />
          </section>

          {/* Bottom Section: YUP Trade Interactive Trade History Table */}
          <section>
            <TradingViewTradeTable
              trades={trades}
              selectedTradeIds={selectedTradeIds}
              onToggleTrade={handleToggleTrade}
              onToggleAllTrades={handleToggleAllTrades}
              theme={theme}
            />
          </section>

        </div>
      </div>
    </div>
  );
}
