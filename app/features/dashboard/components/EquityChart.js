'use client';

import { useState } from 'react';
import { Target } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, BarChart, Bar } from 'recharts';
import { useLanguageStore } from '@/app/core/i18n/store';
import { useDashboardStore } from '@/app/features/dashboard/store/dashboardStore';
import TradingViewChart from '@/components/TradingViewChart';

import { useThemeStore } from '@/app/core/theme/store';

export default function EquityChart() {
  const t = useLanguageStore(state => state.t);
  const trades = useDashboardStore(state => state.trades) || [];
  const stats = useDashboardStore(state => state.stats) || { setups: [] };
  const selectedTradeForChart = useDashboardStore(state => state.selectedTradeForChart);
  const setSelectedTradeForChart = useDashboardStore(state => state.setSelectedTradeForChart);
  
  const theme = useThemeStore(state => state.theme);

  const [activeChartTab, setActiveChartTab] = useState('equity'); // 'equity' | 'setup' | 'tradingview'

  // Prepare data for Cumulative Equity Curve
  const prepareChartData = () => {
    if (trades.length === 0) return [];
    
    // Sort trades chronologically (oldest first)
    const chronoTrades = [...trades].reverse();
    let cumulative = 0;
    
    return chronoTrades.map((trade, idx) => {
      cumulative += trade.pnl;
      return {
        name: t('tradeLabel', { num: idx + 1 }) || `Lệnh ${idx + 1}`,
        pnl: trade.pnl,
        equity: Math.round(cumulative * 100) / 100,
        asset: trade.asset
      };
    });
  };

  const chartData = prepareChartData();
  const equityColor = (stats.summary?.totalPnl >= 0) ? '#10b981' : '#f43f5e';

  return (
    <div className="bg-white dark:bg-[#151922] rounded-3xl p-6 space-y-4 transition-colors duration-300 border border-slate-200 dark:border-white/5 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-white/5">
        <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
          {activeChartTab === 'tradingview' ? `📈 ${t('tradingViewChart')}` : activeChartTab === 'equity' ? t('equityCurve') : t('setupStatsTab')}
        </h3>
        
        <div className="flex bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
          <button
            onClick={() => setActiveChartTab('equity')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
              activeChartTab === 'equity'
                ? 'bg-emerald-500 text-white dark:text-slate-950 shadow font-extrabold'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white'
            }`}
          >
            {t('equityCurve')}
          </button>
          <button
            onClick={() => setActiveChartTab('setup')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
              activeChartTab === 'setup'
                ? 'bg-emerald-500 text-white dark:text-slate-950 shadow font-extrabold'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white'
            }`}
          >
            {t('setupStatsTab')}
          </button>
          <button
            onClick={() => setActiveChartTab('tradingview')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer flex items-center gap-1.5 ${
              activeChartTab === 'tradingview'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white dark:text-slate-950 shadow font-extrabold'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white'
            }`}
          >
            <span>📈 TradingView</span>
            {selectedTradeForChart && (
              <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping"></span>
            )}
          </button>
        </div>
      </div>

      <div className={`${activeChartTab === 'tradingview' ? 'min-h-[580px]' : 'h-[320px]'} w-full pt-2 transition-all duration-300`}>
        {activeChartTab === 'equity' ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorEquity" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={equityColor} stopOpacity={0.2}/>
                  <stop offset="95%" stopColor={equityColor} stopOpacity={0.01}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
              <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
              <Tooltip 
                contentStyle={{ backgroundColor: 'var(--bg-input, #1e293b)', borderColor: 'var(--border-color, #334155)', borderRadius: '12px' }}
                labelStyle={{ color: 'var(--text-sub, #94a3b8)', fontSize: '12px', fontWeight: '600', marginBottom: '4px' }}
                labelClassName=""
                itemStyle={{ fontSize: '13px' }}
              />
              <Area type="monotone" dataKey="equity" stroke={equityColor} strokeWidth={2} fillOpacity={1} fill="url(#colorEquity)" name="Equity (USD)" />
            </AreaChart>
          </ResponsiveContainer>
        ) : activeChartTab === 'setup' ? (
          !stats?.setups || stats.setups.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-6 space-y-3 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-slate-200 dark:border-slate-800">
              <div className="p-3 bg-amber-500/10 rounded-2xl text-amber-500 dark:text-amber-400 border border-amber-500/20">
                <Target className="w-7 h-7 animate-pulse" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-slate-800 dark:text-white">{t('noSetupChartTitle') || 'Chưa có dữ liệu'}</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
                  {t('noSetupChartDesc') || 'Chưa có đủ dữ liệu để thống kê.'}
                </p>
              </div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.setups} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="setup" stroke="#64748b" fontSize={10} tickLine={false} />
                <YAxis yAxisId="left" orientation="left" stroke="#10b981" fontSize={10} tickLine={false} />
                <YAxis yAxisId="right" orientation="right" stroke="#3b82f6" domain={[0, 100]} fontSize={10} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--bg-input, #1e293b)', borderColor: 'var(--border-color, #334155)', borderRadius: '12px' }}
                  labelStyle={{ color: 'var(--text-sub, #94a3b8)', fontSize: '12px', fontWeight: '600', marginBottom: '4px' }}
                  labelClassName=""
                  itemStyle={{ fontSize: '13px' }}
                />
                <Bar yAxisId="left" dataKey="totalPnl" name="Net PnL (USD)" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="right" dataKey="winRate" name="Win Rate (%)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )
        ) : (
          <TradingViewChart
            selectedTrade={selectedTradeForChart}
            onClearSelectedTrade={() => setSelectedTradeForChart(null)}
            allTrades={trades}
            onSelectTrade={setSelectedTradeForChart}
            theme={theme}
          />
        )}
      </div>
    </div>
  );
}
