'use client';

import React, { useState, useRef } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useDashboardStore } from '@/appV2/features/dashboard/store/dashboardStore';

export default function ZoomImageModal() {
  const zoomImages = useDashboardStore(state => state.zoomImages);
  const zoomImageIndex = useDashboardStore(state => state.zoomImageIndex);
  const setZoomImages = useDashboardStore(state => state.setZoomImages);
  const setZoomImageIndex = useDashboardStore(state => state.setZoomImageIndex);

  const [zoomScale, setZoomScale] = useState(1);
  const zoomContainerRef = useRef(null);
  const dragStatusRef = useRef({ isDragging: false, startX: 0, startY: 0, scrollLeft: 0, scrollTop: 0 });

  if (!zoomImages || zoomImages.length === 0) return null;

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

  return (
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
                setZoomImageIndex(zoomImageIndex === 0 ? zoomImages.length - 1 : zoomImageIndex - 1);
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
                setZoomImageIndex(zoomImageIndex === zoomImages.length - 1 ? 0 : zoomImageIndex + 1);
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
              key={zoomImageIndex}
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
  );
}
