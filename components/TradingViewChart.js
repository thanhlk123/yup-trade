'use client';

import { useEffect, useRef, useState } from 'react';
import { 
  Maximize2, 
  Minimize2, 
  X, 
  TrendingUp, 
  TrendingDown, 
  Target, 
  ShieldAlert, 
  Sparkles, 
  Layers, 
  ArrowUpRight, 
  ArrowDownRight,
  CheckCircle2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  BarChart2,
  Clock
} from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';

export default function TradingViewChart({ selectedTrade, onClearSelectedTrade, allTrades = [], onSelectTrade, theme = 'dark' }) {
  const { t } = useLanguage();
  const containerRef = useRef(null);
  const widgetRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [interval, setIntervalState] = useState('15');
  const [widgetReady, setWidgetReady] = useState(false);

  // Map asset string (e.g., "XAUUSD", "GOLD", "EURUSD") to TradingView exchange symbol
  const getTvSymbol = (asset) => {
    if (!asset) return 'OANDA:XAUUSD';
    const cleanAsset = asset.trim().toUpperCase();
    if (cleanAsset.includes('XAU') || cleanAsset.includes('GOLD') || cleanAsset.includes('VÀNG')) {
      return 'OANDA:XAUUSD';
    }
    if (cleanAsset.includes('BTC')) return 'BINANCE:BTCUSDT';
    if (cleanAsset.includes('ETH')) return 'BINANCE:ETHUSDT';
    if (cleanAsset.includes('EUR')) return 'OANDA:EURUSD';
    if (cleanAsset.includes('GBP')) return 'OANDA:GBPUSD';
    if (cleanAsset.includes('JPY') || cleanAsset.includes('USDJPY')) return 'OANDA:USDJPY';
    if (cleanAsset.includes('US30') || cleanAsset.includes('DOW')) return 'CAPITALCOM:US30';
    if (cleanAsset.includes('NAS100') || cleanAsset.includes('NDX')) return 'CAPITALCOM:US100';
    
    return `OANDA:${cleanAsset.replace('/', '')}`;
  };

  const currentSymbol = getTvSymbol(selectedTrade?.asset);

  useEffect(() => {
    let scriptExists = document.getElementById('tradingview-widget-script');

    const initWidget = () => {
      if (!containerRef.current) return;
      containerRef.current.innerHTML = '';
      const widgetDiv = document.createElement('div');
      const uniqueId = `tv_chart_container_${Math.random().toString(36).substring(2, 9)}`;
      widgetDiv.id = uniqueId;
      widgetDiv.style.height = '100%';
      widgetDiv.style.width = '100%';
      containerRef.current.appendChild(widgetDiv);

      if (window.TradingView) {
        widgetRef.current = new window.TradingView.widget({
          autosize: true,
          symbol: currentSymbol,
          interval: interval,
          timezone: 'Asia/Ho_Chi_Minh',
          theme: theme === 'light' ? 'light' : 'dark',
          style: '1',
          locale: 'vi',
          toolbar_bg: theme === 'light' ? '#ffffff' : '#0f172a',
          enable_publishing: false,
          allow_symbol_change: true,
          container_id: uniqueId,
          hide_side_toolbar: false,
          details: true,
          hotlist: false,
          calendar: false,
        });
        setWidgetReady(true);
      }
    };

    if (!scriptExists) {
      const script = document.createElement('script');
      script.id = 'tradingview-widget-script';
      script.src = 'https://s3.tradingview.com/tv.js';
      script.async = true;
      script.onload = initWidget;
      document.head.appendChild(script);
    } else {
      if (window.TradingView) {
        initWidget();
      } else {
        scriptExists.addEventListener('load', initWidget);
      }
    }

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [currentSymbol, theme, interval]);

  // Calculate trade details (Pips, Risk/Reward, etc.)
  const calcTradeDetails = (trade) => {
    if (!trade) return null;
    const entry = parseFloat(trade.entry_price) || 0;
    const tp = parseFloat(trade.take_profit) || null;
    const sl = parseFloat(trade.stop_loss) || null;
    const exit = parseFloat(trade.exit_price) || null;
    const side = trade.side || 'BUY';

    let tpDistance = null;
    let slDistance = null;
    let rrRatio = null;

    if (entry > 0 && tp > 0) {
      tpDistance = side === 'BUY' ? tp - entry : entry - tp;
    }

    if (entry > 0 && sl > 0) {
      slDistance = side === 'BUY' ? entry - sl : sl - entry;
    }

    if (tpDistance !== null && slDistance !== null && slDistance > 0) {
      rrRatio = (tpDistance / slDistance).toFixed(2);
    }

    return {
      entry,
      tp,
      sl,
      exit,
      side,
      tpDistance: tpDistance !== null ? tpDistance.toFixed(2) : null,
      slDistance: slDistance !== null ? slDistance.toFixed(2) : null,
      rrRatio
    };
  };

  const tradeDetails = calcTradeDetails(selectedTrade);

  // Navigation between trades when viewing on chart
  const currentIndex = allTrades.findIndex(t => t.id === selectedTrade?.id);
  const handlePrevTrade = () => {
    if (currentIndex > 0 && onSelectTrade) {
      onSelectTrade(allTrades[currentIndex - 1]);
    }
  };
  const handleNextTrade = () => {
    if (currentIndex >= 0 && currentIndex < allTrades.length - 1 && onSelectTrade) {
      onSelectTrade(allTrades[currentIndex + 1]);
    }
  };

  return (
    <div className={`relative rounded-3xl overflow-hidden border transition-all duration-300 ${
      isFullscreen 
        ? 'fixed inset-0 z-50 rounded-none border-none bg-slate-950 p-4' 
        : theme === 'light'
          ? 'bg-white border-slate-200 shadow-lg'
          : 'bg-slate-900/60 backdrop-blur-xl border-white/10 shadow-2xl'
    }`}>
      {/* Header bar */}
      <div className={`p-4 border-b flex flex-wrap items-center justify-between gap-3 ${
        theme === 'light' ? 'border-slate-200 bg-slate-50/80' : 'border-white/5 bg-slate-950/60'
      }`}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <BarChart2 className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className={`font-extrabold text-sm tracking-tight ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>
                {t('tradingViewChart')}
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-wider flex items-center gap-1">
                <Clock className="w-3 h-3 text-emerald-400" /> {currentSymbol} (GMT+7)
              </span>
            </div>
            <p className={`text-xs ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>
              {selectedTrade ? `${selectedTrade.asset} • Setup: ${selectedTrade.setup_tag || 'N/A'}` : 'Xem biến động giá XAUUSD theo thời gian thực chuẩn Múi giờ Việt Nam'}
            </p>
          </div>
        </div>

        {/* Timeframe & Action Buttons */}
        <div className="flex items-center gap-2">
          {/* Timeframe Selector */}
          <div className={`flex items-center p-1 rounded-xl border text-xs font-semibold ${
            theme === 'light' ? 'bg-slate-200/60 border-slate-300' : 'bg-slate-900 border-slate-800'
          }`}>
            {['1', '5', '15', '60', '240', 'D'].map((tf) => (
              <button
                key={tf}
                onClick={() => setIntervalState(tf)}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer text-[11px] font-bold ${
                  interval === tf
                    ? 'bg-emerald-500 text-slate-950 shadow-sm'
                    : theme === 'light' ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-white'
                }`}
              >
                {tf === 'D' ? '1D' : `${tf}m`}
              </button>
            ))}
          </div>

          {/* Toggle Fullscreen */}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className={`p-2 rounded-xl transition cursor-pointer border ${
              theme === 'light'
                ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800'
            }`}
            title={isFullscreen ? 'Thu nhỏ' : 'Phóng to'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Main Grid: Chart + Position Overlay */}
      <div className={`grid grid-cols-1 ${selectedTrade ? 'lg:grid-cols-3' : ''} gap-0`}>
        
        {/* Left/Main Column: TradingView Chart */}
        <div className={`${selectedTrade ? 'lg:col-span-2' : 'w-full'} relative min-h-[520px] h-[550px]`}>
          <div ref={containerRef} className="w-full h-full" />
          
          {/* Selected Trade Quick Info Floating Badge on Top Left of Chart */}
          {selectedTrade && tradeDetails && (
            <div className="absolute top-4 left-14 pointer-events-none z-10">
              <div className="bg-slate-950/85 backdrop-blur-md border border-white/10 p-2.5 px-3.5 rounded-2xl shadow-xl flex items-center gap-3 text-xs pointer-events-auto">
                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                  selectedTrade.side === 'BUY' ? 'bg-emerald-500 text-slate-950' : 'bg-rose-500 text-white'
                }`}>
                  {selectedTrade.side} {selectedTrade.asset}
                </span>
                <span className="text-slate-300 font-medium">
                  Entry: <strong className="font-mono text-white">${tradeDetails.entry}</strong>
                </span>
                {tradeDetails.tp && (
                  <span className="text-emerald-400 font-medium">
                    TP: <strong className="font-mono">${tradeDetails.tp}</strong>
                  </span>
                )}
                {tradeDetails.sl && (
                  <span className="text-rose-400 font-medium">
                    SL: <strong className="font-mono">${tradeDetails.sl}</strong>
                  </span>
                )}
                {tradeDetails.rrRatio && (
                  <span className="text-amber-300 font-mono text-[11px]">
                    R:R 1:{tradeDetails.rrRatio}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Interactive Selected Position Details Visualizer */}
        {selectedTrade && tradeDetails && (
          <div className={`p-5 flex flex-col justify-between border-t lg:border-t-0 lg:border-l space-y-6 ${
            theme === 'light' ? 'border-slate-200 bg-slate-50/50' : 'border-white/5 bg-slate-950/40'
          }`}>
            <div className="space-y-5">
              {/* Header section with trade switcher */}
              <div className="flex items-center justify-between pb-3 border-b border-white/5">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-400 animate-pulse" />
                  <h4 className={`text-xs font-extrabold uppercase tracking-wider ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>
                    {t('selectedTradeOverview')}
                  </h4>
                </div>

                <div className="flex items-center gap-1">
                  {allTrades.length > 0 && (
                    <>
                      <button
                        onClick={handlePrevTrade}
                        disabled={currentIndex <= 0}
                        className={`p-1 rounded-lg transition disabled:opacity-30 ${
                          theme === 'light' ? 'hover:bg-slate-200 text-slate-700' : 'hover:bg-slate-800 text-slate-300'
                        }`}
                        title="Lệnh trước"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <span className="text-[10px] font-mono text-slate-400 px-1">
                        {currentIndex + 1}/{allTrades.length}
                      </span>
                      <button
                        onClick={handleNextTrade}
                        disabled={currentIndex >= allTrades.length - 1}
                        className={`p-1 rounded-lg transition disabled:opacity-30 ${
                          theme === 'light' ? 'hover:bg-slate-200 text-slate-700' : 'hover:bg-slate-800 text-slate-300'
                        }`}
                        title="Lệnh tiếp theo"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </>
                  )}
                  <button
                    onClick={onClearSelectedTrade}
                    className={`ml-2 p-1 rounded-lg hover:bg-rose-500/20 text-rose-400 transition`}
                    title={t('clearSelectedTrade')}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Trade Type & Status Big Banner */}
              <div className={`p-4 rounded-2xl border space-y-3 relative overflow-hidden ${
                selectedTrade.side === 'BUY'
                  ? 'bg-emerald-500/10 border-emerald-500/30'
                  : 'bg-rose-500/10 border-rose-500/30'
              }`}>
                <div className="flex items-center justify-between relative z-10">
                  <div className="flex items-center gap-2">
                    <span className={`px-3 py-1 rounded-xl text-xs font-black uppercase tracking-wider ${
                      selectedTrade.side === 'BUY'
                        ? 'bg-emerald-500 text-slate-950 shadow-md'
                        : 'bg-rose-500 text-white shadow-md'
                    }`}>
                      {selectedTrade.side === 'BUY' ? 'Lệnh Mua (Long)' : 'Lệnh Bán (Short)'}
                    </span>
                    <span className="text-xs font-bold text-slate-300">
                      {selectedTrade.size} Lots
                    </span>
                  </div>

                  <span className={`text-base font-extrabold font-mono ${
                    selectedTrade.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}>
                    {selectedTrade.pnl >= 0 ? '+' : ''}{selectedTrade.pnl?.toLocaleString()} USD
                  </span>
                </div>

                <div className="text-xs text-slate-400 flex items-center justify-between pt-1 border-t border-white/5">
                  <span>Thời gian (GMT+7): {selectedTrade.trade_time ? new Date(selectedTrade.trade_time.replace(' ', 'T') + 'Z').toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : 'N/A'}</span>
                  <span className="font-semibold text-slate-300">Setup: {selectedTrade.setup_tag || 'Standard'}</span>
                </div>
              </div>

              {/* Price Levels Visual Box */}
              <div className="space-y-2.5">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5 text-blue-400" />
                  Các Mức Giá Định Vị Lệnh (Execution Prices)
                </div>

                {/* Entry Price Bar */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-blue-500/10 border border-blue-500/30 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-ping"></div>
                    <span className="font-bold text-blue-300">{t('entryPrice')}</span>
                  </div>
                  <span className="font-extrabold font-mono text-white text-sm">
                    {tradeDetails.entry} USD
                  </span>
                </div>

                {/* Take Profit Bar */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                    <div>
                      <span className="font-bold text-emerald-300">{t('takeProfit')}</span>
                      {tradeDetails.tpDistance && (
                        <div className="text-[10px] text-emerald-400/80">+{tradeDetails.tpDistance} pips</div>
                      )}
                    </div>
                  </div>
                  <span className="font-extrabold font-mono text-emerald-400 text-sm">
                    {tradeDetails.tp ? `${tradeDetails.tp} USD` : 'Không đặt TP'}
                  </span>
                </div>

                {/* Stop Loss Bar */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-rose-400" />
                    <div>
                      <span className="font-bold text-rose-300">{t('stopLoss')}</span>
                      {tradeDetails.slDistance && (
                        <div className="text-[10px] text-rose-400/80">-{tradeDetails.slDistance} pips</div>
                      )}
                    </div>
                  </div>
                  <span className="font-extrabold font-mono text-rose-400 text-sm">
                    {tradeDetails.sl ? `${tradeDetails.sl} USD` : 'Không đặt SL'}
                  </span>
                </div>

                {/* Exit Price if available */}
                {tradeDetails.exit > 0 && (
                  <div className="flex items-center justify-between p-3 rounded-xl bg-purple-500/10 border border-purple-500/30 text-xs">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-purple-400" />
                      <span className="font-bold text-purple-300">{t('exitPrice')}</span>
                    </div>
                    <span className="font-extrabold font-mono text-purple-300 text-sm">
                      {tradeDetails.exit} USD
                    </span>
                  </div>
                )}
              </div>

              {/* Risk:Reward Ratio Bar Graphic */}
              {tradeDetails.rrRatio && (
                <div className="p-3.5 rounded-2xl bg-slate-900 border border-white/5 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400 font-bold">{t('riskRewardRatio')}</span>
                    <span className="font-extrabold text-amber-400 font-mono text-sm">
                      1 : {tradeDetails.rrRatio}
                    </span>
                  </div>

                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden flex">
                    <div className="bg-rose-500 h-full" style={{ width: '30%' }} title="Risk"></div>
                    <div className="bg-emerald-500 h-full" style={{ width: `${Math.min(70, Math.max(20, parseFloat(tradeDetails.rrRatio) * 30))}%` }} title="Reward"></div>
                  </div>
                </div>
              )}

              {/* User Notes snippet */}
              {selectedTrade.user_notes && (
                <div className="p-3 rounded-xl bg-slate-900/80 border border-white/5 space-y-1">
                  <div className="text-[10px] font-bold text-slate-500 uppercase">Ghi chú lệnh:</div>
                  <p className="text-xs text-slate-300 line-clamp-3 italic">
                    "{selectedTrade.user_notes}"
                  </p>
                </div>
              )}
            </div>

            {/* Bottom Actions */}
            <div className="pt-2">
              <button
                onClick={onClearSelectedTrade}
                className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition border border-white/5 cursor-pointer text-center"
              >
                {t('clearSelectedTrade')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
