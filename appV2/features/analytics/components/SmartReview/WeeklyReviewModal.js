import { Calendar, X } from 'lucide-react';
import { useLanguageStore } from '@/appV2/core/i18n/store';
import { useSmartReviewStore } from '@/appV2/features/analytics/store/smartReviewStore';

export default function WeeklyReviewModal() {
  const t = useLanguageStore(state => state.t);
  const isOpen = useSmartReviewStore(state => state.isWeeklyReviewOpen);
  const onClose = () => useSmartReviewStore.getState().setWeeklyReviewOpen(false);
  const weeklyReview = useSmartReviewStore(state => state.weeklyReview);

  if (!isOpen || !weeklyReview) return null;

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
            <Calendar className="w-5 h-5 text-sky-400 animate-pulse" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              {t('weeklyReviewTitle') || 'ĐÁNH GIÁ TUẦN NÀY'}
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
              <span className="text-[10px] text-slate-500 uppercase font-semibold">Phong độ tuần</span>
              <span className="text-3xl font-extrabold text-sky-400 font-mono mt-1">
                {weeklyReview.performance_grade || 'A'}
              </span>
            </div>
            <div className="sm:col-span-2 flex flex-col justify-center pl-2">
              <span className="text-[10px] text-slate-500 uppercase font-semibold mb-1">TỔNG QUAN CHIẾN LƯỢC</span>
              <p className="text-xs text-slate-350 leading-relaxed italic">
                &ldquo;{weeklyReview.strategy_overview}&rdquo;
              </p>
            </div>
          </div>

          <div className="bg-sky-500/5 border border-sky-500/10 p-4 rounded-xl space-y-2">
            <span className="text-sky-400 text-[10px] font-bold uppercase tracking-wider block">
              💡 Phân tích Tâm lý & Kỷ luật tuần
            </span>
            <p className="text-xs text-slate-300 leading-relaxed">
              {weeklyReview.psychology_analysis}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-slate-950/40 border border-slate-850 p-4 rounded-xl space-y-2">
              <span className="text-emerald-400 text-[10px] font-bold uppercase tracking-wider block">
                Mẫu hình thành công (Winning Setups)
              </span>
              <ul className="space-y-1.5 list-disc list-inside text-xs text-slate-350">
                {weeklyReview.winning_setups?.map((s, i) => (
                  <li key={i} className="leading-relaxed">{s}</li>
                ))}
              </ul>
            </div>

            <div className="bg-slate-950/40 border border-slate-850 p-4 rounded-xl space-y-2">
              <span className="text-rose-400 text-[10px] font-bold uppercase tracking-wider block">
                Vấn đề rò rỉ lợi nhuận (Profit Leaks)
              </span>
              <ul className="space-y-1.5 list-disc list-inside text-xs text-slate-300">
                {weeklyReview.profit_leaks?.map((l, i) => (
                  <li key={i} className="leading-relaxed">{l}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="bg-emerald-500/5 border border-emerald-500/10 p-4 rounded-xl space-y-2">
            <span className="text-emerald-450 text-[10px] font-bold uppercase tracking-wider block">
              🎯 Mục tiêu điều chỉnh tuần tới
            </span>
            <ul className="space-y-1.5 list-disc list-inside text-xs text-slate-300">
              {weeklyReview.next_week_goals?.map((g, i) => (
                <li key={i} className="leading-relaxed">{g}</li>
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
