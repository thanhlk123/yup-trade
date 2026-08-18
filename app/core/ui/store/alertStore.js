import { create } from 'zustand';

export const useAlertStore = create((set, get) => ({
  isOpen: false,
  title: '',
  message: '',
  type: 'info', // 'info', 'warning', 'danger', 'success'
  confirmText: 'Xác nhận',
  cancelText: 'Hủy',
  onConfirm: null,
  onCancel: null,
  isAsync: false,
  isLoading: false,

  showAlert: (options) => {
    set({
      isOpen: true,
      title: options.title || 'Thông báo',
      message: options.message || '',
      type: options.type || 'info',
      confirmText: options.confirmText || 'Xác nhận',
      cancelText: options.cancelText || 'Hủy',
      onConfirm: options.onConfirm || null,
      onCancel: options.onCancel || null,
      isAsync: !!options.isAsync,
      isLoading: false
    });
  },

  closeAlert: () => {
    const { onCancel } = get();
    if (onCancel) onCancel();
    set({ isOpen: false });
  },

  confirmAlert: async () => {
    const { onConfirm, isAsync } = get();
    if (!onConfirm) {
      set({ isOpen: false });
      return;
    }

    if (isAsync) {
      set({ isLoading: true });
      try {
        await onConfirm();
      } finally {
        set({ isOpen: false, isLoading: false });
      }
    } else {
      onConfirm();
      set({ isOpen: false });
    }
  }
}));
