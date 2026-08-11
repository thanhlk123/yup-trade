'use client';

import { useState, useEffect } from 'react';
import { 
  CheckSquare, 
  Square, 
  ArrowUpRight, 
  ArrowDownRight, 
  Search, 
  Filter, 
  CheckCircle2, 
  XCircle, 
  Clock,
  Layers,
  BookOpen,
  Plus,
  Activity,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight
} from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import QuickReviewModal from './QuickReviewModal';

// Helper to reliably format any DB date string to exact Vietnam Time (UTC+7 / Asia/Ho_Chi_Minh)
const formatVietnamDateTime = (dateStr) => {
  if (!dateStr) return 'N/A';
  let str = String(dateStr).trim();
  // The DB stores time as UTC SQL string: "YYYY-MM-DD HH:mm:ss"
  try {
    // Convert SQL format to ISO UTC format
    const isoString = str.replace(' ', 'T') + 'Z';
    const dt = new Date(isoString);
    if (!isNaN(dt.getTime())) {
      // Format to Asia/Ho_Chi_Minh
      const formatter = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Ho_Chi_Minh',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
      return formatter.format(dt).replace(',', '');
    }
  } catch (e) {}

  return str;
};

export default function TradingViewTradeTable({ 
  trades = [], 
  selectedTradeIds = [], 
  onToggleTrade, 
  onToggleAllTrades,
  theme = 'dark' 
}) {
  const { t } = useLanguage();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [assetFilter, setAssetFilter] = useState('ALL');
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  // Quick Review State
  const [isQuickReviewOpen, setIsQuickReviewOpen] = useState(false);
  const [tradesToReview, setTradesToReview] = useState([]);

  // Reset to page 1 whenever filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, assetFilter]);

  const filteredTrades = trades.filter((t) => {
    const matchesSearch = 
      (t.asset || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.setup_tag || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.user_notes || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'ALL' || t.status === statusFilter;
    const matchesAsset = assetFilter === 'ALL' || t.asset === assetFilter;

    return matchesSearch && matchesStatus && matchesAsset;
  });

  // Extract unique assets for filter
  const uniqueAssets = Array.from(new Set(trades.map(t => t.asset).filter(Boolean))).sort();

  // Calculate Pagination bounds
  const totalItems = filteredTrades.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  const validCurrentPage = Math.min(currentPage, totalPages);
  
  const startIndex = (validCurrentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  
  const paginatedTrades = filteredTrades.slice(startIndex, endIndex);

  const isAllSelected = filteredTrades.length > 0 && filteredTrades.every(t => selectedTradeIds.includes(t.id));

  return (
    <div className={`h-full w-full flex flex-col p-4 sm:p-5 overflow-hidden transition-all duration-300 ${
      theme === 'light' ? 'bg-white' : 'bg-slate-950'
    }`}>
      {/* Header & Filter Bar */}
      <div className={`flex flex-col gap-3 mb-4 pb-3 border-b flex-shrink-0 ${
        theme === 'light' ? 'border-slate-200' : 'border-white/5'
      }`}>
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className={`font-extrabold text-sm flex items-center gap-2 ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>
              {t('tradeJournalTitle')}
            </h3>
            <p className={`text-xs ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>
              {t('tradeJournalSubtitle')}
            </p>
          </div>

          <button
            onClick={() => onToggleAllTrades(filteredTrades)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap border ${
              theme === 'light'
                ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-300'
                : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
            }`}
          >
            <CheckSquare className="w-3.5 h-3.5" />
            <span>{isAllSelected ? t('deselectAll') : t('selectAll')}</span>
          </button>
        </div>

        {/* Search & Status Filters */}
        <div className="flex items-center gap-2">
          <div className={`relative flex-1 flex items-center rounded-xl border ${
            theme === 'light' ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-slate-900 border-slate-800 text-white'
          }`}>
            <Search className="w-3.5 h-3.5 ml-2.5 text-slate-400" />
            <input
              type="text"
              placeholder={t('searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`px-2.5 py-1.5 bg-transparent text-xs outline-none w-full placeholder-slate-400 ${
                theme === 'light' ? 'text-slate-900' : 'text-white'
              }`}
            />
          </div>

          <div className="relative">
            <select
              value={assetFilter}
              onChange={(e) => setAssetFilter(e.target.value)}
              className={`appearance-none pl-2 pr-6 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer transition focus:outline-none focus:ring-1 ${
                theme === 'light'
                  ? 'bg-slate-50 border-slate-300 text-slate-800 hover:border-slate-400 focus:ring-emerald-400'
                  : 'bg-slate-900 border-slate-800 text-slate-200 hover:border-slate-700 focus:ring-emerald-500'
              }`}
              title="Filter by Asset"
            >
              <option value="ALL">All Assets</option>
              {uniqueAssets.map(asset => (
                <option key={asset} value={asset}>{asset}</option>
              ))}
            </select>
            <div className={`pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 ${
              theme === 'light' ? 'text-slate-500' : 'text-slate-400'
            }`}>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                <path d="M1 3l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
              </svg>
            </div>
          </div>

          <div className={`flex items-center p-0.5 rounded-xl border text-xs font-semibold ${
            theme === 'light' ? 'bg-slate-100 border-slate-300' : 'bg-slate-900 border-slate-800'
          }`}>
            {['ALL', 'WIN', 'LOSS'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer text-[10px] font-bold ${
                  statusFilter === st
                    ? 'bg-emerald-500 text-slate-950 shadow'
                    : theme === 'light' ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-white'
                }`}
              >
                {st === 'ALL' ? t('filterAll') : st === 'WIN' ? t('filterWin') : t('filterLoss')}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Trade History Table with Smooth Independent Vertical Scroll */}
      <div className={`flex-1 overflow-x-auto overflow-y-auto rounded-2xl border ${
        theme === 'light' ? 'border-slate-200 bg-slate-50' : 'border-white/5 bg-slate-900/40'
      }`}>
        <table className="w-full text-left border-collapse text-xs">
          <thead className={`sticky top-0 z-10 backdrop-blur-md ${
            theme === 'light' ? 'bg-slate-100/95 text-slate-700' : 'bg-slate-900/95 text-slate-400'
          }`}>
            <tr className={`border-b text-[10px] font-bold uppercase tracking-wider ${
              theme === 'light' ? 'border-slate-200 text-slate-700' : 'border-white/10 text-slate-400'
            }`}>
              <th className="py-3 px-2 text-center">x</th>
              <th className="py-3 px-2">{t('thPair')}</th>
              <th className="py-3 px-2">{t('thStartDate')}</th>
              <th className="py-3 px-2">{t('thEndDate')}</th>
              <th className="py-3 px-2">{t('thType')}</th>
              <th className="py-3 px-2">{t('thEntry')}</th>
              <th className="py-3 px-2 text-rose-500">{t('thSL')}</th>
              <th className="py-3 px-2 text-emerald-600">{t('thTP')}</th>
              <th className="py-3 px-2 text-right">{t('thPnL')}</th>
            </tr>
          </thead>
          <tbody className={`divide-y font-mono ${theme === 'light' ? 'divide-slate-200 text-slate-800' : 'divide-white/5 text-slate-100'}`}>
            {paginatedTrades.length === 0 ? (
              <tr>
                <td colSpan="9" className="text-center py-8 text-slate-500 font-sans">
                  {t('noMatchingTrades')}
                </td>
              </tr>
            ) : (
              paginatedTrades.map((trade) => {
                const isSelected = selectedTradeIds.includes(trade.id);
                const isBuy = trade.side === 'BUY';

                return (
                  <tr
                    key={trade.id}
                    onClick={() => onToggleTrade(trade)}
                    className={`cursor-pointer transition-all duration-200 ${
                      isSelected
                        ? theme === 'light' ? 'bg-emerald-100/80 border-l-4 border-l-emerald-600 shadow-inner' : 'bg-emerald-500/15 border-l-4 border-l-emerald-400 shadow-inner'
                        : theme === 'light' ? 'hover:bg-slate-100 text-slate-800' : 'hover:bg-slate-800/50 text-slate-100'
                    }`}
                  >
                    {/* Tick Checkbox */}
                    <td className="py-3 px-2 text-center" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggleTrade(trade)}
                        className="w-4 h-4 rounded cursor-pointer accent-emerald-500"
                      />
                    </td>

                    {/* Pair */}
                    <td className={`py-3 px-2 font-sans font-extrabold whitespace-nowrap ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>
                      {trade.asset || 'XAUUSD'}
                    </td>

                    {/* Start Date (Vietnam Time GMT+7) */}
                    <td className={`py-3 px-2 font-sans text-[11px] whitespace-nowrap ${theme === 'light' ? 'text-slate-600' : 'text-slate-300'}`}>
                      {formatVietnamDateTime(trade.trade_time)}
                    </td>

                    {/* End Date (Vietnam Time GMT+7) */}
                    <td className={`py-3 px-2 font-sans text-[11px] whitespace-nowrap ${theme === 'light' ? 'text-slate-600' : 'text-slate-300'}`}>
                      {formatVietnamDateTime(trade.exit_time)}
                    </td>

                    {/* Trade Type Badge (sell / buy) */}
                    <td className="py-3 px-2 font-sans">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                        isBuy
                          ? theme === 'light' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : theme === 'light' ? 'bg-rose-100 text-rose-800 border border-rose-300' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                      }`}>
                        {isBuy ? 'buy' : 'sell'}
                      </span>
                    </td>

                    {/* Entry Price */}
                    <td className={`py-3 px-2 font-bold whitespace-nowrap ${theme === 'light' ? 'text-blue-700' : 'text-blue-400'}`}>
                      {trade.entry_price}
                    </td>

                    {/* Stop Loss */}
                    <td className={`py-3 px-2 font-bold whitespace-nowrap ${theme === 'light' ? 'text-rose-700' : 'text-rose-400'}`}>
                      {trade.stop_loss || '-'}
                    </td>

                    {/* Take Profit */}
                    <td className={`py-3 px-2 font-bold whitespace-nowrap ${theme === 'light' ? 'text-emerald-700' : 'text-emerald-400'}`}>
                      {trade.take_profit || '-'}
                    </td>

                    {/* Profit / Loss */}
                    <td className={`py-3 px-2 font-extrabold text-xs whitespace-nowrap ${
                      trade.pnl >= 0 
                        ? theme === 'light' ? 'text-emerald-700' : 'text-emerald-400'
                        : theme === 'light' ? 'text-rose-700' : 'text-rose-400'
                    }`}>
                      {trade.pnl >= 0 ? '+' : ''}{trade.pnl?.toLocaleString()}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className={`flex flex-wrap items-center justify-between gap-3 pt-3 mt-3 border-t flex-shrink-0 text-xs font-sans ${
        theme === 'light' ? 'border-slate-200 text-slate-600' : 'border-white/5 text-slate-400'
      }`}>
        {/* Left: Trade counts */}
        <div className="flex items-center gap-2">
          <span>{t('showingItemsCount', { start: totalItems > 0 ? startIndex + 1 : 0, end: endIndex, total: totalItems })}</span>
          
          <select
            value={itemsPerPage}
            onChange={(e) => {
              setItemsPerPage(Number(e.target.value));
              setCurrentPage(1);
            }}
            className={`ml-2 border rounded-lg px-2 py-1 outline-none text-xs cursor-pointer ${
              theme === 'light' ? 'bg-white border-slate-300 text-slate-800' : 'bg-slate-900 border-slate-800 text-slate-300'
            }`}
          >
            <option value={10}>{t('itemsPerPageLabel', { count: 10 })}</option>
            <option value={20}>{t('itemsPerPageLabel', { count: 20 })}</option>
            <option value={50}>{t('itemsPerPageLabel', { count: 50 })}</option>
            <option value={100}>{t('itemsPerPageLabel', { count: 100 })}</option>
          </select>
        </div>

        {/* Right: Page navigation */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setCurrentPage(1)}
            disabled={validCurrentPage === 1}
            className={`p-1.5 rounded-lg border transition cursor-pointer ${
              theme === 'light' 
                ? 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-30' 
                : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-white hover:border-slate-700 disabled:opacity-30'
            }`}
            title={t('firstPage')}
          >
            <ChevronsLeft className="w-4 h-4" />
          </button>
          
          <button
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={validCurrentPage === 1}
            className={`p-1.5 rounded-lg border transition cursor-pointer ${
              theme === 'light' 
                ? 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-30' 
                : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-white hover:border-slate-700 disabled:opacity-30'
            }`}
            title={t('prevPage')}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <span className={`px-2 py-1 font-medium ${theme === 'light' ? 'text-slate-700' : 'text-slate-300'}`}>
            {t('pageOf', { current: validCurrentPage, total: totalPages })}
          </span>

          <button
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={validCurrentPage >= totalPages}
            className={`p-1.5 rounded-lg border transition cursor-pointer ${
              theme === 'light' 
                ? 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-30' 
                : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-white hover:border-slate-700 disabled:opacity-30'
            }`}
            title={t('nextPage')}
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <button
            onClick={() => setCurrentPage(totalPages)}
            disabled={validCurrentPage >= totalPages}
            className={`p-1.5 rounded-lg border transition cursor-pointer ${
              theme === 'light' 
                ? 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-30' 
                : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-white hover:border-slate-700 disabled:opacity-30'
            }`}
            title={t('lastPage')}
          >
            <ChevronsRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
