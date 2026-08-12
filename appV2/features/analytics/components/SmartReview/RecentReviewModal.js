import { Sparkles, X } from 'lucide-react';
import { useLanguageStore } from '@/appV2/core/i18n/store';
import { useSmartReviewStore } from '@/appV2/features/analytics/store/smartReviewStore';

export default function RecentReviewModal() {
  const t = useLanguageStore(state => state.t);
  const isOpen = useSmartReviewStore(state => state.isRecentReviewOpen);
  const onClose = () => useSmartReviewStore.getState().setRecentReviewOpen(false);
  const recentReview = useSmartReviewStore(state => state.recentReview);

  if (!isOpen || !recentReview) return null;

  return (
    <div 
      onClick={onClose}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-fade-in"
    >
      <div 
        className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh] animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400 animate-pulse" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              {t('reviewRecent20Title') || 'ĐÁNH GIÁ 20 LỆNH GẦN NHẤT'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-850 rounded-lg text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-950/60 p-4 rounded-2xl border border-slate-850">
            <div className="text-center sm:border-r border-slate-850 flex flex-col justify-center py-2">
              <span className="text-[10px] text-slate-500 uppercase font-semibold">Trạng thái chuỗi</span>
              <span className="text-xl font-extrabold text-amber-400 font-mono mt-1">
                {recentReview.streak_status || 'Bình thường'}
              </span>
            </div>
            <div className="sm:col-span-2 flex flex-col justify-center pl-2">
              <span className="text-[10px] text-slate-500 uppercase font-semibold mb-1">CHẨN ĐOÁN NHANH</span>
              <p className="text-xs text-slate-350 leading-relaxed italic">
                &ldquo;{recentReview.quick_diagnosis}&rdquo;
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-amber-500/5 border border-amber-500/10 p-4 rounded-xl space-y-2">
              <span className="text-amber-400 text-[10px] font-bold uppercase tracking-wider block">
                Cảnh báo nguy cơ
              </span>
              <ul className="space-y-1.5 list-disc list-inside text-xs text-slate-350">
                {recentReview.risk_warnings?.map((w, i) => (
                  <li key={i} className="leading-relaxed">{w}</li>
                ))}
              </ul>
            </div>

            <div className="bg-slate-950/40 border border-slate-850 p-4 rounded-xl space-y-2">
              <span className="text-sky-400 text-[10px] font-bold uppercase tracking-wider block">
                Mẫu hình đang hoạt động tốt
              </span>
              <ul className="space-y-1.5 list-disc list-inside text-xs text-slate-300">
                {recentReview.working_patterns?.map((p, i) => (
                  <li key={i} className="leading-relaxed">{p}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="bg-emerald-500/5 border border-emerald-500/10 p-4 rounded-xl space-y-2">
            <span className="text-emerald-450 text-[10px] font-bold uppercase tracking-wider block">
              🎯 Cần làm ngay lập tức
            </span>
            <ul className="space-y-1.5 list-disc list-inside text-xs text-slate-300">
              {recentReview.immediate_actions?.map((a, i) => (
                <li key={i} className="leading-relaxed">{a}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition cursor-pointer"
          >
            {t('acknowledgedLessons') || 'Đã ghi nhận bài học'}
          </button>
        </div>
      </div>
    </div>
  );
}
