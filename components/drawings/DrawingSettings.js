'use client';

import React from 'react';
import { Trash2 } from 'lucide-react';

const COLORS = ['#f43f5e', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ffffff'];
const THICKNESSES = [1, 2, 3, 4];

export default function DrawingSettings({ drawing, onUpdate, onDelete }) {
  if (!drawing) return null;

  const currentColor = drawing.color || '#3b82f6';
  const currentThickness = drawing.thickness || 2;

  return (
    <div 
      className="hide-on-capture absolute top-4 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-3 p-2 rounded-xl border border-slate-700/50 bg-slate-800/90 shadow-2xl backdrop-blur-md"
      onMouseDown={(e) => e.stopPropagation()} // Prevent chart from catching clicks
    >
      {/* Colors */}
      <div className="flex items-center gap-1.5 px-2 border-r border-slate-700">
        {COLORS.map(c => (
          <button
            key={c}
            onClick={() => onUpdate(drawing.id, { color: c })}
            className={`w-5 h-5 rounded-full transition-transform ${currentColor === c ? 'scale-125 ring-2 ring-white/50' : 'hover:scale-110'}`}
            style={{ backgroundColor: c }}
            title="Đổi màu"
          />
        ))}
      </div>

      {/* Thickness */}
      <div className="flex items-center gap-1.5 px-2 border-r border-slate-700">
        {THICKNESSES.map(t => (
          <button
            key={t}
            onClick={() => onUpdate(drawing.id, { thickness: t })}
            className={`w-6 h-6 flex items-center justify-center rounded transition ${currentThickness === t ? 'bg-white/10' : 'hover:bg-white/5'}`}
            title={`Độ dày ${t}px`}
          >
            <div className="bg-slate-300 w-4 rounded-full" style={{ height: `${t}px` }} />
          </button>
        ))}
      </div>

      {/* Delete */}
      <button 
        onClick={() => onDelete(drawing.id)}
        className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-400/10 rounded transition"
        title="Xóa nét vẽ (Delete)"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}
