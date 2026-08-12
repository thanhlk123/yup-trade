import { Award, X } from 'lucide-react';
import { useLanguageStore } from '@/app/core/i18n/store';
import { useSmartReviewStore } from '@/app/features/analytics/store/smartReviewStore';

export default function TodayReviewModal() {
  const t = useLanguageStore(state => state.t);
  const isOpen = useSmartReviewStore(state => state.isTodayReviewOpen);
  const onClose = () => useSmartReviewStore.getState().setTodayReviewOpen(false);
  const todayReview = useSmartReviewStore(state => state.todayReview);

  if (!isOpen || !todayReview) return null;

  return (
    <div 
      onClick={onClose}
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
              {t('todayReviewTitle') || 'ĐÁNH GIÁ HÔM NAY'}
            </h2>
          </div>
          <button
            onClick={onClose}
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
              <span className="text-[10px] text-slate-500 uppercase font-semibold">{t('disciplineToday') || 'KỶ LUẬT'}</span>
              <span className="text-3xl font-extrabold text-emerald-400 font-mono mt-1">
                {todayReview.discipline_score}/10
              </span>
            </div>
            <div className="sm:col-span-2 flex flex-col justify-center pl-2">
              <span className="text-[10px] text-slate-500 uppercase font-semibold mb-1">{t('coachComment') || 'NHẬN XÉT CỦA COACH'}</span>
              <p className="text-xs text-slate-350 leading-relaxed italic">
                &ldquo;{todayReview.summary}&rdquo;
              </p>
            </div>
          </div>

          {/* Strengths & Weaknesses Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-emerald-500/5 border border-emerald-500/10 p-4 rounded-xl space-y-2">
              <span className="text-emerald-400 text-[10px] font-bold uppercase tracking-wider block">
                {t('strengthsToday') || 'ĐIỂM TỐT CẦN PHÁT HUY'}
              </span>
              <ul className="space-y-1.5 list-disc list-inside text-xs text-slate-350">
                {todayReview.strengths?.map((str, i) => (
                  <li key={i} className="leading-relaxed">{str}</li>
                ))}
              </ul>
            </div>

            <div className="bg-rose-500/5 border border-rose-500/10 p-4 rounded-xl space-y-2">
              <span className="text-rose-400 text-[10px] font-bold uppercase tracking-wider block">
                {t('weaknessesMistakes') || 'LỖI CẦN KHẮC PHỤC'}
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
              {t('keyLessonToday') || 'BÀI HỌC CỐT LÕI'}
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
