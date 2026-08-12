import { create } from 'zustand';
import { fetchTrades, fetchStats, fetchAccountTabs } from '../services/dashboardApi';

export const useDashboardStore = create((set, get) => ({
  trades: [],
  stats: { summary: {}, setups: [] },
  accountTabs: [],
  activeTab: 'LIVE',
  loading: true,
  isAccountTabsLoaded: false,
  
  latestFetchId: null,
  isFormOpen: false,
  editingTrade: null,
  openTradeForm: (trade = null) => set({ isFormOpen: true, editingTrade: trade }),
  closeTradeForm: () => set({ isFormOpen: false, editingTrade: null }),

  isQuickReviewOpen: false,
  tradesToReview: [],
  openQuickReview: (trades) => set({ isQuickReviewOpen: true, tradesToReview: trades }),
  closeQuickReview: () => set({ isQuickReviewOpen: false, tradesToReview: [] }),

  isCarouselOpen: false,
  carouselIndex: 0,
  setCarouselIndex: (index) => set({ carouselIndex: index }),
  setIsCarouselOpen: (isOpen) => set({ isCarouselOpen: isOpen }),
  tradeToGenerateImage: null,
  setTradeToGenerateImage: (trade) => set({ tradeToGenerateImage: trade }),

  selectedTradeForChart: null,
  setSelectedTradeForChart: (trade) => set({ selectedTradeForChart: trade }),

  behaviorFilterIds: null,
  setBehaviorFilterIds: (ids) => set({ behaviorFilterIds: ids }),

  isExportModalOpen: false,
  setIsExportModalOpen: (isOpen) => set({ isExportModalOpen: isOpen }),

  zoomImages: [],
  zoomImageIndex: 0,
  setZoomImages: (images, initialIndex = 0) => set({ zoomImages: images, zoomImageIndex: initialIndex }),
  setZoomImageIndex: (index) => set({ zoomImageIndex: index }),

  setActiveTab: (tab) => {
    set({ activeTab: tab });
    if (typeof window !== 'undefined') {
      localStorage.setItem('ai_trading_active_account_tab', tab);
    }
    get().fetchDashboardData(tab);
  },

  loadAccountTabs: async () => {
    try {
      const data = await fetchAccountTabs();
      if (data.success && data.data) {
        const mappedTabs = data.data.map(t => ({
          key: t.tab_key,
          label: t.label,
          color: t.color,
          isAll: t.is_all === 1,
          order: t.display_order
        }));
        
        set({ accountTabs: mappedTabs, isAccountTabsLoaded: true });
        
        if (mappedTabs.length > 0) {
          let currentTab = typeof window !== 'undefined' ? localStorage.getItem('ai_trading_active_account_tab') : 'LIVE';
          if (!currentTab) currentTab = 'LIVE';

          let tabToSet = currentTab;
          const isSavedTabInMapped = mappedTabs.some(t => t.key === currentTab);
          
          if (currentTab === 'LIVE' || !isSavedTabInMapped) {
            tabToSet = mappedTabs[0].key;
          }
          
          get().setActiveTab(tabToSet);
        }
      }
    } catch (e) {
      console.error('Failed to load account tabs:', e);
      set({ isAccountTabsLoaded: true });
    }
  },

  fetchDashboardData: async (tab = get().activeTab) => {
    try {
      const fetchId = Date.now();
      set({ latestFetchId: fetchId, loading: true });
      
      const [tradesData, statsData] = await Promise.all([
        fetchTrades(tab, fetchId),
        fetchStats(tab, fetchId)
      ]);

      if (get().latestFetchId !== fetchId) return;

      set((state) => ({
        trades: tradesData.success ? tradesData.data : state.trades,
        stats: statsData.success ? statsData.data : state.stats,
        loading: false
      }));
    } catch (err) {
      console.error('Failed to load data:', err);
      set({ loading: false });
    }
  },

  handleResetHistory: async () => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa toàn bộ lịch sử giao dịch? Hành động này không thể hoàn tác.')) {
      return;
    }
    try {
      const res = await fetch('/api/trades', { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        get().fetchDashboardData();
      }
    } catch (error) {
      console.error('Error resetting trades:', error);
    }
  },
}));
