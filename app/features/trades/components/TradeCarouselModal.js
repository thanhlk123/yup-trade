'use client';

import { useState, useRef } from 'react';
import { 
  Plus, X, ChevronLeft, ChevronRight, Image, Maximize2, Sparkles 
} from 'lucide-react';
import { useLanguageStore } from '@/app/core/i18n/store';
import { useDashboardStore } from '@/app/features/dashboard/store/dashboardStore';
import { getTradeTypeBadge } from '@/lib/tradeUtils';
import { parseImageUrls } from '@/lib/imageUtils';

export default function TradeCarouselModal() {
  const t = useLanguageStore(state => state.t);
  const trades = useDashboardStore(state => state.trades) || [];
  const activeTab = useDashboardStore(state => state.activeTab);
  const fetchDashboardData = useDashboardStore(state => state.fetchDashboardData);
  
  const isCarouselOpen = useDashboardStore(state => state.isCarouselOpen);
  const setIsCarouselOpen = useDashboardStore(state => state.setIsCarouselOpen);
  const carouselIndex = useDashboardStore(state => state.carouselIndex);
  const setCarouselIndex = useDashboardStore(state => state.setCarouselIndex);

  const [carouselImageIndex, setCarouselImageIndex] = useState(0);
  const [zoomImages, setZoomImages] = useState([]);
  const [zoomImageIndex, setZoomImageIndex] = useState(0);
  const [zoomScale, setZoomScale] = useState(1);

  const zoomContainerRef = useRef(null);
  const dragStatusRef = useRef({ isDragging: false, startX: 0, startY: 0, scrollLeft: 0, scrollTop: 0 });

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



  const handleCarouselImageUpload = async (e, trade) => {
    const files = Array.from(e.target.files);
    if (!files || files.length === 0) return;

    let existingImages = parseImageUrls(trade.image_url);

    if (existingImages.length + files.length > 10) {
      alert("Bạn chỉ được đính kèm tối đa 10 hình ảnh biểu đồ cho mỗi giao dịch.");
      return;
    }

    const newImages = [];
    for (const file of files) {
      const base64 = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(file);
      });
      newImages.push(base64);
    }

    const updatedImages = [...existingImages, ...newImages];
    const image_url = JSON.stringify(updatedImages);

    try {
      const response = await fetch('/api/trades', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...trade,
          image_url
        })
      });
      
      const result = await response.json();
      if (result.success) {
        await fetchDashboardData(activeTab);
        setCarouselImageIndex(existingImages.length);
      } else {
        alert(result.error || 'Không thể tải ảnh lên.');
      }
    } catch (err) {
      console.error(err);
      alert('Lỗi mạng khi cập nhật hình ảnh.');
    } finally {
      if (e && e.target) {
        e.target.value = '';
      }
    }
  };


  return (
    <>
      {zoomImages.length > 0 && (
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
                    setZoomImageIndex(idx => (idx === 0 ? zoomImages.length - 1 : idx - 1));
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
                    setZoomImageIndex(idx => (idx === zoomImages.length - 1 ? 0 : idx + 1));
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
                  key={zoomImageIndex} // force image reload animation on index change
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
      )}



      {isCarouselOpen && trades.length > 0 && trades[carouselIndex] && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4 animate-fade-in">
          <div className="relative w-full max-w-6xl h-[85vh] bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden flex flex-col shadow-2xl animate-scale-in">
            
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-800/80 bg-slate-950 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="font-bold text-white text-sm sm:text-base">
                  {t('browseJournalTitle', { current: carouselIndex + 1, total: trades.length })}
                </span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  trades[carouselIndex].side === 'BUY' 
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                }`}>
                  {trades[carouselIndex].side}
                </span>
                {(() => {
                  const badge = getTradeTypeBadge(trades[carouselIndex].trade_type);
                  return (
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${badge.className}`}>
                      {badge.text}
                    </span>
                  );
                })()}
              </div>
              <button 
                onClick={() => setIsCarouselOpen(false)}
                className="p-1.5 bg-slate-900 hover:bg-slate-850 text-slate-400 hover:text-white rounded-lg border border-slate-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-0">
              
              {/* Left Column: Image/Chart Visual */}
              <div className="flex flex-col bg-slate-950 rounded-2xl border border-slate-850 p-4 min-h-[350px] lg:h-full justify-between relative overflow-hidden group">
                <div className="flex-1 flex items-center justify-center relative min-h-0">
                  {(() => {
                    const carouselTrade = trades[carouselIndex];
                    let carouselImages = [];
                    if (carouselTrade.image_url) {
                      try {
                        const parsed = JSON.parse(carouselTrade.image_url);
                        carouselImages = Array.isArray(parsed) ? parsed : [carouselTrade.image_url];
                      } catch (e) {
                        carouselImages = [carouselTrade.image_url];
                      }
                    }

                    if (carouselImages.length === 0) {
                      return (
                        <div className="text-center space-y-4 py-12 flex flex-col items-center justify-center h-full">
                          <Image className="w-12 h-12 text-slate-700 mx-auto" />
                          <p className="text-slate-500 text-xs font-medium">{t('noChartImageForTrade')}</p>
                          <label className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 border border-slate-850 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-bold rounded-xl cursor-pointer transition">
                            <Plus className="w-4 h-4 text-emerald-400" /> Tải lên biểu đồ (Tối đa 5)
                            <input 
                              type="file" 
                              accept="image/*" 
                              multiple 
                              onChange={(e) => handleCarouselImageUpload(e, carouselTrade)} 
                              className="hidden" 
                            />
                          </label>
                        </div>
                      );
                    }

                    const activeImg = carouselImages[carouselImageIndex] || carouselImages[0];

                    return (
                      <>
                        <img 
                          src={activeImg} 
                          alt={`Trade Chart ${carouselImageIndex + 1}`} 
                          onError={(e) => {
                            e.target.style.display = 'none';
                            if (e.target.nextElementSibling) e.target.nextElementSibling.style.display = 'flex';
                          }}
                          className="max-h-[46vh] object-contain rounded-lg mx-auto select-none pointer-events-none"
                        />
                        <div className="absolute inset-0 hidden items-center justify-center text-slate-400 dark:text-slate-600 pointer-events-none bg-slate-100 dark:bg-slate-900 rounded-lg max-h-[46vh]">
                           <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-16 h-16 opacity-50"><line x1="3" y1="3" x2="21" y2="21"/><path d="M15 15l2.121-2.121A4 4 0 0 0 11.414 7.17L9 9.586"/><path d="m3 16 5-5"/><path d="M4 22h14c0-1.1.9-2 2-2"/><path d="M22 18V4a2 2 0 0 0-2-2H8"/><circle cx="9" cy="9" r="2"/></svg>
                        </div>
                        
                        <div 
                          onClick={() => {
                            setZoomImages(carouselImages);
                            setZoomImageIndex(carouselImageIndex);
                          }}
                          className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition cursor-zoom-in z-20"
                        >
                          <div 
                            className="absolute top-3 right-3 p-2 rounded-lg border border-slate-700 shadow-xl" 
                            style={{ backgroundColor: 'rgba(15,23,42,0.85)', color: '#ffffff' }}
                          >
                            <Maximize2 className="w-4 h-4" />
                          </div>
                        </div>

                        {/* Image navigation arrows overlay */}
                        {carouselImages.length > 1 && (
                          <>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setCarouselImageIndex(idx => (idx === 0 ? carouselImages.length - 1 : idx - 1));
                              }}
                              className="absolute left-2 p-2 bg-slate-950/80 hover:bg-slate-900 border border-slate-800 text-white rounded-full transition shadow-lg z-10 cursor-pointer"
                            >
                              <ChevronLeft className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setCarouselImageIndex(idx => (idx === carouselImages.length - 1 ? 0 : idx + 1));
                              }}
                              className="absolute right-2 p-2 bg-slate-950/80 hover:bg-slate-900 border border-slate-800 text-white rounded-full transition shadow-lg z-10 cursor-pointer"
                            >
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </>
                    );
                  })()}
                </div>

                {/* Gallery indicator thumbnails at bottom */}
                {(() => {
                  const carouselTrade = trades[carouselIndex];
                  let carouselImages = [];
                  if (carouselTrade.image_url) {
                    try {
                      const parsed = JSON.parse(carouselTrade.image_url);
                      carouselImages = Array.isArray(parsed) ? parsed : [carouselTrade.image_url];
                    } catch (e) {
                      carouselImages = [carouselTrade.image_url];
                    }
                  }

                  if (carouselImages.length === 0) return null;

                  return (
                    <div className="mt-3 flex justify-center items-center gap-1.5 overflow-x-auto py-1">
                      {carouselImages.map((imgUrl, imgIdx) => (
                        <button
                          key={imgIdx}
                          type="button"
                          onClick={() => setCarouselImageIndex(imgIdx)}
                          className={`relative w-12 aspect-video rounded-md overflow-hidden border transition shrink-0 ${
                            carouselImageIndex === imgIdx 
                              ? 'border-emerald-500 ring-1 ring-emerald-500 scale-105' 
                              : 'border-slate-800 opacity-60 hover:opacity-100'
                          }`}
                        >
                          <img src={imgUrl} onError={(e) => { e.target.style.display = 'none'; if (e.target.nextElementSibling) e.target.nextElementSibling.style.display = 'flex'; }} className="w-full h-full object-cover select-none pointer-events-none" alt="Thumb" />
                        <div className="absolute inset-0 hidden items-center justify-center text-slate-400 dark:text-slate-600 pointer-events-none bg-slate-100 dark:bg-slate-900">
                           <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 opacity-50"><line x1="3" y1="3" x2="21" y2="21"/><path d="M15 15l2.121-2.121A4 4 0 0 0 11.414 7.17L9 9.586"/><path d="m3 16 5-5"/><path d="M4 22h14c0-1.1.9-2 2-2"/><path d="M22 18V4a2 2 0 0 0-2-2H8"/><circle cx="9" cy="9" r="2"/></svg>
                        </div>
                        </button>
                      ))}
                      
                      {carouselImages.length < 5 && (
                        <label className="relative w-12 aspect-video rounded-md border border-dashed border-slate-800 hover:border-slate-700 bg-slate-900/40 hover:bg-slate-900/80 flex items-center justify-center cursor-pointer transition shrink-0">
                          <Plus className="w-4 h-4 text-slate-500 hover:text-slate-350" />
                          <input 
                            type="file" 
                            accept="image/*" 
                            multiple 
                            onChange={(e) => handleCarouselImageUpload(e, carouselTrade)} 
                            className="hidden" 
                          />
                        </label>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Right Column: Trade Details & AI Evaluation */}
              <div className="space-y-4 flex flex-col justify-between overflow-y-auto lg:h-full pr-1">
                
                {/* Meta details */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <div>
                      <h2 className="text-xl font-bold text-white">{trades[carouselIndex].asset}</h2>
                      <span className="text-xs text-slate-500 font-mono">
                        {trades[carouselIndex].trade_time || 'N/A'}
                        {trades[carouselIndex].exit_time && ` → ${trades[carouselIndex].exit_time}`}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className={`font-mono font-bold text-lg ${
                        trades[carouselIndex].status === 'WIN' 
                          ? 'text-emerald-400' 
                          : trades[carouselIndex].status === 'LOSS' 
                            ? 'text-rose-400' 
                            : 'text-slate-400'
                      }`}>
                        {trades[carouselIndex].status === 'WIN' ? '+' : ''}{trades[carouselIndex].pnl.toLocaleString()} USD
                      </span>
                      <p className="text-[10px] text-slate-500 font-mono uppercase">Setup: {trades[carouselIndex].setup_tag}</p>
                    </div>
                  </div>

                  {/* Quantitative Stats */}
                  <div className="grid grid-cols-4 gap-2 bg-slate-950/50 p-3 rounded-xl border border-slate-850 font-mono text-center">
                    <div>
                      <span className="text-slate-500 block text-[9px] uppercase font-sans">{t('entryPriceLabel')}</span>
                      <span className="text-white text-xs font-semibold">{trades[carouselIndex].entry_price}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[9px] uppercase font-sans">{t('exitPriceLabel')}</span>
                      <span className="text-white text-xs font-semibold">{trades[carouselIndex].exit_price}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[9px] uppercase font-sans">{t('stopLoss')}</span>
                      <span className="text-slate-400 text-xs font-semibold">{trades[carouselIndex].stop_loss || '-'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[9px] uppercase font-sans">Volume</span>
                      <span className="text-slate-400 text-xs font-semibold">{trades[carouselIndex].size}</span>
                    </div>
                  </div>

                  {/* User Notes */}
                  {trades[carouselIndex].user_notes && (
                    <div className="space-y-1">
                      <span className="text-slate-400 font-semibold block uppercase text-[9px]">{t('contextNotesLabel')}</span>
                      <p className="text-slate-300 leading-relaxed bg-slate-950/20 p-3 rounded-xl border border-slate-850 text-xs max-h-36 overflow-y-auto whitespace-pre-line text-slate-300">
                        {trades[carouselIndex].user_notes}
                      </p>
                    </div>
                  )}
                </div>

                {/* AI Review */}
                {trades[carouselIndex].ai_evaluation && (
                  <div className="border-t border-slate-850 pt-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-emerald-400 font-bold uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 animate-pulse" /> Phân tích AI Coach
                      </span>
                      <span className="text-slate-400 text-[10px] font-semibold bg-slate-950 px-2 py-0.5 rounded border border-slate-850 font-mono">
                        Điểm: {trades[carouselIndex].ai_evaluation.decision_rating}/10
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
                      <div className="bg-emerald-500/5 border border-emerald-500/10 p-2.5 rounded-lg">
                        <span className="text-emerald-400 font-semibold block text-[10px] mb-1">{t('strengthsLabel')}</span>
                        <ul className="list-disc list-inside space-y-0.5 text-slate-350">
                          {trades[carouselIndex].ai_evaluation.strengths?.map((s, i) => <li key={i}>{s}</li>)}
                        </ul>
                      </div>
                      <div className="bg-rose-500/5 border border-rose-500/10 p-2.5 rounded-lg">
                        <span className="text-rose-400 font-semibold block text-[10px] mb-1">{t('weaknessesLabel')}</span>
                        <ul className="list-disc list-inside space-y-0.5 text-slate-355 text-slate-300">
                          {trades[carouselIndex].ai_evaluation.weaknesses?.map((w, i) => <li key={i}>{w}</li>)}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

              </div>
            </div>

            {/* Navigation Footer */}
            <div className="px-6 py-4 border-t border-slate-800/80 bg-slate-950 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setCarouselIndex(Math.max(0, carouselIndex - 1))}
                disabled={carouselIndex === 0}
                className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 border border-slate-800 hover:bg-slate-850 hover:text-white rounded-xl text-slate-300 disabled:opacity-30 disabled:pointer-events-none transition font-semibold text-xs cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" /> {t('prevTrade')}
              </button>
              
              <span className="text-slate-400 font-bold text-xs">
                {carouselIndex + 1} / {trades.length}
              </span>

              <button
                type="button"
                onClick={() => setCarouselIndex(Math.min(trades.length - 1, carouselIndex + 1))}
                disabled={carouselIndex === trades.length - 1}
                className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 border border-slate-800 hover:bg-slate-850 hover:text-white rounded-xl text-slate-300 disabled:opacity-30 disabled:pointer-events-none transition font-semibold text-xs cursor-pointer"
              >
                {t('nextTrade')} <ChevronRight className="w-4 h-4" />
              </button>
            </div>

          </div>
        </div>
      )}

    </>
  );
}
