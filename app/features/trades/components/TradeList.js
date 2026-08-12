'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { 
  BookOpen, Layers, Activity, Target, AlertTriangle, 
  Image, BarChart2, ChevronUp, ChevronDown, Calendar, 
  Zap, Sparkles, X, Brain 
} from 'lucide-react';
import { useLanguageStore } from '@/app/core/i18n/store';
import { useThemeStore } from '@/app/core/theme/store';
import { useDashboardStore } from '@/app/features/dashboard/store/dashboardStore';
import { getTradeTypeBadge, isSymbolSupported } from '@/lib/tradeUtils';

export default function TradeList() {
  const t = useLanguageStore(state => state.t);
  const language = useLanguageStore(state => state.language);
  const theme = useThemeStore(state => state.theme);
  const themeStyles = useThemeStore(state => state.themeStyles);

  const trades = useDashboardStore(state => state.trades) || [];
  const activeTab = useDashboardStore(state => state.activeTab);
  const accountTabs = useDashboardStore(state => state.accountTabs);
  
  // Zustand Store actions for Modals/Panels
  const setTradesToReview = useDashboardStore(state => state.openQuickReview);
  
  const setCarouselIndex = useDashboardStore(state => state.setCarouselIndex);
  const setIsCarouselOpen = useDashboardStore(state => state.setIsCarouselOpen);
  const setTradeToGenerateImage = useDashboardStore(state => state.setTradeToGenerateImage);
  const setEditingTrade = useDashboardStore(state => state.openTradeForm); // openTradeForm(trade)
  const fetchDashboardData = useDashboardStore(state => state.fetchDashboardData);

  // Note: Behavior filters are moved to store if they communicate, but for now we keep local as requested to keep UI logic intact
  const [showLessonsOnly, setShowLessonsOnly] = useState(false);
  const [expandedTradeId, setExpandedTradeId] = useState(null);
  const [selectedStrengthFilter, setSelectedStrengthFilter] = useState(null);
  const [selectedWeaknessFilter, setSelectedWeaknessFilter] = useState(null);
  const behaviorFilterIds = useDashboardStore(state => state.behaviorFilterIds);
  const setBehaviorFilterIds = useDashboardStore(state => state.setBehaviorFilterIds);
  
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  
  // Missing functions from V1
  const toggleExpandTrade = (id) => {
    setExpandedTradeId(prev => prev === id ? null : id);
  };

  const setIsExportModalOpen = useDashboardStore(state => state.setIsExportModalOpen);

  const setZoomImages = useDashboardStore(state => state.setZoomImages);

  const setZoomImageIndex = useDashboardStore(state => state.setZoomImageIndex);

  // Filter Trades
  const filteredTrades = useMemo(() => {
    let result = trades;
    
    if (showLessonsOnly) {
      result = result.filter(t => t.is_lesson === 1);
    }
    
    if (behaviorFilterIds) {
      result = result.filter(t => behaviorFilterIds.includes(t.id));
    }
    
    if (selectedStrengthFilter) {
      result = result.filter(t => t.ai_evaluation?.strengths?.includes(selectedStrengthFilter));
    }
    
    if (selectedWeaknessFilter) {
      result = result.filter(t => t.ai_evaluation?.weaknesses?.includes(selectedWeaknessFilter));
    }
    
    return result;
  }, [trades, showLessonsOnly, behaviorFilterIds, selectedStrengthFilter, selectedWeaknessFilter]);

  const totalPages = Math.ceil(filteredTrades.length / itemsPerPage);
  const currentTrades = filteredTrades.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <>
                {/* History Journals */}
                <div className={`rounded-3xl p-6 flex flex-col h-fit transition-colors duration-300 ${themeStyles.card}`}>
                  
                  <div className={`flex justify-between items-center mb-6 pb-4 border-b ${themeStyles.border} flex-wrap gap-4`}>
                    <h3 className={`text-sm font-bold uppercase tracking-wider flex items-center gap-2 ${themeStyles.titleText}`}>
                      📓 {t('tradeJournal')}
                    </h3>
                    <div className="flex items-center gap-2">
                      {trades.length > 0 && (
                        <>
                          <button
                            onClick={() => setShowLessonsOnly(!showLessonsOnly)}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer border ${
                              showLessonsOnly 
                                ? 'bg-amber-500/10 border-amber-500/30 text-amber-500 dark:text-amber-400 font-extrabold' 
                                : theme === 'light'
                                  ? 'bg-white border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-50'
                                  : `${themeStyles.innerCard} ${themeStyles.border} ${themeStyles.titleText} hover:opacity-80`
                            }`}
                          >
                            <BookOpen className={`w-3.5 h-3.5 ${showLessonsOnly ? 'text-amber-400' : 'text-amber-500 dark:text-amber-400'}`} /> {showLessonsOnly ? t('filterLessonsOnly') : t('filterByLessons')}
                          </button>
                          <button
                            onClick={() => setIsExportModalOpen(true)}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${themeStyles.innerCard} ${themeStyles.titleText} hover:opacity-80`}
                          >
                            <BookOpen className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" /> {t('exportHtml')}
                          </button>
                          <button
                            onClick={() => {
                              setCarouselIndex(0);
                              setIsCarouselOpen(true);
                            }}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${themeStyles.innerCard} ${themeStyles.titleText} hover:opacity-80`}
                          >
                            <Layers className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" /> {t('quickView')}
                          </button>
                          <button
                            onClick={() => {
                              const unreviewed = trades.filter(t => !t.setup_tag || t.setup_tag === 'Unclassified' || !t.user_notes);
                              if (unreviewed.length > 0) {
                                setTradesToReview(unreviewed); // This is openQuickReview in the store
                              } else {
                                alert('Tất cả lệnh đã được review đầy đủ!');
                              }
                            }}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                              theme === 'light'
                                ? 'bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100'
                                : 'bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/20'
                            }`}
                          >
                            <Activity className="w-3.5 h-3.5" /> Duyệt nhanh ({trades.filter(t => !t.setup_tag || t.setup_tag === 'Unclassified' || !t.user_notes).length})
                          </button>
                        </>
                      )}
                      <span className={`text-xs font-mono px-2.5 py-1 rounded-lg border ${themeStyles.innerCard} ${themeStyles.titleText}`}>
                        {t('countTrades', { count: trades.length })}
                      </span>
                    </div>
                  </div>

                  {(selectedStrengthFilter || selectedWeaknessFilter || (behaviorFilterIds && behaviorFilterIds.length > 0)) && (
                    <div className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl mb-4 text-xs ${themeStyles.innerCard}`}>
                      <span className={themeStyles.subtext}>
                        {t('filteringBehavior')} {' '}
                        {(selectedStrengthFilter || selectedWeaknessFilter) ? (
                          <strong className={selectedStrengthFilter ? "text-emerald-500 dark:text-emerald-400 font-bold" : "text-rose-500 dark:text-rose-400 font-bold"}>
                            {selectedStrengthFilter || selectedWeaknessFilter}
                          </strong>
                        ) : (
                          <strong className="text-violet-500 dark:text-violet-400 font-bold">
                            AI Behavior Intelligence ({behaviorFilterIds.length} trades)
                          </strong>
                        )}
                      </span>
                      <button 
                        onClick={() => {
                          setSelectedStrengthFilter(null);
                          setSelectedWeaknessFilter(null);
                          setBehaviorFilterIds(null);
                        }}
                        className={`text-[10px] px-2 py-1 rounded-lg transition cursor-pointer font-bold ${themeStyles.innerCard} ${themeStyles.titleText} hover:opacity-80`}
                      >
                        {t('clearFilter')}
                      </button>
                    </div>
                  )}

                  {/* Scrollable list */}
                  <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                    {currentTrades.map((trade) => {
                      const isWin = trade.status === 'WIN';
                      const isLoss = trade.status === 'LOSS';
                      const isExpanded = expandedTradeId === trade.id;
                      const ai = trade.ai_evaluation;

                      return (
                        <div 
                          key={trade.id} 
                          className={`rounded-2xl relative transition-all duration-300 ${themeStyles.tradeCardBg} ${
                            isExpanded ? 'ring-1 ring-emerald-500/20 shadow-xl' : ''
                          }`}
                        >
                          {/* Header Summary */}
                          <div 
                            onClick={() => toggleExpandTrade(trade.id)}
                            className="p-4 cursor-pointer flex items-center justify-between gap-3 text-sm"
                          >
                            <div className="flex items-center gap-3">
                              {/* Side Badge */}
                              <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${
                                trade.side === 'BUY' 
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' 
                                  : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                              }`}>
                                {trade.side}
                              </span>

                              {/* Trade Type Badge */}
                              {(() => {
                                const badge = getTradeTypeBadge(trade.trade_type, language, accountTabs);
                                return (
                                  <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold ${badge.className}`}>
                                    {badge.text}
                                  </span>
                                );
                              })()}

                              {trade.is_lesson === 1 && (
                                <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center gap-1 shadow-sm shadow-amber-500/5">
                                  <BookOpen className="w-3 h-3 text-amber-500" /> Bài Học
                                </span>
                              )}

                              {/* Asset & Setup */}
                              <div>
                                <h4 className={`font-extrabold text-base tracking-tight ${themeStyles.titleText}`}>{trade.asset}</h4>
                                <span className={`text-xs font-medium ${themeStyles.subtext}`}>
                                  Setup: {trade.setup_tag}
                                </span>
                              </div>
                            </div>

                            {/* PnL & Expand */}
                            <div className="flex items-center gap-2">
                              {(() => {
                                const hasAsset = trade.asset && trade.asset.trim() !== '';
                                const hasEntry = trade.entry_price !== null && trade.entry_price !== undefined && !isNaN(parseFloat(trade.entry_price));
                                const hasExit = trade.exit_price !== null && trade.exit_price !== undefined && !isNaN(parseFloat(trade.exit_price));
                                const hasEntryTime = !!trade.trade_time;
                                const hasExitTime = !!trade.exit_time;
                                const imgUrls = trade.images ? String(trade.images).split(',').filter(Boolean) : [];

                                const disabledReasons = [];
                                if (!hasAsset) disabledReasons.push("Tài sản (Asset) đang trống");
                                else if (!isSymbolSupported(trade.asset)) disabledReasons.push(`Cặp tiền ${trade.asset.toUpperCase()} chưa được hỗ trợ`);
                                
                                if (!hasEntry) disabledReasons.push("Entry đang trống");
                                if (!hasExit) disabledReasons.push("Exit đang trống");
                                if (!hasEntryTime) disabledReasons.push("Thời gian vào lệnh trống");
                                if (!hasExitTime) disabledReasons.push("Thời gian ra lệnh trống");
                                if (imgUrls.length >= 10) disabledReasons.push("Đạt giới hạn 10 ảnh");

                                const isChartGenDisabled = disabledReasons.length > 0;

                                return (
                                  <div className="flex items-center gap-1">
                                    {isChartGenDisabled && (
                                      <button
                                        type="button"
                                        onClick={(e) => e.stopPropagation()}
                                        className="relative p-1 rounded-md bg-amber-500/10 text-amber-500 dark:text-amber-400 hover:bg-amber-500/20 transition-colors border border-amber-500/20 cursor-pointer group outline-none"
                                      >
                                        <AlertTriangle className="w-3 h-3" />
                                        
                                        <div className="absolute right-full top-1/2 -translate-y-1/2 mr-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible group-focus:opacity-100 group-focus:visible z-[100] w-[220px] bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-500/30 rounded-xl shadow-xl p-3 text-left transition-all pointer-events-none">
                                          <p className="text-xs font-bold text-amber-600 dark:text-amber-400 mb-1.5">{t('autoGenMissingConditions')}</p>
                                          <ul className="text-[10px] text-slate-700 dark:text-slate-300 list-disc pl-3 space-y-1">
                                            {disabledReasons.map((reason, idx) => (
                                              <li key={idx}>{reason}</li>
                                            ))}
                                          </ul>
                                        </div>
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      disabled={isChartGenDisabled}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setTradeToGenerateImage(trade);
                                      }}
                                      title={t('genImageBtn')}
                                      className="flex items-center gap-1 px-2.5 py-1 bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 dark:text-sky-400 border border-sky-500/20 rounded-lg text-[10px] font-bold transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                      <Image className="w-3 h-3 text-sky-500" /> {t('genImageBtn')}
                                    </button>
                                  </div>
                                );
                              })()}

                              <Link
                                href={`/studio?tradeId=${trade.id}${activeTab && activeTab !== 'ALL' ? `&account=${activeTab}` : ''}`}
                                onClick={(e) => e.stopPropagation()}
                                title={t('viewChartBtn')}
                                className="flex items-center gap-1 px-2.5 py-1 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 rounded-lg text-[10px] font-bold transition cursor-pointer"
                              >
                                <BarChart2 className="w-3 h-3 text-indigo-500" /> {t('viewChartBtn')}
                              </Link>

                              <div className="text-right ml-1">
                                <p className={`font-bold font-mono text-sm ${
                                  isWin ? 'text-emerald-500 dark:text-emerald-400' : isLoss ? 'text-rose-500 dark:text-rose-400' : themeStyles.subtext
                                }`}>
                                  {isWin ? '+' : ''}{trade.pnl.toLocaleString()} USD
                                </p>
                                <div className={`flex flex-col items-end`}>
                                  <span className={`text-[9px] font-mono ${themeStyles.subtext}`}>
                                    Trade Quality: {ai?.decision_rating ? `${ai.decision_rating}/10` : '-'}
                                  </span>
                                  {ai?.decision_rating && ai.decision_rating <= 5 && (
                                    <span className="text-rose-500 font-bold text-[10px] mt-0.5">🔴 Risk</span>
                                  )}
                                </div>
                              </div>
                              {isExpanded ? (
                                <ChevronUp className={`w-4 h-4 ${themeStyles.subtext}`} />
                              ) : (
                                <ChevronDown className={`w-4 h-4 ${themeStyles.subtext}`} />
                              )}
                            </div>
                          </div>

                          {/* Expanded Details */}
                          {isExpanded && (
                            <div className={`px-4 pb-4 border-t ${themeStyles.border} ${themeStyles.innerCard} text-xs space-y-4 pt-3.5 animate-slide-down`}>
                              
                              {/* Specific Metrics */}
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 rounded-xl bg-slate-50/70 dark:bg-slate-800/30 font-mono">
                                <div>
                                  <span className={`block text-[9px] uppercase font-sans ${themeStyles.subtext}`}>Giá vào:</span>
                                  <span className={`text-xs font-semibold ${themeStyles.titleText}`}>{trade.entry_price}</span>
                                </div>
                                <div>
                                  <span className={`block text-[9px] uppercase font-sans ${themeStyles.subtext}`}>Giá ra:</span>
                                  <span className={`text-xs font-semibold ${themeStyles.titleText}`}>{trade.exit_price}</span>
                                </div>
                                <div>
                                  <span className={`block text-[9px] uppercase font-sans ${themeStyles.subtext}`}>Stop Loss:</span>
                                  <span className={`text-xs ${themeStyles.subtext}`}>{trade.stop_loss || 'Không'}</span>
                                </div>
                                <div>
                                  <span className={`block text-[9px] uppercase font-sans ${themeStyles.subtext}`}>Volume:</span>
                                  <span className={`text-xs ${themeStyles.subtext}`}>{trade.size}</span>
                                </div>
                              </div>

                              {/* Trade Context & Execution Tags (User Inputs) */}
                              {(() => {
                                const getTagStyle = (label) => {
                                  if (label === 'Xu hướng' || label === 'Vào lệnh') return "text-blue-700 dark:text-blue-300 bg-blue-100/40 dark:bg-blue-500/10 border border-blue-200/30 dark:border-blue-500/20";
                                  if (label === 'Chất lượng' || label === 'Kế hoạch Risk') return "text-emerald-700 dark:text-emerald-300 bg-emerald-100/40 dark:bg-emerald-500/10 border border-emerald-200/30 dark:border-emerald-500/20";
                                  if (label === 'Quản lý' || label === 'Lý do chốt') return "text-violet-700 dark:text-violet-300 bg-violet-100/40 dark:bg-violet-500/10 border border-violet-200/30 dark:border-violet-500/20";
                                  if (label === 'Tâm lý') return "text-amber-700 dark:text-amber-300 bg-amber-100/40 dark:bg-amber-500/10 border border-amber-200/30 dark:border-amber-500/20";
                                  if (label === 'Lỗi sai') return "text-rose-700 dark:text-rose-300 bg-rose-100/40 dark:bg-rose-500/10 border border-rose-200/30 dark:border-rose-500/20";
                                  return "text-slate-700 dark:text-slate-300 bg-slate-100/50 dark:bg-slate-800/50 border border-slate-200/40 dark:border-slate-700/50";
                                };

                                const allTags = [
                                  { label: 'Xu hướng', value: trade.market_trend, format: (v) => v.replace('#Trend_', '').replace(/_/g, ' ') },
                                  { label: 'Khung lớn', value: trade.htf_context, format: (v) => v.replace(/_/g, ' ') },
                                  { label: 'Vùng giá (POI)', value: trade.poi, format: (v) => v.replace(/_/g, ' ') },
                                  { label: 'Hợp lưu', value: trade.confluences, format: (v) => v.replace(/_/g, ' ') },
                                  { label: 'Kế hoạch Risk', value: trade.risk_plan, format: (v) => v.replace(/_/g, ' ') },
                                  { label: 'Vào lệnh', value: trade.entry_trigger, format: (v) => v.replace('#Trigger_', '').replace(/_/g, ' ') },
                                  { label: 'Chất lượng', value: trade.execution_quality, format: (v) => v.replace('#Exec_', '').replace(/_/g, ' ') },
                                  { label: 'Quản lý', value: trade.trade_management, format: (v) => v.replace('#Mgmt_', '').replace(/_/g, ' ') },
                                  { label: 'Lý do chốt', value: trade.exit_reason, format: (v) => v.replace(/_/g, ' ') },
                                  { label: 'Tâm lý', value: trade.emotions, format: (v) => v.replace(/_/g, ' ') },
                                  { label: 'Lỗi sai', value: trade.mistakes, format: (v) => v.replace(/_/g, ' ') }
                                ].filter(t => t.value);

                                if (allTags.length === 0) return null;

                                const midIndex = Math.ceil(allTags.length / 2);
                                const leftColumnTags = allTags.slice(0, midIndex);
                                const rightColumnTags = allTags.slice(midIndex);

                                return (
                                  <details className="group/profile rounded-xl border border-indigo-100/40 dark:border-indigo-500/10 bg-indigo-50/20 dark:bg-indigo-900/10 transition-all duration-300 overflow-hidden">
                                    <summary className="flex justify-between items-center cursor-pointer list-none text-[10px] text-indigo-700/70 dark:text-indigo-300/80 uppercase tracking-widest font-bold hover:text-indigo-800 hover:bg-indigo-50/40 dark:hover:text-indigo-200 transition-colors p-3 px-4">
                                      <div className="flex items-center gap-2">
                                        <Target className="w-3.5 h-3.5 opacity-80 text-indigo-500" /> 
                                        Hồ sơ giao dịch
                                      </div>
                                      <div className="flex items-center gap-1 font-semibold text-[9px]">
                                        <span className="group-open/profile:hidden opacity-70">CHI TIẾT →</span>
                                        <span className="hidden group-open/profile:inline opacity-70">THU GỌN</span>
                                      </div>
                                    </summary>
                                    
                                    <div className="px-4 pb-4 pt-3 border-t border-indigo-100/40 dark:border-indigo-500/10">
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
                                        <div className="space-y-3">
                                          {leftColumnTags.map((t, i) => (
                                            <div key={`left-${i}`} className="flex items-center justify-between sm:justify-start sm:grid sm:grid-cols-[85px_1fr]">
                                              <span className="text-[11px] text-slate-500 dark:text-slate-400">{t.label}:</span>
                                              <div className="flex">
                                                <span className={`text-[10.5px] font-medium px-2 py-0.5 rounded ${getTagStyle(t.label)} shadow-sm`}>
                                                  {t.format ? t.format(t.value) : t.value}
                                                </span>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                        {rightColumnTags.length > 0 && (
                                          <div className="space-y-3 sm:border-l sm:border-indigo-100/50 sm:dark:border-indigo-500/10 sm:pl-6">
                                            {rightColumnTags.map((t, i) => (
                                              <div key={`right-${i}`} className="flex items-center justify-between sm:justify-start sm:grid sm:grid-cols-[85px_1fr]">
                                                <span className="text-[11px] text-slate-500 dark:text-slate-400">{t.label}:</span>
                                                <div className="flex">
                                                  <span className={`text-[10.5px] font-medium px-2 py-0.5 rounded ${getTagStyle(t.label)} shadow-sm`}>
                                                    {t.format ? t.format(t.value) : t.value}
                                                  </span>
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </details>
                                );
                              })()}

                              {/* Ghi chú bối cảnh */}
                              {trade.user_notes && (
                                <div className="space-y-1.5 pt-1">
                                  <div className="flex items-center gap-1.5 font-bold text-slate-500 dark:text-slate-400 uppercase text-[10px] tracking-widest px-1">
                                    <BookOpen className="w-3.5 h-3.5 opacity-70" /> Ghi chú
                                  </div>
                                  <p className={`leading-relaxed p-3 rounded-xl border border-slate-200/60 dark:border-slate-700/50 text-sm whitespace-pre-wrap bg-white/50 dark:bg-slate-900/30 ${themeStyles.titleText}`}>
                                    {trade.user_notes}
                                  </p>
                                </div>
                              )}

                              {/* Chart Image Thumbnail */}
                              {(() => {
                                if (!trade.image_url) return null;
                                let currentImages = [];
                                try {
                                  const parsed = JSON.parse(trade.image_url);
                                  currentImages = Array.isArray(parsed) ? parsed : [trade.image_url];
                                } catch (e) {
                                  currentImages = [trade.image_url];
                                }
                                if (currentImages.length === 0) return null;

                                return (
                                  <div className="space-y-2.5 pt-1">
                                    <div className="flex items-center gap-1.5 font-bold text-slate-500 dark:text-slate-400 uppercase text-[10px] tracking-widest px-1">
                                      <Image className="w-3.5 h-3.5 opacity-70" /> Ảnh chụp biểu đồ ({currentImages.length})
                                    </div>
                                    <div className="flex flex-wrap gap-3">
                                      {currentImages.map((imgUrl, imgIdx) => (
                                        <div 
                                          key={imgIdx}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setZoomImages(currentImages);
                                            setZoomImageIndex(imgIdx);
                                          }}
                                          className={`relative w-28 sm:w-36 aspect-video rounded-lg overflow-hidden border ${themeStyles.border} ${themeStyles.innerCard} cursor-zoom-in hover:scale-[1.02] transition`}
                                        >
                                          <img 
                                            src={imgUrl} 
                                            alt={`Trade chart ${imgIdx + 1}`} 
                                            onError={(e) => {
                                              e.target.style.display = 'none';
                                              if (e.target.nextElementSibling) e.target.nextElementSibling.style.display = 'flex';
                                            }}
                                            className="h-full w-full object-contain mx-auto select-none pointer-events-none"
                                          />
                                          <div className="absolute inset-0 hidden items-center justify-center text-slate-400 dark:text-slate-600 bg-slate-100 dark:bg-slate-900 pointer-events-none">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8 opacity-50"><line x1="3" y1="3" x2="21" y2="21"/><path d="M15 15l2.121-2.121A4 4 0 0 0 11.414 7.17L9 9.586"/><path d="m3 16 5-5"/><path d="M4 22h14c0-1.1.9-2 2-2"/><path d="M22 18V4a2 2 0 0 0-2-2H8"/><circle cx="9" cy="9" r="2"/></svg>
                                          </div>
                                          <span className="absolute bottom-1 right-1 text-[9px] bg-white/90 dark:bg-slate-950/70 text-slate-600 dark:text-slate-200 px-1.5 py-0.5 rounded-md font-mono shadow-sm backdrop-blur-sm pointer-events-none border border-slate-200/50 dark:border-transparent">
                                            #{imgIdx + 1}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })()}

                                  {/* AI Coaching Feedbacks */}
                                  {ai && (
                                    <div className={`space-y-3 border-t ${themeStyles.border} pt-4 mt-2`}>
                                      <div className={`p-4 sm:p-5 rounded-2xl bg-white/40 dark:bg-slate-900/40 relative overflow-hidden group border border-slate-200/40 dark:border-white/5`}>
                                        <div className={`absolute inset-0 bg-gradient-to-br to-transparent pointer-events-none ${
                                          ai.coach_title?.includes('RISK') ? 'from-rose-500/5' :
                                          ai.coach_title?.includes('GOOD') ? 'from-emerald-500/5' :
                                          'from-amber-500/5'
                                        }`} />
                                        
                                        <div className="relative z-10">
                                          {ai.coach_verdict ? (
                                            <>
                                              <div className="flex items-center gap-1.5 font-bold tracking-wider text-[11px] uppercase mb-3.5">
                                                <Brain className={`w-4 h-4 opacity-80 ${
                                                  ai.coach_title?.includes('RISK') ? 'text-rose-500' :
                                                  ai.coach_title?.includes('GOOD') ? 'text-emerald-500' :
                                                  'text-amber-500'
                                                }`} />
                                                <span className={`${
                                                  ai.coach_title?.includes('RISK') ? 'text-rose-600 dark:text-rose-400' :
                                                  ai.coach_title?.includes('GOOD') ? 'text-emerald-600 dark:text-emerald-400' :
                                                  'text-amber-600 dark:text-amber-400'
                                                }`}>AI Coach</span>
                                              </div>
                                              <div className="text-[13px] leading-relaxed text-slate-700 dark:text-slate-300 space-y-2.5">
                                                <p className="font-semibold text-[14px] text-slate-900 dark:text-slate-100">{ai.coach_verdict}</p>
                                                {ai.coach_why && <p className="text-slate-600 dark:text-slate-400">{ai.coach_why}</p>}
                                                {ai.coach_action && (
                                                  <div className="pt-2 mt-2 border-t border-slate-200/50 dark:border-slate-700/50">
                                                    <p className="whitespace-pre-line font-medium text-slate-700 dark:text-slate-300">{ai.coach_action}</p>
                                                  </div>
                                                )}
                                              </div>
                                            </>
                                          ) : ai.coach_message ? (
                                            <div className="text-[13px] leading-relaxed whitespace-pre-wrap font-medium text-slate-700 dark:text-slate-300">
                                              {ai.coach_message}
                                            </div>
                                          ) : (
                                            <div className="text-[13px] leading-relaxed whitespace-pre-wrap font-medium text-slate-700 dark:text-slate-300">
                                              <span className="font-bold text-emerald-600 dark:text-emerald-400 block mb-2 tracking-wide">🧠 COACH</span>
                                              {(ai.strengths || []).map((s, i) => <span key={`s-${i}`} className="block mb-1.5"><span className="text-emerald-500 mr-1">✓</span>{s}</span>)}
                                              {(ai.weaknesses || []).map((w, i) => <span key={`w-${i}`} className="block mb-1.5"><span className="text-rose-500 mr-1">✗</span>{w}</span>)}
                                              {ai.advice && <span className="block mt-2 pt-2 border-t border-slate-200 dark:border-white/5 italic text-slate-600 dark:text-slate-400">{ai.advice}</span>}
                                            </div>
                                          )}
                                        </div>
                                        
                                        <details className="group/details relative z-10 mt-3 pt-3 border-t border-slate-200/50 dark:border-white/5">
                                          <summary className="flex justify-between items-center cursor-pointer list-none text-[10px] text-slate-500 dark:text-slate-500 uppercase tracking-wider font-bold hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
                                            <div className="flex items-center gap-1.5">
                                              <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600"></span>
                                              AI REVIEWED TRADE DATA
                                            </div>
                                            <div className="flex items-center gap-1 text-indigo-500">
                                              <span className="group-open/details:hidden">Xem tại sao →</span>
                                              <span className="hidden group-open/details:inline">Đóng lại</span>
                                            </div>
                                          </summary>
                                          <div className="mt-3 text-xs space-y-3 font-mono text-slate-600 dark:text-slate-400 bg-white/50 dark:bg-black/20 p-3 rounded-lg border border-slate-200/50 dark:border-white/5">
                                            <div className="grid grid-cols-2 gap-4">
                                              <div>
                                                <div className="font-bold mb-1.5 text-slate-700 dark:text-slate-300 uppercase text-[9px] tracking-wider">EVIDENCE</div>
                                                <div className="space-y-1.5 text-[11px]">
                                                  <div className="flex justify-between"><span>Entry</span><span className="text-slate-900 dark:text-white font-semibold">{trade.entry_price || '—'}</span></div>
                                                  <div className="flex justify-between"><span>Exit</span><span className="text-slate-900 dark:text-white font-semibold">{trade.exit_price || '—'}</span></div>
                                                  <div className="flex justify-between"><span>SL</span><span className="text-slate-900 dark:text-white font-semibold">{trade.stop_loss || '—'}</span></div>
                                                  <div className="flex justify-between"><span>Volume</span><span className="text-slate-900 dark:text-white font-semibold">{trade.size || '—'}</span></div>
                                                  <div className="flex justify-between pt-1 border-t border-slate-200/50 dark:border-white/10 mt-1">
                                                    <span>P/L</span>
                                                    <span className={`font-bold ${trade.pnl >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                                                      {trade.pnl >= 0 ? '+' : ''}{trade.pnl}
                                                    </span>
                                                  </div>
                                                </div>
                                              </div>
                                              <div>
                                                <div className="font-bold mb-1.5 text-slate-700 dark:text-slate-300 uppercase text-[9px] tracking-wider">WHY</div>
                                                <div className="space-y-1.5 text-[10px]">
                                                  {!trade.stop_loss ? (
                                                    <>
                                                      <div className="text-rose-500 dark:text-rose-400">→ Không có SL</div>
                                                      <div className="text-rose-500 dark:text-rose-400">→ Không xác định invalidation</div>
                                                      <div className="text-rose-500 dark:text-rose-400">→ Risk trước entry không xác định</div>
                                                      <div className="text-slate-500">→ Volume {trade.size || '—'} không thể đánh giá risk</div>
                                                    </>
                                                  ) : (
                                                    <>
                                                      <div className="text-emerald-500 dark:text-emerald-400">→ Có Stop Loss rõ ràng</div>
                                                      <div className="text-emerald-500 dark:text-emerald-400">→ Đã xác định điểm Invalidation</div>
                                                      <div className="text-emerald-500 dark:text-emerald-400">→ Risk/Reward có thể ước tính trước</div>
                                                    </>
                                                  )}
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        </details>
                                      </div>
                                    </div>
                                  )}

                              {/* Footer Timestamp & Actions */}
                              <div className="flex justify-between items-center text-[10px] text-slate-500 pt-2 border-t border-slate-800/40 mt-1 font-mono">
                                <span className="flex items-center gap-1 flex-wrap">
                                  <Calendar className="w-3.5 h-3.5" /> 
                                  {trade.trade_time ? new Date(trade.trade_time.replace(' ', 'T') + 'Z').toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : 'N/A'}
                                  {trade.exit_time && ` → ${new Date(trade.exit_time.replace(' ', 'T') + 'Z').toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}`}
                                </span>
                                <div className="flex items-center gap-3">

                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingTrade(trade);
                                    }}
                                    className="flex items-center gap-1 text-slate-400 hover:text-emerald-450 hover:font-bold transition font-semibold"
                                  >
                                    <Sparkles className="w-3 h-3 text-emerald-400" /> {t('edit')}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      if (confirm(t('confirmDelete'))) {
                                        try {
                                          const res = await fetch(`/api/trades?id=${trade.id}`, { method: 'DELETE' });
                                          const result = await res.json();
                                          if (result.success) {
                                            fetchDashboardData(activeTab);
                                          } else {
                                            alert(result.error || 'Lỗi khi xóa lệnh');
                                          }
                                        } catch (err) {
                                          alert('Lỗi kết nối mạng khi xóa');
                                        }
                                      }
                                    }}
                                    className="flex items-center gap-1 text-slate-400 hover:text-rose-500 transition font-semibold"
                                  >
                                    <X className="w-3 h-3 text-rose-400" /> {t('delete')}
                                  </button>
                                </div>
                              </div>

                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Sidebar list pagination controls */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between pt-4 mt-auto border-t border-slate-850 text-xs">
                      <button
                        type="button"
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        className="px-3 py-1.5 bg-slate-950 hover:bg-slate-900 border border-slate-850 rounded-xl text-slate-300 disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer"
                      >
                        {t('pagePrev')}
                      </button>
                      <span className="text-slate-400 font-mono">
                        {t('pageIndicator', { current: currentPage, total: totalPages })}
                      </span>
                      <button
                        type="button"
                        disabled={currentPage === totalPages}
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        className="px-3 py-1.5 bg-slate-950 hover:bg-slate-900 border border-slate-850 rounded-xl text-slate-300 disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer"
                      >
                        {t('pageNext')}
                      </button>
                    </div>
                  )}

                </div>

    </>
  );
}
