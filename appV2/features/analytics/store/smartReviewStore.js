import { create } from 'zustand';

export const useSmartReviewStore = create((set, get) => ({
  // State
  isTodayReviewOpen: false,
  isWeeklyReviewOpen: false,
  isMonthlyReviewOpen: false,
  isRecentReviewOpen: false,

  todayReview: null,
  weeklyReview: null,
  monthlyReview: null,
  recentReview: null,

  loadingToday: false,
  loadingWeekly: false,
  loadingMonthly: false,
  loadingRecent: false,

  // Setters
  setTodayReviewOpen: (isOpen) => set({ isTodayReviewOpen: isOpen }),
  setWeeklyReviewOpen: (isOpen) => set({ isWeeklyReviewOpen: isOpen }),
  setMonthlyReviewOpen: (isOpen) => set({ isMonthlyReviewOpen: isOpen }),
  setRecentReviewOpen: (isOpen) => set({ isRecentReviewOpen: isOpen }),

  // Actions
  handleTodayReview: async (activeTab, language) => {
    set({ loadingToday: true });
    try {
      const d = new Date();
      const todayDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const res = await fetch(`/api/today-review?type=${activeTab}&date=${todayDateStr}&lang=${language}`);
      const result = await res.json();
      if (result.success) {
        set({ todayReview: result.data, isTodayReviewOpen: true });
      } else {
        alert(result.error || 'Không thể tạo nhận xét hôm nay lúc này.');
      }
    } catch (err) {
      console.error(err);
      alert('Lỗi kết nối mạng khi tải nhận xét ngày hôm nay.');
    } finally {
      set({ loadingToday: false });
    }
  },

  handleWeeklyReview: async (activeTab, language) => {
    set({ loadingWeekly: true });
    try {
      const res = await fetch(`/api/weekly-review?type=${activeTab}&lang=${language}`);
      const result = await res.json();
      if (result.success) {
        set({ weeklyReview: result.data, isWeeklyReviewOpen: true });
      } else {
        alert(result.error || 'Không thể tạo nhận xét tuần lúc này.');
      }
    } catch (err) {
      console.error(err);
      alert('Lỗi kết nối mạng khi tải nhận xét tuần.');
    } finally {
      set({ loadingWeekly: false });
    }
  },

  handleMonthlyReview: async (activeTab, language) => {
    set({ loadingMonthly: true });
    try {
      const res = await fetch(`/api/monthly-review?type=${activeTab}&lang=${language}`);
      const result = await res.json();
      if (result.success) {
        set({ monthlyReview: result.data, isMonthlyReviewOpen: true });
      } else {
        alert(result.error || 'Không thể tạo nhận xét tháng lúc này.');
      }
    } catch (err) {
      console.error(err);
      alert('Lỗi kết nối mạng khi tải nhận xét tháng.');
    } finally {
      set({ loadingMonthly: false });
    }
  },

  handleRecentReview: async (activeTab, language) => {
    set({ loadingRecent: true });
    try {
      const res = await fetch(`/api/recent-review?type=${activeTab}&lang=${language}`);
      const result = await res.json();
      if (result.success) {
        set({ recentReview: result.data, isRecentReviewOpen: true });
      } else {
        alert(result.error || 'Không thể tạo nhận xét chuỗi lệnh lúc này.');
      }
    } catch (err) {
      console.error(err);
      alert('Lỗi kết nối mạng khi tải nhận xét chuỗi lệnh.');
    } finally {
      set({ loadingRecent: false });
    }
  }
}));
