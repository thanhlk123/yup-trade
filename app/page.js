'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { 
  Plus, 
  Sparkles, 
  TrendingUp, 
  TrendingDown, 
  RotateCcw, 
  BookOpen, 
  ChevronDown, 
  ChevronUp, 
  ChevronLeft,
  ChevronRight,
  Calendar,
  Layers,
  Award,
  ShieldAlert,
  Flame,
  Brain,
  Trash2,
  Image,
  X,
  FileSpreadsheet,
  AlertTriangle,
  Zap,
  MoreHorizontal,
  Settings,
  Maximize2,
  Minimize2,
  Sun,
  Moon,
  Trees,
  BarChart2,
  Target,
  BrainCircuit,
  Activity
} from 'lucide-react';
import TradeForm from '@/components/TradeForm';
import SetupStats from '@/components/SetupStats';
import TradingImprovementEngine from '@/components/TradingImprovementEngine';
import BehaviorIntelligence from '@/components/BehaviorIntelligence';

import ImportCSVModal from '@/components/ImportCSVModal';
import TradingRules from '@/components/TradingRules';

import WhatIfSimulator from '@/components/WhatIfSimulator';
import TradingViewChart from '@/components/TradingViewChart';
import TradingViewStudioModal from '@/components/TradingViewStudioModal';
import QuickReviewModal from '@/components/QuickReviewModal';
import HiddenChartGenerator from '@/components/HiddenChartGenerator';
import GlobalErrorHandler from '@/components/GlobalErrorHandler';
import LanguageSelector from '@/components/LanguageSelector';
import { LanguageProvider, useLanguage } from '@/lib/i18n/LanguageContext';
import { parseImageUrls, formatImagesForDb } from '@/lib/imageUtils';
import { 
  getTradeTypeBadge, 
  hasContextNotes, 
  extractTechnicalStrengths, 
  extractTechnicalWeaknesses, 
  extractPsychologicalMistakes, 
  extractLessons,
  isDcaTrade,
  isSymbolSupported
} from '@/lib/tradeUtils';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

function DashboardContent() {
  const { language, t } = useLanguage();
  const [mounted, setMounted] = useState(false);
  const [trades, setTrades] = useState([]);
  const [stats, setStats] = useState({ summary: {}, setups: [] });
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const [isCSVImportOpen, setIsCSVImportOpen] = useState(false);

  const [isStudioModalOpen, setIsStudioModalOpen] = useState(false);
  const [expandedTradeId, setExpandedTradeId] = useState(null);
  const [activeChartTab, setActiveChartTab] = useState('equity');
  const [activeTab, setActiveTabState] = useState('LIVE'); // 'LIVE' | 'BACKTEST' | 'ALL' | custom
  const [tradeToGenerateImage, setTradeToGenerateImage] = useState(null);
  
  const [accountTabs, setAccountTabs] = useState([]);
  const [isAccountTabsLoaded, setIsAccountTabsLoaded] = useState(false);

  // Sync activeTab with localStorage
  const setActiveTab = (tab) => {
    setActiveTabState(tab);
    if (typeof window !== 'undefined') {
      localStorage.setItem('ai_trading_active_account_tab', tab);
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedTab = localStorage.getItem('ai_trading_active_account_tab');
      if (savedTab) {
        setActiveTabState(savedTab);
      }
    }
  }, []);

  const [isAddTabModalOpen, setIsAddTabModalOpen] = useState(false);
  const [newTabName, setNewTabName] = useState('');
  const [newTabColor, setNewTabColor] = useState('emerald');

  const [editingTabKey, setEditingTabKey] = useState(null);
  const [editingTabName, setEditingTabName] = useState('');
  
  const [draggedTab, setDraggedTab] = useState(null);
  const [dragOverTab, setDragOverTab] = useState(null);
  const [heldTab, setHeldTab] = useState(null);
  const holdTimeout = useRef(null);

  const loadAccountTabs = async () => {
    try {
      const res = await fetch('/api/account-tabs');
      const data = await res.json();
      if (data.success && data.data) {
        // Map from DB structure to frontend structure
        const mappedTabs = data.data.map(t => ({
          key: t.tab_key,
          label: t.label,
          color: t.color,
          isAll: t.is_all === 1,
          order: t.display_order
        }));
        setAccountTabs(mappedTabs);
        if (mappedTabs.length > 0) {
          let currentTab = typeof window !== 'undefined' ? localStorage.getItem('ai_trading_active_account_tab') : 'LIVE';
          if (!currentTab) currentTab = 'LIVE';

          let tabToSet = currentTab;
          const isSavedTabInMapped = mappedTabs.some(t => t.key === currentTab);
          
          if (currentTab === 'LIVE' || !isSavedTabInMapped) {
            tabToSet = mappedTabs[0].key;
          }
          
          setActiveTab(tabToSet);
        }
      }
    } catch (e) {
      console.error('Failed to load account tabs:', e);
    } finally {
      setIsAccountTabsLoaded(true);
    }
  };

  // Quick Review state
  const [isQuickReviewOpen, setIsQuickReviewOpen] = useState(false);
  const [tradesToReview, setTradesToReview] = useState([]);

  useEffect(() => {
    loadAccountTabs();
  }, []);

  const handleAddAccountTab = async () => {
    if (!newTabName.trim()) return;
    const cleanKey = 'TAB_' + newTabName.trim().toUpperCase().replace(/[^A-Z0-9]/g, '_');
    
    // Find highest order to place new tab before 'ALL' tab
    const allTab = accountTabs.find(t => t.isAll);
    const highestOrderBeforeAll = accountTabs
      .filter(t => !t.isAll)
      .reduce((max, t) => Math.max(max, t.order || 0), -1);
      
    const newOrder = highestOrderBeforeAll + 1;
    
    // If 'ALL' tab exists, push its order + 1 or make sure new tab is before it
    // Actually we can just update 'ALL' tab order if needed, but for now just inserting with order is fine.

    try {
      const res = await fetch('/api/account-tabs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: cleanKey,
          label: newTabName.trim(),
          color: newTabColor,
          isAll: false,
          display_order: newOrder
        })
      });
      const data = await res.json();
      
      if (data.success) {
        await loadAccountTabs();
        setActiveTab(cleanKey);
        setNewTabName('');
        setIsAddTabModalOpen(false);
      } else {
        alert(data.error || 'Failed to add tab');
      }
    } catch (e) {
      console.error(e);
      alert('Network error when adding tab');
    }
  };

  const handleDeleteAccountTab = async (tabToDelete) => {
    if (tabToDelete.isAll) return;
    const confirmMsg = t('deleteTabConfirm', { name: tabToDelete.label });

    if (confirm(confirmMsg)) {
      try {
        const res = await fetch(`/api/account-tabs?key=${tabToDelete.key}`, { method: 'DELETE' });
        const data = await res.json();
        
        if (data.success) {
          // Clear associated localStorage data (like drawings) for deleted trades
          if (data.deletedTradeIds && data.deletedTradeIds.length > 0) {
            data.deletedTradeIds.forEach(id => {
              localStorage.removeItem(`tv_drawings_v2_${id}`);
            });
          }

          await loadAccountTabs();
          if (activeTab === tabToDelete.key) {
            setActiveTab('ALL');
          }
          
          // Refresh dashboard data so the deleted trades disappear from the UI
          fetchDashboardData();
        } else {
          alert(data.error || 'Failed to delete tab');
        }
      } catch (e) {
        console.error(e);
        alert('Network error when deleting tab');
      }
    }
  };

  const handleSaveInlineRename = async () => {
    if (editingTabKey && editingTabName.trim()) {
      try {
        const res = await fetch('/api/account-tabs', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tab_key: editingTabKey,
            label: editingTabName.trim()
          })
        });
        const data = await res.json();
        
        if (data.success) {
          await loadAccountTabs();
        } else {
          alert(data.error || 'Failed to rename tab');
        }
      } catch (e) {
        console.error(e);
        alert('Network error when renaming tab');
      }
    }
    setEditingTabKey(null);
  };
  const [showLessonsOnly, setShowLessonsOnly] = useState(false);
  const [selectedStrengthFilter, setSelectedStrengthFilter] = useState(null);
  const [selectedWeaknessFilter, setSelectedWeaknessFilter] = useState(null);
  const [behaviorFilterIds, setBehaviorFilterIds] = useState(null); // new: behavior filter by ID set
  const [zoomImages, setZoomImages] = useState([]);
  const [zoomImageIndex, setZoomImageIndex] = useState(0);
  const [isCarouselOpen, setIsCarouselOpen] = useState(false);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [carouselImageIndex, setCarouselImageIndex] = useState(0);
  const [editingTrade, setEditingTrade] = useState(null);
  const [zoomScale, setZoomScale] = useState(1); // 1 to 4 for image details zooming
  
  const [weeklyReview, setWeeklyReview] = useState(null);
  const [isWeeklyReviewOpen, setIsWeeklyReviewOpen] = useState(false);
  const [loadingWeeklyReview, setLoadingWeeklyReview] = useState(false);
  
  const [recentReview, setRecentReview] = useState(null);
  const [isRecentReviewOpen, setIsRecentReviewOpen] = useState(false);
  const [loadingRecentReview, setLoadingRecentReview] = useState(false);

  const [todayReview, setTodayReview] = useState(null);
  const [isTodayReviewOpen, setIsTodayReviewOpen] = useState(false);
  const [loadingTodayReview, setLoadingTodayReview] = useState(false);

  const [monthlyReview, setMonthlyReview] = useState(null);
  const [isMonthlyReviewOpen, setIsMonthlyReviewOpen] = useState(false);
  const [loadingMonthlyReview, setLoadingMonthlyReview] = useState(false);
  const [isReviewMenuOpen, setIsReviewMenuOpen] = useState(false);

  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showCustomDate, setShowCustomDate] = useState(false);
  const [exportStartDate, setExportStartDate] = useState('');
  const [exportEndDate, setExportEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [weeklyTradeCount, setWeeklyTradeCount] = useState(0);
  const [monthlyTradeCount, setMonthlyTradeCount] = useState(0);
  const [ruleViolations, setRuleViolations] = useState([]);
  const [whatIfTrade, setWhatIfTrade] = useState(null);
  const [selectedTradeForChart, setSelectedTradeForChart] = useState(null);
  const chartSectionRef = useRef(null);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [expandedWidget, setExpandedWidget] = useState(null);
  const [isWidgetSettingsOpen, setIsWidgetSettingsOpen] = useState(false);
  const [theme, setTheme] = useState('dark'); // 'dark' | 'light'

  const handleViewTradeOnChart = (trade) => {
    setSelectedTradeForChart(trade);
    setActiveChartTab('tradingview');
    if (chartSectionRef.current) {
      chartSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  useEffect(() => {
    const savedTheme = localStorage.getItem('ai_trading_theme');
    const initialTheme = (savedTheme && ['dark', 'light'].includes(savedTheme)) ? savedTheme : 'dark';
    setTheme(initialTheme);
    document.documentElement.setAttribute('data-theme', initialTheme);
  }, []);

  const changeTheme = (newTheme) => {
    setTheme(newTheme);
    localStorage.setItem('ai_trading_theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  const getThemeStyles = () => {
    if (theme === 'light') {
      return {
        main: 'bg-slate-100 text-slate-900',
        header: 'bg-white/90 border-slate-200 shadow-sm text-slate-900',
        card: 'bg-white border border-slate-200/80 shadow-sm text-slate-900',
        subtext: 'text-slate-500',
        titleText: 'text-slate-900',
        border: 'border-slate-200',
        innerCard: 'bg-slate-50 border border-slate-200',
        tradeCardBg: 'bg-white border-slate-200 hover:border-slate-300 shadow-sm hover:shadow-md text-slate-900',
        switcherBg: 'bg-slate-200/80 border-slate-300',
      };
    }
    // Default 'dark'
    return {
      main: 'bg-slate-950 text-slate-100',
      header: 'bg-slate-950/60 border-white/5 shadow-sm text-white',
      card: 'bg-slate-900/40 backdrop-blur-xl border border-white/5 shadow-2xl text-slate-100',
      subtext: 'text-slate-400',
      titleText: 'text-white',
      border: 'border-white/5',
      innerCard: 'bg-slate-900/40 border border-white/5',
      tradeCardBg: 'bg-slate-900/20 border-white/5 hover:border-white/10 hover:bg-slate-900/40 shadow-md text-slate-100',
      switcherBg: 'bg-slate-900/80 border-white/10',
    };
  };

  const themeStyles = getThemeStyles();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleDrawingsUpdated = (e) => {
      const { tradeId, drawings_data } = e.detail;
      setTrades(prev => prev.map(t => t.id === tradeId ? { ...t, drawings_data } : t));
    };
    window.addEventListener('tv_drawings_updated', handleDrawingsUpdated);
    return () => window.removeEventListener('tv_drawings_updated', handleDrawingsUpdated);
  }, []);

  // Close dropdowns & modals when clicking outside or pressing Esc
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.more-menu-container')) {
        setIsMoreMenuOpen(false);
      }
      if (!event.target.closest('.widget-settings-container')) {
        setIsWidgetSettingsOpen(false);
      }
      if (!event.target.closest('.smart-review-container')) {
        setIsReviewMenuOpen(false);
      }
    };
    
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsMoreMenuOpen(false);
        setIsWidgetSettingsOpen(false);
        setIsReviewMenuOpen(false);
        setExpandedWidget(null);
      }
    };
    
    document.addEventListener('click', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);
  
  const renderExpandedWidget = () => {
    if (!expandedWidget) return null;
    switch (expandedWidget) {
      case 'ai-insights': return (
        <div className="theme-card rounded-3xl p-6 shadow-2xl relative overflow-hidden flex flex-col">
          <div className="absolute -top-12 -right-12 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
          
          <div className="flex items-center justify-between border-b theme-border pb-4 relative z-10">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <BrainCircuit className="w-5 h-5 text-emerald-400" /> {t('aiInsightsTitle')}
            </h3>
            <button onClick={() => setExpandedWidget(null)} className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition">
              <Minimize2 className="w-4 h-4 text-emerald-400" />
            </button>
          </div>

          <div className="mt-4 mb-2 relative z-10 flex-1 overflow-y-auto pr-2">
            <TradingImprovementEngine trades={trades} activeTab={activeTab} />
          </div>
        </div>
      );
      case 'setup-stats': return <SetupStats stats={stats} trades={trades} isExpanded={true} />;
      case 'progress-dashboard': return <ProgressDashboard activeTab={activeTab} isExpanded={true} />;
      case 'trading-rules': return <TradingRules trades={trades} activeTab={activeTab} onViolationChange={setRuleViolations} isExpanded={true} />;
      case 'context-scratchpad': return <ContextScratchpad isExpanded={true} />;
      default: return null;
    }
  };
  
  const zoomContainerRef = useRef(null);
  const dragStatusRef = useRef({ isDragging: false, startX: 0, startY: 0, scrollLeft: 0, scrollTop: 0 });

  const handleMouseDown = (e) => {
    if (zoomScale === 1 || !zoomContainerRef.current) return;
    const container = zoomContainerRef.current;
    dragStatusRef.current = {
      isDragging: true,
      startX: e.pageX - container.offsetLeft,
      startY: e.pageY - container.offsetTop,
      scrollLeft: container.scrollLeft,
      scrollTop: container.scrollTop
    };
    container.style.cursor = 'grabbing';
    container.style.userSelect = 'none';
  };

  const handleMouseMoveDrag = (e) => {
    if (!dragStatusRef.current.isDragging || !zoomContainerRef.current) return;
    e.preventDefault();
    const container = zoomContainerRef.current;
    const { startX, startY, scrollLeft, scrollTop } = dragStatusRef.current;
    const x = e.pageX - container.offsetLeft;
    const y = e.pageY - container.offsetTop;
    const walkX = (x - startX) * 1.5;
    const walkY = (y - startY) * 1.5;
    container.scrollLeft = scrollLeft - walkX;
    container.scrollTop = scrollTop - walkY;
  };

  const handleMouseUpOrLeave = () => {
    if (!dragStatusRef.current.isDragging) return;
    dragStatusRef.current.isDragging = false;
    if (zoomContainerRef.current) {
      zoomContainerRef.current.style.cursor = zoomScale > 1 ? 'grab' : 'default';
      zoomContainerRef.current.style.userSelect = 'auto';
    }
  };

  const latestFetchRef = useRef(null);

  const fetchDashboardData = async (tab = activeTab) => {
    try {
      const fetchId = Date.now();
      latestFetchRef.current = fetchId;
      setLoading(true);
      const [tradesRes, statsRes] = await Promise.all([
        fetch(`/api/trades?type=${tab}&_t=${fetchId}`),
        fetch(`/api/stats?type=${tab}&_t=${fetchId}`)
      ]);

      if (latestFetchRef.current !== fetchId) return;

      const tradesData = await tradesRes.json();
      const statsData = await statsRes.json();

      if (tradesData.success) setTrades(tradesData.data);
      if (statsData.success) setStats(statsData.data);
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  };



  const getFilteredTrades = (allTrades) => {
    let result = showLessonsOnly ? allTrades.filter(t => t.is_lesson === 1) : allTrades;

    // Behavior Intelligence filter (ID-based, from BehaviorIntelligence component)
    if (behaviorFilterIds && behaviorFilterIds.length > 0) {
      const idSet = new Set(behaviorFilterIds);
      result = result.filter(t => idSet.has(t.id));
    }

    if (selectedStrengthFilter) {
      result = result.filter(tr => {
        const tradeStrengths = new Set();
        
        const techStrengths = extractTechnicalStrengths(tr, t);
        techStrengths.forEach(s => tradeStrengths.add(s));

        if (hasContextNotes(tr)) {
          let ai = tr.ai_evaluation;
          if (typeof ai === 'string') {
            try { ai = JSON.parse(ai); } catch (e) {}
          }
          if (ai && Array.isArray(ai.strengths)) {
            ai.strengths.forEach(s => tradeStrengths.add(s.trim()));
          }
        }
        
        return tradeStrengths.has(selectedStrengthFilter);
      });
    }

    if (selectedWeaknessFilter) {
      result = result.filter(tr => {
        const tradeWeaknesses = new Set();

        // 1. DCA & Technical Weaknesses (All trades)
        if (isDcaTrade(tr)) {
          tradeWeaknesses.add(t('techUncontrolledDca'));
        }
        
        const techWeaknesses = extractTechnicalWeaknesses(tr, t);
        techWeaknesses.forEach(w => tradeWeaknesses.add(w));

        // 2. AI Weaknesses (Only if trade has context notes)
        if (hasContextNotes(tr)) {
          let ai = tr.ai_evaluation;
          if (typeof ai === 'string') {
            try { ai = JSON.parse(ai); } catch (e) {}
          }
          if (ai && Array.isArray(ai.weaknesses)) {
            ai.weaknesses.forEach(w => tradeWeaknesses.add(w.trim()));
          }
        }

        return tradeWeaknesses.has(selectedWeaknessFilter);
      });
    }

    return result;
  };

  const getBehaviorStats = () => {
    const strengthCounts = {};
    const weaknessCounts = {};

    trades.forEach(trade => {
      let ai = trade.ai_evaluation;
      if (typeof ai === 'string') {
        try { ai = JSON.parse(ai); } catch (e) {}
      }
      if (ai) {
        if (ai.strengths && Array.isArray(ai.strengths)) {
          ai.strengths.forEach(str => {
            const trimmed = str.trim();
            if (trimmed) {
              strengthCounts[trimmed] = (strengthCounts[trimmed] || 0) + 1;
            }
          });
        }
        if (ai.weaknesses && Array.isArray(ai.weaknesses)) {
          ai.weaknesses.forEach(wk => {
            const trimmed = wk.trim();
            if (trimmed) {
              weaknessCounts[trimmed] = (weaknessCounts[trimmed] || 0) + 1;
            }
          });
        }
      }
    });

    const topStrengths = Object.entries(strengthCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const topWeaknesses = Object.entries(weaknessCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return { topStrengths, topWeaknesses };
  };

  useEffect(() => {
    fetchDashboardData(activeTab);
  }, [activeTab]);

  useEffect(() => {
    if (isWeeklyReviewOpen) handleWeeklyReview();
    if (isRecentReviewOpen) handleRecentReview();
    if (isTodayReviewOpen) handleTodayReview();
  }, [language]);

  const handleWeeklyReview = async () => {
    try {
      setLoadingWeeklyReview(true);
      const res = await fetch(`/api/weekly-review?type=${activeTab}&lang=${language}`);
      const result = await res.json();
      if (result.success) {
        setWeeklyReview(result.data);
        setIsWeeklyReviewOpen(true);
      } else {
        alert(result.error || 'Không thể tạo nhận xét tuần lúc này.');
      }
    } catch (err) {
      console.error(err);
      alert('Lỗi kết nối mạng khi tải nhận xét tuần.');
    } finally {
      setLoadingWeeklyReview(false);
    }
  };

  const handleMonthlyReview = async () => {
    try {
      setLoadingMonthlyReview(true);
      const res = await fetch(`/api/monthly-review?type=${activeTab}&lang=${language}`);
      const result = await res.json();
      if (result.success) {
        setMonthlyReview(result.data);
        setIsMonthlyReviewOpen(true);
      } else {
        alert(result.error || 'Không thể tạo nhận xét tháng lúc này.');
      }
    } catch (err) {
      console.error(err);
      alert('Lỗi kết nối mạng khi tải nhận xét tháng.');
    } finally {
      setLoadingMonthlyReview(false);
    }
  };

  const handleRecentReview = async () => {
    try {
      setLoadingRecentReview(true);
      const res = await fetch(`/api/recent-review?type=${activeTab}&lang=${language}`);
      const result = await res.json();
      if (result.success) {
        setRecentReview(result.data);
        setIsRecentReviewOpen(true);
      } else {
        alert(result.error || 'Không thể tạo nhận xét chuỗi lệnh lúc này.');
      }
    } catch (err) {
      console.error(err);
      alert('Lỗi kết nối mạng khi tải nhận xét chuỗi lệnh.');
    } finally {
      setLoadingRecentReview(false);
    }
  };

  const handleTodayReview = async () => {
    try {
      setLoadingTodayReview(true);
      const d = new Date();
      const todayDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const res = await fetch(`/api/today-review?type=${activeTab}&date=${todayDateStr}&lang=${language}`);
      const result = await res.json();
      if (result.success) {
        setTodayReview(result.data);
        setIsTodayReviewOpen(true);
      } else {
        alert(result.error || 'Không thể tạo nhận xét hôm nay lúc me.');
      }
    } catch (err) {
      console.error(err);
      alert('Lỗi kết nối mạng khi tải nhận xét ngày hôm nay.');
    } finally {
      setLoadingTodayReview(false);
    }
  };

  useEffect(() => {
    setCarouselImageIndex(0);
  }, [carouselIndex]);

  const handleTradeAdded = (newTrade, isNew = false, forceOpenReview = false) => {
    if (editingTrade) {
      setTrades(prev => prev.map(t => t.id === newTrade.id ? newTrade : t));
      setEditingTrade(null);
    } else if (newTrade) {
      setTrades(prev => [newTrade, ...prev]);
    }
    fetchDashboardData(activeTab);

    // Automatically open Quick Review if forced or if it's a newly created trade
    if ((forceOpenReview || isNew) && newTrade) {
      setTradesToReview([newTrade]);
      setIsQuickReviewOpen(true);
    }
  };

  const handleResetHistory = async () => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa toàn bộ lịch sử giao dịch? Hành động này không thể hoàn tác.')) {
      return;
    }
    try {
      const res = await fetch('/api/trades', { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        fetchDashboardData();
      }
    } catch (error) {
      console.error('Error resetting trades:', error);
    }
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, showLessonsOnly, selectedStrengthFilter, selectedWeaknessFilter, behaviorFilterIds]);

  useEffect(() => {
    const displayedCount = getFilteredTrades(trades).length;
    const totalPages = Math.ceil(displayedCount / 5) || 1;
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [trades, showLessonsOnly, selectedStrengthFilter, selectedWeaknessFilter, behaviorFilterIds]);

  useEffect(() => {
    const today = Date.now();
    const weekAgo = today - 7 * 24 * 60 * 60 * 1000;
    const monthAgo = today - 30 * 24 * 60 * 60 * 1000;
    
    setWeeklyTradeCount(trades.filter(t => new Date(t.trade_time) >= new Date(weekAgo)).length);
    setMonthlyTradeCount(trades.filter(t => new Date(t.trade_time) >= new Date(monthAgo)).length);
  }, [trades]);

  const handleCarouselImageUpload = async (e, trade) => {
    const files = Array.from(e.target.files);
    if (!files || files.length === 0) return;

    let existingImages = parseImageUrls(trade.image_url);

    if (existingImages.length + files.length > 10) {
      alert("Bạn chỉ được đính kèm tối đa 10 hình ảnh biểu đồ cho mỗi giao dịch.");
      return;
    }

    const newImages = [];
    for (const file of files) {
      const base64 = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(file);
      });
      newImages.push(base64);
    }

    const updatedImages = [...existingImages, ...newImages];
    const image_url = JSON.stringify(updatedImages);

    try {
      const response = await fetch('/api/trades', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...trade,
          image_url
        })
      });
      
      const result = await response.json();
      if (result.success) {
        await fetchDashboardData(activeTab);
        setCarouselImageIndex(existingImages.length);
      } else {
        alert(result.error || 'Không thể tải ảnh lên.');
      }
    } catch (err) {
      console.error(err);
      alert('Lỗi mạng khi cập nhật hình ảnh.');
    } finally {
      if (e && e.target) {
        e.target.value = '';
      }
    }
  };

  const toggleExpandTrade = (id) => {
    setExpandedTradeId(expandedTradeId === id ? null : id);
  };

  const exportToHTML = async (range = 'ALL') => {
    if (trades.length === 0) return;

    let filteredTrades = [...trades];
    const now = new Date();

    if (range === 'WEEK') {
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      filteredTrades = trades.filter(t => new Date(t.trade_time) >= sevenDaysAgo);
    } else if (range === 'MONTH') {
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      filteredTrades = trades.filter(t => new Date(t.trade_time) >= thirtyDaysAgo);
    } else if (range === 'RECENT') {
      filteredTrades = trades.slice(0, 20);
    } else if (range === 'TODAY') {
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      filteredTrades = trades.filter(t => new Date(t.trade_time) >= startOfDay);
    } else if (range === 'YESTERDAY') {
      const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      const endOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      filteredTrades = trades.filter(t => {
        const d = new Date(t.trade_time);
        return d >= startOfYesterday && d <= endOfYesterday;
      });
    } else if (range === 'CUSTOM') {
      if (!exportStartDate || !exportEndDate) {
        alert('Vui lòng chọn đầy đủ Từ ngày và Đến ngày!');
        return;
      }
      const start = new Date(exportStartDate);
      const end = new Date(exportEndDate);
      end.setHours(23, 59, 59, 999);
      filteredTrades = trades.filter(t => {
        const d = new Date(t.trade_time);
        return d >= start && d <= end;
      });
    }

    if (filteredTrades.length === 0) {
      alert('Không có giao dịch nào trong khoảng thời gian đã chọn để xuất báo cáo.');
      return;
    }

    setIsExporting(true);

    try {
      // 1. Fetch AI review corresponding to the range if not already fetched
      let targetReview = null;
      let isRecentType = range === 'RECENT';

      if (isRecentType) {
        if (recentReview) {
          targetReview = recentReview;
        } else {
          const res = await fetch(`/api/recent-review?type=${activeTab}`);
          const result = await res.json();
          if (result.success) {
            targetReview = result.data;
            setRecentReview(result.data); // save in state
          }
        }
      } else {
        if (weeklyReview) {
          targetReview = weeklyReview;
        } else {
          const res = await fetch(`/api/weekly-review?type=${activeTab}`);
          const result = await res.json();
          if (result.success) {
            targetReview = result.data;
            setWeeklyReview(result.data); // save in state
          }
        }
      }

      // 2. Generate HTML structure with targetReview
      let tabName = 'Tất cả Lệnh';
      if (activeTab !== 'ALL') {
        const found = accountTabs.find(t => t.key === activeTab);
        tabName = found ? found.label : activeTab;
      }
      const totalTrades = filteredTrades.length;
      const wins = filteredTrades.filter(t => t.status === 'WIN').length;
      const winRate = totalTrades > 0 ? Math.round((wins / totalTrades) * 100) : 0;
      const netPnL = filteredTrades.reduce((acc, t) => acc + t.pnl, 0);

      let aiReviewSection = '';
      if (isRecentType && targetReview) {
        aiReviewSection = `
          <div class="ai-summary-box recent">
              <h3 class="ai-summary-title">${t('htmlReportRecent')}</h3>
              <p style="font-size: 13px; color: #cbd5e1; margin-bottom: 20px; line-height: 1.6;">
                  <strong>🎯 Tổng quan (Summary):</strong> ${targetReview.summary}
              </p>
              
              <div class="ai-summary-grid">
                  <div class="ai-summary-col mistake">
                      <h4>📉 Góc Nhìn Kỹ Thuật (Technical Insight)</h4>
                      <p style="font-size: 12px; line-height: 1.6; color: #cbd5e1; padding-top: 8px;">
                          ${targetReview.technical_insight || 'N/A'}
                      </p>
                  </div>
                  <div class="ai-summary-col weakness">
                      <h4>🧠 Bắt Mạch Tâm Lý (Psychological Insight)</h4>
                      <p style="font-size: 12px; line-height: 1.6; color: #cbd5e1; padding-top: 8px;">
                          ${targetReview.psychological_insight || 'N/A'}
                      </p>
                  </div>
              </div>

              <div class="ai-summary-grid" style="margin-top: 15px;">
                  <div class="ai-summary-col strength">
                      <h4>🛡 Quản Trị Rủi Ro (Risk Insight)</h4>
                      <p style="font-size: 12px; line-height: 1.6; color: #cbd5e1; padding-top: 8px;">
                          ${targetReview.risk_insight || 'N/A'}
                      </p>
                  </div>
                  <div class="ai-summary-col advice">
                      <h4>🎯 Bài Tập & Hành Động (Micro-Goals)</h4>
                      <ul style="padding-top: 8px; list-style-type: disc; margin-left: 20px;">
                          ${targetReview.micro_goals?.map(a => `<li style="font-size: 12px; margin-bottom: 4px; color: #cbd5e1;">${a}</li>`).join('') || '<li>N/A</li>'}
                      </ul>
                  </div>
              </div>
          </div>
        `;
      } else if (targetReview) {
        aiReviewSection = `
          <div class="ai-summary-box">
              <h3 class="ai-summary-title">${t('htmlReportWeekly')}</h3>
              <div style="display: flex; gap: 20px; align-items: center; margin-bottom: 20px; border-bottom: 1px solid rgba(168,85,247,0.1); padding-bottom: 15px;">
                  <div style="text-align: center; background-color: rgba(168,85,247,0.1); padding: 10px 20px; border-radius: 12px; border: 1px solid rgba(168,85,247,0.2);">
                      <div style="font-size: 9px; color: #a855f7; font-weight: bold; text-transform: uppercase;">Điểm Kỷ Luật</div>
                      <div style="font-size: 24px; font-weight: bold; color: #c084fc; font-family: monospace;">${targetReview.discipline_score}/10</div>
                  </div>
                  <div style="flex: 1; font-size: 13px; color: #cbd5e1; line-height: 1.6; font-style: italic;">
                      &ldquo;${targetReview.summary}&rdquo;
                  </div>
              </div>

              <div class="ai-summary-grid">
                  <div class="ai-summary-col strength">
                      <h4>${t('strengthsDecisions')}</h4>
                      <ul>
                          ${targetReview.strengths?.map(s => `<li>${s}</li>`).join('') || '<li>N/A</li>'}
                      </ul>
                  </div>
                  <div class="ai-summary-col weakness">
                      <h4>${t('weaknessesRepeats')}</h4>
                      <ul>
                          ${targetReview.weaknesses?.map(w => `<li>${w}</li>`).join('') || '<li>N/A</li>'}
                      </ul>
                  </div>
              </div>

              <div class="ai-summary-grid" style="margin-top: 15px;">
                  <div class="ai-summary-col advice">
                      <h4>${t('actionPlanCompliance')}</h4>
                      <ul>
                          ${targetReview.action_plan?.map(a => `<li>${a}</li>`).join('') || '<li>N/A</li>'}
                      </ul>
                  </div>
                  <div class="ai-summary-col" style="background-color: rgba(15,23,42,0.4); border: 1px solid #1e293b; padding: 15px; border-radius: 10px; color: #cbd5e1;">
                      <h4 style="color: #60a5fa;">${t('coreLessons')}</h4>
                      <ul style="list-style-type: decimal;">
                          ${targetReview.key_lessons?.map(l => `<li>${l}</li>`).join('') || '<li>N/A</li>'}
                      </ul>
                  </div>
              </div>
          </div>
        `;
      }

      let htmlContent = `<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${t('htmlReportTitle')} - ${tabName}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        
        body {
            font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background-color: #030712;
            color: #f3f4f6;
            margin: 0;
            padding: 40px 20px;
            line-height: 1.6;
        }
        .container {
            max-width: 1000px;
            margin: 0 auto;
        }
        header {
            border-bottom: 1px solid #1f2937;
            padding-bottom: 24px;
            margin-bottom: 32px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        header h1 {
            margin: 0;
            font-size: 22px;
            font-weight: 800;
            background: linear-gradient(to right, #10b981, #3b82f6);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        header p {
            margin: 6px 0 0 0;
            color: #9ca3af;
            font-size: 13px;
        }
        .meta-tag {
            background: linear-gradient(135deg, #1f2937, #111827);
            color: #f9fafb;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 700;
            border: 1px solid #374151;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 16px;
            margin-bottom: 32px;
        }
        .stats-card {
            background-color: #0f172a;
            border: 1px solid #1e293b;
            border-radius: 16px;
            padding: 20px;
            text-align: left;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
        }
        .stats-card .title {
            color: #94a3b8;
            font-size: 11px;
            text-transform: uppercase;
            font-weight: 700;
            letter-spacing: 0.5px;
            margin-bottom: 6px;
        }
        .stats-card .value {
            font-size: 24px;
            font-weight: 800;
            font-family: monospace;
        }
        .text-green { color: #34d399; }
        .text-red { color: #f87171; }
        .text-gray { color: #94a3b8; }
        
        /* AI Summary Box Styling */
        .ai-summary-box {
            background: linear-gradient(135deg, rgba(168,85,247,0.08), rgba(59,130,246,0.03));
            border: 1px solid rgba(168,85,247,0.25);
            border-radius: 24px;
            padding: 24px;
            margin-bottom: 32px;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
        }
        .ai-summary-box.recent {
            background: linear-gradient(135deg, rgba(245,158,11,0.08), rgba(239,68,68,0.03));
            border: 1px solid rgba(245,158,11,0.25);
        }
        .ai-summary-title {
            font-size: 14px;
            font-weight: 800;
            color: #c084fc;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-top: 0;
            margin-bottom: 16px;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .ai-summary-box.recent .ai-summary-title {
            color: #fbbf24;
        }
        .ai-summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 16px;
            margin-top: 16px;
        }
        .ai-summary-col {
            background-color: rgba(17, 24, 39, 0.6);
            border: 1px solid rgba(31, 41, 55, 0.8);
            padding: 18px;
            border-radius: 14px;
        }
        .ai-summary-col h4 {
            margin: 0 0 10px 0;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            font-weight: 700;
        }
        .ai-summary-col.strength h4 { color: #34d399; }
        .ai-summary-col.weakness h4 { color: #f87171; }
        .ai-summary-col.mistake h4 { color: #fbbf24; }
        .ai-summary-col.advice h4 { color: #c084fc; }
        
        .ai-summary-col ul, .ai-col ul {
            margin: 0;
            padding-left: 20px;
            font-size: 12px;
            color: #d1d5db;
        }
        .ai-summary-col ul li, .ai-col ul li {
            margin-bottom: 6px;
        }

        /* Trade Cards */
        .trade-card {
            background-color: #0b1329;
            border: 1px solid #1e293b;
            border-radius: 20px;
            padding: 24px;
            margin-bottom: 32px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }
        .trade-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid #1e293b;
            padding-bottom: 16px;
            margin-bottom: 20px;
        }
        .trade-title {
            font-size: 16px;
            font-weight: 700;
            display: flex;
            align-items: center;
            gap: 12px;
        }
        .trade-side-buy {
            color: #10b981;
            background-color: rgba(16, 185, 129, 0.1);
            padding: 4px 10px;
            border-radius: 6px;
            font-size: 11px;
            font-weight: 700;
            border: 1px solid rgba(16, 185, 129, 0.2);
        }
        .trade-side-sell {
            color: #ef4444;
            background-color: rgba(239, 68, 68, 0.1);
            padding: 4px 10px;
            border-radius: 6px;
            font-size: 11px;
            font-weight: 700;
            border: 1px solid rgba(239, 68, 68, 0.2);
        }
        .trade-pnl {
            font-size: 20px;
            font-weight: 800;
            font-family: monospace;
        }
        .trade-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 12px;
            background-color: #030712;
            padding: 14px;
            border-radius: 12px;
            font-family: monospace;
            font-size: 13px;
            text-align: center;
            margin-bottom: 20px;
            border: 1px solid #1f2937;
        }
        .trade-grid div {
            border-right: 1px solid #1f2937;
        }
        .trade-grid div:last-child {
            border-right: none;
        }
        .trade-grid span {
            color: #9ca3af;
            display: block;
            font-size: 10px;
            text-transform: uppercase;
            font-weight: 600;
            margin-bottom: 4px;
        }
        
        /* Notes Box (Preserving exact whitespace) */
        .notes-box {
            background-color: rgba(17, 24, 39, 0.5);
            border: 1px dashed #374151;
            padding: 16px;
            border-radius: 12px;
            font-size: 13px;
            color: #e5e7eb;
            margin-bottom: 20px;
            white-space: pre-wrap;
            line-height: 1.6;
        }
        
        .ai-section {
            border-top: 1px solid #1f2937;
            padding-top: 20px;
            margin-top: 20px;
        }
        .ai-header {
            font-weight: 700;
            color: #34d399;
            font-size: 12px;
            text-transform: uppercase;
            margin-bottom: 12px;
            display: flex;
            justify-content: space-between;
        }
        .ai-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 16px;
            margin-bottom: 16px;
        }
        .ai-col {
            background-color: rgba(17, 24, 39, 0.4);
            border: 1px solid rgba(55, 65, 81, 0.5);
            padding: 14px;
            border-radius: 10px;
        }
        .ai-col h5 {
            margin: 0 0 8px 0;
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .ai-advice {
            background-color: rgba(16, 185, 129, 0.04);
            border-left: 4px solid #10b981;
            padding: 14px;
            border-radius: 0 10px 10px 0;
            font-size: 12px;
            color: #34d399;
            font-style: italic;
            border: 1px solid rgba(16, 185, 129, 0.08);
        }
        .charts-container {
            display: flex;
            flex-wrap: wrap;
            gap: 12px;
            margin-top: 20px;
        }
        .chart-img {
            max-width: 280px;
            max-height: 180px;
            object-fit: contain;
            border: 1px solid #1f2937;
            border-radius: 12px;
            background-color: #030712;
            cursor: zoom-in;
            transition: transform 0.2s, border-color 0.2s;
        }
        .chart-img:hover {
            transform: scale(1.03);
            border-color: #10b981;
        }
        
        @media print {
            body { background-color: #ffffff; color: #000000; padding: 0; }
            .trade-card { page-break-inside: avoid; border: 1px solid #cbd5e1; background-color: #ffffff; }
            .stats-card, .trade-grid, .notes-box, .ai-col, .ai-advice, .ai-summary-box, .ai-summary-col { background-color: #f8fafc; border: 1px solid #cbd5e1; color: #000000; }
            .text-green { color: #047857; }
            .text-red { color: #b91c1c; }
            header h1 { color: #047857; }
            .chart-img { border: 1px solid #cbd5e1; }
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <div>
                <h1>${t('htmlReportTitle')}</h1>
                <p>Xuất báo cáo tự động ngày: ${new Date().toLocaleDateString('vi-VN')} | Khoảng thời gian: ${range === 'ALL' ? 'Tất cả' : range === 'WEEK' ? 'Tuần qua' : range === 'MONTH' ? 'Tháng qua' : 'Chuỗi 20 lệnh gần đây'}</p>
            </div>
            <div class="meta-tag">${tabName}</div>
        </header>

        <div class="stats-grid">
            <div class="stats-card">
                <div class="title">Tổng Giao Dịch</div>
                <div class="value">${totalTrades}</div>
            </div>
            <div class="stats-card">
                <div class="title">Win Rate</div>
                <div class="value text-green">${winRate}%</div>
            </div>
            <div class="stats-card">
                <div class="title">Tổng PnL</div>
                <div class="value ${netPnL >= 0 ? 'text-green' : 'text-red'}">
                    ${netPnL >= 0 ? '+' : ''}${netPnL.toLocaleString()} USD
                </div>
            </div>
            <div class="stats-card">
                <div class="title">Expectancy</div>
                <div class="value">${stats.summary?.avgPnl >= 0 ? '+' : ''}${stats.summary?.avgPnl?.toLocaleString() || 0} USD</div>
            </div>
        </div>

        ${aiReviewSection}

        <div class="trades-list">
`;

      filteredTrades.forEach((trade, idx) => {
        let images = [];
        if (trade.image_url) {
          try {
            const parsed = JSON.parse(trade.image_url);
            images = Array.isArray(parsed) ? parsed : [trade.image_url];
          } catch (e) {
            images = [trade.image_url];
          }
        }

        let ai = null;
        if (trade.ai_evaluation) {
          try {
            ai = typeof trade.ai_evaluation === 'string' ? JSON.parse(trade.ai_evaluation) : trade.ai_evaluation;
          } catch (e) {
            ai = trade.ai_evaluation;
          }
        }

        htmlContent += `
              <div class="trade-card">
                  <div class="trade-header">
                      <div class="trade-title">
                          ${t('tradeLabel', { num: totalTrades - idx })}: ${trade.asset}
                          <span class="${trade.side === 'BUY' ? 'trade-side-buy' : 'trade-side-sell'}">${trade.side}</span>
                      </div>
                      <div class="trade-pnl ${trade.status === 'WIN' ? 'text-green' : trade.status === 'LOSS' ? 'text-red' : 'text-gray'}">
                          ${trade.pnl >= 0 ? '+' : ''}${trade.pnl.toLocaleString()} USD
                      </div>
                  </div>

                  <div class="trade-grid">
                      <div><span>Giá vào</span>${trade.entry_price}</div>
                      <div><span>Giá ra</span>${trade.exit_price}</div>
                      <div><span>Khối lượng</span>${trade.size}</div>
                      <div><span>Setup</span>${trade.setup_tag || 'N/A'}</div>
                  </div>

                  ${trade.user_notes ? `<div class="notes-box"><strong>${t('tradeNotes')}:</strong>\n${trade.user_notes}</div>` : ''}

                  ${ai ? `
                  <div class="ai-section">
                      <div class="ai-header">
                          <span>${t('recentReviewTitle')}</span>
                          <span style="font-weight: bold; color: #fbbf24;">${t('decisionScore')}: ${ai.decision_rating || 5}/10</span>
                      </div>
                      <div class="ai-grid">
                          <div class="ai-col">
                              <ul>
                                  ${ai.strengths?.map(s => `<li>${s}</li>`).join('') || '<li>Không ghi nhận</li>'}
                              </ul>
                          </div>
                          <div class="ai-col">
                              <h5 style="color: #f87171;">⚠️ Điểm sai (Weaknesses)</h5>
                              <ul>
                                  ${ai.weaknesses?.map(w => `<li>${w}</li>`).join('') || '<li>Không ghi nhận</li>'}
                              </ul>
                          </div>
                      </div>
                      ${ai.advice ? `<div class="ai-advice"><strong>Lời khuyên Coach:</strong> ${ai.advice}</div>` : ''}
                  </div>
                  ` : ''}

                  ${images.length > 0 ? `
                  <div class="charts-container">
                      ${images.map((imgUrl, imgIdx) => `<img src="${imgUrl}" class="chart-img" alt="Chart ${imgIdx + 1}" onclick="showModalImage('${imgUrl}')" />`).join('')}
                  </div>
                  ` : ''}
              </div>
        `;
      });

      htmlContent += `
        </div>
      </div>

      <!-- Lightbox for print view or browser view -->
      <div id="imageModal" style="display: none; position: fixed; inset: 0; background-color: rgba(2,6,23,0.95); z-index: 1000; justify-content: center; align-items: center; cursor: zoom-out;">
          <img id="modalImage" style="max-width: 90%; max-height: 90%; object-fit: contain; border-radius: 12px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);" />
      </div>

      <script>
        const modal = document.getElementById('imageModal');
        const modalImg = document.getElementById('modalImage');
        
        window.showModalImage = function(url) {
          modalImg.src = url;
          modal.style.display = 'flex';
        };
        
        modal.addEventListener('click', () => {
          modal.style.display = 'none';
          modalImg.src = '';
        });
      </script>
  </body>
  </html>
  `;

      const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `nhat-ky-giao-dich-${activeTab}-${range}-${new Date().toISOString().split('T')[0]}.html`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      console.error('Error during HTML export:', e);
      alert('Đã xảy ra lỗi khi tạo báo cáo xuất khẩu.');
    } finally {
      setIsExporting(false);
    }
  };

  // Prepare data for Cumulative Equity Curve
  const prepareChartData = () => {
    if (trades.length === 0) return [];
    
    // Sort trades chronologically (oldest first)
    const chronoTrades = [...trades].reverse();
    let cumulative = 0;
    
    return chronoTrades.map((trade, idx) => {
      cumulative += trade.pnl;
      return {
        name: t('tradeLabel', { num: idx + 1 }),
        pnl: trade.pnl,
        equity: Math.round(cumulative * 100) / 100,
        asset: trade.asset
      };
    });
  };

  const displayedTrades = getFilteredTrades(trades);
  const chartData = prepareChartData();
  const equityColor = stats.summary?.totalPnl >= 0 ? '#10b981' : '#f43f5e';
  const totalPages = Math.ceil(displayedTrades.length / 5) || 1;
  const currentTrades = displayedTrades.slice((currentPage - 1) * 5, currentPage * 5);

  if (!mounted) {
    return <div className="min-h-screen flex items-center justify-center bg-[#12151e] text-slate-400">Loading Dashboard...</div>;
  }

  return (
    <main className={`flex-1 min-h-screen transition-colors duration-300 ${themeStyles.main}`}>
      
      {/* Suppress asynchronous Lightweight Charts disposal errors */}
      <GlobalErrorHandler />
      
      {/* Background Worker for Auto Generating Missing Charts */}
      
      {/* Header Bar */}
      <header className={`border-b sticky top-0 z-30 backdrop-blur-xl px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 transition-colors duration-300 ${themeStyles.header}`}>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-tr from-emerald-500 to-teal-400 rounded-xl shadow-lg shadow-emerald-500/20 text-slate-950">
            <Brain className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold flex items-center gap-2 tracking-tight">
              YUP Trade <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider">v1.0</span>
            </h1>
            <p className={`text-xs ${themeStyles.subtext}`}>{t('appSubTitle')}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Theme Switcher 2-Way Control */}
          <div className={`flex items-center p-1 rounded-xl border bg-slate-200/50 dark:bg-slate-800/50 border-slate-300 dark:border-slate-700 shadow-inner mr-2`}>
            <button
              onClick={() => changeTheme('dark')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                theme === 'dark' 
                  ? 'bg-slate-800 text-emerald-400 shadow-sm border border-emerald-500/20' 
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
              }`}
              title="Midnight Sapphire"
            >
              <Moon className="w-3.5 h-3.5" />
              <span>{t('darkTheme')}</span>
            </button>

            <button
              onClick={() => changeTheme('light')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                theme === 'light' 
                  ? 'bg-white text-blue-600 shadow-sm border border-slate-300 font-extrabold' 
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
              }`}
              title="Soft Slate Light"
            >
              <Sun className="w-3.5 h-3.5 text-amber-500" />
              <span>{t('lightTheme')}</span>
            </button>
          </div>

          {/* Language Selector Dropdown */}
          <LanguageSelector />

          {/* New Feature: Studio TradingView Live & Position Box Visualizer */}
          <Link
            href={`/studio${activeTab && activeTab !== 'ALL' ? `?account=${activeTab}` : ''}`}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-teal-500/20 cursor-pointer"
            title={t('tradingViewStudio')}
          >
            <BarChart2 className="w-4 h-4 font-bold" />
            <span>{t('tradingViewStudio')}</span>
          </Link>



          {/* Main Primary CTA: Nhập Nhật Ký từ CSV */}
          <button
            onClick={() => setIsCSVImportOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-emerald-500/20 cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" /> {t('importCSV')}
          </button>

          {/* Add Manual Trade */}
          <button
            onClick={() => {
              setEditingTrade(null);
              setIsFormOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-slate-700 text-emerald-600 dark:text-emerald-400 border border-emerald-500/40 rounded-xl text-xs font-bold transition shadow cursor-pointer"
            title={t('addManual')}
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">{t('addManual')}</span>
          </button>

          {trades.length > 0 && (
            <div className="relative smart-review-container z-50">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsReviewMenuOpen(!isReviewMenuOpen);
                }}
                className="flex items-center gap-2 px-4 py-2.5 bg-purple-100 dark:bg-purple-500/20 hover:bg-purple-200 dark:hover:bg-purple-500/30 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-500/30 rounded-xl text-xs font-bold transition shadow-[0_0_15px_rgba(168,85,247,0.15)] cursor-pointer"
              >
                <Brain className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                AI Smart Review
                <ChevronDown className="w-3 h-3 text-purple-600 dark:text-purple-400" />
              </button>

              {isReviewMenuOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden p-2 space-y-1">
                  
                  <div className="px-3 py-2 border-b border-white/5 mb-1">
                    <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">{t('reviewSelectTimeframe')}</p>
                  </div>

                  <button 
                    onClick={() => { handleTodayReview(); setIsReviewMenuOpen(false); }}
                    disabled={loadingTodayReview}
                    className="w-full flex flex-col px-3 py-2 hover:bg-slate-800 rounded-xl text-left cursor-pointer transition disabled:opacity-50"
                  >
                    <div className="flex items-center gap-2 text-sm font-bold text-emerald-400">
                      <Award className="w-4 h-4" /> {t('reviewTodayTitle')}
                    </div>
                    <p className="text-[10px] text-slate-500 ml-6 mt-0.5">{t('reviewTodayDesc')}</p>
                  </button>

                  <button 
                    onClick={() => { handleWeeklyReview(); setIsReviewMenuOpen(false); }}
                    disabled={loadingWeeklyReview}
                    className="w-full flex flex-col px-3 py-2 hover:bg-slate-800 rounded-xl text-left cursor-pointer transition disabled:opacity-50"
                  >
                    <div className="flex items-center gap-2 text-sm font-bold text-sky-400">
                      <Calendar className="w-4 h-4" /> {t('reviewWeeklyTitle')}
                    </div>
                    <p className="text-[10px] text-slate-500 ml-6 mt-0.5">{t('reviewWeeklyDesc')}</p>
                  </button>

                  <button 
                    onClick={() => { handleMonthlyReview(); setIsReviewMenuOpen(false); }}
                    disabled={loadingMonthlyReview}
                    className="w-full flex flex-col px-3 py-2 hover:bg-slate-800 rounded-xl text-left cursor-pointer transition disabled:opacity-50"
                  >
                    <div className="flex items-center gap-2 text-sm font-bold text-purple-400">
                      <BarChart2 className="w-4 h-4" /> {t('reviewMonthlyTitle')}
                    </div>
                    <p className="text-[10px] text-slate-500 ml-6 mt-0.5">{t('reviewMonthlyDesc')}</p>
                  </button>

                  <div className="my-1 border-t border-white/5"></div>

                  <button 
                    onClick={() => { handleRecentReview(); setIsReviewMenuOpen(false); }}
                    disabled={loadingRecentReview}
                    className="w-full flex flex-col px-3 py-2 hover:bg-slate-800 rounded-xl text-left cursor-pointer transition disabled:opacity-50"
                  >
                    <div className="flex items-center gap-2 text-sm font-bold text-amber-400">
                      <Sparkles className="w-4 h-4" /> {t('reviewRecent20Title')}
                    </div>
                    <p className="text-[10px] text-slate-500 ml-6 mt-0.5">{t('reviewRecent20Desc')}</p>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* More Actions Dropdown */}
          <div className="relative more-menu-container">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsMoreMenuOpen(!isMoreMenuOpen);
              }}
              className="p-2.5 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-xl transition border border-slate-200 dark:border-white/5 cursor-pointer shadow-sm"
              title={t('moreTools')}
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
            
            {isMoreMenuOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50 p-2 space-y-1">


                {trades.length > 0 && (
                  <>
                    <button 
                      onClick={() => { setWhatIfTrade(trades[0]); setIsMoreMenuOpen(false); }} 
                      className="w-full flex items-center gap-3 px-3 py-2 hover:bg-slate-800 rounded-xl text-xs text-slate-300 hover:text-violet-400 transition text-left cursor-pointer"
                    >
                      <Zap className="w-4 h-4 text-violet-400" /> {t('whatIfSimulator')}
                    </button>

                    <div className="my-1 border-t border-white/5"></div>

                    <button 
                      onClick={() => { handleResetHistory(); setIsMoreMenuOpen(false); }} 
                      className="w-full flex items-center gap-3 px-3 py-2 hover:bg-slate-800 rounded-xl text-xs text-rose-400 transition text-left cursor-pointer"
                    >
                      <RotateCcw className="w-4 h-4 text-rose-400" /> {t('resetHistory')}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Dynamic Tab Switcher */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className={`flex backdrop-blur-md p-1.5 rounded-2xl w-full md:max-w-3xl text-xs sm:text-sm font-semibold flex-wrap items-center gap-1.5 transition-colors duration-300 ${themeStyles.switcherBg} border`}>
          
          {/* Render "Tất Cả Lệnh" as fixed on the left */}
          {(() => {
            const allTab = accountTabs.find(t => t.isAll);
            if (!allTab) return null;
            
            const isActive = activeTab === allTab.key;
            const activeStyles = {
              slate: theme === 'light'
                ? 'bg-white text-slate-900 shadow-md font-extrabold border border-slate-300'
                : 'bg-slate-800 text-white shadow-sm font-extrabold border border-slate-700'
            };
            const inactiveStyle = theme === 'light'
              ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-300/50 font-bold'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50 font-semibold';
              
            return (
              <div key={allTab.key} className="relative group flex-1 min-w-[105px]">
                <button
                  onClick={() => setActiveTab(allTab.key)}
                  className={`w-full py-2 px-3 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    isActive ? (activeStyles[allTab.color] || activeStyles.slate) : inactiveStyle
                  }`}
                >
                  <span>{t('tabAll')}</span>
                </button>
              </div>
            );
          })()}

          {/* Render draggable tabs */}
          {accountTabs.filter(t => !t.isAll).map((tab) => {
            const isActive = activeTab === tab.key;
            const isDragging = draggedTab?.key === tab.key;
            const isDragOver = dragOverTab?.key === tab.key;
            
            const activeStyles = {
              emerald: theme === 'light'
                ? 'bg-emerald-500 text-slate-950 shadow-md font-extrabold border border-emerald-600/30'
                : 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 shadow-md font-extrabold',
              rose: theme === 'light'
                ? 'bg-rose-500 text-white shadow-md font-extrabold border border-rose-600/30'
                : 'bg-gradient-to-r from-rose-500 to-red-600 text-white shadow-md font-extrabold',
              blue: theme === 'light'
                ? 'bg-blue-600 text-white shadow-md font-extrabold border border-blue-700/30'
                : 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-md font-extrabold',
              sky: theme === 'light'
                ? 'bg-sky-500 text-slate-950 shadow-md font-extrabold border border-sky-600/30'
                : 'bg-gradient-to-r from-sky-500 to-cyan-500 text-slate-950 shadow-md font-extrabold',
              amber: theme === 'light'
                ? 'bg-amber-500 text-slate-950 shadow-md font-extrabold border border-amber-600/30'
                : 'bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 shadow-md font-extrabold',
              violet: theme === 'light'
                ? 'bg-violet-600 text-white shadow-md font-extrabold border border-violet-700/30'
                : 'bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-md font-extrabold',
              slate: theme === 'light'
                ? 'bg-white text-slate-900 shadow-md font-extrabold border border-slate-300'
                : 'bg-slate-800 text-white shadow-sm font-extrabold border border-slate-700'
            };

            const inactiveStyle = theme === 'light'
              ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-300/50 font-bold'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50 font-semibold';

            const inputActiveStyles = {
              emerald: theme === 'light'
                ? 'bg-emerald-500 text-white shadow-inner font-extrabold border-2 border-emerald-700'
                : 'bg-emerald-500 text-white shadow-inner font-extrabold border-2 border-emerald-300',
              rose: theme === 'light'
                ? 'bg-rose-500 text-white shadow-inner font-extrabold border-2 border-rose-700'
                : 'bg-rose-500 text-white shadow-inner font-extrabold border-2 border-rose-300',
              blue: theme === 'light'
                ? 'bg-blue-600 text-white shadow-inner font-extrabold border-2 border-blue-800'
                : 'bg-blue-600 text-white shadow-inner font-extrabold border-2 border-blue-300',
              sky: theme === 'light'
                ? 'bg-sky-500 text-white shadow-inner font-extrabold border-2 border-sky-700'
                : 'bg-sky-500 text-white shadow-inner font-extrabold border-2 border-sky-300',
              amber: theme === 'light'
                ? 'bg-amber-500 text-white shadow-inner font-extrabold border-2 border-amber-700'
                : 'bg-amber-500 text-white shadow-inner font-extrabold border-2 border-amber-300',
              violet: theme === 'light'
                ? 'bg-violet-600 text-white shadow-inner font-extrabold border-2 border-violet-800'
                : 'bg-violet-500 text-white shadow-inner font-extrabold border-2 border-violet-300',
              slate: theme === 'light'
                ? 'bg-slate-700 text-white shadow-inner font-extrabold border-2 border-slate-900'
                : 'bg-slate-800 text-white shadow-inner font-extrabold border-2 border-slate-500'
            };

            return (
              <div 
                key={tab.key} 
                className={`relative group flex-1 min-w-[105px] transition-all duration-200 ${isDragging ? 'opacity-50' : 'opacity-100'} ${isDragOver && draggedTab?.key !== tab.key ? 'scale-105 outline-dashed outline-2 outline-emerald-500/50 outline-offset-2 rounded-xl' : ''} ${heldTab === tab.key ? 'animate-wiggle' : ''}`}
                draggable
                onPointerDown={(e) => {
                  holdTimeout.current = setTimeout(() => {
                    setHeldTab(tab.key);
                  }, 150);
                }}
                onPointerUp={() => {
                  clearTimeout(holdTimeout.current);
                  setHeldTab(null);
                }}
                onPointerLeave={() => {
                  clearTimeout(holdTimeout.current);
                  setHeldTab(null);
                }}
                onDragStart={(e) => {
                  setDraggedTab(tab);
                  setHeldTab(tab.key);
                  // Ensure drag effect is allowed
                  if (e.dataTransfer) {
                    e.dataTransfer.effectAllowed = 'move';
                  }
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (draggedTab && draggedTab.key !== tab.key) {
                    setDragOverTab(tab);
                  }
                }}
                onDragLeave={() => {
                  if (dragOverTab?.key === tab.key) {
                    setDragOverTab(null);
                  }
                }}
                onDrop={async (e) => {
                  e.preventDefault();
                  if (!draggedTab || draggedTab.key === tab.key) {
                    setDraggedTab(null);
                    setDragOverTab(null);
                    return;
                  }
                  
                  const otherTabs = accountTabs.filter(t => !t.isAll);
                  const draggedIndex = otherTabs.findIndex(t => t.key === draggedTab.key);
                  const targetIndex = otherTabs.findIndex(t => t.key === tab.key);
                  
                  const newTabs = [...otherTabs];
                  newTabs.splice(draggedIndex, 1);
                  newTabs.splice(targetIndex, 0, draggedTab);
                  
                  const updatedTabs = newTabs.map((t, i) => ({ ...t, order: i + 1 }));
                  const allTab = accountTabs.find(t => t.isAll);
                  const newAccountTabs = allTab ? [allTab, ...updatedTabs] : updatedTabs;
                  
                  // Optimistic update
                  setAccountTabs(newAccountTabs);
                  setDraggedTab(null);
                  setDragOverTab(null);
                  
                  // Sync to API
                  try {
                    const payload = updatedTabs.map(t => ({ tab_key: t.key, display_order: t.order }));
                    await fetch('/api/account-tabs', {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(payload)
                    });
                  } catch (error) {
                    console.error("Failed to sync tab order", error);
                  }
                }}
                onDragEnd={() => {
                  setDraggedTab(null);
                  setDragOverTab(null);
                  setHeldTab(null);
                }}
              >
                {editingTabKey === tab.key ? (
                  <input
                    type="text"
                    value={editingTabName}
                    autoFocus
                    onChange={(e) => setEditingTabName(e.target.value)}
                    onBlur={handleSaveInlineRename}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveInlineRename();
                      if (e.key === 'Escape') setEditingTabKey(null);
                    }}
                    className={`custom-input w-full py-1.5 px-2 text-center rounded-lg outline-none text-xs ${inputActiveStyles[tab.color] || inputActiveStyles.emerald}`}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <button
                    onClick={() => setActiveTab(tab.key)}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      setEditingTabKey(tab.key);
                      setEditingTabName(tab.label);
                    }}
                    title={language === 'en' ? "Double click to rename, drag to reorder" : "Nháy đúp để đổi tên, giữ để kéo thả"}
                    className={`w-full py-2 px-3 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      isActive
                        ? activeStyles[tab.color] || activeStyles.emerald
                        : inactiveStyle
                    }`}
                  >
                    <span>{tab.label}</span>
                  </button>
                )}

                {accountTabs.length > 2 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteAccountTab(tab);
                    }}
                    title={language === 'en' ? "Delete this tab" : "Xóa tab này"}
                    className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 transition p-1 bg-rose-600 text-white rounded-full hover:bg-rose-500 cursor-pointer shadow-md z-10"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}

          {/* Button to Add New Dynamic Tab */}
          <button
            onClick={() => setIsAddTabModalOpen(true)}
            className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 ml-1 shadow-sm ${
              theme === 'light'
                ? 'bg-emerald-600 text-white hover:bg-emerald-700 border border-emerald-600'
                : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
            }`}
            title={t('addTabModalTitle')}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t('addTabBtn')}</span>
          </button>
        </div>
      </div>

      {/* Loading Overlay */}
      {loading && trades.length === 0 ? (
        <div className="flex items-center justify-center h-[70vh]">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
            <p className="text-sm text-slate-400">Đang đồng bộ dữ liệu giao dịch...</p>
          </div>
        </div>
      ) : (
        <div className="w-full max-w-[1920px] mx-auto p-4 sm:p-8 space-y-8">

          {/* 1. Summary Metrics Dashboard */}
          <section className={`rounded-3xl p-6 relative overflow-hidden transition-colors duration-300 ${themeStyles.card}`}>
            {/* Subtle Gradient Aura in background */}
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none"></div>
            <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl pointer-events-none"></div>
            
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 relative z-10">
              {/* Total PnL */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-widest">
                  {stats.summary?.totalPnl >= 0 ? <TrendingUp className="w-3.5 h-3.5 text-emerald-400" /> : <TrendingDown className="w-3.5 h-3.5 text-rose-400" />}
                  {t('netPnL')}
                </div>
                <div className="flex items-baseline gap-1">
                  <span className={`text-3xl font-extrabold tracking-tight ${stats.summary?.totalPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {stats.summary?.totalPnl >= 0 ? '+' : ''}{stats.summary?.totalPnl?.toLocaleString() || 0}
                  </span>
                  <span className="text-xs text-slate-500 font-bold">USD</span>
                </div>
              </div>

              {/* Total Trades */}
              <div className="space-y-2 lg:border-l lg:border-white/5 lg:pl-8">
                <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-widest">
                  <Layers className="w-3.5 h-3.5 text-sky-400" />
                  {t('totalTrades')}
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold tracking-tight text-white">
                    {stats.summary?.totalTrades || 0}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 font-medium">
                  <span className="text-emerald-400/80">{stats.summary?.wins || 0}W</span> - <span className="text-rose-400/80">{stats.summary?.losses || 0}L</span> - <span className="text-slate-400/80">{stats.summary?.breakevens || 0}BE</span>
                </div>
              </div>

              {/* Win Rate */}
              <div className="space-y-2 lg:border-l lg:border-white/5 lg:pl-8">
                <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-widest">
                  <Flame className="w-3.5 h-3.5 text-orange-400" />
                  {t('winRate')}
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold tracking-tight text-white">
                    {stats.summary?.winRate || 0}%
                  </span>
                </div>
                <div className="w-full bg-slate-800/50 h-1.5 rounded-full overflow-hidden mt-2">
                  <div 
                    className="bg-gradient-to-r from-orange-500 to-amber-400 h-full rounded-full"
                    style={{ width: `${stats.summary?.winRate || 0}%` }}
                  ></div>
                </div>
              </div>

              {/* Average PnL */}
              <div className="space-y-2 lg:border-l lg:border-white/5 lg:pl-8">
                <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-widest">
                  <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
                  {t('avgR')}
                </div>
                <div className="flex items-baseline gap-1">
                  <span className={`text-3xl font-extrabold tracking-tight ${stats.summary?.avgPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {stats.summary?.avgPnl >= 0 ? '+' : ''}{stats.summary?.avgPnl?.toLocaleString() || 0}
                  </span>
                  <span className="text-xs text-slate-500 font-bold">USD</span>
                </div>
              </div>
            </div>
          </section>

          {trades.length === 0 ? (
            /* Empty State */
            <section className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-12 text-center max-w-2xl mx-auto flex flex-col items-center justify-center gap-4 mt-8">
              <div className="w-16 h-16 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-center text-slate-500 shadow-inner">
                <BookOpen className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h2 className="text-xl font-bold text-white">{t('emptyJournalTitle')}</h2>
                <p className="text-slate-400 text-sm max-w-md">
                  {t('emptyJournalDesc')}
                </p>
              </div>
              <div className="flex gap-3 mt-2">
                <button
                  onClick={() => {
                    setEditingTrade(null);
                    setIsFormOpen(true);
                  }}
                  className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl transition shadow-lg shadow-emerald-500/10 cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> {t('addManual')}
                </button>
              </div>
            </section>
          ) : (
            /* Main Dashboard Content Grid - 2 Equal Columns */
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
              
              {/* Left Column: Charts & History Journals */}
              <div className="xl:col-span-1 space-y-8 flex flex-col">
                
                {/* Tabbed Chart Panel */}
                <div ref={chartSectionRef} className={`rounded-3xl p-6 space-y-4 transition-colors duration-300 ${themeStyles.card}`}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/5">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      {activeChartTab === 'tradingview' ? `📈 ${t('tradingViewChart')}` : activeChartTab === 'equity' ? t('equityCurve') : t('setupStatsTab')}
                    </h3>
                    
                    <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                      <button
                        onClick={() => setActiveChartTab('equity')}
                        className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                          activeChartTab === 'equity'
                            ? 'bg-emerald-500 text-slate-950 shadow font-extrabold'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {t('equityCurve')}
                      </button>
                      <button
                        onClick={() => setActiveChartTab('setup')}
                        className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                          activeChartTab === 'setup'
                            ? 'bg-emerald-500 text-slate-950 shadow font-extrabold'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {t('setupStatsTab')}
                      </button>
                      <button
                        onClick={() => setActiveChartTab('tradingview')}
                        className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                          activeChartTab === 'tradingview'
                            ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 shadow font-extrabold'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        <span>📈 TradingView</span>
                        {selectedTradeForChart && (
                          <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping"></span>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className={`${activeChartTab === 'tradingview' ? 'min-h-[580px]' : 'h-72'} w-full pt-2 transition-all duration-300`}>
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
                            contentStyle={{ backgroundColor: 'var(--bg-input)', borderColor: 'var(--border-color)', borderRadius: '12px' }}
                            labelStyle={{ color: 'var(--text-sub)', fontSize: '12px', fontWeight: '600', marginBottom: '4px' }}
                            labelClassName=""
                            itemStyle={{ fontSize: '13px' }}
                          />
                          <Area type="monotone" dataKey="equity" stroke={equityColor} strokeWidth={2} fillOpacity={1} fill="url(#colorEquity)" name="Equity (USD)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : activeChartTab === 'setup' ? (
                      !stats?.setups || stats.setups.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center p-6 space-y-3 theme-inner-card/40 rounded-2xl border theme-border">
                          <div className="p-3 bg-amber-500/10 rounded-2xl text-amber-400 border border-amber-500/20">
                            <Target className="w-7 h-7 animate-pulse" />
                          </div>
                          <div className="space-y-1">
                            <h4 className="text-sm font-bold text-white">{t('noSetupChartTitle')}</h4>
                            <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                              {t('noSetupChartDesc')}
                            </p>
                          </div>
                          <div className="flex flex-col items-center gap-1.5 pt-1">
                            <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">{t('setupTagsExampleTitle')}</span>
                            <div className="flex flex-wrap items-center justify-center gap-1.5">
                              {['#Breakout', '#FBO', '#Keylevel', '#LHRetest', '#FOMO', '#Trend'].map(tag => (
                                <span key={tag} className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/20 font-bold">
                                  {tag}
                                </span>
                              ))}
                            </div>
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
                              contentStyle={{ backgroundColor: 'var(--bg-input)', borderColor: 'var(--border-color)', borderRadius: '12px' }}
                              labelStyle={{ color: 'var(--text-sub)', fontSize: '12px', fontWeight: '600', marginBottom: '4px' }}
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
                                setTradesToReview(unreviewed);
                                setIsQuickReviewOpen(true);
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
                                      setWhatIfTrade(trade);
                                    }}
                                    className="flex items-center gap-1 text-slate-400 hover:text-violet-400 hover:font-bold transition font-semibold"
                                  >
                                    <Zap className="w-3 h-3 text-violet-400" /> {t('whatIfSimulator')}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingTrade(trade);
                                      setIsFormOpen(true);
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
                
                <BehaviorIntelligence
                  trades={trades}
                  onFilterByBehavior={(ids) => setBehaviorFilterIds(ids)}
                />
              </div>

              {/* Right Column: AI Insights & Analytics */}
              <div className="space-y-8 xl:col-span-1 animate-slide-down">
                
                <TradingRules 
                  trades={trades} 
                  activeTab={activeTab} 
                  accountTabs={accountTabs} 
                  onViolationChange={setRuleViolations} 
                  onExpand={() => setExpandedWidget('trading-rules')} 
                />

                <div className="theme-card rounded-3xl p-6 shadow-2xl relative overflow-hidden flex flex-col">
                  <div className="absolute -top-12 -right-12 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
                  
                  <div className="flex items-center justify-between border-b theme-border pb-4 relative z-10">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <BrainCircuit className="w-5 h-5 text-emerald-400" /> {t('aiInsightsTitle')}
                    </h3>
                    <button onClick={() => setExpandedWidget('ai-insights')} className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition">
                      <Maximize2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="mt-4 mb-2 relative z-10 flex-1">
                    <TradingImprovementEngine trades={trades} activeTab={activeTab} />
                  </div>
                </div>

                <SetupStats 
                  stats={stats} 
                  trades={trades} 
                  onExpand={() => setExpandedWidget('setup-stats')} 
                />
              </div>

            </div>
          )}

        </div>
      )}

      {/* Modal entry form */}
      <TradeForm 
        isOpen={isFormOpen} 
        onClose={() => {
          setIsFormOpen(false);
          setEditingTrade(null);
        }} 
        onTradeAdded={handleTradeAdded}
        tradeToEdit={editingTrade}
        accountTabs={accountTabs}
        activeTab={activeTab}
      />



      {/* Modal import CSV form */}
      <ImportCSVModal 
        isOpen={isCSVImportOpen} 
        onClose={() => setIsCSVImportOpen(false)} 
        onSuccess={handleTradeAdded}
        existingTrades={trades}
        accountTabs={accountTabs}
        activeTab={activeTab}
      />

      {/* Modal Thêm Account Tab Mới */}
      {isAddTabModalOpen && (
        <div className="fixed inset-0 z-[150] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="theme-card border theme-border rounded-3xl p-6 sm:p-8 w-full max-w-md space-y-6 shadow-2xl relative font-sans">
            <div className="flex items-center justify-between border-b theme-border pb-3">
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-emerald-400" />
                <span>{t('addTabModalTitle')}</span>
              </h3>
              <button
                onClick={() => setIsAddTabModalOpen(false)}
                className="p-1.5 hover:bg-white/10 rounded-xl text-slate-400 hover:text-white transition cursor-pointer"
                title={t('cancel')}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold theme-text-sub uppercase tracking-wider mb-2">
                  {t('tabNameLabel')}
                </label>
                <input
                  type="text"
                  value={newTabName}
                  onChange={(e) => setNewTabName(e.target.value)}
                  placeholder={t('tabNamePlaceholder')}
                  className="w-full theme-inner-card theme-border border text-white text-sm rounded-xl px-4 py-3 outline-none focus:border-emerald-500 font-bold transition shadow-sm"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold theme-text-sub uppercase tracking-wider mb-2">
                  {t('badgeColorLabel')}
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {[
                    { id: 'emerald', bg: 'bg-emerald-500', name: t('colorEmerald') },
                    { id: 'sky', bg: 'bg-sky-500', name: t('colorSky') },
                    { id: 'amber', bg: 'bg-amber-500', name: t('colorAmber') },
                    { id: 'violet', bg: 'bg-violet-500', name: t('colorViolet') },
                    { id: 'rose', bg: 'bg-rose-500', name: t('colorRose') },
                  ].map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setNewTabColor(c.id)}
                      className={`h-10 rounded-xl ${c.bg} transition flex items-center justify-center cursor-pointer ${
                        newTabColor === c.id ? 'ring-2 ring-white scale-105 font-bold shadow-lg' : 'opacity-70 hover:opacity-100'
                      }`}
                      title={c.name}
                    >
                      {newTabColor === c.id && <span className="font-bold text-slate-950 text-xs">✓</span>}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t theme-border pt-4">
              <button
                onClick={() => setIsAddTabModalOpen(false)}
                className="px-4 py-2 theme-inner-card theme-border border hover:bg-white/10 text-slate-300 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleAddAccountTab}
                disabled={!newTabName.trim()}
                className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-black text-xs rounded-xl transition shadow-lg shadow-emerald-500/20 cursor-pointer"
              >
                {t('createTabBtn')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Zoom Image Modal */}
      {zoomImages.length > 0 && (
        <div 
          onClick={() => {
            setZoomImages([]);
            setZoomImageIndex(0);
            setZoomScale(1);
          }}
          className="fixed inset-0 z-[70] flex flex-col items-center justify-center bg-slate-950/95 backdrop-blur-md p-4 animate-fade-in"
        >
          <div 
            className="relative w-full max-w-5xl bg-slate-900 border border-slate-805 rounded-3xl overflow-hidden shadow-2xl flex flex-col h-[85vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header controls */}
            <div className="px-6 py-3.5 border-b border-slate-800 bg-slate-950 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Soi chi tiết biểu đồ {zoomImages.length > 1 && `(${zoomImageIndex + 1}/${zoomImages.length})`}
                </span>
                {zoomScale > 1 && (
                  <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full font-semibold border border-emerald-500/20">
                    💡 Nhấp giữ và kéo (Drag) để lia biểu đồ
                  </span>
                )}
              </div>
              
              {/* Zoom Buttons */}
              <div className="flex items-center gap-2 bg-slate-900 p-1 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => setZoomScale(s => Math.max(1, s - 0.5))}
                  disabled={zoomScale === 1}
                  className="px-2.5 py-1 text-xs font-bold bg-slate-950 hover:bg-slate-800 text-white rounded-lg border border-slate-800 disabled:opacity-40 transition cursor-pointer"
                >
                  Thu nhỏ (-)
                </button>
                <span className="text-xs font-mono px-2 text-emerald-400 font-bold min-w-[40px] text-center">
                  {Math.round(zoomScale * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setZoomScale(s => Math.min(4, s + 0.5))}
                  disabled={zoomScale === 4}
                  className="px-2.5 py-1 text-xs font-bold bg-slate-950 hover:bg-slate-800 text-white rounded-lg border border-slate-800 disabled:opacity-40 transition cursor-pointer"
                >
                  Phóng to (+)
                </button>
                <button
                  type="button"
                  onClick={() => setZoomScale(1)}
                  className="px-2.5 py-1 text-xs font-semibold hover:text-white text-slate-400 transition cursor-pointer"
                >
                  Reset
                </button>
              </div>

              <button 
                type="button"
                onClick={() => {
                  setZoomImages([]);
                  setZoomImageIndex(0);
                  setZoomScale(1);
                }}
                className="p-1.5 bg-slate-900 hover:bg-rose-600 text-white rounded-lg border border-slate-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Viewport with native overflow scroll dragging panning & lightbox controls */}
            <div className="flex-1 relative flex flex-col justify-between min-h-0 bg-slate-950">
              
              {/* Left Arrow overlay */}
              {zoomImages.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    setZoomImageIndex(idx => (idx === 0 ? zoomImages.length - 1 : idx - 1));
                    setZoomScale(1);
                  }}
                  className="absolute left-4 top-1/2 -translate-y-1/2 p-2.5 bg-slate-950/80 hover:bg-slate-900 border border-slate-800 text-white rounded-full transition shadow-lg z-20 cursor-pointer"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
              )}
              
              {/* Right Arrow overlay */}
              {zoomImages.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    setZoomImageIndex(idx => (idx === zoomImages.length - 1 ? 0 : idx + 1));
                    setZoomScale(1);
                  }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-2.5 bg-slate-950/80 hover:bg-slate-900 border border-slate-800 text-white rounded-full transition shadow-lg z-20 cursor-pointer"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              )}

              {/* Scrollable Container */}
              <div 
                ref={zoomContainerRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMoveDrag}
                onMouseUp={handleMouseUpOrLeave}
                onMouseLeave={handleMouseUpOrLeave}
                className={`w-full h-full overflow-auto p-6 ${
                  zoomScale === 1 
                    ? 'flex items-center justify-center cursor-default' 
                    : 'block cursor-grab'
                }`}
              >
                <img 
                  src={zoomImages[zoomImageIndex]} 
                  alt="Zoomed Chart Detail" 
                  onError={(e) => {
                    e.target.style.display = 'none';
                    if (e.target.nextElementSibling) e.target.nextElementSibling.style.display = 'flex';
                  }}
                  className="rounded-lg shadow-2xl select-none pointer-events-none animate-fade-in"
                  key={zoomImageIndex} // force image reload animation on index change
                  style={{
                    width: zoomScale === 1 ? 'auto' : `${zoomScale * 100}%`,
                    maxWidth: zoomScale === 1 ? '100%' : 'none',
                    maxHeight: zoomScale === 1 ? '70vh' : 'none',
                    height: 'auto',
                    display: 'block',
                    margin: '0 auto'
                  }}
                />
                <div className="hidden items-center justify-center text-slate-400 dark:text-slate-600 pointer-events-none w-full h-full opacity-50 mt-10">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-16 h-16"><line x1="3" y1="3" x2="21" y2="21"/><path d="M15 15l2.121-2.121A4 4 0 0 0 11.414 7.17L9 9.586"/><path d="m3 16 5-5"/><path d="M4 22h14c0-1.1.9-2 2-2"/><path d="M22 18V4a2 2 0 0 0-2-2H8"/><circle cx="9" cy="9" r="2"/></svg>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Trade Inspector Carousel Modal */}
      {isCarouselOpen && trades.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4 animate-fade-in">
          <div className="relative w-full max-w-6xl h-[85vh] bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden flex flex-col shadow-2xl animate-scale-in">
            
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-800/80 bg-slate-950 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="font-bold text-white text-sm sm:text-base">
                  {t('browseJournalTitle', { current: carouselIndex + 1, total: trades.length })}
                </span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  trades[carouselIndex].side === 'BUY' 
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                }`}>
                  {trades[carouselIndex].side}
                </span>
                {(() => {
                  const badge = getTradeTypeBadge(trades[carouselIndex].trade_type);
                  return (
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${badge.className}`}>
                      {badge.text}
                    </span>
                  );
                })()}
              </div>
              <button 
                onClick={() => setIsCarouselOpen(false)}
                className="p-1.5 bg-slate-900 hover:bg-slate-850 text-slate-400 hover:text-white rounded-lg border border-slate-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-0">
              
              {/* Left Column: Image/Chart Visual */}
              <div className="flex flex-col bg-slate-950 rounded-2xl border border-slate-850 p-4 min-h-[350px] lg:h-full justify-between relative overflow-hidden group">
                <div className="flex-1 flex items-center justify-center relative min-h-0">
                  {(() => {
                    const carouselTrade = trades[carouselIndex];
                    let carouselImages = [];
                    if (carouselTrade.image_url) {
                      try {
                        const parsed = JSON.parse(carouselTrade.image_url);
                        carouselImages = Array.isArray(parsed) ? parsed : [carouselTrade.image_url];
                      } catch (e) {
                        carouselImages = [carouselTrade.image_url];
                      }
                    }

                    if (carouselImages.length === 0) {
                      return (
                        <div className="text-center space-y-4 py-12 flex flex-col items-center justify-center h-full">
                          <Image className="w-12 h-12 text-slate-700 mx-auto" />
                          <p className="text-slate-500 text-xs font-medium">{t('noChartImageForTrade')}</p>
                          <label className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 border border-slate-850 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-bold rounded-xl cursor-pointer transition">
                            <Plus className="w-4 h-4 text-emerald-400" /> Tải lên biểu đồ (Tối đa 5)
                            <input 
                              type="file" 
                              accept="image/*" 
                              multiple 
                              onChange={(e) => handleCarouselImageUpload(e, carouselTrade)} 
                              className="hidden" 
                            />
                          </label>
                        </div>
                      );
                    }

                    const activeImg = carouselImages[carouselImageIndex] || carouselImages[0];

                    return (
                      <>
                        <img 
                          src={activeImg} 
                          alt={`Trade Chart ${carouselImageIndex + 1}`} 
                          onError={(e) => {
                            e.target.style.display = 'none';
                            if (e.target.nextElementSibling) e.target.nextElementSibling.style.display = 'flex';
                          }}
                          className="max-h-[46vh] object-contain rounded-lg mx-auto select-none pointer-events-none"
                        />
                        <div className="absolute inset-0 hidden items-center justify-center text-slate-400 dark:text-slate-600 pointer-events-none bg-slate-100 dark:bg-slate-900 rounded-lg max-h-[46vh]">
                           <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-16 h-16 opacity-50"><line x1="3" y1="3" x2="21" y2="21"/><path d="M15 15l2.121-2.121A4 4 0 0 0 11.414 7.17L9 9.586"/><path d="m3 16 5-5"/><path d="M4 22h14c0-1.1.9-2 2-2"/><path d="M22 18V4a2 2 0 0 0-2-2H8"/><circle cx="9" cy="9" r="2"/></svg>
                        </div>
                        
                        <div 
                          onClick={() => {
                            setZoomImages(carouselImages);
                            setZoomImageIndex(carouselImageIndex);
                          }}
                          className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition cursor-zoom-in z-20"
                        >
                          <div 
                            className="absolute top-3 right-3 p-2 rounded-lg border border-slate-700 shadow-xl" 
                            style={{ backgroundColor: 'rgba(15,23,42,0.85)', color: '#ffffff' }}
                          >
                            <Maximize2 className="w-4 h-4" />
                          </div>
                        </div>

                        {/* Image navigation arrows overlay */}
                        {carouselImages.length > 1 && (
                          <>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setCarouselImageIndex(idx => (idx === 0 ? carouselImages.length - 1 : idx - 1));
                              }}
                              className="absolute left-2 p-2 bg-slate-950/80 hover:bg-slate-900 border border-slate-800 text-white rounded-full transition shadow-lg z-10 cursor-pointer"
                            >
                              <ChevronLeft className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setCarouselImageIndex(idx => (idx === carouselImages.length - 1 ? 0 : idx + 1));
                              }}
                              className="absolute right-2 p-2 bg-slate-950/80 hover:bg-slate-900 border border-slate-800 text-white rounded-full transition shadow-lg z-10 cursor-pointer"
                            >
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </>
                    );
                  })()}
                </div>

                {/* Gallery indicator thumbnails at bottom */}
                {(() => {
                  const carouselTrade = trades[carouselIndex];
                  let carouselImages = [];
                  if (carouselTrade.image_url) {
                    try {
                      const parsed = JSON.parse(carouselTrade.image_url);
                      carouselImages = Array.isArray(parsed) ? parsed : [carouselTrade.image_url];
                    } catch (e) {
                      carouselImages = [carouselTrade.image_url];
                    }
                  }

                  if (carouselImages.length === 0) return null;

                  return (
                    <div className="mt-3 flex justify-center items-center gap-1.5 overflow-x-auto py-1">
                      {carouselImages.map((imgUrl, imgIdx) => (
                        <button
                          key={imgIdx}
                          type="button"
                          onClick={() => setCarouselImageIndex(imgIdx)}
                          className={`relative w-12 aspect-video rounded-md overflow-hidden border transition shrink-0 ${
                            carouselImageIndex === imgIdx 
                              ? 'border-emerald-500 ring-1 ring-emerald-500 scale-105' 
                              : 'border-slate-800 opacity-60 hover:opacity-100'
                          }`}
                        >
                          <img src={imgUrl} onError={(e) => { e.target.style.display = 'none'; if (e.target.nextElementSibling) e.target.nextElementSibling.style.display = 'flex'; }} className="w-full h-full object-cover select-none pointer-events-none" alt="Thumb" />
                        <div className="absolute inset-0 hidden items-center justify-center text-slate-400 dark:text-slate-600 pointer-events-none bg-slate-100 dark:bg-slate-900">
                           <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 opacity-50"><line x1="3" y1="3" x2="21" y2="21"/><path d="M15 15l2.121-2.121A4 4 0 0 0 11.414 7.17L9 9.586"/><path d="m3 16 5-5"/><path d="M4 22h14c0-1.1.9-2 2-2"/><path d="M22 18V4a2 2 0 0 0-2-2H8"/><circle cx="9" cy="9" r="2"/></svg>
                        </div>
                        </button>
                      ))}
                      
                      {carouselImages.length < 5 && (
                        <label className="relative w-12 aspect-video rounded-md border border-dashed border-slate-800 hover:border-slate-700 bg-slate-900/40 hover:bg-slate-900/80 flex items-center justify-center cursor-pointer transition shrink-0">
                          <Plus className="w-4 h-4 text-slate-500 hover:text-slate-350" />
                          <input 
                            type="file" 
                            accept="image/*" 
                            multiple 
                            onChange={(e) => handleCarouselImageUpload(e, carouselTrade)} 
                            className="hidden" 
                          />
                        </label>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Right Column: Trade Details & AI Evaluation */}
              <div className="space-y-4 flex flex-col justify-between overflow-y-auto lg:h-full pr-1">
                
                {/* Meta details */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <div>
                      <h2 className="text-xl font-bold text-white">{trades[carouselIndex].asset}</h2>
                      <span className="text-xs text-slate-500 font-mono">
                        {trades[carouselIndex].trade_time || 'N/A'}
                        {trades[carouselIndex].exit_time && ` → ${trades[carouselIndex].exit_time}`}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className={`font-mono font-bold text-lg ${
                        trades[carouselIndex].status === 'WIN' 
                          ? 'text-emerald-400' 
                          : trades[carouselIndex].status === 'LOSS' 
                            ? 'text-rose-400' 
                            : 'text-slate-400'
                      }`}>
                        {trades[carouselIndex].status === 'WIN' ? '+' : ''}{trades[carouselIndex].pnl.toLocaleString()} USD
                      </span>
                      <p className="text-[10px] text-slate-500 font-mono uppercase">Setup: {trades[carouselIndex].setup_tag}</p>
                    </div>
                  </div>

                  {/* Quantitative Stats */}
                  <div className="grid grid-cols-4 gap-2 bg-slate-950/50 p-3 rounded-xl border border-slate-850 font-mono text-center">
                    <div>
                      <span className="text-slate-500 block text-[9px] uppercase font-sans">{t('entryPriceLabel')}</span>
                      <span className="text-white text-xs font-semibold">{trades[carouselIndex].entry_price}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[9px] uppercase font-sans">{t('exitPriceLabel')}</span>
                      <span className="text-white text-xs font-semibold">{trades[carouselIndex].exit_price}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[9px] uppercase font-sans">{t('stopLoss')}</span>
                      <span className="text-slate-400 text-xs font-semibold">{trades[carouselIndex].stop_loss || '-'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[9px] uppercase font-sans">Volume</span>
                      <span className="text-slate-400 text-xs font-semibold">{trades[carouselIndex].size}</span>
                    </div>
                  </div>

                  {/* User Notes */}
                  {trades[carouselIndex].user_notes && (
                    <div className="space-y-1">
                      <span className="text-slate-400 font-semibold block uppercase text-[9px]">{t('contextNotesLabel')}</span>
                      <p className="text-slate-300 leading-relaxed bg-slate-950/20 p-3 rounded-xl border border-slate-850 text-xs max-h-36 overflow-y-auto whitespace-pre-line text-slate-300">
                        {trades[carouselIndex].user_notes}
                      </p>
                    </div>
                  )}
                </div>

                {/* AI Review */}
                {trades[carouselIndex].ai_evaluation && (
                  <div className="border-t border-slate-850 pt-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-emerald-400 font-bold uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 animate-pulse" /> Phân tích AI Coach
                      </span>
                      <span className="text-slate-400 text-[10px] font-semibold bg-slate-950 px-2 py-0.5 rounded border border-slate-850 font-mono">
                        Điểm: {trades[carouselIndex].ai_evaluation.decision_rating}/10
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
                      <div className="bg-emerald-500/5 border border-emerald-500/10 p-2.5 rounded-lg">
                        <span className="text-emerald-400 font-semibold block text-[10px] mb-1">{t('strengthsLabel')}</span>
                        <ul className="list-disc list-inside space-y-0.5 text-slate-350">
                          {trades[carouselIndex].ai_evaluation.strengths?.map((s, i) => <li key={i}>{s}</li>)}
                        </ul>
                      </div>
                      <div className="bg-rose-500/5 border border-rose-500/10 p-2.5 rounded-lg">
                        <span className="text-rose-400 font-semibold block text-[10px] mb-1">{t('weaknessesLabel')}</span>
                        <ul className="list-disc list-inside space-y-0.5 text-slate-355 text-slate-300">
                          {trades[carouselIndex].ai_evaluation.weaknesses?.map((w, i) => <li key={i}>{w}</li>)}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

              </div>
            </div>

            {/* Navigation Footer */}
            <div className="px-6 py-4 border-t border-slate-800/80 bg-slate-950 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setCarouselIndex(prev => Math.max(0, prev - 1))}
                disabled={carouselIndex === 0}
                className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 border border-slate-800 hover:bg-slate-850 hover:text-white rounded-xl text-slate-300 disabled:opacity-30 disabled:pointer-events-none transition font-semibold text-xs cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" /> {t('prevTrade')}
              </button>
              
              <span className="text-slate-400 font-bold text-xs">
                {carouselIndex + 1} / {trades.length}
              </span>

              <button
                type="button"
                onClick={() => setCarouselIndex(prev => Math.min(trades.length - 1, prev + 1))}
                disabled={carouselIndex === trades.length - 1}
                className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 border border-slate-800 hover:bg-slate-850 hover:text-white rounded-xl text-slate-300 disabled:opacity-30 disabled:pointer-events-none transition font-semibold text-xs cursor-pointer"
              >
                {t('nextTrade')} <ChevronRight className="w-4 h-4" />
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Today's AI Review Modal */}
      {isTodayReviewOpen && todayReview && (
        <div 
          onClick={() => setIsTodayReviewOpen(false)}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-fade-in"
        >
          <div 
            className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh] animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-emerald-400 animate-pulse" />
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                  {t('todayReviewTitle')}
                </h2>
              </div>
              <button
                onClick={() => setIsTodayReviewOpen(false)}
                className="p-1.5 hover:bg-slate-850 rounded-lg text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              
              {/* Score card & Overview */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-950/60 p-4 rounded-2xl border border-slate-850">
                <div className="text-center sm:border-r border-slate-850 flex flex-col justify-center py-2">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">{t('disciplineToday')}</span>
                  <span className="text-3xl font-extrabold text-emerald-400 font-mono mt-1">
                    {todayReview.discipline_score}/10
                  </span>
                </div>
                <div className="sm:col-span-2 flex flex-col justify-center pl-2">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold mb-1">{t('coachComment')}</span>
                  <p className="text-xs text-slate-350 leading-relaxed italic">
                    &ldquo;{todayReview.summary}&rdquo;
                  </p>
                </div>
              </div>

              {/* Strengths & Weaknesses Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-emerald-500/5 border border-emerald-500/10 p-4 rounded-xl space-y-2">
                  <span className="text-emerald-400 text-[10px] font-bold uppercase tracking-wider block">
                    {t('strengthsToday')}
                  </span>
                  <ul className="space-y-1.5 list-disc list-inside text-xs text-slate-350">
                    {todayReview.strengths?.map((str, i) => (
                      <li key={i} className="leading-relaxed">{str}</li>
                    ))}
                  </ul>
                </div>

                <div className="bg-rose-500/5 border border-rose-500/10 p-4 rounded-xl space-y-2">
                  <span className="text-rose-400 text-[10px] font-bold uppercase tracking-wider block">
                    {t('weaknessesMistakes')}
                  </span>
                  <ul className="space-y-1.5 list-disc list-inside text-xs text-slate-300">
                    {todayReview.weaknesses?.map((weak, i) => (
                      <li key={i} className="leading-relaxed">{weak}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Key Lesson */}
              <div className="bg-slate-950/40 border border-slate-850 p-4 rounded-xl space-y-2">
                <span className="text-blue-400 text-[10px] font-bold uppercase tracking-wider block">
                  {t('keyLessonToday')}
                </span>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {todayReview.key_lesson}
                </p>
              </div>

              {/* Actionable Advice */}
              <div className="bg-emerald-500/5 border border-emerald-500/10 p-4 rounded-xl space-y-2">
                <span className="text-emerald-450 text-[10px] font-bold uppercase tracking-wider block">
                  🎯 Kế hoạch & Lời khuyên hành động
                </span>
                <ul className="space-y-1.5 list-disc list-inside text-xs text-slate-300">
                  {todayReview.actionable_advice?.map((act, i) => (
                    <li key={i} className="leading-relaxed">{act}</li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/50 flex justify-end">
              <button
                type="button"
                onClick={() => setIsTodayReviewOpen(false)}
                className="px-5 py-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition cursor-pointer"
              >
                {t('acknowledgedLessons')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Weekly AI Review Modal */}
      {isWeeklyReviewOpen && weeklyReview && (
        <div 
          onClick={() => setIsWeeklyReviewOpen(false)}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-fade-in"
        >
          <div 
            className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh] animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
              <div className="flex items-center gap-2">
                <Brain className="w-5 h-5 text-purple-400 animate-pulse" />
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                  {t('weeklyReviewTitle')}
                </h2>
              </div>
              <button
                onClick={() => setIsWeeklyReviewOpen(false)}
                className="p-1.5 hover:bg-slate-850 rounded-lg text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              
              {/* Score card & Overview */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-950/60 p-4 rounded-2xl border border-slate-850">
                <div className="text-center sm:border-r border-slate-850 flex flex-col justify-center py-2">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">{t('disciplineWeek')}</span>
                  <span className="text-3xl font-extrabold text-purple-400 font-mono mt-1">
                    {weeklyReview.discipline_score}/10
                  </span>
                </div>
                <div className="sm:col-span-2 flex flex-col justify-center pl-2">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold mb-1">{t('coachSummary')}</span>
                  <p className="text-xs text-slate-350 leading-relaxed italic">
                    &ldquo;{weeklyReview.summary}&rdquo;
                  </p>
                </div>
              </div>

              {/* Strengths & Weaknesses Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-emerald-500/5 border border-emerald-500/10 p-4 rounded-xl space-y-2">
                  <span className="text-emerald-450 text-[10px] font-bold uppercase tracking-wider block">
                    {t('strengthsDecisions')}
                  </span>
                  <ul className="space-y-1.5 list-disc list-inside text-xs text-slate-350">
                    {weeklyReview.strengths?.map((str, i) => (
                      <li key={i} className="leading-relaxed">{str}</li>
                    ))}
                  </ul>
                </div>

                <div className="bg-rose-500/5 border border-rose-500/10 p-4 rounded-xl space-y-2">
                  <span className="text-rose-450 text-[10px] font-bold uppercase tracking-wider block">
                    {t('weaknessesRepeats')}
                  </span>
                  <ul className="space-y-1.5 list-disc list-inside text-xs text-slate-300">
                    {weeklyReview.weaknesses?.map((weak, i) => (
                      <li key={i} className="leading-relaxed">{weak}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Key Lessons */}
              <div className="bg-slate-950/40 border border-slate-850 p-4 rounded-xl space-y-2">
                <span className="text-blue-400 text-[10px] font-bold uppercase tracking-wider block">
                  {t('coreLessons')}
                </span>
                <ul className="space-y-1.5 list-decimal list-inside text-xs text-slate-300">
                  {weeklyReview.key_lessons?.map((les, i) => (
                    <li key={i} className="leading-relaxed">{les}</li>
                  ))}
                </ul>
              </div>

              {/* Action Plan */}
              <div className="bg-purple-500/5 border border-purple-500/10 p-4 rounded-xl space-y-2">
                <span className="text-purple-400 text-[10px] font-bold uppercase tracking-wider block">
                  {t('actionPlanNextWeek')}
                </span>
                <ul className="space-y-1.5 list-disc list-inside text-xs text-slate-300">
                  {weeklyReview.action_plan?.map((act, i) => (
                    <li key={i} className="leading-relaxed">{act}</li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/50 flex justify-end">
              <button
                type="button"
                onClick={() => setIsWeeklyReviewOpen(false)}
                className="px-5 py-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition cursor-pointer"
              >
                {t('understoodRules')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Monthly AI Review Modal */}
      {isMonthlyReviewOpen && monthlyReview && (
        <div 
          onClick={() => setIsMonthlyReviewOpen(false)}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-fade-in"
        >
          <div 
            className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh] animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
              <div className="flex items-center gap-2">
                <BarChart2 className="w-5 h-5 text-purple-400 animate-pulse" />
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                  Đánh giá Tháng Này
                </h2>
              </div>
              <button
                onClick={() => setIsMonthlyReviewOpen(false)}
                className="p-1.5 hover:bg-slate-850 rounded-lg text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              
              {/* Score card & Overview */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-950/60 p-4 rounded-2xl border border-slate-850">
                <div className="text-center sm:border-r border-slate-850 flex flex-col justify-center py-2">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Kỷ luật tháng</span>
                  <span className="text-3xl font-extrabold text-purple-400 font-mono mt-1">
                    {monthlyReview.discipline_score}/10
                  </span>
                </div>
                <div className="sm:col-span-2 flex flex-col justify-center pl-2">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold mb-1">{t('coachSummary')}</span>
                  <p className="text-xs text-slate-350 leading-relaxed italic">
                    &ldquo;{monthlyReview.summary}&rdquo;
                  </p>
                </div>
              </div>

              {/* Strengths & Weaknesses Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-emerald-500/5 border border-emerald-500/10 p-4 rounded-xl space-y-2">
                  <span className="text-emerald-450 text-[10px] font-bold uppercase tracking-wider block">
                    {t('strengthsDecisions')}
                  </span>
                  <ul className="space-y-1.5 list-disc list-inside text-xs text-slate-350">
                    {monthlyReview.strengths?.map((str, i) => (
                      <li key={i} className="leading-relaxed">{str}</li>
                    ))}
                  </ul>
                </div>

                <div className="bg-rose-500/5 border border-rose-500/10 p-4 rounded-xl space-y-2">
                  <span className="text-rose-450 text-[10px] font-bold uppercase tracking-wider block">
                    {t('weaknessesRepeats')}
                  </span>
                  <ul className="space-y-1.5 list-disc list-inside text-xs text-slate-300">
                    {monthlyReview.weaknesses?.map((weak, i) => (
                      <li key={i} className="leading-relaxed">{weak}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Key Lessons */}
              <div className="bg-slate-950/40 border border-slate-850 p-4 rounded-xl space-y-2">
                <span className="text-blue-400 text-[10px] font-bold uppercase tracking-wider block">
                  {t('coreLessons')}
                </span>
                <ul className="space-y-1.5 list-decimal list-inside text-xs text-slate-300">
                  {monthlyReview.key_lessons?.map((les, i) => (
                    <li key={i} className="leading-relaxed">{les}</li>
                  ))}
                </ul>
              </div>

              {/* Action Plan */}
              <div className="bg-purple-500/5 border border-purple-500/10 p-4 rounded-xl space-y-2">
                <span className="text-purple-400 text-[10px] font-bold uppercase tracking-wider block">
                  Kế hoạch tháng tới
                </span>
                <ul className="space-y-1.5 list-disc list-inside text-xs text-slate-300">
                  {monthlyReview.action_plan?.map((act, i) => (
                    <li key={i} className="leading-relaxed">{act}</li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/50 flex justify-end">
              <button
                type="button"
                onClick={() => setIsMonthlyReviewOpen(false)}
                className="px-5 py-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition cursor-pointer"
              >
                {t('understoodRules')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* What-If Simulator Modal */}
      {whatIfTrade && (
        <WhatIfSimulator trade={whatIfTrade} onClose={() => setWhatIfTrade(null)} />
      )}

      {/* Recent Trades Review Modal */}
      {isRecentReviewOpen && recentReview && (
        <div 
          onClick={() => setIsRecentReviewOpen(false)}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-fade-in"
        >
          <div 
            className="relative w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh] animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-400 animate-pulse" />
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                  {t('recentReviewTitle')}
                </h2>
              </div>
              <button
                onClick={() => setIsRecentReviewOpen(false)}
                className="p-1.5 hover:bg-slate-850 rounded-lg text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              
              {/* Overview */}
              <div className="bg-slate-950/60 p-5 rounded-2xl border border-slate-850 space-y-3">
                <div>
                  <span className="text-[10px] text-amber-400 uppercase font-bold tracking-wider">{t('summaryOverview')}</span>
                  <p className="text-xs text-slate-300 leading-relaxed font-medium mt-1">
                    {recentReview.summary}
                  </p>
                </div>
              </div>

              {/* Technical & Psychological Insights */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-slate-950/40 border border-slate-850 p-4 rounded-xl space-y-2">
                  <span className="text-amber-405 text-[10px] font-bold uppercase tracking-wider block">
                    {t('technicalInsight')}
                  </span>
                  <p className="text-xs text-slate-300 leading-relaxed font-medium">
                    {recentReview.technical_insight}
                  </p>
                </div>

                <div className="bg-rose-500/5 border border-rose-500/10 p-4 rounded-xl space-y-2">
                  <span className="text-rose-450 text-[10px] font-bold uppercase tracking-wider block">
                    {t('psychologicalInsight')}
                  </span>
                  <p className="text-xs text-slate-300 leading-relaxed font-medium">
                    {recentReview.psychological_insight}
                  </p>
                </div>
              </div>

              {/* Risk Insight & Micro-Goals */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-emerald-500/5 border border-emerald-500/10 p-4 rounded-xl space-y-2">
                  <span className="text-emerald-450 text-[10px] font-bold uppercase tracking-wider block">
                    {t('riskInsight')}
                  </span>
                  <p className="text-xs text-slate-300 leading-relaxed font-medium">
                    {recentReview.risk_insight}
                  </p>
                </div>

                <div className="bg-purple-500/5 border border-purple-500/10 p-4 rounded-xl space-y-2">
                  <span className="text-purple-400 text-[10px] font-bold uppercase tracking-wider block">
                    {t('microGoals')}
                  </span>
                  <ul className="space-y-1.5 list-disc list-inside text-xs text-slate-300 font-semibold">
                    {recentReview.micro_goals?.map((act, i) => (
                      <li key={i} className="leading-relaxed text-purple-200">{act}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/50 flex justify-end">
              <button
                type="button"
                onClick={() => setIsRecentReviewOpen(false)}
                className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold text-xs rounded-xl transition cursor-pointer shadow-lg shadow-orange-500/10"
              >
                {t('acknowledgedMistakes')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Exporting Loader Overlay */}
      {isExporting && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="flex flex-col items-center bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center max-w-sm space-y-4 shadow-2xl">
            <div className="w-12 h-12 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin"></div>
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Đang khởi tạo báo cáo AI...</h3>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                Hệ thống đang trích xuất dữ liệu giao dịch và chạy AI Coach phân tích chuyên sâu. Báo cáo HTML của bạn sẽ được tải xuống tự động sau vài giây.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Export Options Modal */}
      {isExportModalOpen && (
        <div 
          onClick={() => setIsExportModalOpen(false)}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-fade-in"
        >
          <div 
            className="relative w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col p-6 space-y-4 animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <span className="text-sm font-bold text-white uppercase tracking-wider">Xuất Nhật Ký Giao Dịch</span>
              <button 
                onClick={() => setIsExportModalOpen(false)}
                className="p-1 hover:bg-slate-850 rounded text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Chọn khoảng thời gian của các giao dịch bạn muốn xuất ra file báo cáo HTML (đã bao gồm phân tích AI và hình ảnh đính kèm offline).
            </p>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  exportToHTML('TODAY');
                  setIsExportModalOpen(false);
                }}
                className="w-full text-left px-4 py-3 bg-slate-950 hover:bg-slate-850 border border-slate-850 hover:border-slate-800 rounded-xl transition text-xs font-bold text-white flex items-center justify-between cursor-pointer"
              >
                <span>☀️ Hôm nay</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  exportToHTML('YESTERDAY');
                  setIsExportModalOpen(false);
                }}
                className="w-full text-left px-4 py-3 bg-slate-950 hover:bg-slate-850 border border-slate-850 hover:border-slate-800 rounded-xl transition text-xs font-bold text-white flex items-center justify-between cursor-pointer"
              >
                <span>🌙 Hôm qua</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  exportToHTML('WEEK');
                  setIsExportModalOpen(false);
                }}
                className="w-full text-left px-4 py-3 bg-slate-950 hover:bg-slate-850 border border-slate-850 hover:border-slate-800 rounded-xl transition text-xs font-bold text-white flex items-center justify-between cursor-pointer"
              >
                <span>📅 7 ngày gần nhất (Tuần)</span>
                <span className="text-[10px] text-emerald-450 font-mono">
                  {weeklyTradeCount} lệnh
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  exportToHTML('MONTH');
                  setIsExportModalOpen(false);
                }}
                className="w-full text-left px-4 py-3 bg-slate-950 hover:bg-slate-850 border border-slate-850 hover:border-slate-800 rounded-xl transition text-xs font-bold text-white flex items-center justify-between cursor-pointer"
              >
                <span>📅 30 ngày gần nhất (Tháng)</span>
                <span className="text-[10px] text-emerald-450 font-mono">
                  {monthlyTradeCount} lệnh
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  exportToHTML('RECENT');
                  setIsExportModalOpen(false);
                }}
                className="w-full text-left px-4 py-3 bg-slate-950 hover:bg-slate-850 border border-slate-850 hover:border-slate-800 rounded-xl transition text-xs font-bold text-white flex items-center justify-between cursor-pointer"
              >
                <span>⚡ 20 lệnh gần nhất (Chuỗi lệnh)</span>
                <span className="text-[10px] text-amber-400 font-mono">
                  {Math.min(20, trades.length)} lệnh
                </span>
              </button>

              <div className="w-full border border-slate-850 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowCustomDate(!showCustomDate)}
                  className="w-full text-left px-4 py-3 bg-slate-950 hover:bg-slate-850 transition text-xs font-bold text-white flex items-center justify-between cursor-pointer"
                >
                  <span>🗓️ Tuỳ chọn ngày (Từ ngày - Đến ngày)</span>
                  {showCustomDate ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                </button>
                {showCustomDate && (
                  <div className="p-4 bg-slate-900 border-t border-slate-850 flex flex-col gap-3">
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="block text-[10px] text-slate-500 font-semibold mb-1 uppercase">Từ ngày</label>
                        <input 
                          type="date" 
                          value={exportStartDate}
                          onChange={(e) => setExportStartDate(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white outline-none focus:border-amber-500/50"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-[10px] text-slate-500 font-semibold mb-1 uppercase">Đến ngày</label>
                        <input 
                          type="date" 
                          value={exportEndDate}
                          onChange={(e) => setExportEndDate(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white outline-none focus:border-amber-500/50"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        exportToHTML('CUSTOM');
                        if (exportStartDate && exportEndDate) {
                          setIsExportModalOpen(false);
                        }
                      }}
                      className="w-full mt-2 py-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-lg text-xs font-bold transition cursor-pointer"
                    >
                      Xác nhận xuất
                    </button>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  exportToHTML('ALL');
                  setIsExportModalOpen(false);
                }}
                className="w-full text-left px-4 py-3 bg-slate-950 hover:bg-slate-850 border border-slate-850 hover:border-slate-800 rounded-xl transition text-xs font-bold text-white flex items-center justify-between cursor-pointer mt-2"
              >
                <span>📦 Xuất toàn bộ lệnh ({trades.length})</span>
                <span className="text-[10px] text-slate-500 font-semibold">Tất cả</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TradingView Studio Modal */}
      {tradeToGenerateImage && (
        <HiddenChartGenerator 
          trade={tradeToGenerateImage}
          isBackground={false}
          onComplete={async (urls, error) => {
            if (urls && urls.length > 0) {
              try {
                const res = await fetch('/api/trades', {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ id: tradeToGenerateImage.id, image_url: JSON.stringify(urls) })
                });
                if (res.ok) {
                   fetchDashboardData();
                }
              } catch (e) {
                console.error(e);
              }
            } else if (error) {
              console.error('Failed to generate image:', error);
            }
            setTradeToGenerateImage(null);
          }}
        />
      )}

      <TradingViewStudioModal
        isOpen={isStudioModalOpen}
        onClose={() => setIsStudioModalOpen(false)}
        trades={trades}
        theme={theme}
      />


      {/* Full-Screen Widget Overlay */}
      {expandedWidget && (
        <div className="fixed inset-0 z-[100] bg-slate-950/95 backdrop-blur-md flex flex-col animate-fade-in overflow-hidden">
          {/* Header */}
          <div className="px-6 py-4 bg-slate-950/80 backdrop-blur-md border-b border-white/5 flex items-center justify-between shadow-sm sticky top-0 z-10">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-tr from-sky-500 to-indigo-500 rounded-xl text-white shadow-lg shadow-sky-500/20">
                <Maximize2 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white tracking-tight">Chế độ xem mở rộng</h2>
                <p className="text-xs text-slate-400">Bấm phím <kbd className="px-1 py-0.5 bg-slate-800 rounded font-mono text-[9px] mx-1 border border-slate-700">Esc</kbd> hoặc nút Đóng để thoát</p>
              </div>
            </div>
            <button
              onClick={() => setExpandedWidget(null)}
              className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl transition font-bold text-xs border border-white/5 shadow-sm cursor-pointer"
            >
              <Minimize2 className="w-4 h-4" /> Đóng Toàn Màn Hình
            </button>
          </div>
          
          {/* Content Area */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-8 md:p-12 custom-scrollbar">
            <div className="max-w-[1600px] mx-auto animate-slide-up">
              {renderExpandedWidget()}
            </div>
          </div>
        </div>
      )}
      
      {/* Quick Review Modal */}
      <QuickReviewModal 
        isOpen={isQuickReviewOpen}
        onClose={() => setIsQuickReviewOpen(false)}
        trades={tradesToReview}
        theme={theme}
        zIndex={isFormOpen ? 40 : 100}
        onSaveTrade={async (payload) => {
          const res = await fetch('/api/trades', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          if (!res.ok) throw new Error('Failed to update trade');
          await fetchDashboardData();
        }}
        onBackToStep1={(trade) => {
          setEditingTrade(trade);
          setIsFormOpen(true);
          setTimeout(() => {
            setIsQuickReviewOpen(false);
          }, 300);
        }}
      />
    </main>
  );
}

export default function Dashboard() {
  return (
    <LanguageProvider>
      <DashboardContent />
    </LanguageProvider>
  );
}
