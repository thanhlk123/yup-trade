'use client';
import { useAlertStore } from '@/app/core/ui/store/alertStore';
import { AlertTriangle, AlertCircle, Info, CheckCircle2, X, Loader2 } from 'lucide-react';
import { useThemeStore } from '@/app/core/theme/store';

export default function GlobalAlertModal() {
  const { isOpen, title, message, type, confirmText, cancelText, isLoading, closeAlert, confirmAlert } = useAlertStore();
  const theme = useThemeStore(state => state.theme);

  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case 'danger': return <AlertTriangle className="w-6 h-6 text-rose-500" />;
      case 'warning': return <AlertCircle className="w-6 h-6 text-amber-500" />;
      case 'success': return <CheckCircle2 className="w-6 h-6 text-emerald-500" />;
      default: return <Info className="w-6 h-6 text-blue-500" />;
    }
  };

  const getThemeColors = () => {
    if (theme === 'light') {
      switch (type) {
        case 'danger': return 'bg-rose-50 border-rose-200 text-rose-900';
        case 'warning': return 'bg-amber-50 border-amber-200 text-amber-900';
        case 'success': return 'bg-emerald-50 border-emerald-200 text-emerald-900';
        default: return 'bg-blue-50 border-blue-200 text-blue-900';
      }
    } else {
      switch (type) {
        case 'danger': return 'bg-rose-500/10 border-rose-500/30 text-rose-100';
        case 'warning': return 'bg-amber-500/10 border-amber-500/30 text-amber-100';
        case 'success': return 'bg-emerald-500/10 border-emerald-500/30 text-emerald-100';
        default: return 'bg-blue-500/10 border-blue-500/30 text-blue-100';
      }
    }
  };

  const getButtonClass = () => {
    if (theme === 'light') {
      switch (type) {
        case 'danger': return 'bg-rose-600 hover:bg-rose-700 text-white';
        case 'warning': return 'bg-amber-500 hover:bg-amber-600 text-white';
        case 'success': return 'bg-emerald-600 hover:bg-emerald-700 text-white';
        default: return 'bg-blue-600 hover:bg-blue-700 text-white';
      }
    } else {
      switch (type) {
        case 'danger': return 'bg-rose-500 hover:bg-rose-600 text-white';
        case 'warning': return 'bg-amber-500 hover:bg-amber-600 text-white';
        case 'success': return 'bg-emerald-500 hover:bg-emerald-600 text-white';
        default: return 'bg-blue-500 hover:bg-blue-600 text-white';
      }
    }
  };

  const isDark = theme === 'dark';

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 animate-fade-in bg-slate-900/50 backdrop-blur-sm">
      <div 
        className={`w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'} animate-slide-up`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`p-6 border-b ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-full shrink-0 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
              {getIcon()}
            </div>
            <div className="flex-1 pt-1">
              <h3 className={`text-xl font-black tracking-tight mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {title}
              </h3>
              <p className={`text-sm leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {message}
              </p>
            </div>
          </div>
        </div>
        
        <div className={`p-4 flex justify-end gap-3 ${isDark ? 'bg-slate-800/50' : 'bg-slate-50'}`}>
          <button
            onClick={closeAlert}
            disabled={isLoading}
            className={`px-5 py-2.5 rounded-xl font-bold transition-all text-sm ${isDark ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-200'} disabled:opacity-50`}
          >
            {cancelText}
          </button>
          
          <button
            onClick={confirmAlert}
            disabled={isLoading}
            className={`px-5 py-2.5 rounded-xl font-bold transition-all text-sm flex items-center gap-2 ${getButtonClass()} disabled:opacity-50`}
          >
            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
