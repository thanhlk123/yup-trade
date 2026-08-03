'use client';

import { useState, useEffect } from 'react';
import { Plus, X, Loader2, Sparkles, TrendingUp, AlertTriangle, BookOpen, Link, Upload, DollarSign, Clock, Target, Tag, ArrowRightLeft, Image, Save, FileText, ChevronDown, Trash2, Check } from 'lucide-react';
import { parseImageUrls } from '@/lib/imageUtils';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import HiddenChartGenerator from './HiddenChartGenerator';
import { OFFICIAL_HASHTAGS } from '@/lib/hashtags';

const TEMPLATES = {
  basic: `[PHÂN TÍCH BỐI CẢNH]
- Xu hướng chính (Trend): 
- Cấu trúc thị trường hiện tại: 

[LÝ DO VÀO LỆNH (SETUP)]
- Tín hiệu kích hoạt (Trigger): 
- Hợp lưu (Confluences): 

[QUẢN LÝ LỆNH]
- Kế hoạch chốt lời (TP) / Cắt lỗ (SL): 
- Xử lý khi giá đi đúng/ngược hướng: 

[TÂM LÝ & KỶ LUẬT]
- Cảm xúc khi vào lệnh: 
- Có phá vỡ quy tắc nào không?: 

[BÀI HỌC RÚT RA]
- Điều làm tốt: 
- Điều cần cải thiện: `,

  smc: `[SMC & PRICE ACTION]
- HTF Bias (H4/D1): 
- Thanh khoản (Liquidity / Inducement): Đã quét thanh khoản ở đâu?

[ĐIỂM VÀO LỆNH (POI)]
- Vùng giá quan tâm (OB/FVG/Breaker): 
- LTF Confirmation (M1/M5): Đã có CHoCH / Flip chưa?

[QUẢN LÝ VỐN & LỆNH]
- RR dự kiến: 
- Kế hoạch dời SL (Trailing) / Chốt lời từng phần: 

[TÂM LÝ GIAO DỊCH]
- Đợi đúng setup hay FOMO?: 
- Bài học: `
};

// Helper function to safely parse images
function parseTradeImages(imageUrlField) {
  return parseImageUrls(imageUrlField);
}

// Convert local datetime-local string to UTC SQL string (YYYY-MM-DD HH:mm:ss)
const convertLocalToUtcSql = (localStr) => {
  if (!localStr) return null;
  const date = new Date(localStr); // Parses as local time if no timezone offset is provided
  if (isNaN(date.getTime())) return null;
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:00`;
};

// Convert UTC DB string to local datetime-local string (YYYY-MM-DDThh:mm) for editing
const convertUtcDbToLocalStr = (utcDbStr) => {
  if (!utcDbStr) return '';
  const date = new Date(utcDbStr + 'Z'); // Treat DB string as UTC
  if (isNaN(date.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export default function TradeForm({ onTradeAdded, isOpen, onClose, tradeToEdit = null, accountTabs = [], inline = false, onOpenScratchpad }) {
  const { t } = useLanguage();
  const [formData, setFormData] = useState({
    asset: '',
    side: 'BUY',
    entry_price: '',
    exit_price: '',
    stop_loss: '',
    take_profit: '',
    size: '',
    trade_time: '', // Make optional by default
    exit_time: '',
    pnl: '',
    user_notes: '',
    trade_type: 'LIVE',
    image_url: '',
    is_lesson: 0,
  });
  const [uploadedImages, setUploadedImages] = useState([]);
  const [urlInput, setUrlInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isGeneratingChart, setIsGeneratingChart] = useState(false);
  
  // Native Hashtags
  const [sessionTag, setSessionTag] = useState('');
  const [selectedSetups, setSelectedSetups] = useState([]);
  const [selectedEvals, setSelectedEvals] = useState([]);
  
  // Custom Hashtags Management
  const [customTags, setCustomTags] = useState([]);
  const [managingCategory, setManagingCategory] = useState(null); // 'sessions' | 'setups' | 'strengths' | 'mistakes'
  const [openDropdown, setOpenDropdown] = useState(null); // category that has dropdown open
  const [newTagInput, setNewTagInput] = useState('');
  const [editingTag, setEditingTag] = useState(null);
  const [editLabelInput, setEditLabelInput] = useState('');
  const [isManagingLoading, setIsManagingLoading] = useState(false);

  const fetchCustomTags = async () => {
    try {
      const res = await fetch('/api/hashtags');
      if (res.ok) {
        const data = await res.json();
        setCustomTags(data.data || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const combinedSessions = customTags.filter(t => t.category === 'sessions');
  const combinedSetups = customTags.filter(t => t.category === 'setups');
  const combinedStrengths = customTags.filter(t => t.category === 'strengths');
  const combinedMistakes = customTags.filter(t => t.category === 'mistakes');

  const handleCreateCustomHashtag = async (e) => {
    e.preventDefault();
    if (!newTagInput || !newTagInput.trim()) return;
    setIsManagingLoading(true);
    try {
      const res = await fetch('/api/hashtags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: newTagInput })
      });
      const data = await res.json();
      if (data.success) {
        setNewTagInput('');
        fetchCustomTags();
      } else {
        alert(data.error);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsManagingLoading(false);
    }
  };

  const handleEditCustomHashtag = async (oldTag) => {
    if (!editLabelInput || !editLabelInput.trim()) {
      setEditingTag(null);
      return;
    }
    setIsManagingLoading(true);
    try {
      const res = await fetch('/api/hashtags', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldTag, newLabel: editLabelInput })
      });
      const data = await res.json();
      if (data.success) {
        setEditingTag(null);
        
        const newTag = data.newTag;
        if (newTag && newTag !== oldTag) {
          if (sessionTag === oldTag) setSessionTag(newTag);
          if (selectedSetups.includes(oldTag)) setSelectedSetups(prev => prev.map(t => t === oldTag ? newTag : t));
          if (selectedEvals.includes(oldTag)) setSelectedEvals(prev => prev.map(t => t === oldTag ? newTag : t));
        }
        
        fetchCustomTags();
      } else {
        alert(data.error);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsManagingLoading(false);
    }
  };

  const handleDeleteCustomHashtag = async (tag) => {
    if (!confirm(t('errConfirmDelete').replace('{tag}', tag))) return;
    setIsManagingLoading(true);
    try {
      const res = await fetch(`/api/hashtags?tag=${encodeURIComponent(tag)}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        fetchCustomTags();
      } else {
        alert(data.error);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsManagingLoading(false);
    }
  };

  const handleAddUrlImage = () => {
    if (!urlInput.trim()) return;
    if (uploadedImages.length >= 10) {
      alert(t('errImageLimit'));
      return;
    }
    setUploadedImages(prev => [...prev, urlInput.trim()]);
    setUrlInput('');
  };

  // Handle Edit/Create synchronization
  useEffect(() => {
    if (tradeToEdit) {
      setFormData({
        id: tradeToEdit.id,
        asset: tradeToEdit.asset,
        side: tradeToEdit.side,
        entry_price: tradeToEdit.entry_price,
        exit_price: tradeToEdit.exit_price,
        stop_loss: tradeToEdit.stop_loss || '',
        take_profit: tradeToEdit.take_profit || '',
        size: tradeToEdit.size,
        trade_time: convertUtcDbToLocalStr(tradeToEdit.trade_time),
        exit_time: convertUtcDbToLocalStr(tradeToEdit.exit_time),
        pnl: tradeToEdit.pnl !== undefined && tradeToEdit.pnl !== null ? tradeToEdit.pnl : '',
        user_notes: tradeToEdit.user_notes || '',
        trade_type: tradeToEdit.trade_type || (accountTabs && accountTabs.length > 0 ? accountTabs[0].key : 'LIVE'),
        image_url: tradeToEdit.image_url || '',
        is_lesson: tradeToEdit.is_lesson || 0,
      });
      setUploadedImages(parseTradeImages(tradeToEdit.image_url));
    } else {
      setFormData({
        asset: '',
        side: 'BUY',
        entry_price: '',
        exit_price: '',
        stop_loss: '',
        take_profit: '',
        size: '',
        trade_time: '',
        exit_time: '',
        pnl: '',
        user_notes: '',
        trade_type: accountTabs && accountTabs.length > 0 ? accountTabs[0].key : 'LIVE',
        image_url: '',
        is_lesson: 0,
      });
      setUploadedImages([]);
    }
    setError('');
    
    fetchCustomTags();
  }, [isOpen, inline, tradeToEdit]);

  if (!isOpen && !inline) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    let currentLength = uploadedImages.length;
    let hasSizeWarning = false;
    let hasLimitWarning = false;

    files.forEach(file => {
      if (currentLength >= 5) {
        hasLimitWarning = true;
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        hasSizeWarning = true;
        return;
      }

      currentLength++;
      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadedImages(prev => {
          if (prev.length >= 10) return prev;
          return [...prev, reader.result];
        });
      };
      reader.readAsDataURL(file);
    });

    if (hasLimitWarning) {
      alert(t('errImageLimit'));
    } else if (hasSizeWarning) {
      alert(t('errImageSize'));
    }
  };

  const handleRemoveImage = (index) => {
    setUploadedImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.trade_time && formData.exit_time) {
      const entryTime = new Date(formData.trade_time).getTime();
      const exitTime = new Date(formData.exit_time).getTime();
      if (exitTime < entryTime) {
        setError(t('errTimeValidation'));
        return;
      }
    }

    setLoading(true);
    setError('');

    const payload = {
      ...formData,
      trade_time: convertLocalToUtcSql(formData.trade_time),
      exit_time: convertLocalToUtcSql(formData.exit_time),
      image_url: uploadedImages.length > 0 ? JSON.stringify(uploadedImages) : null
    };

    const buildFinalNotes = (baseNotes) => {
      const tags = [];
      if (sessionTag) tags.push(sessionTag);
      if (selectedSetups.length > 0) tags.push(...selectedSetups);
      if (selectedEvals.length > 0) tags.push(...selectedEvals);
      
      if (tags.length === 0) return baseNotes;
      
      // Prevent duplicating tags if they are already in baseNotes (e.g. from editing an old trade)
      let finalTagsToAppend = [];
      tags.forEach(t => {
        if (!baseNotes.includes(`[${t}]`)) {
          finalTagsToAppend.push(t);
        }
      });

      if (finalTagsToAppend.length === 0) return baseNotes;

      const tagString = finalTagsToAppend.map(t => `[${t}]`).join(' ');
      return `${tagString}\n\n${baseNotes}`;
    };

    try {
      const finalNotes = buildFinalNotes(payload.user_notes);
      payload.user_notes = finalNotes;

      const response = await fetch('/api/trades', {
        method: tradeToEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      if (result.success) {
        onTradeAdded(result.data);
        onClose();
        // Reset form
        setFormData({
          asset: '',
          side: 'BUY',
          entry_price: '',
          exit_price: '',
          stop_loss: '',
          take_profit: '',
          size: '',
          trade_time: new Date().toISOString().substring(0, 16),
          exit_time: '',
          user_notes: '',
          trade_type: 'LIVE',
          image_url: '',
          is_lesson: 0,
        });
        setUploadedImages([]);
        setSessionTag('');
        setSelectedSetups([]);
        setSelectedEvals([]);
      } else {
        setError(result.error || t('errSaveFailed'));
      }
    } catch (err) {
      console.error(err);
      setError(t('errNetwork'));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen && !inline) return null;

  const renderDropdown = (category, label, options, selected, onToggle) => {
    const isOpen = openDropdown === category;
    
    return (
      <div className="relative flex flex-col gap-2 w-full">
        <div className="flex items-center gap-3 w-full">
          <span className="text-xs font-bold text-slate-400 w-16 shrink-0">{label}:</span>
          <div className="relative flex-1">
            <button 
              type="button" 
              onClick={() => setOpenDropdown(isOpen ? null : category)}
              className="bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 rounded-xl px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 flex items-center justify-between w-full transition-all"
            >
              <span className={selected.length > 0 ? "text-white font-bold" : "text-slate-500 truncate"}>
                {selected.length > 0 ? `${t('hashtagSelected')} (${selected.length})` : t('hashtagSelectHint')}
              </span>
              <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            
            {isOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => { setOpenDropdown(null); setEditingTag(null); setNewTagInput(''); }} />
                <div className="absolute top-full left-0 mt-2 z-50 w-full sm:w-[320px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl p-2 max-h-[350px] flex flex-col">
                  
                  {/* Inline Create */}
                  <div className="p-2 border-b border-slate-200 dark:border-white/5 flex items-center gap-2 mb-2">
                     <input
                       type="text"
                       value={newTagInput}
                       onChange={e => setNewTagInput(e.target.value)}
                       placeholder={t('hashtagAddHint')}
                       className="flex-1 bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-1.5 text-xs text-slate-800 dark:text-white outline-none focus:border-sky-500/50"
                       onKeyDown={(e) => {
                         if (e.key === 'Enter') {
                           e.preventDefault();
                           handleCreateCustomHashtag(e);
                         }
                       }}
                     />
                     <button
                       type="button"
                       disabled={isManagingLoading || !newTagInput.trim()}
                       onClick={handleCreateCustomHashtag}
                       className="bg-sky-500/20 text-sky-400 hover:bg-sky-500/30 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors disabled:opacity-50 shrink-0"
                     >
                       {isManagingLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : t('hashtagAddBtn')}
                     </button>
                  </div>

                  {/* Options List */}
                  <div className="overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 flex-1 pr-1">
                    {options.map(opt => {
                       const isSelected = selected.includes(opt.tag);
                       const isEditing = editingTag === opt.tag;
                       
                       if (isEditing) {
                          return (
                             <div key={opt.tag} className="flex items-center gap-2 px-2 py-1.5 mb-1 bg-white/5 rounded-xl border border-sky-500/30">
                               <input
                                 type="text"
                                 autoFocus
                                 value={editLabelInput}
                                 onChange={e => setEditLabelInput(e.target.value)}
                                 className="flex-1 bg-black/50 border border-white/20 rounded-lg px-2 py-1 text-xs text-white outline-none"
                                 onKeyDown={(e) => {
                                   if (e.key === 'Enter') { e.preventDefault(); handleEditCustomHashtag(opt.tag); }
                                   if (e.key === 'Escape') setEditingTag(null);
                                 }}
                               />
                               <button type="button" onClick={() => handleEditCustomHashtag(opt.tag)} className="text-emerald-400 p-1.5 hover:bg-white/10 rounded-lg">
                                 <Check className="w-4 h-4" />
                               </button>
                               <button type="button" onClick={() => setEditingTag(null)} className="text-slate-400 p-1.5 hover:bg-white/10 rounded-lg">
                                 <X className="w-4 h-4" />
                               </button>
                             </div>
                          );
                       }

                       return (
                         <div key={opt.tag} className="relative group mb-1 flex items-center w-full">
                           <button
                             type="button"
                             onClick={() => onToggle(opt.tag)}
                             className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-between ${
                               isSelected 
                                 ? 'bg-sky-500/20 text-sky-300' 
                                 : 'text-slate-300 hover:bg-white/5'
                             }`}
                           >
                             <span className="truncate pr-16">{opt.label || opt.tag.replace(/#(Session|Setup|Strength|Mistake)_/, '')} <span className="text-[10px] font-normal opacity-40 ml-1">{opt.group !== 'Mặc định' && t('hashtagCustom')}</span></span>
                             {isSelected && <Check className="w-4 h-4 text-sky-400 shrink-0" />}
                           </button>
                           
                           <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 border border-white/10 rounded-lg p-1 shadow-lg">
                             <button type="button" onClick={(e) => { e.stopPropagation(); setEditingTag(opt.tag); setEditLabelInput(opt.label); }} className="p-1.5 text-slate-400 hover:text-sky-400 hover:bg-white/10 rounded-md transition-colors" title={t('hashtagEditTitle')}>
                               <FileText className="w-3.5 h-3.5" />
                             </button>
                             <button type="button" onClick={(e) => { e.stopPropagation(); handleDeleteCustomHashtag(opt.tag); }} className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-white/10 rounded-md transition-colors" title={t('hashtagDeleteTitle')}>
                               <Trash2 className="w-3.5 h-3.5" />
                             </button>
                           </div>
                         </div>
                       )
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
        
        {/* Selected Chips */}
        {selected.length > 0 && (
           <div className="flex flex-wrap gap-2 ml-[76px]">
             {selected.map(tag => (
                <span key={tag} className="bg-sky-500/20 text-sky-300 border border-sky-500/30 text-[11px] font-bold px-2 py-1 rounded-lg flex items-center gap-1.5 group cursor-pointer hover:bg-rose-500/20 hover:text-rose-300 hover:border-rose-500/30 transition-colors" onClick={() => onToggle(tag)} title={t('hashtagRemoveChip')}>
                   {customTags.find(t => t.tag === tag)?.label || tag.replace(/#(Session|Setup|Strength|Mistake)_/, '')}
                   <X className="w-3 h-3 group-hover:opacity-100 opacity-50" />
                </span>
             ))}
           </div>
        )}
      </div>
    );
  };

  const wrapperClass = inline
    ? "h-full w-full flex flex-col"
    : "fixed inset-0 z-50 flex items-center justify-center bg-slate-200/60 dark:bg-slate-950/60 backdrop-blur-md p-4 animate-fade-in";

  const innerClass = inline
    ? "relative w-full h-full flex flex-col"
    : "relative w-[95vw] max-w-6xl bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur-3xl border border-slate-200 dark:border-white/10 rounded-3xl shadow-[0_0_60px_-15px_rgba(16,185,129,0.15)] overflow-hidden flex flex-col max-h-[95vh]";

  const InputWrapper = ({ label, icon: Icon, children }) => (
    <div className="group relative">
      <label className="flex items-center gap-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
        {Icon && <Icon className="w-3.5 h-3.5 text-slate-500 group-focus-within:text-emerald-400 transition-colors" />}
        {label}
      </label>
      {children}
    </div>
  );

  const inputClass = "w-full bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-white/5 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 rounded-xl px-4 py-2.5 text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-600 transition-all outline-none font-medium text-sm";

  return (
    <div className={wrapperClass}>
      <div className={innerClass}>
        
        {/* Header */}
        <div className="px-8 py-5 border-b border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 to-teal-500/5 pointer-events-none" />
          <h2 className="relative z-10 text-lg font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400 uppercase tracking-wider flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
              <BookOpen className="w-4 h-4 text-emerald-400" />
            </div>
            {tradeToEdit ? t('editTradeTitle') : t('newTradeTitle')}
          </h2>
          {!inline && (
            <button
              onClick={onClose}
              className="relative z-10 p-2 hover:bg-slate-200 dark:hover:bg-white/10 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 md:p-8 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
          {error && (
            <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-start gap-3 text-rose-400 text-sm animate-shake">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full">
            {/* LEFT COLUMN: Narrative & Context (col-span-7) */}
            <div className="lg:col-span-7 flex flex-col gap-6 h-full">



              {/* Native Hashtags Toolbar */}
              <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-white/5 rounded-2xl p-6 space-y-6 shrink-0">
                <div className="flex items-center gap-2 mb-2 border-b border-slate-200 dark:border-white/5 pb-4">
                  <Tag className="w-5 h-5 text-emerald-400" />
                  <h3 className="text-base font-bold text-emerald-400 uppercase tracking-wider">{t('quickClassification')}</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                  {renderDropdown('sessions', t('sessionLabel'), combinedSessions, sessionTag ? [sessionTag] : [], (tag) => setSessionTag(tag === sessionTag ? '' : tag))}
                  {renderDropdown('setups', t('setupLabel'), combinedSetups, selectedSetups, (tag) => setSelectedSetups(prev => prev.includes(tag) ? prev.filter(x => x !== tag) : [...prev, tag]))}
                  {renderDropdown('strengths', t('strengthsLabel'), combinedStrengths, selectedEvals.filter(t => t.startsWith('#Strength')), (tag) => setSelectedEvals(prev => prev.includes(tag) ? prev.filter(x => x !== tag) : [...prev, tag]))}
                  {renderDropdown('mistakes', t('mistakesLabel'), combinedMistakes, selectedEvals.filter(t => t.startsWith('#Mistake')), (tag) => setSelectedEvals(prev => prev.includes(tag) ? prev.filter(x => x !== tag) : [...prev, tag]))}
                </div>
              </div>



              {/* Section: Notes and Media */}
              <div className="bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 rounded-2xl p-6 space-y-6 flex-1 flex flex-col min-h-[500px]">
                <div className="flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-4 bg-amber-500 rounded-full" />
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">{t('notesAndContext')}</h3>
                  </div>
                </div>

                <textarea
                  name="user_notes"
                  value={formData.user_notes}
                  onChange={handleChange}
                  placeholder={t('notesPlaceholder')}
                  className={`${inputClass} flex-1 font-mono text-xs leading-relaxed resize-none min-h-[120px]`}
                ></textarea>

                <div 
                  onClick={() => setFormData(prev => ({ ...prev, is_lesson: prev.is_lesson ? 0 : 1 }))}
                  className={`shrink-0 flex items-center gap-4 border rounded-xl p-4 transition-all cursor-pointer select-none ${
                    formData.is_lesson
                      ? 'bg-amber-500/10 border-amber-500/40 shadow-[0_0_20px_rgba(245,158,11,0.1)]'
                      : 'bg-white/[0.02] border-white/5 hover:border-white/10'
                  }`}
                >
                  <div className={`w-6 h-6 rounded flex items-center justify-center transition-all ${
                    formData.is_lesson 
                      ? 'bg-amber-500 text-slate-950' 
                      : 'bg-white/5 border border-white/10 text-transparent'
                  }`}>
                    <svg className="w-4 h-4 stroke-[3]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" stroke="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <span className={`text-sm font-bold block ${formData.is_lesson ? 'text-amber-400' : 'text-slate-300'}`}>
                      {t('markAsLesson')}
                    </span>
                    <span className="text-xs text-slate-500 block mt-0.5">{t('lessonHint')}</span>
                  </div>
                </div>

                <div className="shrink-0 pt-4 border-t border-white/5">
                  <div className="flex items-center justify-between mb-4">
                    <label className="flex items-center gap-2 text-[11px] font-bold text-slate-200 uppercase tracking-wider">
                      <Image className="w-4 h-4 text-emerald-400" /> {t('chartImages')} ({uploadedImages.length}/10)
                    </label>
                    {isGeneratingChart ? (
                      <div className="text-[11px] font-bold text-emerald-400 flex items-center gap-2">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> {t('generatingImage')}
                      </div>
                    ) : (
                      (() => {
                        const hasAsset = formData.asset && formData.asset.trim() !== '';
                        const hasEntry = formData.entry_price && !isNaN(parseFloat(formData.entry_price));
                        const hasExit = formData.exit_price && !isNaN(parseFloat(formData.exit_price));
                        const hasEntryTime = !!formData.trade_time;
                        const hasExitTime = !!formData.exit_time;

                        const disabledReasons = [];
                        if (!hasAsset) disabledReasons.push("Tài sản (Asset) đang trống");
                        if (!hasEntry) disabledReasons.push("Entry đang trống hoặc không hợp lệ");
                        if (!hasExit) disabledReasons.push("Exit đang trống hoặc không hợp lệ");
                        if (!hasEntryTime) disabledReasons.push("Thời gian vào lệnh đang trống");
                        if (!hasExitTime) disabledReasons.push("Thời gian ra lệnh đang trống");
                        if (uploadedImages.length >= 10) disabledReasons.push("Đã đạt giới hạn 10 ảnh");

                        const isChartGenDisabled = disabledReasons.length > 0;
                        const tooltipTitle = isChartGenDisabled ? "Thiếu điều kiện tạo ảnh:\n- " + disabledReasons.join("\n- ") : "Tạo ảnh biểu đồ tự động từ TradingView";

                        return (
                          <div className="flex items-center gap-1.5">
                            {isChartGenDisabled && (
                              <button
                                type="button"
                                onClick={() => alert(`${t('autoGenMissingConditions')}\n\n- ` + disabledReasons.join("\n- "))}
                                className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors border border-amber-500/20 cursor-pointer"
                                title={t('autoGenCheckConditionHint')}
                              >
                                <AlertTriangle className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setIsGeneratingChart(true)}
                              disabled={isChartGenDisabled}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors text-[11px] font-bold uppercase tracking-wide border ${isChartGenDisabled ? 'bg-slate-800/50 text-slate-500 border-slate-700/50 cursor-not-allowed' : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border-emerald-500/20'}`}
                              title={isChartGenDisabled ? t('autoGenNotEnoughConditions') : t('autoGenTooltip')}
                            >
                              <Sparkles className="w-3.5 h-3.5" /> {t('autoGenImageBtn')}
                            </button>
                          </div>
                        );
                      })()
                    )}
                  </div>
                  
                  {isGeneratingChart && (
                    <div className="absolute opacity-0 pointer-events-none w-0 h-0 overflow-hidden" style={{ zIndex: -999 }}>
                      <HiddenChartGenerator
                        trade={{
                          ...formData,
                          entry_price: parseFloat(formData.entry_price),
                          exit_price: parseFloat(formData.exit_price),
                          size: parseFloat(formData.size || 0),
                          pnl: formData.pnl !== '' && !isNaN(parseFloat(formData.pnl)) ? parseFloat(formData.pnl) : (() => {
                             const entry = parseFloat(formData.entry_price);
                             const exit = parseFloat(formData.exit_price);
                             const sz = parseFloat(formData.size || 0);
                             let p = 0;
                             if (formData.side === 'BUY') p = (exit - entry) * sz;
                             else if (formData.side === 'SELL') p = (entry - exit) * sz;
                             return Math.round(p * 100) / 100;
                          })()
                        }}
                        onComplete={(images) => {
                          if (images && images.length > 0) {
                            setUploadedImages(prev => {
                              const combined = [...prev, ...images];
                              return combined.slice(0, 10);
                            });
                          }
                          setIsGeneratingChart(false);
                        }}
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {uploadedImages.map((imgUrl, idx) => (
                      <div key={idx} className="relative aspect-video rounded-xl overflow-hidden border border-white/10 bg-black/40 group">
                        <img 
                          src={imgUrl} 
                          alt={`Preview ${idx + 1}`} 
                          onError={(e) => {
                            e.target.style.display = 'none';
                            if (e.target.nextElementSibling) e.target.nextElementSibling.style.display = 'flex';
                          }}
                          className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition duration-300"
                        />
                        <div className="absolute inset-0 hidden items-center justify-center text-slate-400 dark:text-slate-600 bg-slate-100 dark:bg-slate-900 pointer-events-none">
                           <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8 opacity-50"><line x1="3" y1="3" x2="21" y2="21"/><path d="M15 15l2.121-2.121A4 4 0 0 0 11.414 7.17L9 9.586"/><path d="m3 16 5-5"/><path d="M4 22h14c0-1.1.9-2 2-2"/><path d="M22 18V4a2 2 0 0 0-2-2H8"/><circle cx="9" cy="9" r="2"/></svg>
                        </div>
                        <span className="absolute bottom-1 right-1 text-[9px] bg-white/90 dark:bg-slate-950/70 text-slate-600 dark:text-slate-200 px-1.5 py-0.5 rounded-md font-mono shadow-sm backdrop-blur-sm pointer-events-none border border-slate-200/50 dark:border-transparent">
                          #{idx + 1}
                        </span>
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveImage(idx)}
                            className="p-2 bg-rose-500 hover:bg-rose-600 text-white rounded-full transition shadow-lg transform scale-90 group-hover:scale-100 cursor-pointer"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}

                    {uploadedImages.length < 10 && (
                      <div className="relative aspect-video rounded-xl overflow-hidden border-2 border-dashed border-slate-300 dark:border-white/10 hover:border-emerald-500/50 hover:bg-emerald-500/5 transition duration-300 cursor-pointer flex flex-col items-center justify-center gap-2 group">
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={handleImageChange}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        />
                        <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-white/5 group-hover:bg-emerald-500/20 flex items-center justify-center transition-colors">
                          <Plus className="w-4 h-4 text-slate-400 group-hover:text-emerald-400" />
                        </div>
                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-200 group-hover:text-emerald-400 uppercase">{t('uploadImage')}</span>
                      </div>
                    )}
                  </div>

                  {uploadedImages.length < 10 && (
                    <div className="flex items-center gap-2 mt-4 max-w-sm">
                      <div className="relative flex-1">
                        <Link className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="text"
                          value={urlInput}
                          onChange={e => setUrlInput(e.target.value)}
                          placeholder={t('orPasteUrl')}
                          className="w-full bg-slate-100 dark:bg-slate-950/40 border border-slate-200 dark:border-white/5 text-slate-800 dark:text-white text-xs rounded-lg pl-9 pr-3 py-2 focus:outline-none focus:border-sky-500/50 transition-colors placeholder:text-slate-400 dark:placeholder:text-slate-300"
                        />
                      </div>
                      {urlInput.trim() && (
                        <button
                          type="button"
                          onClick={handleAddUrlImage}
                          className="px-4 py-2 bg-sky-500/10 text-sky-400 hover:bg-sky-500/20 hover:text-sky-300 border border-sky-500/20 font-bold text-xs rounded-lg transition-colors cursor-pointer shrink-0"
                        >
                          {t('addButton')}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: Technicals (col-span-5) */}
            <div className="lg:col-span-5 flex flex-col gap-6 h-full overflow-y-auto pr-1">
              
              {/* Section 1: General & Position */}
              <div className="bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 rounded-2xl p-6 space-y-5 shrink-0">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-1.5 h-4 bg-emerald-500 rounded-full" />
                  <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider">{t('infoAndPosition')}</h3>
                </div>
                
                <div className="space-y-4">
                  <InputWrapper label={t('assetLabel')} icon={Tag}>
                    <input
                      type="text"
                      name="asset"
                      value={formData.asset}
                      onChange={handleChange}
                      placeholder={t('assetPlaceholder')}
                      required
                      className={inputClass}
                    />
                  </InputWrapper>

                  <InputWrapper label={t('sideLabel')} icon={ArrowRightLeft}>
                    <div className="grid grid-cols-2 gap-1.5 bg-slate-100 dark:bg-slate-950/40 border border-slate-200 dark:border-white/5 p-1 rounded-xl">
                      <button
                        type="button"
                        onClick={() => setFormData(p => ({ ...p, side: 'BUY' }))}
                        className={`py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          formData.side === 'BUY' 
                            ? 'bg-emerald-500 text-slate-950 shadow-[0_0_15px_rgba(16,185,129,0.3)]' 
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/5'
                        }`}
                      >
                        BUY
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData(p => ({ ...p, side: 'SELL' }))}
                        className={`py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          formData.side === 'SELL' 
                            ? 'bg-rose-500 text-white shadow-[0_0_15px_rgba(244,63,94,0.3)]' 
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/5'
                        }`}
                      >
                        SELL
                      </button>
                    </div>
                  </InputWrapper>

                  <div className="grid grid-cols-2 gap-4">
                    <InputWrapper label={t('accountLabel')} icon={Target}>
                      <div className="relative">
                        <select
                          value={formData.trade_type}
                          onChange={(e) => setFormData(p => ({ ...p, trade_type: e.target.value }))}
                          className={`${inputClass} appearance-none pr-8 cursor-pointer`}
                        >
                          {(accountTabs && accountTabs.length > 0 ? accountTabs.filter(t => !t.isAll) : [
                            { key: 'LIVE', label: 'Live' },
                            { key: 'BACKTEST', label: 'Backtest' }
                          ]).map((tab) => (
                            <option key={tab.key} value={tab.key} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-white">{tab.label}</option>
                          ))}
                        </select>
                        <ChevronDown className="w-4 h-4 text-slate-500 absolute right-3 top-3.5 pointer-events-none" />
                      </div>
                    </InputWrapper>

                    <InputWrapper label={t('sizeLabel')} icon={TrendingUp}>
                      <input
                        type="number"
                        step="any"
                        name="size"
                        value={formData.size}
                        onChange={handleChange}
                        placeholder="0.1"
                        required
                        min="0.00000001"
                        className={inputClass}
                      />
                    </InputWrapper>
                  </div>
                </div>
              </div>

              {/* Section 2: Pricing */}
              <div className="bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 rounded-2xl p-6 space-y-5 shrink-0">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-1.5 h-4 bg-sky-500 rounded-full" />
                  <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider">{t('pricingStats')}</h3>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <InputWrapper label="Entry Price">
                    <input
                      type="number" step="any" name="entry_price"
                      value={formData.entry_price} onChange={handleChange}
                      placeholder="0.00" required
                      className={inputClass}
                    />
                  </InputWrapper>
                  <InputWrapper label="Exit Price">
                    <input
                      type="number" step="any" name="exit_price"
                      value={formData.exit_price} onChange={handleChange}
                      placeholder="0.00" required
                      className={inputClass}
                    />
                  </InputWrapper>
                  <InputWrapper label="Stop Loss (SL)">
                    <input
                      type="number" step="any" name="stop_loss"
                      value={formData.stop_loss} onChange={handleChange}
                      placeholder="Tuỳ chọn"
                      className={inputClass}
                    />
                  </InputWrapper>
                  <InputWrapper label="Take Profit (TP)">
                    <input
                      type="number" step="any" name="take_profit"
                      value={formData.take_profit} onChange={handleChange}
                      placeholder="Tuỳ chọn"
                      className={inputClass}
                    />
                  </InputWrapper>
                </div>
              </div>

              {/* Section 3: Timing */}
              <div className="bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 rounded-2xl p-6 space-y-5 shrink-0">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-1.5 h-4 bg-purple-500 rounded-full" />
                  <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider">{t('timeAndResult')}</h3>
                </div>
                
                <div className="space-y-4">
                  <InputWrapper label={t('entryTime')} icon={Clock}>
                    <input
                      type="datetime-local" name="trade_time"
                      value={formData.trade_time} onChange={handleChange}
                      className={inputClass}
                    />
                  </InputWrapper>
                  <InputWrapper label={t('exitTime')} icon={Clock}>
                    <input
                      type="datetime-local" name="exit_time"
                      value={formData.exit_time} onChange={handleChange}
                      className={inputClass}
                    />
                  </InputWrapper>
                  <InputWrapper label={t('pnlLabel')} icon={DollarSign}>
                    <input
                      type="number" step="any" name="pnl"
                      value={formData.pnl} onChange={handleChange}
                      placeholder={t('pnlPlaceholder')}
                      className={`${inputClass} border-emerald-500/30 focus:border-emerald-500 text-emerald-600 dark:text-emerald-300 font-bold placeholder-slate-400 dark:placeholder-slate-500 text-lg`}
                    />
                  </InputWrapper>
                </div>
              </div>

            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="px-8 py-5 border-t border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-slate-900/50 flex justify-end gap-3 backdrop-blur-xl relative z-10">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 bg-slate-200 dark:bg-white/5 hover:bg-slate-300 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 font-bold text-sm rounded-xl transition-all cursor-pointer"
          >
            {t('cancel')}
          </button>
          
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={loading}
            className="group relative px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-sm rounded-xl shadow-[0_0_20px_rgba(16,185,129,0.2)] hover:shadow-[0_0_30px_rgba(16,185,129,0.4)] disabled:opacity-50 transition-all flex items-center gap-2 overflow-hidden cursor-pointer"
          >
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 pointer-events-none" />
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> {t('processing')}
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                {tradeToEdit ? t('saveChanges') : t('createNewTrade')}
              </>
            )}
          </button>
        </div>
      </div>


    </div>
  );
}
