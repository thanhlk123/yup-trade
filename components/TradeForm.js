'use client';

import { useState, useEffect } from 'react';
import { X, Loader2, TrendingUp, AlertTriangle, BookOpen, DollarSign, Clock, Target, Tag, ArrowRightLeft, ChevronDown } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';

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

const InputWrapper = ({ label, icon: Icon, children }) => (
  <div className="group relative">
    <label className="flex items-center gap-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
      {Icon && <Icon className="w-3.5 h-3.5 text-slate-500 group-focus-within:text-emerald-400 transition-colors" />}
      {label}
    </label>
    {children}
  </div>
);

const inputClass = "w-full bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-white/5 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 rounded-xl px-4 py-3 text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-600 transition-all outline-none font-medium text-sm leading-normal";

const FormField = ({ label, icon, type = 'text', name, value, onChange, placeholder, required, min, step, className = '' }) => (
  <InputWrapper label={label} icon={icon}>
    <input
      type={type}
      name={name}
      value={value}
      onChange={onChange}
      onWheel={type === 'number' ? (e) => e.target.blur() : undefined}
      placeholder={placeholder}
      required={required}
      min={min}
      step={step}
      className={`${inputClass} ${className}`}
    />
  </InputWrapper>
);

const getInitialFormData = (tradeToEdit, accountTabs, activeTab) => {
  if (tradeToEdit) {
    return {
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
      risk_amount: tradeToEdit.risk_amount !== undefined && tradeToEdit.risk_amount !== null ? tradeToEdit.risk_amount : '',
      user_notes: tradeToEdit.user_notes || '',
      trade_type: tradeToEdit.trade_type || (accountTabs && accountTabs.length > 0 ? accountTabs[0].key : 'LIVE'),
      image_url: tradeToEdit.image_url || '',
      is_lesson: tradeToEdit.is_lesson || 0,
    };
  }

  const lastSize = typeof window !== 'undefined' ? (localStorage.getItem('ai_trading_last_size') || '') : '';
  const lastAsset = typeof window !== 'undefined' ? (localStorage.getItem('ai_trading_last_asset') || '') : '';
  const defaultTab = (activeTab && activeTab !== 'ALL') ? activeTab : (accountTabs && accountTabs.length > 0 ? accountTabs[0].key : 'LIVE');

  return {
    asset: lastAsset,
    side: 'BUY',
    entry_price: '',
    exit_price: '',
    stop_loss: '',
    take_profit: '',
    size: lastSize,
    trade_time: '',
    exit_time: '',
    pnl: '',
    risk_amount: '',
    user_notes: '',
    trade_type: defaultTab,
    image_url: '',
    is_lesson: 0,
  };
};

export default function TradeForm({ onTradeAdded, isOpen, onClose, tradeToEdit = null, accountTabs = [], activeTab = 'ALL', inline = false, onOpenScratchpad }) {
  const { t } = useLanguage();
  const [formData, setFormData] = useState(getInitialFormData(tradeToEdit, accountTabs, activeTab));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Handle Edit/Create synchronization
  useEffect(() => {
    setFormData(getInitialFormData(tradeToEdit, accountTabs, activeTab));
    setError('');
  }, [isOpen, inline, tradeToEdit]);

  if (!isOpen && !inline) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
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
      skip_ai: true // Prevent AI analysis during basic trade creation (Step 1)
    };

    try {

      const response = await fetch('/api/trades', {
        method: tradeToEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      if (result.success) {
        onTradeAdded(result.data, !tradeToEdit, true); // forceOpenReview = true
        onClose();
        if (typeof window !== 'undefined') {
          if (formData.size) localStorage.setItem('ai_trading_last_size', formData.size);
          if (formData.asset) localStorage.setItem('ai_trading_last_asset', formData.asset);
        }

        // Reset form
        setFormData({
          ...getInitialFormData(null, accountTabs, activeTab),
          asset: formData.asset,
          size: formData.size,
          trade_time: new Date().toISOString().substring(0, 16),
        });
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


  const wrapperClass = inline
    ? "h-full w-full flex flex-col"
    : "fixed inset-0 z-50 flex items-center justify-center bg-slate-200/60 dark:bg-slate-950/60 backdrop-blur-md p-4 animate-fade-in";

  const innerClass = inline
    ? "relative w-full h-full flex flex-col"
    : "relative w-[95vw] max-w-2xl bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur-3xl border border-slate-200 dark:border-white/10 rounded-3xl shadow-[0_0_60px_-15px_rgba(16,185,129,0.15)] overflow-hidden flex flex-col max-h-[95vh]";

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
            {tradeToEdit ? `${t('editTradeTitle')} (1/2)` : `${t('newTradeTitle')} (1/2)`}
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

          <div className="flex flex-col gap-6 h-full max-w-2xl mx-auto w-full">
            
            {/* MAIN COLUMN: Technicals */}
            <div className="flex flex-col gap-6 h-full overflow-y-auto pr-1">
              
              {/* Section 1: General & Position */}
              <div className="bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 rounded-2xl p-6 space-y-5 shrink-0">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-1.5 h-4 bg-emerald-500 rounded-full" />
                  <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider">{t('infoAndPosition')}</h3>
                </div>
                
                <div className="space-y-4">
                  <FormField
                    label={t('assetLabel')} icon={Tag} name="asset"
                    value={formData.asset} onChange={handleChange}
                    placeholder={t('assetPlaceholder')} required
                  />

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

                    <FormField
                      label={t('sizeLabel')} icon={TrendingUp} type="number" step="any" name="size"
                      value={formData.size} onChange={handleChange}
                      placeholder="0.1" required min="0.00000001"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Entry/Exit Params */}
              <div className="bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 rounded-2xl p-6 space-y-5 shrink-0">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-1.5 h-4 bg-sky-500 rounded-full" />
                  <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider">THÔNG SỐ VÀO / RA</h3>
                </div>
                
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      label="Entry Price" type="number" step="any" name="entry_price"
                      value={formData.entry_price} onChange={handleChange}
                      placeholder="0.00" required
                    />
                    <FormField
                      label="Exit Price" type="number" step="any" name="exit_price"
                      value={formData.exit_price} onChange={handleChange}
                      placeholder="0.00" required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      label={t('entryTime')} icon={Clock} type="datetime-local" name="trade_time"
                      value={formData.trade_time} onChange={handleChange} required
                    />
                    <FormField
                      label={t('exitTime')} icon={Clock} type="datetime-local" name="exit_time"
                      value={formData.exit_time} onChange={handleChange}
                    />
                  </div>
                </div>
              </div>

              {/* Section 3: Optional Info */}
              <div className="bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 rounded-2xl p-6 space-y-5 shrink-0">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-1.5 h-4 bg-purple-500 rounded-full" />
                  <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider">THÔNG SỐ TUỲ CHỌN</h3>
                </div>
                
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      label="Stop Loss (SL)" type="number" step="any" name="stop_loss"
                      value={formData.stop_loss} onChange={handleChange}
                      placeholder="Giá (VD: 2405.5)"
                    />
                    <FormField
                      label="Take Profit (TP)" type="number" step="any" name="take_profit"
                      value={formData.take_profit} onChange={handleChange}
                      placeholder="Giá (VD: 2405.5)"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      label="Risk ($) - Rủi ro" icon={AlertTriangle} type="number" step="any" name="risk_amount"
                      value={formData.risk_amount} onChange={handleChange}
                      placeholder="VD: 50"
                      className="border-rose-500/30 focus:border-rose-500 text-rose-600 dark:text-rose-400 font-bold placeholder-slate-400 dark:placeholder-slate-500 text-lg"
                    />
                    <FormField
                      label={t('pnlLabel')} icon={DollarSign} type="number" step="any" name="pnl"
                      value={formData.pnl} onChange={handleChange}
                      placeholder={t('pnlPlaceholder')}
                      className="border-emerald-500/30 focus:border-emerald-500 text-emerald-600 dark:text-emerald-300 font-bold placeholder-slate-400 dark:placeholder-slate-500 text-lg"
                    />
                  </div>
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
                Tiếp tục ➔
              </>
            )}
          </button>
        </div>
      </div>


    </div>
  );
}
