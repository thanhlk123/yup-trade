'use client';

import { useState, useRef, useEffect } from 'react';
import { HelpCircle, Info, ShieldAlert, CheckCircle2, Zap, AlertTriangle, BookOpen, X } from 'lucide-react';
import { getHashtagInfo } from '@/lib/hashtags';

export default function HashtagBadge({ tag, showIcon = true, size = 'sm', interactive = true }) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const tooltipRef = useRef(null);

  const info = getHashtagInfo(tag);

  // Close tooltip on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (tooltipRef.current && !tooltipRef.current.contains(e.target)) {
        setShowTooltip(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!info) {
    // Plain tag badge if not in dictionary
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-mono font-bold theme-inner-card text-slate-700 dark:text-slate-300 theme-border">
        {tag}
      </span>
    );
  }

  const badgeColor = info.color || 'text-slate-300 border-slate-700 bg-slate-800';

  // Size styling
  const sizeClasses = {
    xs: 'text-[10px] px-1.5 py-0.5 rounded-md',
    sm: 'text-xs px-2.5 py-1 rounded-xl',
    md: 'text-xs sm:text-sm px-3 py-1.5 rounded-xl',
  }[size] || 'text-xs px-2.5 py-1 rounded-xl';

  return (
    <div className="relative inline-block" ref={tooltipRef}>
      <button
        type="button"
        onClick={() => {
          if (interactive) setShowModal(!showModal);
        }}
        onMouseEnter={() => {
          if (interactive) setShowTooltip(true);
        }}
        onMouseLeave={() => {
          if (interactive) setShowTooltip(false);
        }}
        className={`inline-flex items-center gap-1.5 font-mono font-extrabold border transition shadow-sm hover:scale-105 cursor-pointer ${sizeClasses} ${badgeColor}`}
        title={`Xem chú thích chi tiết cho ${info.tag}`}
      >
        <span>{info.tag}</span>
        {showIcon && <HelpCircle className="w-3 h-3 opacity-70 hover:opacity-100 shrink-0" />}
      </button>

      {/* Hover Quick Tooltip */}
      {showTooltip && !showModal && (
        <div className="absolute left-0 bottom-full mb-2 z-50 w-72 p-3 bg-slate-900/95 border border-amber-500/30 text-white rounded-2xl shadow-2xl backdrop-blur-md text-xs space-y-2 pointer-events-none animate-fade-in">
          <div className="flex items-center justify-between font-bold border-b border-slate-800 pb-1.5">
            <span className="text-amber-300 font-mono">{info.tag}</span>
            <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 font-normal">
              {info.group || info.catLabel}
            </span>
          </div>

          <p className="text-slate-200 text-[11px] leading-relaxed">
            {info.description}
          </p>

          {info.rules && (
            <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[10px] text-amber-200 leading-tight">
              <strong>💡 Quy tắc:</strong> {info.rules}
            </div>
          )}

          {info.riskLevel && (
            <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-800/60">
              <span>Mức độ Rủi ro:</span>
              <span className={`font-bold ${
                info.riskLevel.includes('Cao') || info.riskLevel.includes('Cháy') ? 'text-rose-400' :
                info.riskLevel.includes('Trung') ? 'text-amber-400' :
                info.riskLevel.includes('Thói Quen') ? 'text-sky-400' : 'text-emerald-400'
              }`}>
                {info.riskLevel}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Click Full Modal Overlay */}
      {showModal && (
        <div className="fixed inset-0 z-[130] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="theme-card border theme-border rounded-3xl p-6 w-full max-w-md space-y-4 shadow-2xl relative text-left">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowModal(false);
              }}
              className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-500/10 rounded-2xl border border-amber-500/30">
                <BookOpen className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <span className={`px-2.5 py-0.5 rounded-lg text-xs font-mono font-extrabold border ${info.color}`}>
                  {info.tag}
                </span>
                <h4 className="text-sm font-bold text-white mt-1">{info.label}</h4>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-2xl theme-inner-card theme-border space-y-1">
                <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider">
                  📖 Ý Nghĩa & Mô Tả Thực Chiến:
                </span>
                <p className="theme-text-main leading-relaxed">{info.description}</p>
              </div>

              {info.rules && (
                <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider flex items-center gap-1">
                    <Zap className="w-3 h-3" /> Quy Tắc & Hướng Dẫn Kích Hoạt Lệnh:
                  </span>
                  <p className="text-emerald-200 leading-relaxed">{info.rules}</p>
                </div>
              )}

              <div className="p-3 rounded-2xl theme-inner-card theme-border flex items-center justify-between">
                <span className="theme-text-sub font-semibold">Mức độ rủi ro / Tính chất:</span>
                <span className={`font-mono font-bold px-2.5 py-1 rounded-lg text-xs border ${
                  info.riskLevel.includes('Cao') || info.riskLevel.includes('Cháy') ? 'bg-rose-500/20 text-rose-300 border-rose-500/40' :
                  info.riskLevel.includes('Trung') ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' :
                  info.riskLevel.includes('Thói Quen') ? 'bg-sky-500/20 text-sky-300 border-sky-500/40' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                }`}>
                  {info.riskLevel}
                </span>
              </div>
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowModal(false);
              }}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl transition cursor-pointer"
            >
              Đóng Chú Thích
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
