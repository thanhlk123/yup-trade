'use client';

import { useState, useEffect, useRef } from 'react';
import { Plus, X, Pencil, ChevronLeft, ChevronRight, CheckCircle, AlertTriangle, Layers, BookOpen, Activity, Loader2, Save, Image as ImageIcon, Wand2, ArrowLeft, ArrowRight, ChevronDown, ChevronUp, Sparkles, Upload, Target, Clock, Link } from 'lucide-react';
import { useThemeStore } from '@/app/core/theme/store';
import { useDashboardStore } from '@/app/features/dashboard/store/dashboardStore';
import HiddenChartGenerator from './HiddenChartGenerator';

export default function QuickReviewModal({ zIndex = 100 }) {
  const isOpen = useDashboardStore(state => state.isQuickReviewOpen);
  const onClose = useDashboardStore(state => state.closeQuickReview);
  const trades = useDashboardStore(state => state.tradesToReview);
  const theme = useThemeStore(state => state.theme);
  const fetchDashboardData = useDashboardStore(state => state.fetchDashboardData);
  const openTradeForm = useDashboardStore(state => state.openTradeForm);
  
  const onBackToStep1 = () => {
    if (trades && trades.length > 0) {
      openTradeForm(trades[0]);
    }
    onClose();
  };

  const onSaveTrade = async (payload) => {
    const res = await fetch('/api/trades', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Failed to update trade');
    await fetchDashboardData();
  };
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAdvancedMode, setIsAdvancedMode] = useState(false);
  const [currentTradeData, setCurrentTradeData] = useState({
    market_trend: '',
    setup_tag: '',
    entry_trigger: '',
    execution_quality: '',
    trade_management: '',
    lesson: '',
    poi: '',
    htf_context: '',
    confluences: [],
    exit_reason: '',
    risk_plan: '',
    setup_grade: '',
    emotions: [],
    mistakes: []
  });
  const [isSaving, setIsSaving] = useState(false);
  const [addingNew, setAddingNew] = useState({ category: null, text: '' });
  
  // Local image generation states
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [generatedImages, setGeneratedImages] = useState([]);
  const [currentImageSlide, setCurrentImageSlide] = useState(0);
  const [tradeToGenerateImage, setTradeToGenerateImage] = useState(null);
  const hasTriggeredGenRef = useRef(false);
  
  const [isAddingUrl, setIsAddingUrl] = useState(false);
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [imgErrorState, setImgErrorState] = useState({});
  
  const [editingTag, setEditingTag] = useState(null); // { oldTag: '', category: '' }

  // Extract all tags from db
  const [dbTags, setDbTags] = useState([]);
  const [isLoadingTags, setIsLoadingTags] = useState(false);

  const trade = trades ? trades[currentIndex] : null;

  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(0);
    }
  }, [isOpen]);

  useEffect(() => {
    // Fetch tags from API
    async function fetchTags() {
      setIsLoadingTags(true);
      try {
        const res = await fetch('/api/hashtags');
        const json = await res.json();
        if (json.success) {
          setDbTags(json.data);
        }
      } catch (e) {
        console.error('Failed to fetch tags', e);
      } finally {
        setIsLoadingTags(false);
      }
    }
    fetchTags();
  }, []);

  useEffect(() => {
    if (!trade) return;
    
    // Initialize data when switching trades
    // Initialize data when switching trades
    const rawLesson = trade.user_notes || '';
    let systemNotes = null;
    let userLesson = rawLesson;
    
    if (rawLesson.includes('[Giao dịch DCA gộp từ') || rawLesson.includes('[Lệnh gộp từ')) {
      const lines = rawLesson.split('\n');
      const sysLines = [];
      const usrLines = [];
      let inSys = false;
      for (const line of lines) {
        if (line.startsWith('[Giao dịch DCA gộp từ') || line.startsWith('[Lệnh gộp từ')) {
          inSys = true;
          sysLines.push(line);
        } else if (inSys && (line.startsWith('- Lệnh #') || line.startsWith('  Ghi chú:'))) {
          sysLines.push(line);
        } else {
          inSys = false;
          if (line.trim() !== '') usrLines.push(line);
        }
      }
      systemNotes = sysLines.join('\n');
      userLesson = usrLines.join('\n').trim();
    }

    setCurrentTradeData({
      market_trend: trade.market_trend || '',
      setup_tag: trade.setup_tag === 'Unclassified' ? '' : (trade.setup_tag || ''),
      entry_trigger: trade.entry_trigger || '',
      execution_quality: trade.execution_quality || '',
      trade_management: trade.trade_management || '',
      lesson: userLesson,
      system_notes: systemNotes,
      poi: trade.poi || '',
      htf_context: trade.htf_context || '',
      confluences: trade.confluences ? JSON.parse(trade.confluences) : [],
      exit_reason: trade.exit_reason || '',
      risk_plan: trade.risk_plan || '',
      setup_grade: trade.setup_grade || '',
      emotions: trade.emotions ? JSON.parse(trade.emotions) : [],
      mistakes: trade.mistakes ? JSON.parse(trade.mistakes) : []
    });
    
    // Reset image states
    let initImages = [];
    if (trade.image_url) {
      try {
        const parsed = JSON.parse(trade.image_url);
        initImages = Array.isArray(parsed) ? parsed : [trade.image_url];
      } catch (e) {
        initImages = [trade.image_url];
      }
    }
    setGeneratedImages(initImages);
    setCurrentImageSlide(0);
    hasTriggeredGenRef.current = false;
    
  }, [currentIndex, trade]);

  const triggerLocalImageGeneration = async (t) => {
    if (generatedImages.length >= 10) {
      alert('Đã đạt giới hạn tối đa 10 ảnh. Vui lòng xoá bớt ảnh trước khi tạo thêm.');
      return;
    }
    if (hasTriggeredGenRef.current || tradeToGenerateImage) return;
    hasTriggeredGenRef.current = true;
    setIsGeneratingImage(true);
    setTradeToGenerateImage(t);
  };

  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    
    if (generatedImages.length >= 10) {
      alert('Đã đạt giới hạn tối đa 10 ảnh.');
      return;
    }
    
    let currentLength = generatedImages.length;
    let ignored = 0;
    files.forEach(file => {
      if (currentLength >= 10) {
        ignored++;
        return;
      }
      currentLength++;
      const reader = new FileReader();
      reader.onloadend = () => {
        setGeneratedImages(prev => {
          if (prev.length >= 10) return prev;
          return [...prev, reader.result];
        });
      };
      reader.readAsDataURL(file);
    });
    
    if (ignored > 0) {
      alert(`Đã đạt giới hạn 10 ảnh. Bỏ qua ${ignored} ảnh thừa.`);
    }
  };

  const handleRemoveImage = async (index) => {
    const imageUrl = generatedImages[index];
    
    // If it's an uploaded file on server, delete it
    if (imageUrl && typeof imageUrl === 'string' && imageUrl.startsWith('/uploads/charts/')) {
      try {
        await fetch('/api/upload', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: imageUrl })
        });
      } catch (e) {
        console.error('Failed to delete image file', e);
      }
    }
    
    setGeneratedImages(prev => {
      const newImages = prev.filter((_, i) => i !== index);
      if (currentImageSlide >= newImages.length) {
        setCurrentImageSlide(Math.max(0, newImages.length));
      }
      if (newImages.length === 0) {
        hasTriggeredGenRef.current = false;
      }
      return newImages;
    });
  };

  if (!isOpen || !trades || trades.length === 0 || !trade) return null;

  const isDark = theme === 'dark';
  
  const hasAsset = !!trade?.asset && trade.asset.trim() !== '';
  const hasEntry = !!trade?.entry_price && !isNaN(parseFloat(trade.entry_price));
  const hasExit = !!trade?.exit_price && !isNaN(parseFloat(trade.exit_price));
  const hasEntryTime = !!trade?.trade_time;
  const hasExitTime = !!trade?.exit_time;
  const canGenerateChart = hasAsset && hasEntry && hasExit && hasEntryTime && hasExitTime;
  
  const handleSaveAndNext = async () => {
    if (isSaving) return;
    setIsSaving(true);
    const payload = {
      id: trade.id,
      market_trend: currentTradeData.market_trend || null,
      setup_tag: currentTradeData.setup_tag || null,
      entry_trigger: currentTradeData.entry_trigger || null,
      execution_quality: currentTradeData.execution_quality || null,
      trade_management: currentTradeData.trade_management || null,
      user_notes: currentTradeData.system_notes ? `${currentTradeData.system_notes}\n\n${currentTradeData.lesson}`.trim() : currentTradeData.lesson || '',
      is_lesson: !!currentTradeData.lesson,
      poi: currentTradeData.poi || null,
      htf_context: currentTradeData.htf_context || null,
      confluences: currentTradeData.confluences.length > 0 ? JSON.stringify(currentTradeData.confluences) : null,
      exit_reason: currentTradeData.exit_reason || null,
      risk_plan: currentTradeData.risk_plan || null,
      setup_grade: currentTradeData.setup_grade || null,
      emotions: currentTradeData.emotions.length > 0 ? JSON.stringify(currentTradeData.emotions) : null,
      mistakes: currentTradeData.mistakes.length > 0 ? JSON.stringify(currentTradeData.mistakes) : null,
      image_url: generatedImages.length > 0 ? JSON.stringify(generatedImages) : trade.image_url
    };

    try {
      await onSaveTrade(payload);
      
      if (currentIndex < trades.length - 1) {
        setCurrentIndex(prev => prev + 1);
      } else {
        onClose();
      }
    } catch (error) {
      console.error('Failed to save trade:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleBack = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  const formatTagDisplay = (tagStr) => {
    if (!tagStr) return '';
    return tagStr.replace(/#(Setup|Trigger|Mgmt|Emotion|Mistake|Trend|Exec|Grade|Risk|Exit)_/g, '');
  };

  const getPillStyle = (isSelected, isDark) => {
    const baseStyle = 'focus:outline-none';
    if (isSelected) {
      return isDark 
        ? `${baseStyle} bg-emerald-500/20 border-2 border-emerald-500 text-emerald-400 font-bold shadow-sm active:scale-[0.98] transition-transform`
        : `${baseStyle} bg-emerald-100 border-2 border-emerald-500 text-emerald-700 font-bold shadow-sm active:scale-[0.98] transition-transform`;
    }
    return isDark 
      ? `${baseStyle} bg-[#1a1e29] border-2 border-[#2a2e39] text-gray-400 hover:bg-[#202532] font-bold shadow-sm active:scale-[0.98] transition-transform`
      : `${baseStyle} bg-white border-2 border-gray-200 text-gray-500 hover:bg-gray-50 font-bold shadow-sm active:scale-[0.98] transition-transform`;
  };

  const getStepBadgeStyle = (isSelected, isDark) => {
    if (isSelected) {
      return 'bg-emerald-500 text-white font-black';
    }
    return isDark ? 'bg-gray-800 text-gray-500 font-black' : 'bg-gray-200 text-gray-500 font-black';
  };

  const getCardStyle = (isDark) => {
    return `p-5 rounded-2xl border-2 transition-all ${isDark ? 'bg-[#151921] border-[#2a2e39] shadow-[0_4px_0_#2a2e39]' : 'bg-white border-gray-100 shadow-[0_4px_0_#f3f4f6]'}`;
  };

  const renderMultiSelectCustomPills = (title, stepNum, stateKey, category, defaultOptions) => {
    const selectedArr = currentTradeData[stateKey] || [];
    const userTags = dbTags.filter(t => t.category === category).map(t => t.tag);
    const allOptions = Array.from(new Set([...defaultOptions, ...userTags]));

    return (
      <div className={`space-y-3 ${getCardStyle(isDark)}`}>
        <div className="flex items-center justify-between">
          <h3 className={`text-xs font-bold uppercase tracking-widest flex items-center ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] mr-2 transition-colors ${getStepBadgeStyle(selectedArr.length > 0, isDark)}`}>{stepNum}</span>
            {title}
          </h3>
          {addingNew.category === category ? (
             <form 
               onSubmit={(e) => {
                 e.preventDefault();
                 if (addingNew.text.trim()) {
                   handleAddNewTag(addingNew.text.trim(), category);
                 }
                 setAddingNew({ category: null, text: '' });
               }}
               className="flex items-center"
             >
               <input 
                 autoFocus
                 type="text"
                 value={addingNew.text}
                 onChange={e => setAddingNew({ ...addingNew, text: e.target.value })}
                 onBlur={() => setTimeout(() => setAddingNew({ category: null, text: '' }), 150)}
                 className={`px-3 py-1 text-xs w-28 rounded border focus:outline-none focus:ring-1 focus:ring-emerald-500 ${isDark ? 'bg-[#1a1e29] border-emerald-500 text-white' : 'bg-white border-emerald-500 text-gray-900'}`}
                 placeholder="Tạo mới..."
               />
             </form>
          ) : (
            <button
              onClick={() => setAddingNew({ category, text: '' })}
              className={`text-xs font-medium flex items-center transition-colors ${isDark ? 'text-gray-500 hover:text-emerald-400' : 'text-slate-400 hover:text-emerald-600'}`}
            >
              <Plus size={14} className="mr-1" /> Thêm mới
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar pb-2">
          {allOptions.map(val => {
            const isSelected = selectedArr.includes(val);
            const isCustom = !defaultOptions.includes(val);
            const isEditing = editingTag?.oldTag === val;

            if (isEditing) {
              return (
                <form key={val} onSubmit={(e) => { e.preventDefault(); handleUpdateTag(val, editingTag.text.trim() || formatTagDisplay(val)); }} className="flex items-center">
                  <input 
                    autoFocus type="text" value={editingTag.text} onChange={e => setEditingTag(prev => ({...prev, text: e.target.value}))}
                    onBlur={() => handleUpdateTag(val, editingTag.text.trim() || formatTagDisplay(val))}
                    className={`px-3 py-1.5 text-sm w-32 rounded-full border focus:outline-none focus:ring-1 focus:ring-emerald-500 ${isDark ? 'bg-[#1a1e29] border-emerald-500 text-white' : 'bg-white border-emerald-500 text-gray-900'}`}
                  />
                </form>
              );
            }

            return (
              <div 
                key={val} 
                className={`group relative flex items-center px-3.5 py-1.5 text-sm rounded-full transition-all border cursor-pointer select-none ${getPillStyle(isSelected, isDark)}`} 
                onClick={() => setCurrentTradeData(prev => {
                  const exists = prev[stateKey].includes(val);
                  return {
                    ...prev,
                    [stateKey]: exists ? prev[stateKey].filter(c => c !== val) : [...prev[stateKey], val]
                  };
                })}
              >
                <span>{formatTagDisplay(val)}</span>
                {isCustom && (
                  <div className="flex items-center ml-2 space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={(e) => { e.stopPropagation(); setEditingTag({ oldTag: val, text: formatTagDisplay(val) }); }} className={`p-0.5 rounded ${isDark ? 'hover:bg-gray-700 text-gray-400 hover:text-white' : 'hover:bg-gray-200 text-gray-500 hover:text-gray-800'}`}>
                      <Pencil size={12} />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteTag(val); }} className={`p-0.5 rounded ${isDark ? 'hover:bg-red-500/20 text-gray-400 hover:text-red-400' : 'hover:bg-red-100 text-gray-500 hover:text-red-600'}`}>
                      <X size={12} />
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    );
  };

  const getPrefixForCategory = (cat) => {
    if (cat === 'setups') return '#Setup_';
    if (cat === 'mistakes') return '#Mistake_';
    if (cat === 'strengths') return '#Strength_';
    if (cat === 'trends') return '#Trend_';
    if (cat === 'sessions') return '#Session_';
    if (cat === 'triggers') return '#Trigger_';
    if (cat === 'management') return '#Mgmt_';
    if (cat === 'confluences') return '#Confluence_';
    return '#Custom_';
  };

  const handleAddNewTag = async (text, category) => {
    if (!text.trim()) return;
    
    // Create Optimistic Tag
    let cleanName = text.replace(/[^a-zA-Z0-9\u00C0-\u024F\u1EA0-\u1EF9]+/g, '');
    cleanName = cleanName ? cleanName.charAt(0).toUpperCase() + cleanName.slice(1) : text;
    const optimisticTag = `${getPrefixForCategory(category)}${cleanName}`;

    const optimisticData = {
        tag: optimisticTag,
        label: text,
        category: category,
        isOptimistic: true // flag to show a loading state if needed
    };

    // 1. Update UI optimistically
    setDbTags(prev => [optimisticData, ...prev]);
    setCurrentTradeData(prev => {
      const next = { ...prev };
      if (category === 'setups') next.setup_tag = optimisticTag;
      else if (category === 'triggers') next.entry_trigger = optimisticTag;
      else if (category === 'management') next.trade_management = optimisticTag;
      else if (category === 'confluences') {
        if (!next.confluences.includes(optimisticTag)) {
          next.confluences = [...next.confluences, optimisticTag];
        }
      }
      return next;
    });

    try {
      // 2. Perform API call in background
      const res = await fetch('/api/hashtags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: text, category })
      });
      const json = await res.json();
      
      if (json.success && json.data) {
        // 3. Replace optimistic data with real DB data
        setDbTags(prev => prev.map(t => t.tag === optimisticTag ? json.data : t));
        
        if (json.data.tag !== optimisticTag) {
          // If the AI returned a slightly different tag string, patch the selection
          setCurrentTradeData(prev => {
            const next = { ...prev };
            if (category === 'setups' && next.setup_tag === optimisticTag) next.setup_tag = json.data.tag;
            else if (category === 'triggers' && next.entry_trigger === optimisticTag) next.entry_trigger = json.data.tag;
            else if (category === 'management' && next.trade_management === optimisticTag) next.trade_management = json.data.tag;
            else if (category === 'confluences') {
              next.confluences = next.confluences.map(c => c === optimisticTag ? json.data.tag : c);
            }
            return next;
          });
        }
      } else {
        // Revert on API failure
        setDbTags(prev => prev.filter(t => t.tag !== optimisticTag));
      }
    } catch (e) {
      console.error(e);
      // Revert on Exception
      setDbTags(prev => prev.filter(t => t.tag !== optimisticTag));
    }
  };

  const handleUpdateTag = async (oldTag, newText) => {
    try {
      const res = await fetch('/api/hashtags', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldTag, newLabel: newText })
      });
      const json = await res.json();
      if (json.success && json.newTag) {
        setDbTags(prev => prev.map(t => t.tag === oldTag ? { ...t, tag: json.newTag, label: newText } : t));
        
        // Update selection if selected
        if (currentTradeData.setup_tag === oldTag) setCurrentTradeData(prev => ({ ...prev, setup_tag: json.newTag }));
        if (currentTradeData.entry_trigger === oldTag) setCurrentTradeData(prev => ({ ...prev, entry_trigger: json.newTag }));
        if (currentTradeData.trade_management === oldTag) setCurrentTradeData(prev => ({ ...prev, trade_management: json.newTag }));
        if (currentTradeData.confluences.includes(oldTag)) {
          setCurrentTradeData(prev => ({ ...prev, confluences: prev.confluences.map(c => c === oldTag ? json.newTag : c) }));
        }
      }
    } catch (e) {
      console.error(e);
    }
    setEditingTag(null);
  };

  const handleDeleteTag = async (tag) => {
    if (!confirm('Bạn có chắc chắn muốn xoá tag này?')) return;
    try {
      const res = await fetch(`/api/hashtags?tag=${encodeURIComponent(tag)}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        setDbTags(prev => prev.filter(t => t.tag !== tag));
        // Deselect if selected
        if (currentTradeData.setup_tag === tag) setCurrentTradeData(prev => ({ ...prev, setup_tag: '' }));
        if (currentTradeData.entry_trigger === tag) setCurrentTradeData(prev => ({ ...prev, entry_trigger: '' }));
        if (currentTradeData.trade_management === tag) setCurrentTradeData(prev => ({ ...prev, trade_management: '' }));
        if (currentTradeData.confluences.includes(tag)) {
          setCurrentTradeData(prev => ({ ...prev, confluences: prev.confluences.filter(c => c !== tag) }));
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md" style={{ zIndex }}>
      <div className={`w-full max-w-[1400px] w-[95vw] max-h-[90vh] flex flex-col rounded-2xl overflow-hidden shadow-2xl border ${isDark ? 'bg-[#131722] border-[#2a2e39] shadow-black/80' : 'bg-slate-50 border-white/50 shadow-gray-300/50'}`}>
        
        {/* Header */}
        <div className={`flex items-center justify-between p-4 border-b ${isDark ? 'border-[#2a2e39] bg-[#1a1e29]' : 'border-gray-200/80 bg-white/60 backdrop-blur-md'}`}>
          <div className="flex items-center space-x-2 sm:space-x-4">
            {onBackToStep1 && (
              <button 
                onClick={() => onBackToStep1(trade)} 
                className={`p-2 rounded-xl transition-all flex items-center justify-center ${isDark ? 'hover:bg-[#2a2e39] text-gray-400 hover:text-white' : 'hover:bg-gray-200/80 text-gray-500 hover:text-gray-800'}`}
                title="Quay lại Bước 1"
              >
                <ArrowLeft size={18} />
              </button>
            )}
            <h2 className={`font-extrabold tracking-tight text-lg flex items-center gap-2 ${isDark ? 'text-gray-100' : 'text-gray-800'}`}>
              <span>Bước 2/2: Đánh giá chi tiết</span>
              <span className="text-gray-400 font-medium text-sm ml-1">({currentIndex + 1}/{trades.length})</span>
            </h2>
          </div>
          <button onClick={onClose} className={`p-2 rounded-xl transition-all ${isDark ? 'hover:bg-[#2a2e39] text-gray-400' : 'hover:bg-gray-200/80 text-gray-500 hover:text-gray-800'}`}>
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-1 overflow-hidden flex-col md:flex-row">
          
          {/* Left Panel: Image Carousel */}
          <div className={`w-full md:w-1/2 flex flex-col p-5 border-r ${isDark ? 'border-[#2a2e39] bg-[#0b0e14]' : 'border-gray-200/60 bg-white'}`}>
            <div className={`flex-1 relative rounded-2xl overflow-hidden flex items-center justify-center border-2 border-dashed group ${isDark ? 'bg-black/20 border-gray-500/30' : 'bg-gray-50/50 border-gray-200 transition-colors'}`}>
              {(() => {
                const isAddMoreSlide = currentImageSlide >= generatedImages.length;
                
                if (isGeneratingImage) {
                  return (
                    <div className="flex flex-col items-center justify-center space-y-6">
                      <div className="relative flex items-center justify-center h-24 w-24">
                        <div className="absolute w-full h-full bg-emerald-500/20 rounded-full animate-ping" />
                        <div className="absolute w-16 h-16 bg-emerald-500/40 rounded-full animate-pulse" />
                        <Wand2 className="w-8 h-8 text-emerald-500 animate-bounce relative z-10" />
                      </div>
                      <div className="space-y-1 text-center">
                        <p className={`text-lg font-black tracking-tight ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                          AI đang vẽ biểu đồ...
                        </p>
                        <p className={`text-sm font-medium ${isDark ? 'text-gray-500' : 'text-gray-500'} flex items-center justify-center`}>
                          Chờ một chút nhé...
                        </p>
                      </div>
                    </div>
                  );
                }
                
                if (isAddMoreSlide) {
                  return (
                    <div className="flex flex-col items-center justify-center p-6 text-center space-y-6 w-full h-full">
                      <div className="relative">
                        <div className="absolute inset-0 blur-2xl bg-emerald-500/20 rounded-full animate-pulse" />
                        <div className={`relative p-5 rounded-3xl border-2 ${isDark ? 'bg-[#1a1e29] border-[#2a2e39] shadow-[0_4px_0_#2a2e39] text-gray-500' : 'bg-white border-gray-100 shadow-[0_4px_0_#f3f4f6] text-emerald-400'}`}>
                          <ImageIcon className="w-12 h-12" />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <p className={`text-lg font-black tracking-tight ${isDark ? 'text-gray-300' : 'text-gray-800'}`}>
                          {generatedImages.length === 0 ? 'Chưa có ảnh đính kèm' : 'Thêm ảnh đính kèm'}
                        </p>
                        <p className={`text-sm font-medium ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                          {generatedImages.length === 0 ? 'Hệ thống có thể tự động dựng biểu đồ' : `Đã thêm ${generatedImages.length}/10 ảnh`}
                        </p>
                      </div>
                      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 flex-wrap">
                        {!hasTriggeredGenRef.current && canGenerateChart && (
                          <button 
                            onClick={() => triggerLocalImageGeneration(trade)}
                            className="flex items-center space-x-2 px-4 py-2 text-sm bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl font-black border-2 border-emerald-600 shadow-sm transition-all active:scale-95 group"
                          >
                            <Wand2 className="w-4 h-4 group-hover:animate-bounce" />
                            <span>Tạo ảnh ngay</span>
                            <Sparkles className="w-3 h-3 text-yellow-300 animate-pulse" />
                          </button>
                        )}
                        <label className={`relative flex items-center space-x-2 px-4 py-2 text-sm rounded-xl font-black border-2 transition-all shadow-sm cursor-pointer active:scale-95 group ${isDark ? 'bg-[#1a1e29] hover:bg-[#202532] border-[#2a2e39] text-gray-300' : 'bg-white hover:bg-gray-50 border-gray-200 text-slate-700'}`}>
                          <Upload className="w-4 h-4 group-hover:-translate-y-0.5 transition-transform" />
                          <span>Tải ảnh lên</span>
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={handleImageUpload}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => setIsAddingUrl(!isAddingUrl)}
                          className={`relative flex items-center justify-center px-4 py-2 text-sm rounded-xl font-black border-2 transition-all shadow-sm active:scale-95 group ${isDark ? 'bg-[#1a1e29] hover:bg-[#202532] border-[#2a2e39] text-gray-300' : 'bg-white hover:bg-gray-50 border-gray-200 text-slate-700'}`}
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
                            className={`flex-1 px-4 py-2 rounded-xl border outline-none font-medium text-sm ${isDark ? 'bg-[#1a1e29] border-[#2a2e39] text-white focus:border-emerald-500' : 'bg-white border-gray-200 text-gray-800 focus:border-emerald-500'}`}
                          />
                          <button
                            onClick={() => {
                              if (!imageUrlInput.trim()) return;
                              if (generatedImages.length >= 10) {
                                alert('Đã đạt giới hạn tối đa 10 ảnh.');
                                return;
                              }
                              setGeneratedImages(prev => [...prev, imageUrlInput.trim()]);
                              setImageUrlInput('');
                              setIsAddingUrl(false);
                            }}
                            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold transition-colors"
                          >
                            Thêm
                          </button>
                        </div>
                      )}
                    </div>
                  );
                }
                
                const currentImgSrc = generatedImages[currentImageSlide];
                const isImgError = imgErrorState[currentImgSrc];

                return (
                  <div className={`relative w-full h-full group ${isDark ? 'bg-[#131722]' : 'bg-gray-100'}`}>
                    {isImgError ? (
                      <div className={`w-full h-full flex flex-col items-center justify-center ${isDark ? 'bg-[#1a1e29] text-gray-500' : 'bg-gray-50 text-gray-400'}`}>
                        <div className={`p-4 rounded-full mb-3 ${isDark ? 'bg-[#2a2e39]' : 'bg-gray-200'}`}>
                          <ImageIcon size={32} className="opacity-50" />
                        </div>
                        <span className="text-sm font-semibold">Ảnh bị lỗi hoặc không tải được</span>
                        <span className="text-xs opacity-70 mt-1 truncate max-w-[80%]">{currentImgSrc}</span>
                      </div>
                    ) : (
                      <img 
                        src={currentImgSrc} 
                        alt="Generated Chart" 
                        className="w-full h-full object-contain"
                        onError={() => setImgErrorState(prev => ({...prev, [currentImgSrc]: true}))}
                      />
                    )}
                    
                    <button
                      onClick={() => handleRemoveImage(currentImageSlide)}
                      className="absolute top-4 right-4 p-2.5 bg-rose-500 hover:bg-rose-600 rounded-full text-white opacity-0 group-hover:opacity-100 transition-all shadow-[0_4px_12px_rgba(225,29,72,0.4)] border border-rose-400/50 active:scale-95"
                      title="Xoá ảnh này"
                    >
                      <X size={16} className="text-white" color="#ffffff" />
                    </button>
                  </div>
                );
              })()}
              
              {/* Navigation overlay */}
              {!isGeneratingImage && (generatedImages.length > 0) && (
                <>
                  <button 
                    onClick={() => setCurrentImageSlide(prev => prev === 0 ? (generatedImages.length < 10 ? generatedImages.length : generatedImages.length - 1) : prev - 1)}
                    className={`absolute left-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full opacity-0 group-hover:opacity-100 transition-all active:scale-90 shadow-[0_4px_12px_rgba(0,0,0,0.15)] border ${isDark ? 'bg-slate-800/90 text-white hover:bg-emerald-500 border-white/20' : 'bg-white/95 text-slate-800 hover:text-emerald-600 hover:bg-emerald-50 border-gray-200'}`}
                  >
                    <ChevronLeft size={22} strokeWidth={3} className={isDark ? 'text-white' : 'text-slate-800 hover:text-emerald-600'} />
                  </button>
                  <button 
                    onClick={() => setCurrentImageSlide(prev => prev === (generatedImages.length < 10 ? generatedImages.length : generatedImages.length - 1) ? 0 : prev + 1)}
                    className={`absolute right-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full opacity-0 group-hover:opacity-100 transition-all active:scale-90 shadow-[0_4px_12px_rgba(0,0,0,0.15)] border ${isDark ? 'bg-slate-800/90 text-white hover:bg-emerald-500 border-white/20' : 'bg-white/95 text-slate-800 hover:text-emerald-600 hover:bg-emerald-50 border-gray-200'}`}
                  >
                    <ChevronRight size={22} strokeWidth={3} className={isDark ? 'text-white' : 'text-slate-800 hover:text-emerald-600'} />
                  </button>
                  <div className={`absolute bottom-12 left-1/2 -translate-x-1/2 flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity px-3 py-1.5 rounded-full ${isDark ? 'bg-black/50 backdrop-blur-md' : 'bg-white/80 backdrop-blur-md shadow-sm border border-gray-200/50'}`}>
                    {Array.from({ length: generatedImages.length + (generatedImages.length < 10 ? 1 : 0) }).map((_, idx) => (
                      <div key={idx} className={`w-2.5 h-2.5 rounded-full transition-all cursor-pointer ${idx === currentImageSlide ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.9)] border border-emerald-300/50 scale-110' : (isDark ? 'bg-slate-400/60 hover:bg-white border border-transparent' : 'bg-gray-300 hover:bg-gray-400 border border-transparent')}`} onClick={() => setCurrentImageSlide(idx)} />
                    ))}
                  </div>
                </>
              )}
            </div>
            
            {/* Quick Summary Block */}
            <div className={`mt-5 p-5 rounded-2xl border-2 transition-all ${isDark ? 'bg-[#1a1e29]/60 border-[#2a2e39] shadow-sm' : 'bg-white border-gray-100 shadow-[0_4px_0_#f3f4f6]'}`}>
              <div className={`text-xl font-black tracking-tight flex flex-wrap items-center gap-x-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                <span>{trade.asset}</span>
                <span className={`text-sm font-normal ${isDark ? 'text-gray-600' : 'text-gray-300'}`}>•</span>
                <span className={`px-2 py-0.5 rounded-md text-sm ${trade.side === 'BUY' ? (isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-700') : (isDark ? 'bg-rose-500/20 text-rose-400' : 'bg-rose-100 text-rose-700')}`}>
                  {trade.side}
                </span>
                <span className={`text-sm font-normal ${isDark ? 'text-gray-600' : 'text-gray-300'}`}>•</span>
                <span className={trade.pnl > 0 ? (isDark ? 'text-emerald-400' : 'text-emerald-600') : trade.pnl < 0 ? (isDark ? 'text-rose-400' : 'text-rose-600') : ''}>
                  {trade.pnl > 0 ? '+' : ''}{trade.pnl} USD
                </span>
              </div>
              
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className={`flex items-center space-x-2 text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                   <Target size={16} className={isDark ? 'text-gray-500' : 'text-gray-400'} />
                   <span>Entry {trade.entry_price || '-'} <span className="opacity-50 mx-1">&rarr;</span> Exit {trade.exit_price || '-'}</span>
                </div>
                <div className={`flex items-center space-x-2 text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                   <Clock size={16} className={isDark ? 'text-gray-500' : 'text-gray-400'} />
                   <span>
                    {(() => {
                      if (trade.duration) return trade.duration;
                      if (!trade.trade_time || !trade.exit_time) return '-';
                      const diffMins = Math.round((new Date(trade.exit_time) - new Date(trade.trade_time)) / 60000);
                      if (diffMins < 60) return `${diffMins}m`;
                      return `${Math.floor(diffMins/60)}h ${diffMins%60}m`;
                    })()} <span className="opacity-40 mx-1">•</span> {(() => {
                      if (trade.session) return trade.session;
                      if (!trade.trade_time) return 'Unknown';
                      const h = new Date(trade.trade_time).getUTCHours();
                      if (h >= 0 && h < 8) return 'Asian';
                      if (h >= 8 && h < 13) return 'London';
                      return 'New York';
                    })()}
                   </span>
                </div>
              </div>
            </div>

            {/* Context Info */}
            <div className={`mt-5 grid grid-cols-2 gap-3 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              <div className={`p-4 rounded-2xl border-2 flex flex-col items-center text-center transition-all ${isDark ? 'bg-[#1a1e29] border-[#2a2e39] shadow-[0_4px_0_#2a2e39]' : 'bg-white border-gray-100 shadow-[0_4px_0_#f3f4f6]'}`}>
                <span className="block text-xs font-bold uppercase tracking-wider opacity-60 mb-1">Planned R:R</span>
                <span className={`text-lg font-black ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                  {trade.planned_rr ? trade.planned_rr.toFixed(2) : (() => {
                    const { entry_price, stop_loss, take_profit, side } = trade;
                    if (!entry_price || !stop_loss || !take_profit || entry_price === stop_loss) return '-';
                    const risk = Math.abs(entry_price - stop_loss);
                    const reward = Math.abs(take_profit - entry_price);
                    return (reward / risk).toFixed(2);
                  })()}
                </span>
              </div>
              <div className={`p-4 rounded-2xl border-2 flex flex-col items-center text-center transition-all ${isDark ? 'bg-[#1a1e29] border-[#2a2e39] shadow-[0_4px_0_#2a2e39]' : 'bg-white border-gray-100 shadow-[0_4px_0_#f3f4f6]'}`}>
                <span className="block text-xs font-bold uppercase tracking-wider opacity-60 mb-1">Actual R:R</span>
                <span className={`text-lg font-black`}>
                  {trade.actual_rr ? trade.actual_rr.toFixed(2) : (() => {
                    const { entry_price, exit_price, stop_loss, side } = trade;
                    if (!entry_price || !exit_price || !stop_loss || entry_price === stop_loss) return '-';
                    const risk = Math.abs(entry_price - stop_loss);
                    const reward = side === 'BUY' ? exit_price - entry_price : entry_price - exit_price;
                    const rr = reward / risk;
                    return (
                       <span className={rr > 0 ? 'text-emerald-500' : rr < 0 ? 'text-rose-500' : ''}>
                         {rr.toFixed(2)}
                       </span>
                    );
                  })()}
                </span>
              </div>
            </div>
          </div>

          {/* Right Panel: MVP Interactive Form */}
          <div className="w-full md:w-1/2 flex flex-col relative">
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-6 pb-32 space-y-6">
              
              {/* 1. Market Trend */}
            <div className={`space-y-3 ${getCardStyle(isDark)}`}>
              <h3 className={`text-xs font-bold uppercase tracking-widest flex items-center ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] mr-2 transition-colors ${getStepBadgeStyle(!!currentTradeData.market_trend, isDark)}`}>1</span>
                Market Trend
              </h3>
              <div className="flex flex-wrap gap-2">
                {[
                  { tag: '#Trend_Up', label: 'Tăng' },
                  { tag: '#Trend_Down', label: 'Giảm' },
                  { tag: '#Trend_Sideway', label: 'Sideway' },
                  { tag: '#Trend_Unclear', label: 'Không rõ ràng' }
                ].map(({tag, label}) => {
                  const isSelected = currentTradeData.market_trend === tag || currentTradeData.market_trend === label;
                  return (
                    <button
                      key={tag}
                      onClick={() => setCurrentTradeData(prev => ({ ...prev, market_trend: isSelected ? '' : tag }))}
                      className={`px-3.5 py-1.5 text-sm rounded-full transition-all border ${getPillStyle(isSelected, isDark)}`}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Helper to render custom pills */}
            {(() => {
              const renderCustomPills = (title, stepNum, stateKey, category, defaultOptions) => {
                const selectedVal = currentTradeData[stateKey];
                const formattedSelected = formatTagDisplay(selectedVal);
                const userTags = dbTags.filter(t => t.category === category).map(t => t.tag);
                const allOptions = Array.from(new Set([...defaultOptions, ...userTags]));

                return (
                  <div className={`space-y-3 ${getCardStyle(isDark)}`}>
                    <div className="flex items-center justify-between">
                      <h3 className={`text-xs font-bold uppercase tracking-widest flex items-center ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] mr-2 transition-colors ${getStepBadgeStyle(!!selectedVal, isDark)}`}>{stepNum}</span>
                        {title}
                      </h3>
                      {addingNew.category === category ? (
                         <form 
                           onSubmit={(e) => {
                             e.preventDefault();
                             if (addingNew.text.trim()) {
                               handleAddNewTag(addingNew.text.trim(), category);
                             }
                             setAddingNew({ category: null, text: '' });
                           }}
                           className="flex items-center"
                         >
                           <input 
                             autoFocus
                             type="text"
                             value={addingNew.text}
                             onChange={e => setAddingNew({ ...addingNew, text: e.target.value })}
                             onBlur={() => setTimeout(() => setAddingNew({ category: null, text: '' }), 150)}
                             className={`px-3 py-1 text-xs w-28 rounded border focus:outline-none focus:ring-1 focus:ring-emerald-500 ${isDark ? 'bg-[#1a1e29] border-emerald-500 text-white' : 'bg-white border-emerald-500 text-gray-900'}`}
                             placeholder="Tạo mới..."
                           />
                         </form>
                      ) : (
                        <button
                          onClick={() => setAddingNew({ category, text: '' })}
                          className={`text-xs font-medium flex items-center transition-colors ${isDark ? 'text-gray-500 hover:text-emerald-400' : 'text-slate-400 hover:text-emerald-600'}`}
                        >
                          <Plus size={14} className="mr-1" /> Thêm mới
                        </button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar pb-2">
                      {allOptions.map(val => {
                        const isSelected = formatTagDisplay(val) === formattedSelected && formattedSelected !== '';
                        // A tag is custom if it's not in defaultOptions and we have defaultOptions, or if it's explicitly marked.
                        // Since Setup is empty [], all tags come from DB, so they are not "custom" in the sense of needing edit/delete UNLESS they are not the main 5.
                        // Actually, for Setup, the main 5 are Breakout, FBO, SWRange, KeyLevel, EMABounce.
                        const isCustom = !defaultOptions.includes(val) && !['#Setup_Breakout', '#Setup_FBO', '#Setup_SWRange', '#Setup_KeyLevel', '#Setup_EMABounce'].includes(val);
                        const isEditing = editingTag?.oldTag === val;

                        if (isEditing) {
                          return (
                            <form key={val} onSubmit={(e) => { e.preventDefault(); handleUpdateTag(val, editingTag.text.trim() || formatTagDisplay(val)); }} className="flex items-center">
                              <input 
                                autoFocus type="text" value={editingTag.text} onChange={e => setEditingTag(prev => ({...prev, text: e.target.value}))}
                                onBlur={() => handleUpdateTag(val, editingTag.text.trim() || formatTagDisplay(val))}
                                className={`px-3 py-1.5 text-sm w-32 rounded-full border focus:outline-none focus:ring-1 focus:ring-emerald-500 ${isDark ? 'bg-[#1a1e29] border-emerald-500 text-white' : 'bg-white border-emerald-500 text-gray-900'}`}
                              />
                            </form>
                          );
                        }

                        return (
                          <div key={val} className={`group relative flex items-center px-3.5 py-1.5 text-sm rounded-full transition-all border cursor-pointer select-none ${getPillStyle(isSelected, isDark)}`} onClick={() => setCurrentTradeData(prev => ({ ...prev, [stateKey]: isSelected ? '' : val }))}>
                            <span>{formatTagDisplay(val)}</span>
                            {isCustom && (
                              <div className="flex items-center ml-2 space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={(e) => { e.stopPropagation(); setEditingTag({ oldTag: val, text: formatTagDisplay(val) }); }} className={`p-0.5 rounded ${isDark ? 'hover:bg-gray-700 text-gray-400 hover:text-white' : 'hover:bg-gray-200 text-gray-500 hover:text-gray-800'}`}>
                                  <Pencil size={12} />
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); handleDeleteTag(val); }} className={`p-0.5 rounded ${isDark ? 'hover:bg-red-500/20 text-gray-400 hover:text-red-400' : 'hover:bg-red-100 text-gray-500 hover:text-red-600'}`}>
                                  <X size={12} />
                                </button>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                );
              };

              return (
                <>
                  {renderCustomPills('Setup', 2, 'setup_tag', 'setups', [])}
                  {renderCustomPills('Entry Trigger', 3, 'entry_trigger', 'triggers', ['#Trigger_BOS', '#Trigger_Retest', '#Trigger_Sweep', '#Trigger_Candle_Pattern', '#Trigger_Touch_Level'])}
                </>
              );
            })()}



            {/* 4. Execution */}
            <div className={`space-y-3 ${getCardStyle(isDark)}`}>
              <h3 className={`text-xs font-bold uppercase tracking-widest flex items-center ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] mr-2 transition-colors ${getStepBadgeStyle(!!currentTradeData.execution_quality, isDark)}`}>4</span>
                Execution Quality
              </h3>
              <div className="flex flex-wrap gap-2">
                {[
                  { tag: '#Exec_Excellent', label: 'Excellent' },
                  { tag: '#Exec_Good', label: 'Good' },
                  { tag: '#Exec_Early', label: 'Early' },
                  { tag: '#Exec_Late', label: 'Late' },
                  { tag: '#Exec_Chased', label: 'Chased Price' }
                ].map(({tag, label}) => {
                  const isSelected = currentTradeData.execution_quality === tag || currentTradeData.execution_quality === label;
                  return (
                    <button
                      key={tag}
                      onClick={() => setCurrentTradeData(prev => ({ ...prev, execution_quality: isSelected ? '' : tag }))}
                      className={`px-3.5 py-1.5 text-sm rounded-full transition-all border ${getPillStyle(isSelected, isDark)}`}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* 5. Management */}
            {(() => {
              const selectedVal = currentTradeData.trade_management;
              const formattedSelected = formatTagDisplay(selectedVal);
              const category = 'management';
              const defaultOptions = ['#Mgmt_Hold to TP/SL', '#Mgmt_Move BE', '#Mgmt_Partial TP', '#Mgmt_Trail SL', '#Mgmt_Manual Exit'];
              const userTags = dbTags.filter(t => t.category === category).map(t => t.tag);
              const allOptions = Array.from(new Set([...defaultOptions, ...userTags]));

              return (
                <div className={`space-y-3 ${getCardStyle(isDark)}`}>
                  <div className="flex items-center justify-between">
                    <h3 className={`text-xs font-bold uppercase tracking-widest flex items-center ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] mr-2 transition-colors ${getStepBadgeStyle(!!selectedVal, isDark)}`}>5</span>
                      Trade Management
                    </h3>
                    {addingNew.category === category ? (
                       <form 
                         onSubmit={(e) => {
                           e.preventDefault();
                           if (addingNew.text.trim()) {
                             handleAddNewTag(addingNew.text.trim(), category);
                           }
                           setAddingNew({ category: null, text: '' });
                         }}
                         className="flex items-center"
                       >
                         <input 
                           autoFocus
                           type="text"
                           value={addingNew.text}
                           onChange={e => setAddingNew({ ...addingNew, text: e.target.value })}
                           onBlur={() => setTimeout(() => setAddingNew({ category: null, text: '' }), 150)}
                           className={`px-3 py-1 text-xs w-28 rounded border focus:outline-none focus:ring-1 focus:ring-emerald-500 ${isDark ? 'bg-[#1a1e29] border-emerald-500 text-white' : 'bg-white border-emerald-500 text-gray-900'}`}
                           placeholder="Tạo mới..."
                         />
                       </form>
                    ) : (
                      <button
                        onClick={() => setAddingNew({ category, text: '' })}
                        className={`text-xs font-medium flex items-center transition-colors ${isDark ? 'text-gray-500 hover:text-emerald-400' : 'text-slate-400 hover:text-emerald-600'}`}
                      >
                        <Plus size={14} className="mr-1" /> Thêm mới
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar pb-2">
                    {allOptions.map(val => {
                      const isSelected = formatTagDisplay(val) === formattedSelected && formattedSelected !== '';
                      const isCustom = !defaultOptions.includes(val);
                      const isEditing = editingTag?.oldTag === val;

                      if (isEditing) {
                        return (
                          <form key={val} onSubmit={(e) => { e.preventDefault(); handleUpdateTag(val, editingTag.text.trim() || formatTagDisplay(val)); }} className="flex items-center">
                            <input 
                              autoFocus type="text" value={editingTag.text} onChange={e => setEditingTag(prev => ({...prev, text: e.target.value}))}
                              onBlur={() => handleUpdateTag(val, editingTag.text.trim() || formatTagDisplay(val))}
                              className={`px-3 py-1.5 text-sm w-32 rounded-full border focus:outline-none focus:ring-1 focus:ring-emerald-500 ${isDark ? 'bg-[#1a1e29] border-emerald-500 text-white' : 'bg-white border-emerald-500 text-gray-900'}`}
                            />
                          </form>
                        );
                      }

                      return (
                        <div key={val} className={`group relative flex items-center px-3.5 py-1.5 text-sm rounded-full transition-all border cursor-pointer select-none ${getPillStyle(isSelected, isDark)}`} onClick={() => setCurrentTradeData(prev => ({ ...prev, trade_management: isSelected ? '' : val }))}>
                          <span>{formatTagDisplay(val)}</span>
                          {isCustom && (
                            <div className="flex items-center ml-2 space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={(e) => { e.stopPropagation(); setEditingTag({ oldTag: val, text: formatTagDisplay(val) }); }} className={`p-0.5 rounded ${isDark ? 'hover:bg-gray-700 text-gray-400 hover:text-white' : 'hover:bg-gray-200 text-gray-500 hover:text-gray-800'}`}>
                                <Pencil size={12} />
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); handleDeleteTag(val); }} className={`p-0.5 rounded ${isDark ? 'hover:bg-red-500/20 text-gray-400 hover:text-red-400' : 'hover:bg-red-100 text-gray-500 hover:text-red-600'}`}>
                                <X size={12} />
                              </button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              );
            })()}

            {/* Advanced Toggle */}
            <div className="pt-5 border-t border-dashed border-gray-200 dark:border-gray-700 flex justify-center">
              <button 
                onClick={() => setIsAdvancedMode(!isAdvancedMode)}
                className={`flex items-center space-x-1 px-4 py-2 rounded-full text-sm font-bold transition-all border-2 ${isAdvancedMode ? 'bg-emerald-100 border-emerald-500 text-emerald-600 shadow-[0_2px_0_#10b981]' : isDark ? 'bg-[#1a1e29] border-[#2a2e39] text-gray-400 hover:text-gray-200 shadow-[0_2px_0_#2a2e39]' : 'bg-white border-gray-200 text-gray-500 hover:text-gray-800 shadow-[0_2px_0_#e5e7eb]'} active:translate-y-[2px] active:shadow-none`}
              >
                <span>{isAdvancedMode ? 'Thu gọn' : 'Chi tiết (Deep Review)'}</span>
                {isAdvancedMode ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
            </div>

            {/* Advanced Mode Fields */}
            {isAdvancedMode && (
              <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-300">
                
                {/* Emotions & Mistakes */}
                {renderMultiSelectCustomPills('Tâm lý giao dịch (Emotions)', '+', 'emotions', 'emotions', ['#Emotion_Confident', '#Emotion_FOMO', '#Emotion_Revenge', '#Emotion_Impatient', '#Emotion_Bored'])}
                {renderMultiSelectCustomPills('Sai lầm (Mistakes)', '+', 'mistakes', 'mistakes', ['#Mistake_MovedSL', '#Mistake_EarlyExit', '#Mistake_CounterTrend'])}

                {/* HTF Context */}
                <div className={`space-y-3 ${getCardStyle(isDark)}`}>
                  <label className={`block text-xs font-bold uppercase tracking-widest flex items-center ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] mr-2 transition-colors ${getStepBadgeStyle(!!currentTradeData.htf_context, isDark)}`}>+</span>
                    HTF Context
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {['M5', 'M15', 'M30', 'H1', 'H4', 'Daily', 'Multi-Timeframe'].map(val => {
                      const selectedArr = currentTradeData.htf_context ? currentTradeData.htf_context.split(',').map(s => s.trim()).filter(Boolean) : [];
                      const isSelected = selectedArr.includes(val);
                      return (
                        <button
                          key={val}
                          onClick={() => setCurrentTradeData(prev => {
                            const arr = prev.htf_context ? prev.htf_context.split(',').map(s => s.trim()).filter(Boolean) : [];
                            return { ...prev, htf_context: isSelected ? arr.filter(x => x !== val).join(', ') : [...arr, val].join(', ') };
                          })}
                          className={`px-3.5 py-1.5 text-sm rounded-full transition-all border ${getPillStyle(isSelected, isDark)}`}
                        >
                          {val}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* POI */}
                {(() => {
                  const selectedArr = currentTradeData.poi ? currentTradeData.poi.split(',').map(s => s.trim()).filter(Boolean) : [];
                  const category = 'poi';
                  const defaultOptions = ['SupplyDemand', 'FVG', 'EMA', 'TrendLine', 'Fibo'];
                  const userTags = dbTags.filter(t => t.category === category).map(t => t.tag);
                  const allOptions = Array.from(new Set([...defaultOptions, ...userTags]));

                  return (
                    <div className={`space-y-3 ${getCardStyle(isDark)}`}>
                      <div className="flex items-center justify-between">
                        <label className={`block text-xs font-bold uppercase tracking-widest flex items-center ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] mr-2 transition-colors ${getStepBadgeStyle(!!currentTradeData.poi, isDark)}`}>+</span>
                          POI (Point of Interest)
                        </label>
                        {addingNew.category === category ? (
                           <form 
                             onSubmit={(e) => {
                               e.preventDefault();
                               if (addingNew.text.trim()) {
                                 handleAddNewTag(addingNew.text.trim(), category);
                               }
                               setAddingNew({ category: null, text: '' });
                             }}
                             className="flex items-center"
                           >
                             <input 
                               autoFocus
                               type="text"
                               value={addingNew.text}
                               onChange={e => setAddingNew({ ...addingNew, text: e.target.value })}
                               onBlur={() => setTimeout(() => setAddingNew({ category: null, text: '' }), 150)}
                               className={`px-3 py-1 text-xs w-28 rounded border focus:outline-none focus:ring-1 focus:ring-purple-500 ${isDark ? 'bg-[#1a1e29] border-purple-500 text-white' : 'bg-white border-purple-500 text-gray-900'}`}
                               placeholder="Tạo mới..."
                             />
                           </form>
                        ) : (
                          <button
                            onClick={() => setAddingNew({ category, text: '' })}
                            className={`text-xs font-medium flex items-center transition-colors ${isDark ? 'text-gray-500 hover:text-purple-400' : 'text-slate-400 hover:text-purple-600'}`}
                          >
                            <Plus size={14} className="mr-1" /> Thêm mới
                          </button>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar pb-2">
                        {allOptions.map(val => {
                          const isSelected = selectedArr.includes(val);
                          const isCustom = !defaultOptions.includes(val);
                          const isEditing = editingTag?.oldTag === val;

                          if (isEditing) {
                            return (
                              <form key={val} onSubmit={(e) => { e.preventDefault(); handleUpdateTag(val, editingTag.text.trim() || formatTagDisplay(val)); }} className="flex items-center">
                                <input 
                                  autoFocus type="text" value={editingTag.text} onChange={e => setEditingTag(prev => ({...prev, text: e.target.value}))}
                                  onBlur={() => handleUpdateTag(val, editingTag.text.trim() || formatTagDisplay(val))}
                                  className={`px-3 py-1.5 text-sm w-32 rounded-full border focus:outline-none focus:ring-1 focus:ring-purple-500 ${isDark ? 'bg-[#1a1e29] border-purple-500 text-white' : 'bg-white border-purple-500 text-gray-900'}`}
                                />
                              </form>
                            );
                          }

                          return (
                            <div
                              key={val}
                              onClick={() => setCurrentTradeData(prev => {
                                const arr = prev.poi ? prev.poi.split(',').map(s => s.trim()).filter(Boolean) : [];
                                return { ...prev, poi: isSelected ? arr.filter(x => x !== val).join(', ') : [...arr, val].join(', ') };
                              })}
                              className={`group relative flex items-center px-3.5 py-1.5 text-sm rounded-full transition-all border cursor-pointer select-none ${getPillStyle(isSelected, isDark)}`}
                            >
                              <span>{formatTagDisplay(val)}</span>
                              {isCustom && (
                                <div className="flex items-center ml-2 space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button onClick={(e) => { e.stopPropagation(); setEditingTag({ oldTag: val, text: formatTagDisplay(val) }); }} className={`p-0.5 rounded ${isDark ? 'hover:bg-gray-700 text-gray-400 hover:text-white' : 'hover:bg-gray-200 text-gray-500 hover:text-gray-800'}`}>
                                    <Pencil size={12} />
                                  </button>
                                  <button onClick={(e) => { e.stopPropagation(); handleDeleteTag(val); }} className={`p-0.5 rounded ${isDark ? 'hover:bg-red-500/20 text-gray-400 hover:text-red-400' : 'hover:bg-red-100 text-gray-500 hover:text-red-600'}`}>
                                    <X size={12} />
                                  </button>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* Confluences */}
                {(() => {
                  const selectedArr = currentTradeData.confluences;
                  const category = 'confluences';
                  const defaultOptions = ['EMA', 'Volume', 'Trendline', 'Fibonacci', 'News'];
                  const userTags = dbTags.filter(t => t.category === category).map(t => t.tag);
                  const allOptions = Array.from(new Set([...defaultOptions, ...userTags]));

                  return (
                    <div className={`space-y-3 ${getCardStyle(isDark)}`}>
                      <div className="flex items-center justify-between">
                        <label className={`block text-xs font-bold uppercase tracking-widest flex items-center ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] mr-2 transition-colors ${getStepBadgeStyle(selectedArr.length > 0, isDark)}`}>+</span>
                          Hợp lưu (Confluences)
                        </label>
                        {addingNew.category === category ? (
                           <form 
                             onSubmit={(e) => {
                               e.preventDefault();
                               if (addingNew.text.trim()) {
                                 handleAddNewTag(addingNew.text.trim(), category);
                               }
                               setAddingNew({ category: null, text: '' });
                             }}
                             className="flex items-center"
                           >
                             <input 
                               autoFocus
                               type="text"
                               value={addingNew.text}
                               onChange={e => setAddingNew({ ...addingNew, text: e.target.value })}
                               onBlur={() => setTimeout(() => setAddingNew({ category: null, text: '' }), 150)}
                               className={`px-3 py-1 text-xs w-28 rounded border focus:outline-none focus:ring-1 focus:ring-emerald-500 ${isDark ? 'bg-[#1a1e29] border-emerald-500 text-white' : 'bg-white border-emerald-500 text-gray-900'}`}
                               placeholder="Tạo mới..."
                             />
                           </form>
                        ) : (
                          <button
                            onClick={() => setAddingNew({ category, text: '' })}
                            className={`text-xs font-medium flex items-center transition-colors ${isDark ? 'text-gray-500 hover:text-emerald-400' : 'text-slate-400 hover:text-emerald-600'}`}
                          >
                            <Plus size={14} className="mr-1" /> Thêm mới
                          </button>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar pb-2">
                        {allOptions.map(val => {
                          const isSelected = selectedArr.includes(val);
                          const isCustom = !defaultOptions.includes(val);
                          const isEditing = editingTag?.oldTag === val;

                          if (isEditing) {
                            return (
                              <form key={val} onSubmit={(e) => { e.preventDefault(); handleUpdateTag(val, editingTag.text.trim() || formatTagDisplay(val)); }} className="flex items-center">
                                <input 
                                  autoFocus type="text" value={editingTag.text} onChange={e => setEditingTag(prev => ({...prev, text: e.target.value}))}
                                  onBlur={() => handleUpdateTag(val, editingTag.text.trim() || formatTagDisplay(val))}
                                  className={`px-3 py-1.5 text-sm w-32 rounded-full border focus:outline-none focus:ring-1 focus:ring-emerald-500 ${isDark ? 'bg-[#1a1e29] border-emerald-500 text-white' : 'bg-white border-emerald-500 text-gray-900'}`}
                                />
                              </form>
                            );
                          }

                          return (
                            <div
                              key={val}
                              onClick={() => setCurrentTradeData(prev => {
                                const exists = prev.confluences.includes(val);
                                return { 
                                  ...prev, 
                                  confluences: exists ? prev.confluences.filter(c => c !== val) : [...prev.confluences, val] 
                                };
                              })}
                              className={`group relative flex items-center px-3.5 py-1.5 text-sm rounded-full transition-all border cursor-pointer select-none ${getPillStyle(isSelected, isDark)}`}
                            >
                              <span>{formatTagDisplay(val)}</span>
                              {isCustom && (
                                <div className="flex items-center ml-2 space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button onClick={(e) => { e.stopPropagation(); setEditingTag({ oldTag: val, text: formatTagDisplay(val) }); }} className={`p-0.5 rounded ${isDark ? 'hover:bg-gray-700 text-gray-400 hover:text-white' : 'hover:bg-gray-200 text-gray-500 hover:text-gray-800'}`}>
                                    <Pencil size={12} />
                                  </button>
                                  <button onClick={(e) => { e.stopPropagation(); handleDeleteTag(val); }} className={`p-0.5 rounded ${isDark ? 'hover:bg-red-500/20 text-gray-400 hover:text-red-400' : 'hover:bg-red-100 text-gray-500 hover:text-red-600'}`}>
                                    <X size={12} />
                                  </button>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* Exit Reason */}
                <div className={`space-y-3 ${getCardStyle(isDark)}`}>
                  <label className={`block text-xs font-bold uppercase tracking-widest flex items-center ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] mr-2 transition-colors ${getStepBadgeStyle(!!currentTradeData.exit_reason, isDark)}`}>+</span>
                    Lý do thoát lệnh
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { tag: '#Exit_TPSL', label: 'TP/SL' },
                      { tag: '#Exit_Manual', label: 'Manual Exit' },
                      { tag: '#Exit_Time', label: 'Time Exit' },
                      { tag: '#Exit_News', label: 'News Exit' },
                      { tag: '#Exit_Invalidated', label: 'Invalidated' },
                      { tag: '#Exit_Other', label: 'Other' }
                    ].map(({tag, label}) => {
                      const selectedArr = currentTradeData.exit_reason ? currentTradeData.exit_reason.split(',').map(s => s.trim()).filter(Boolean) : [];
                      const isSelected = selectedArr.includes(tag) || selectedArr.includes(label);
                      return (
                        <button
                          key={tag}
                          onClick={() => setCurrentTradeData(prev => {
                            const arr = prev.exit_reason ? prev.exit_reason.split(',').map(s => s.trim()).filter(Boolean) : [];
                            // If selected by either tag or label, remove it. Otherwise add the tag.
                            const isActive = arr.includes(tag) || arr.includes(label);
                            return { ...prev, exit_reason: isActive ? arr.filter(x => x !== tag && x !== label).join(', ') : [...arr, tag].join(', ') };
                          })}
                          className={`px-3.5 py-1.5 text-sm rounded-full transition-all border ${getPillStyle(isSelected, isDark)}`}
                        >
                          {label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Risk Plan */}
                <div className={`space-y-3 ${getCardStyle(isDark)}`}>
                  <h3 className={`text-xs font-bold uppercase tracking-widest flex items-center ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] mr-2 transition-colors ${getStepBadgeStyle(!!currentTradeData.risk_plan, isDark)}`}>+</span>
                    Tuân thủ Risk Plan?
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { tag: '#Risk_Followed', label: 'Có' },
                      { tag: '#Risk_Violated', label: 'Không' }
                    ].map(({tag, label}) => {
                      const isSelected = currentTradeData.risk_plan === tag;
                      return (
                        <button
                          key={tag}
                          onClick={() => setCurrentTradeData(prev => ({ ...prev, risk_plan: isSelected ? '' : tag }))}
                          className={`px-3.5 py-1.5 text-sm rounded-full transition-all border ${getPillStyle(isSelected, isDark)}`}
                        >
                          {label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Setup Grade */}
                <div className={`space-y-3 ${getCardStyle(isDark)}`}>
                  <h3 className={`text-xs font-bold uppercase tracking-widest flex items-center ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] mr-2 transition-colors ${getStepBadgeStyle(!!currentTradeData.setup_grade, isDark)}`}>+</span>
                    Setup Grade
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { tag: '#Grade_A_Plus', label: 'A+' },
                      { tag: '#Grade_A', label: 'A' },
                      { tag: '#Grade_B', label: 'B' },
                      { tag: '#Grade_C', label: 'C' }
                    ].map(({tag, label}) => {
                      const isSelected = currentTradeData.setup_grade === tag || currentTradeData.setup_grade === label;
                      return (
                        <button
                          key={tag}
                          onClick={() => setCurrentTradeData(prev => ({ ...prev, setup_grade: isSelected ? '' : tag }))}
                          className={`w-11 h-11 flex items-center justify-center text-sm rounded-xl transition-all border ${getPillStyle(isSelected, isDark)}`}
                        >
                          {label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Lesson Learned */}
            <div className="space-y-2 pt-5 border-t border-dashed border-gray-200 dark:border-gray-700">
              <h3 className={`text-sm font-bold uppercase tracking-wider flex items-center ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                Lesson Learned <span className="ml-2 text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">Optional</span>
              </h3>
              
              {currentTradeData.system_notes && (
                <div className={`p-3 rounded-xl text-xs font-mono whitespace-pre-wrap border max-h-32 overflow-y-auto custom-scrollbar shadow-inner ${isDark ? 'bg-black/20 border-[#2a2e39] text-gray-300' : 'bg-gray-50 border-gray-200 text-gray-500'}`}>
                  {currentTradeData.system_notes}
                </div>
              )}
              
              <textarea 
                value={currentTradeData.lesson}
                onChange={(e) => setCurrentTradeData(prev => ({ ...prev, lesson: e.target.value }))}
                className={`w-full h-24 p-4 rounded-xl text-sm border focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 outline-none transition-all resize-none shadow-inner ${
                  isDark 
                    ? 'bg-black/20 border-[#2a2e39] text-gray-100 placeholder-gray-500 shadow-black/40 hover:border-[#3a3f50]' 
                    : 'bg-gray-50/50 border-gray-200 text-gray-900 placeholder-gray-400 shadow-gray-200/20 hover:border-gray-300'
                }`}
                placeholder="Bài học rút ra từ lệnh này là gì?..."
              />
            </div>

            <div className="flex-1" />
              <div className="h-28 flex-shrink-0" />
            </div>

            {/* Save Buttons (Sticky Bottom) */}
            <div className={`absolute bottom-0 left-0 right-0 z-20 p-4 md:px-6 border-t ${isDark ? 'bg-[#131722]/95 border-[#2a2e39] backdrop-blur-md' : 'bg-slate-50/95 border-gray-200/80 backdrop-blur-md'}`}>
              <div className="flex space-x-3">
                {trades.length > 1 && (
                  <button
                    onClick={handleBack}
                    disabled={currentIndex === 0 || isSaving}
                    className={`w-14 flex items-center justify-center py-3 rounded-xl border-2 transition-all font-bold disabled:opacity-50 disabled:cursor-not-allowed ${isDark ? 'bg-[#1a1e29] border-[#2a2e39] text-gray-400 hover:bg-[#202532] shadow-sm' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50 shadow-sm'} active:scale-[0.98]`}
                  >
                    <ArrowLeft size={20} />
                  </button>
                )}
                <button
                  onClick={handleSaveAndNext}
                  disabled={isSaving}
                  className="flex-1 flex items-center justify-center space-x-2 py-3 bg-emerald-500 hover:bg-emerald-400 text-white font-black text-base rounded-xl border-2 border-emerald-600 shadow-sm active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {isSaving ? (
                    <Loader2 size={20} className="animate-spin" />
                  ) : (
                    <>
                      <span>{currentIndex < trades.length - 1 ? 'Lưu & Tiếp theo' : 'Lưu & Hoàn thành'}</span>
                      {currentIndex < trades.length - 1 ? <ArrowRight size={20} /> : <CheckCircle size={20} />}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
          
        </div>
      </div>
      
      {/* Hidden Chart Generator for this Modal */}
      {tradeToGenerateImage && (() => {
        let existingImageCount = 0;
        try {
          if (tradeToGenerateImage.image_url) {
            const parsed = JSON.parse(tradeToGenerateImage.image_url);
            existingImageCount = Array.isArray(parsed) ? parsed.length : 0;
          }
        } catch (e) {}
        
        return (
          <HiddenChartGenerator 
            trade={tradeToGenerateImage}
            existingImageCount={existingImageCount}
            isBackground={true}
          onComplete={async (urls, error) => {
            setIsGeneratingImage(false);
            if (urls && urls.length > 0) {
              setGeneratedImages(urls);
              // Save it to db instantly
              try {
                await fetch('/api/trades', {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ id: tradeToGenerateImage.id, image_url: JSON.stringify(urls) })
                });
              } catch (e) {
                console.error(e);
              }
            } else if (error) {
              console.error('Failed to generate image:', error);
            }
            setTradeToGenerateImage(null);
          }}
        />
        );
      })()}
    </div>
  );
}
