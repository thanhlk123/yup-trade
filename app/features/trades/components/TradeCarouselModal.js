'use client';

import { useState, useRef } from 'react';
import { Plus, X, ChevronLeft, ChevronRight, Image as ImageIcon, Maximize2, Sparkles, Target, Brain, BookOpen, Calendar, Wand2, Upload, Link } from 'lucide-react';
import { useLanguageStore } from '@/app/core/i18n/store';
import { useThemeStore } from '@/app/core/theme/store';
import { useDashboardStore } from '@/app/features/dashboard/store/dashboardStore';
import { getTradeTypeBadge } from '@/lib/tradeUtils';
import { parseImageUrls } from '@/lib/imageUtils';
import HiddenChartGenerator from './HiddenChartGenerator';

export default function TradeCarouselModal() {
  const t = useLanguageStore(state => state.t);
  const theme = useThemeStore(state => state.theme);
  const themeStyles = useThemeStore(state => state.themeStyles);
  const isDark = theme === 'dark';
  const trades = useDashboardStore(state => state.trades) || [];
  const activeTab = useDashboardStore(state => state.activeTab);
  const fetchDashboardData = useDashboardStore(state => state.fetchDashboardData);
  
  const isCarouselOpen = useDashboardStore(state => state.isCarouselOpen);
  const setIsCarouselOpen = useDashboardStore(state => state.setIsCarouselOpen);
  const carouselIndex = useDashboardStore(state => state.carouselIndex);
  const setCarouselIndex = useDashboardStore(state => state.setCarouselIndex);
  
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [tradeToGenerateImage, setTradeToGenerateImage] = useState(null);
  const hasTriggeredGenRef = useRef(false);
  const [isAddingUrl, setIsAddingUrl] = useState(false);
  const [imageUrlInput, setImageUrlInput] = useState('');

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



  
  const triggerLocalImageGeneration = async (trade) => {
    if (hasTriggeredGenRef.current || tradeToGenerateImage) return;
    let existingImages = parseImageUrls(trade.image_url);
    if (existingImages.length >= 10) {
      alert('Đã đạt giới hạn tối đa 10 ảnh. Vui lòng xoá bớt ảnh trước khi tạo thêm.');
      return;
    }
    hasTriggeredGenRef.current = true;
    setIsGeneratingImage(true);
    setTradeToGenerateImage(trade);
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


  
  const getTagStyle = (label) => {
    if (label === 'Xu hướng' || label === 'Vào lệnh') return "text-blue-700 dark:text-blue-300 bg-blue-100/40 dark:bg-blue-500/10 border border-blue-200/30 dark:border-blue-500/20";
    if (label === 'Chất lượng' || label === 'Kế hoạch Risk') return "text-emerald-700 dark:text-emerald-300 bg-emerald-100/40 dark:bg-emerald-500/10 border border-emerald-200/30 dark:border-emerald-500/20";
    if (label === 'Quản lý' || label === 'Lý do chốt') return "text-violet-700 dark:text-violet-300 bg-violet-100/40 dark:bg-violet-500/10 border border-violet-200/30 dark:border-violet-500/20";
    if (label === 'Tâm lý') return "text-amber-700 dark:text-amber-300 bg-amber-100/40 dark:bg-amber-500/10 border border-amber-200/30 dark:border-amber-500/20";
    if (label === 'Lỗi sai') return "text-rose-700 dark:text-rose-300 bg-rose-100/40 dark:bg-rose-500/10 border border-rose-200/30 dark:border-rose-500/20";
    return "text-slate-700 dark:text-slate-300 bg-slate-100/50 dark:bg-slate-800/50 border border-slate-200/40 dark:border-slate-700/50";
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
        <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in ${isDark ? 'bg-slate-950/90' : 'bg-slate-900/60'} backdrop-blur-md`}>
          <div className={`relative w-full max-w-6xl h-[85vh] rounded-3xl overflow-hidden flex flex-col shadow-2xl animate-scale-in border ${themeStyles.card} ${themeStyles.border}`}>
            
            {/* Header */}
            <div className={`px-6 py-4 border-b flex items-center justify-between ${themeStyles.border} ${isDark ? 'bg-[#131722]' : 'bg-slate-50'}`}>
              <div className="flex items-center gap-3">
                <span className={`font-bold text-sm sm:text-base ${themeStyles.titleText}`}>
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
              <button onClick={() => setIsCarouselOpen(false)} className={`p-1.5 rounded-lg border transition cursor-pointer ${themeStyles.innerCard} ${themeStyles.border} ${themeStyles.titleText} hover:opacity-80`}>
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 overflow-y-auto lg:overflow-hidden p-6 grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-0">
              
              {/* Left Column: Image/Chart Visual */}
              <div className={`flex flex-col rounded-2xl border p-4 min-h-[350px] lg:h-full justify-between relative overflow-hidden group ${themeStyles.innerCard} ${themeStyles.border}`}>
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
                        <div className="flex flex-col items-center justify-center p-6 text-center space-y-6 w-full h-full">
                          {isGeneratingImage ? (
                            <div className="flex flex-col items-center justify-center space-y-6">
                              <div className="relative flex items-center justify-center h-24 w-24">
                                <div className="absolute w-full h-full bg-emerald-500/20 rounded-full animate-ping" />
                                <div className="absolute w-16 h-16 bg-emerald-500/40 rounded-full animate-pulse" />
                                <Wand2 className="w-8 h-8 text-emerald-500 animate-bounce relative z-10" />
                              </div>
                              <div className="space-y-1 text-center">
                                <p className={`text-lg font-black tracking-tight ${themeStyles.titleText}`}>
                                  AI đang vẽ biểu đồ...
                                </p>
                                <p className={`text-sm font-medium ${themeStyles.subtext} flex items-center justify-center`}>
                                  Chờ một chút nhé...
                                </p>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="relative">
                                <div className="absolute inset-0 blur-2xl bg-emerald-500/10 rounded-full animate-pulse" />
                                <div className={`relative p-5 rounded-3xl border-2 ${themeStyles.innerCard} ${themeStyles.border} ${themeStyles.subtext}`}>
                                  <ImageIcon className="w-12 h-12" />
                                </div>
                              </div>
                              <div className="space-y-1">
                                <p className={`text-lg font-black tracking-tight ${themeStyles.titleText}`}>
                                  {carouselImages.length === 0 ? 'Chưa có ảnh đính kèm' : 'Thêm ảnh đính kèm'}
                                </p>
                                <p className={`text-sm font-medium ${themeStyles.subtext}`}>
                                  {carouselImages.length === 0 ? 'Hệ thống có thể tự động dựng biểu đồ' : `Đã thêm ${carouselImages.length}/10 ảnh`}
                                </p>
                              </div>
                              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 flex-wrap">
                                <button 
                                  onClick={() => triggerLocalImageGeneration(carouselTrade)}
                                  className="flex items-center space-x-2 px-4 py-2 text-sm bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl font-black border-2 border-emerald-600 shadow-sm transition-all active:scale-95 group"
                                >
                                  <Wand2 className="w-4 h-4 group-hover:animate-bounce" />
                                  <span>Tạo ảnh ngay</span>
                                  <Sparkles className="w-3 h-3 text-yellow-300 animate-pulse" />
                                </button>
                                
                                <label className={`relative flex items-center space-x-2 px-4 py-2 text-sm rounded-xl font-black border transition-all shadow-sm cursor-pointer active:scale-95 group ${themeStyles.innerCard} ${themeStyles.border} ${themeStyles.titleText} hover:opacity-80`}>
                                  <Upload className="w-4 h-4 group-hover:-translate-y-0.5 transition-transform" />
                                  <span>Tải ảnh lên</span>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    onChange={(e) => handleCarouselImageUpload(e, carouselTrade)}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                  />
                                </label>
                                
                                <button
                                  type="button"
                                  onClick={() => setIsAddingUrl(!isAddingUrl)}
                                  className={`relative flex items-center justify-center px-4 py-2 text-sm rounded-xl font-black border transition-all shadow-sm active:scale-95 group ${themeStyles.innerCard} ${themeStyles.border} ${themeStyles.titleText} hover:opacity-80`}
                                  title="Thêm ảnh từ URL"
                                >
                                  <Link className="w-4 h-4 mr-1.5 group-hover:-translate-y-0.5 transition-transform" />
                                  <span>Link URL</span>
                                </button>
                              </div>

                              {isAddingUrl && (
                                <div className="w-full max-w-sm mx-auto mt-4 flex gap-2">
                                  <input
                                    type="text"
                                    value={imageUrlInput}
                                    onChange={(e) => setImageUrlInput(e.target.value)}
                                    placeholder="Nhập URL ảnh (https://...)"
                                    className={`flex-1 px-4 py-2 rounded-xl border outline-none font-medium text-sm ${themeStyles.innerCard} ${themeStyles.border} ${themeStyles.titleText} focus:border-emerald-500`}
                                  />
                                  <button
                                    onClick={async () => {
                                      if (!imageUrlInput.trim()) return;
                                      if (carouselImages.length >= 10) {
                                        alert('Đã đạt giới hạn tối đa 10 ảnh.');
                                        return;
                                      }
                                      const newImages = [...carouselImages, imageUrlInput.trim()];
                                      try {
                                        const response = await fetch('/api/trades', {
                                          method: 'PUT',
                                          headers: { 'Content-Type': 'application/json' },
                                          body: JSON.stringify({
                                            ...carouselTrade,
                                            image_url: JSON.stringify(newImages)
                                          })
                                        });
                                        if (response.ok) {
                                          await fetchDashboardData(activeTab);
                                          setCarouselImageIndex(newImages.length - 1);
                                          setImageUrlInput('');
                                          setIsAddingUrl(false);
                                        }
                                      } catch(e) {
                                        console.error(e);
                                      }
                                    }}
                                    className="px-4 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-bold transition-colors"
                                  >
                                    Thêm
                                  </button>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      );
                    }

                    
                    const isAddMoreSlide = carouselImageIndex >= carouselImages.length;
                    
                    if (isAddMoreSlide) {
                      return (
                        <div className="flex flex-col items-center justify-center p-6 text-center space-y-6 w-full h-full relative z-10">
                          {isGeneratingImage ? (
                            <div className="flex flex-col items-center justify-center space-y-6">
                              <div className="relative flex items-center justify-center h-24 w-24">
                                <div className="absolute w-full h-full bg-emerald-500/20 rounded-full animate-ping" />
                                <div className="absolute w-16 h-16 bg-emerald-500/40 rounded-full animate-pulse" />
                                <Wand2 className="w-8 h-8 text-emerald-500 animate-bounce relative z-10" />
                              </div>
                              <div className="space-y-1 text-center">
                                <p className={`text-lg font-black tracking-tight ${themeStyles.titleText}`}>
                                  AI đang vẽ biểu đồ...
                                </p>
                                <p className={`text-sm font-medium ${themeStyles.subtext} flex items-center justify-center`}>
                                  Chờ một chút nhé...
                                </p>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="relative">
                                <div className="absolute inset-0 blur-2xl bg-emerald-500/10 rounded-full animate-pulse" />
                                <div className={`relative p-5 rounded-3xl border-2 ${themeStyles.innerCard} ${themeStyles.border} ${themeStyles.subtext}`}>
                                  <ImageIcon className="w-12 h-12" />
                                </div>
                              </div>
                              <div className="space-y-1">
                                <p className={`text-lg font-black tracking-tight ${themeStyles.titleText}`}>
                                  Thêm ảnh đính kèm
                                </p>
                                <p className={`text-sm font-medium ${themeStyles.subtext}`}>
                                  Đã thêm {carouselImages.length}/10 ảnh
                                </p>
                              </div>
                              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 flex-wrap">
                                <button 
                                  onClick={() => triggerLocalImageGeneration(carouselTrade)}
                                  className="flex items-center space-x-2 px-4 py-2 text-sm bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl font-black border-2 border-emerald-600 shadow-sm transition-all active:scale-95 group"
                                >
                                  <Wand2 className="w-4 h-4 group-hover:animate-bounce" />
                                  <span>Tạo ảnh ngay</span>
                                  <Sparkles className="w-3 h-3 text-yellow-300 animate-pulse" />
                                </button>
                                
                                <label className={`relative flex items-center space-x-2 px-4 py-2 text-sm rounded-xl font-black border transition-all shadow-sm cursor-pointer active:scale-95 group ${themeStyles.innerCard} ${themeStyles.border} ${themeStyles.titleText} hover:opacity-80`}>
                                  <Upload className="w-4 h-4 group-hover:-translate-y-0.5 transition-transform" />
                                  <span>Tải ảnh lên</span>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    onChange={(e) => handleCarouselImageUpload(e, carouselTrade)}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                  />
                                </label>
                                
                                <button
                                  type="button"
                                  onClick={() => setIsAddingUrl(!isAddingUrl)}
                                  className={`relative flex items-center justify-center px-4 py-2 text-sm rounded-xl font-black border transition-all shadow-sm active:scale-95 group ${themeStyles.innerCard} ${themeStyles.border} ${themeStyles.titleText} hover:opacity-80`}
                                  title="Thêm ảnh từ URL"
                                >
                                  <Link className="w-4 h-4 mr-1.5 group-hover:-translate-y-0.5 transition-transform" />
                                  <span>Link URL</span>
                                </button>
                              </div>

                              {isAddingUrl && (
                                <div className="w-full max-w-sm mx-auto mt-4 flex gap-2">
                                  <input
                                    type="text"
                                    value={imageUrlInput}
                                    onChange={(e) => setImageUrlInput(e.target.value)}
                                    placeholder="Nhập URL ảnh (https://...)"
                                    className={`flex-1 px-4 py-2 rounded-xl border outline-none font-medium text-sm ${themeStyles.innerCard} ${themeStyles.border} ${themeStyles.titleText} focus:border-emerald-500`}
                                  />
                                  <button
                                    onClick={async () => {
                                      if (!imageUrlInput.trim()) return;
                                      if (carouselImages.length >= 10) {
                                        alert('Đã đạt giới hạn tối đa 10 ảnh.');
                                        return;
                                      }
                                      const newImages = [...carouselImages, imageUrlInput.trim()];
                                      try {
                                        const response = await fetch('/api/trades', {
                                          method: 'PUT',
                                          headers: { 'Content-Type': 'application/json' },
                                          body: JSON.stringify({
                                            ...carouselTrade,
                                            image_url: JSON.stringify(newImages)
                                          })
                                        });
                                        if (response.ok) {
                                          await fetchDashboardData(activeTab);
                                          setCarouselImageIndex(newImages.length - 1);
                                          setImageUrlInput('');
                                          setIsAddingUrl(false);
                                        }
                                      } catch(e) {
                                        console.error(e);
                                      }
                                    }}
                                    className="px-4 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-bold transition-colors"
                                  >
                                    Thêm
                                  </button>
                                </div>
                              )}
                            </>
                          )}

                          {/* Image navigation arrows overlay for the uploader slide */}
                          <>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setCarouselImageIndex(idx => (idx === 0 ? carouselImages.length : idx - 1));
                              }}
                              className="absolute left-2 p-2 bg-slate-950/80 hover:bg-slate-900 border border-slate-800 text-white rounded-full transition shadow-lg z-10 cursor-pointer"
                            >
                              <ChevronLeft className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setCarouselImageIndex(idx => (idx === carouselImages.length ? 0 : idx + 1));
                              }}
                              className="absolute right-2 p-2 bg-slate-950/80 hover:bg-slate-900 border border-slate-800 text-white rounded-full transition shadow-lg z-10 cursor-pointer"
                            >
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          </>
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
                        <div className={`absolute inset-0 hidden items-center justify-center text-slate-400 dark:text-slate-600 pointer-events-none rounded-lg max-h-[46vh] ${isDark ? 'bg-slate-900' : 'bg-slate-100'}`}>
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
                            className={`absolute top-3 right-3 p-2 rounded-lg border shadow-xl ${isDark ? 'bg-slate-900/85 border-slate-700 text-white' : 'bg-white/85 border-slate-300 text-slate-700'}`}>
                            <Maximize2 className="w-4 h-4" />
                          </div>
                        </div>

                        {/* Image navigation arrows overlay */}
                        <>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCarouselImageIndex(idx => (idx === 0 ? carouselImages.length : idx - 1));
                            }}
                            className="absolute left-2 p-2 bg-slate-950/80 hover:bg-slate-900 border border-slate-800 text-white rounded-full transition shadow-lg z-10 cursor-pointer"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCarouselImageIndex(idx => (idx === carouselImages.length ? 0 : idx + 1));
                            }}
                            className="absolute right-2 p-2 bg-slate-950/80 hover:bg-slate-900 border border-slate-800 text-white rounded-full transition shadow-lg z-10 cursor-pointer"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </>
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
                        <div className={`absolute inset-0 hidden items-center justify-center text-slate-400 dark:text-slate-600 pointer-events-none ${isDark ? 'bg-slate-900' : 'bg-slate-100'}`}>
                           <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 opacity-50"><line x1="3" y1="3" x2="21" y2="21"/><path d="M15 15l2.121-2.121A4 4 0 0 0 11.414 7.17L9 9.586"/><path d="m3 16 5-5"/><path d="M4 22h14c0-1.1.9-2 2-2"/><path d="M22 18V4a2 2 0 0 0-2-2H8"/><circle cx="9" cy="9" r="2"/></svg>
                        </div>
                        </button>
                      ))}
                      
                      
                      {carouselImages.length < 10 && (
                        <button
                          type="button"
                          onClick={() => setCarouselImageIndex(carouselImages.length)}
                          className={`relative w-12 aspect-video rounded-md border transition shrink-0 flex items-center justify-center ${
                            carouselImageIndex >= carouselImages.length 
                              ? 'border-emerald-500 ring-1 ring-emerald-500 scale-105 bg-emerald-500/10' 
                              : 'border-slate-800 border-dashed opacity-60 hover:opacity-100 dark:bg-slate-900/40'
                          }`}
                        >
                          <Plus className={`w-4 h-4 ${carouselImageIndex >= carouselImages.length ? 'text-emerald-500' : 'text-slate-500 dark:text-slate-400'}`} />
                        </button>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Right Column: Trade Details & AI Evaluation */}
              <div className="space-y-4 overflow-y-auto lg:h-full pr-2 animate-fade-in custom-scrollbar pb-6">
                
                {/* Meta details */}
                <div className="space-y-3 pt-2">
                  <div className={`flex items-center justify-between border-b pb-3 ${themeStyles.border}`}>
                    <div>
                      <h2 className={`text-2xl font-black ${themeStyles.titleText}`}>{trades[carouselIndex].asset}</h2>
                      <span className={`text-xs font-mono font-medium opacity-80 ${themeStyles.subtext}`}>
                        {trades[carouselIndex].trade_time || 'N/A'}
                        {trades[carouselIndex].exit_time && ` → ${trades[carouselIndex].exit_time}`}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className={`font-mono font-black text-xl ${
                        trades[carouselIndex].status === 'WIN' 
                          ? 'text-emerald-500' 
                          : trades[carouselIndex].status === 'LOSS' 
                            ? 'text-rose-500' 
                            : themeStyles.subtext.split(' ')[0]
                      }`}>
                        {trades[carouselIndex].status === 'WIN' ? '+' : ''}{trades[carouselIndex].pnl.toLocaleString()} USD
                      </span>
                      <p className={`text-[10px] font-mono font-bold uppercase mt-1 ${themeStyles.subtext}`}>Setup: {trades[carouselIndex].setup_tag}</p>
                    </div>
                  </div>
                </div>

                
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 rounded-xl bg-slate-50/70 dark:bg-slate-800/30 font-mono">
                                <div>
                                  <span className={`block text-[9px] uppercase font-sans ${themeStyles.subtext}`}>Giá vào:</span>
                                  <span className={`text-xs font-semibold ${themeStyles.titleText}`}>{trades[carouselIndex].entry_price}</span>
                                </div>
                                <div>
                                  <span className={`block text-[9px] uppercase font-sans ${themeStyles.subtext}`}>Giá ra:</span>
                                  <span className={`text-xs font-semibold ${themeStyles.titleText}`}>{trades[carouselIndex].exit_price}</span>
                                </div>
                                <div>
                                  <span className={`block text-[9px] uppercase font-sans ${themeStyles.subtext}`}>Stop Loss:</span>
                                  <span className={`text-xs ${themeStyles.subtext}`}>{trades[carouselIndex].stop_loss || 'Không'}</span>
                                </div>
                                <div>
                                  <span className={`block text-[9px] uppercase font-sans ${themeStyles.subtext}`}>Volume:</span>
                                  <span className={`text-xs ${themeStyles.subtext}`}>{trades[carouselIndex].size}</span>
                                </div>
                              </div>

                              {/* Trade Context & Execution Tags (User Inputs) */}
                              {(() => {
                                const getTagStyle = (label) => {
                                  if (label === 'Xu hướng' || label === 'Vào lệnh') return "text-blue-700 dark:text-blue-300 bg-blue-100/40 dark:bg-blue-500/10 border border-blue-200/30 dark:border-blue-500/20";
                                  if (label === 'Chất lượng' || label === 'Kế hoạch Risk') return "text-emerald-700 dark:text-emerald-300 bg-emerald-100/40 dark:bg-emerald-500/10 border border-emerald-200/30 dark:border-emerald-500/20";
                                  if (label === 'Quản lý' || label === 'Lý do chốt') return "text-violet-700 dark:text-violet-300 bg-violet-100/40 dark:bg-violet-500/10 border border-violet-200/30 dark:border-violet-500/20";
                                  if (label === 'Tâm lý') return "text-amber-700 dark:text-amber-300 bg-amber-100/40 dark:bg-amber-500/10 border border-amber-200/30 dark:border-amber-500/20";
                                  if (label === 'Lỗi sai') return "text-rose-700 dark:text-rose-300 bg-rose-100/40 dark:bg-rose-500/10 border border-rose-200/30 dark:border-rose-500/20";
                                  return "text-slate-700 dark:text-slate-300 bg-slate-100/50 dark:bg-slate-800/50 border border-slate-200/40 dark:border-slate-700/50";
                                };

                                const allTags = [
                                  { label: 'Xu hướng', value: trades[carouselIndex].market_trend, format: (v) => v.replace('#Trend_', '').replace(/_/g, ' ') },
                                  { label: 'Khung lớn', value: trades[carouselIndex].htf_context, format: (v) => v.replace(/_/g, ' ') },
                                  { label: 'Vùng giá (POI)', value: trades[carouselIndex].poi, format: (v) => v.replace(/_/g, ' ') },
                                  { label: 'Hợp lưu', value: trades[carouselIndex].confluences, format: (v) => v.replace(/_/g, ' ') },
                                  { label: 'Kế hoạch Risk', value: trades[carouselIndex].risk_plan, format: (v) => v.replace(/_/g, ' ') },
                                  { label: 'Vào lệnh', value: trades[carouselIndex].entry_trigger, format: (v) => v.replace('#Trigger_', '').replace(/_/g, ' ') },
                                  { label: 'Chất lượng', value: trades[carouselIndex].execution_quality, format: (v) => v.replace('#Exec_', '').replace(/_/g, ' ') },
                                  { label: 'Quản lý', value: trades[carouselIndex].trade_management, format: (v) => v.replace('#Mgmt_', '').replace(/_/g, ' ') },
                                  { label: 'Lý do chốt', value: trades[carouselIndex].exit_reason, format: (v) => v.replace(/_/g, ' ') },
                                  { label: 'Tâm lý', value: trades[carouselIndex].emotions, format: (v) => v.replace(/_/g, ' ') },
                                  { label: 'Lỗi sai', value: trades[carouselIndex].mistakes, format: (v) => v.replace(/_/g, ' ') }
                                ].filter(t => t.value);

                                if (allTags.length === 0) return null;

                                return (
                                  <details className="group/profile rounded-xl border border-indigo-100/40 dark:border-indigo-500/10 bg-indigo-50/20 dark:bg-indigo-900/10 transition-all duration-300 overflow-hidden">
                                    <summary className="flex justify-between items-center cursor-pointer list-none text-[10px] text-indigo-700/70 dark:text-indigo-300/80 uppercase tracking-widest font-bold hover:text-indigo-800 hover:bg-indigo-50/40 dark:hover:text-indigo-200 transition-colors p-3 px-4">
                                      <div className="flex items-center gap-2">
                                        <Target className="w-3.5 h-3.5 opacity-80 text-indigo-500" /> 
                                        Hồ sơ giao dịch
                                      </div>
                                      <div className="flex items-center gap-1 font-semibold text-[9px]">
                                        <span className="group-open/profile:hidden opacity-70">CHI TIẾT →</span>
                                        <span className="hidden group-open/profile:inline opacity-70">THU GỌN</span>
                                      </div>
                                    </summary>
                                    
                                    <div className="p-3 border-t border-indigo-100/40 dark:border-indigo-500/10 bg-white/30 dark:bg-slate-950/20">
                                      <div className="flex flex-wrap gap-2.5">
                                        {allTags.map((t, i) => (
                                          <div key={`tag-${i}`} className="flex items-center gap-1.5 bg-white/70 dark:bg-slate-900/60 px-2.5 py-1.5 rounded-lg border border-slate-200/60 dark:border-slate-700/50 shadow-sm">
                                            <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">{t.label}:</span>
                                            <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${getTagStyle(t.label)}`}>
                                              {t.format ? t.format(t.value) : t.value}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  </details>
                                );
                              })()}

                              {/* Ghi chú bối cảnh */}
                              {trades[carouselIndex].user_notes && (
                                <div className="space-y-1.5 pt-1">
                                  <div className="flex items-center gap-1.5 font-bold text-slate-500 dark:text-slate-400 uppercase text-[10px] tracking-widest px-1">
                                    <BookOpen className="w-3.5 h-3.5 opacity-70" /> Ghi chú
                                  </div>
                                  <p className={`leading-relaxed p-3 rounded-xl border border-slate-200/60 dark:border-slate-700/50 text-sm whitespace-pre-wrap bg-white/50 dark:bg-slate-900/30 ${themeStyles.titleText}`}>
                                    {trades[carouselIndex].user_notes}
                                  </p>
                                </div>
                              )}

                              

                                  {trades[carouselIndex].ai_evaluation && (
                                    <div className={`space-y-3 border-t ${themeStyles.border} pt-4 mt-2`}>
                                      <div className={`p-4 sm:p-5 rounded-2xl bg-white/40 dark:bg-slate-900/40 relative overflow-hidden group border border-slate-200/40 dark:border-white/5`}>
                                        <div className={`absolute inset-0 bg-gradient-to-br to-transparent pointer-events-none ${
                                          trades[carouselIndex].ai_evaluation.coach_title?.includes('RISK') ? 'from-rose-500/5' :
                                          trades[carouselIndex].ai_evaluation.coach_title?.includes('GOOD') ? 'from-emerald-500/5' :
                                          'from-amber-500/5'
                                        }`} />
                                        
                                        <div className="relative z-10">
                                          {trades[carouselIndex].ai_evaluation.coach_verdict ? (
                                            <>
                                              <div className="flex items-center gap-1.5 font-bold tracking-wider text-[11px] uppercase mb-3.5">
                                                <Brain className={`w-4 h-4 opacity-80 ${
                                                  trades[carouselIndex].ai_evaluation.coach_title?.includes('RISK') ? 'text-rose-500' :
                                                  trades[carouselIndex].ai_evaluation.coach_title?.includes('GOOD') ? 'text-emerald-500' :
                                                  'text-amber-500'
                                                }`} />
                                                <span className={`${
                                                  trades[carouselIndex].ai_evaluation.coach_title?.includes('RISK') ? 'text-rose-600 dark:text-rose-400' :
                                                  trades[carouselIndex].ai_evaluation.coach_title?.includes('GOOD') ? 'text-emerald-600 dark:text-emerald-400' :
                                                  'text-amber-600 dark:text-amber-400'
                                                }`}>AI Coach</span>
                                              </div>
                                              <div className="text-[13px] leading-relaxed text-slate-700 dark:text-slate-300 space-y-2.5">
                                                <p className="font-semibold text-[14px] text-slate-900 dark:text-slate-100">{trades[carouselIndex].ai_evaluation.coach_verdict}</p>
                                                {trades[carouselIndex].ai_evaluation.coach_why && <p className="text-slate-600 dark:text-slate-400">{trades[carouselIndex].ai_evaluation.coach_why}</p>}
                                                {trades[carouselIndex].ai_evaluation.coach_action && (
                                                  <div className="pt-2 mt-2 border-t border-slate-200/50 dark:border-slate-700/50">
                                                    <p className="whitespace-pre-line font-medium text-slate-700 dark:text-slate-300">{trades[carouselIndex].ai_evaluation.coach_action}</p>
                                                  </div>
                                                )}
                                              </div>
                                            </>
                                          ) : trades[carouselIndex].ai_evaluation.coach_message ? (
                                            <div className="text-[13px] leading-relaxed whitespace-pre-wrap font-medium text-slate-700 dark:text-slate-300">
                                              <span className="font-bold text-emerald-600 dark:text-emerald-400 block mb-2 tracking-wide flex items-center gap-1.5"><Brain className="w-4 h-4 opacity-80" /> AI COACH</span>
                                              {trades[carouselIndex].ai_evaluation.coach_message}
                                            </div>
                                          ) : (
                                            <div className="text-[13px] leading-relaxed whitespace-pre-wrap font-medium text-slate-700 dark:text-slate-300">
                                              <span className="font-bold text-emerald-600 dark:text-emerald-400 block mb-2 tracking-wide flex items-center gap-1.5"><Brain className="w-4 h-4 opacity-80" /> AI COACH</span>
                                              {(trades[carouselIndex].ai_evaluation.strengths || []).map((s, i) => <span key={`s-${i}`} className="block mb-1.5"><span className="text-emerald-500 mr-1">✓</span>{s}</span>)}
                                              {(trades[carouselIndex].ai_evaluation.weaknesses || []).map((w, i) => <span key={`w-${i}`} className="block mb-1.5"><span className="text-rose-500 mr-1">✗</span>{w}</span>)}
                                              {trades[carouselIndex].ai_evaluation.advice && <span className="block mt-2 pt-2 border-t border-slate-200 dark:border-white/5 italic text-slate-600 dark:text-slate-400">{trades[carouselIndex].ai_evaluation.advice}</span>}
                                            </div>
                                          )}
                                        </div>
                                        
                                        <details className="group/details relative z-10 mt-3 pt-3 border-t border-slate-200/50 dark:border-white/5">
                                          <summary className="flex justify-between items-center cursor-pointer list-none text-[10px] text-slate-500 dark:text-slate-500 uppercase tracking-wider font-bold hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
                                            <div className="flex items-center gap-1.5">
                                              <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600"></span>
                                              AI REVIEWED TRADE DATA
                                            </div>
                                            <div className="flex items-center gap-1 text-indigo-500">
                                              <span className="group-open/details:hidden">Xem tại sao →</span>
                                              <span className="hidden group-open/details:inline">Đóng lại</span>
                                            </div>
                                          </summary>
                                          <div className="mt-3 text-xs space-y-3 font-mono text-slate-600 dark:text-slate-400 bg-white/50 dark:bg-black/20 p-3 rounded-lg border border-slate-200/50 dark:border-white/5">
                                            <div className="grid grid-cols-2 gap-4">
                                              <div>
                                                <div className="font-bold mb-1.5 text-slate-700 dark:text-slate-300 uppercase text-[9px] tracking-wider">EVIDENCE</div>
                                                <div className="space-y-1.5 text-[11px]">
                                                  <div className="flex justify-between"><span>Entry</span><span className="text-slate-900 dark:text-white font-semibold">{trades[carouselIndex].entry_price || '—'}</span></div>
                                                  <div className="flex justify-between"><span>Exit</span><span className="text-slate-900 dark:text-white font-semibold">{trades[carouselIndex].exit_price || '—'}</span></div>
                                                  <div className="flex justify-between"><span>SL</span><span className="text-slate-900 dark:text-white font-semibold">{trades[carouselIndex].stop_loss || '—'}</span></div>
                                                  <div className="flex justify-between"><span>Volume</span><span className="text-slate-900 dark:text-white font-semibold">{trades[carouselIndex].size || '—'}</span></div>
                                                  <div className="flex justify-between pt-1 border-t border-slate-200/50 dark:border-white/10 mt-1">
                                                    <span>P/L</span>
                                                    <span className={`font-bold ${trades[carouselIndex].pnl >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                                                      {trades[carouselIndex].pnl >= 0 ? '+' : ''}{trades[carouselIndex].pnl}
                                                    </span>
                                                  </div>
                                                </div>
                                              </div>
                                              <div>
                                                <div className="font-bold mb-1.5 text-slate-700 dark:text-slate-300 uppercase text-[9px] tracking-wider">WHY</div>
                                                <div className="space-y-1.5 text-[10px]">
                                                  {!trades[carouselIndex].stop_loss ? (
                                                    <>
                                                      <div className="text-rose-500 dark:text-rose-400">→ Không có SL</div>
                                                      <div className="text-rose-500 dark:text-rose-400">→ Không xác định invalidation</div>
                                                      <div className="text-rose-500 dark:text-rose-400">→ Risk trước entry không xác định</div>
                                                      <div className="text-slate-500">→ Volume {trades[carouselIndex].size || '—'} không thể đánh giá risk</div>
                                                    </>
                                                  ) : (
                                                    <>
                                                      <div className="text-emerald-500 dark:text-emerald-400">→ Có Stop Loss rõ ràng</div>
                                                      <div className="text-emerald-500 dark:text-emerald-400">→ Đã xác định điểm Invalidation</div>
                                                      <div className="text-emerald-500 dark:text-emerald-400">→ Risk/Reward có thể ước tính trước</div>
                                                    </>
                                                  )}
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        </details>
                                      </div>
                                    </div>
                                  )}

                              
              </div>
            </div>

            {/* Navigation Footer */}
            <div className={`px-6 py-4 border-t flex items-center justify-between ${themeStyles.border} ${isDark ? 'bg-[#131722]' : 'bg-slate-50'}`}>
              <button type="button" onClick={() => setCarouselIndex(Math.max(0, carouselIndex - 1))} disabled={carouselIndex === 0} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border disabled:opacity-30 disabled:pointer-events-none transition font-semibold text-xs cursor-pointer ${themeStyles.innerCard} ${themeStyles.border} ${themeStyles.titleText} hover:opacity-80`}>
                <ChevronLeft className="w-4 h-4" /> {t('prevTrade')}
              </button>
              
              <span className={`font-bold text-xs ${themeStyles.subtext}`}>
                {carouselIndex + 1} / {trades.length}
              </span>

              <button type="button" onClick={() => setCarouselIndex(Math.min(trades.length - 1, carouselIndex + 1))} disabled={carouselIndex === trades.length - 1} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border disabled:opacity-30 disabled:pointer-events-none transition font-semibold text-xs cursor-pointer ${themeStyles.innerCard} ${themeStyles.border} ${themeStyles.titleText} hover:opacity-80`}>
                {t('nextTrade')} <ChevronRight className="w-4 h-4" />
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Hidden Chart Generator for this Modal */}
      {tradeToGenerateImage && (
        <HiddenChartGenerator 
          trade={tradeToGenerateImage}
          isBackground={true}
          onComplete={async (urls, error) => {
            setIsGeneratingImage(false);
            if (urls && urls.length > 0) {
              // The HiddenChartGenerator handles getting new URLs, but we need to append them to the existing ones
              let existingImages = parseImageUrls(tradeToGenerateImage.image_url);
              const combinedUrls = [...existingImages, ...urls];
              
              // Save it to db instantly
              try {
                const response = await fetch('/api/trades', {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ ...tradeToGenerateImage, image_url: JSON.stringify(combinedUrls) })
                });
                if (response.ok) {
                  await fetchDashboardData(activeTab);
                  setCarouselImageIndex(combinedUrls.length - 1);
                }
              } catch (e) {
                console.error(e);
              }
            } else if (error) {
              console.error('Failed to generate image:', error);
            }
            setTradeToGenerateImage(null);
            hasTriggeredGenRef.current = false;
          }}
        />
      )}
    </>
  );
}
