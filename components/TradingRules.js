'use client';

import { useState, useEffect, useCallback } from 'react';
import { ShieldAlert, Plus, Trash2, ToggleLeft, ToggleRight, AlertTriangle, CheckCircle2, Flame, TrendingDown, ListChecks, Info, Award, Calendar, Zap, MessageSquareWarning } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { isDcaTrade } from '@/lib/tradeUtils';

export default function TradingRules({ trades = [], activeTab = 'ALL', onViolationChange, onExpand, accountTabs = [] }) {
  const { t } = useLanguage();

  // Dynamic Rule Templates based on current language
  const RULE_TEMPLATES = [
    { label: t('tplNoDcaLabel'), type: 'no_dca', placeholder: t('tplNoDcaPlaceholder'), unit: t('tplNoDcaUnit'), icon: '💣', defaultValue: 0, defaultText: t('tplNoDcaText') },
    { label: t('tplNoRevengeLabel'), type: 'no_revenge', placeholder: t('tplNoRevengePlaceholder'), unit: t('tplNoRevengeUnit'), icon: '🤬', defaultValue: 15, defaultText: t('tplNoRevengeText') },
    { label: t('tplStrictSlLabel'), type: 'strict_sl', placeholder: t('tplStrictSlPlaceholder'), unit: t('tplStrictSlUnit'), icon: '🛡️', defaultValue: 1, defaultText: t('tplStrictSlText') },
    { label: t('tplMaxVolLabel'), type: 'max_volume', placeholder: t('tplMaxVolPlaceholder'), unit: t('tplMaxVolUnit'), icon: '⚖️', defaultValue: 0.2, defaultText: t('tplMaxVolText') },
    { label: t('tplDailyTradeLimitLabel'), type: 'daily_trade_limit', placeholder: t('tplDailyTradeLimitPlaceholder'), unit: t('tplDailyTradeLimitUnit'), icon: '📊', defaultValue: 3, defaultText: t('tplDailyTradeLimitText') },
    { label: t('tplDailyLossLimitLabel'), type: 'daily_loss_limit', placeholder: t('tplDailyLossLimitPlaceholder'), unit: t('tplDailyLossLimitUnit'), icon: '$', defaultValue: 200, defaultText: t('tplDailyLossLimitText') },
    { label: t('tplConsecutiveLossLabel'), type: 'consecutive_loss_limit', placeholder: t('tplConsecutiveLossPlaceholder'), unit: t('tplConsecutiveLossUnit'), icon: '🔥', defaultValue: 2, defaultText: t('tplConsecutiveLossText') },
  ];

  const RULE_TYPE_META = {
    no_dca: { color: 'rose', icon: ShieldAlert, label: t('metaNoDca') },
    no_revenge: { color: 'amber', icon: AlertTriangle, label: t('metaNoRevenge') },
    strict_sl: { color: 'emerald', icon: CheckCircle2, label: t('metaStrictSl') },
    max_volume: { color: 'purple', icon: TrendingDown, label: t('metaMaxVol') },
    daily_trade_limit: { color: 'sky', icon: ListChecks, label: t('metaDailyTradeLimit') },
    daily_loss_limit: { color: 'rose', icon: TrendingDown, label: t('metaDailyLossLimit') },
    consecutive_loss_limit: { color: 'amber', icon: Flame, label: t('metaConsecutiveLoss') },
  };

  const colorMap = {
    sky: { badge: 'bg-sky-500/10 text-sky-400 border-sky-500/20', icon: 'text-sky-400' },
    rose: { badge: 'bg-rose-500/10 text-rose-400 border-rose-500/20', icon: 'text-rose-400' },
    amber: { badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20', icon: 'text-amber-400' },
    emerald: { badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', icon: 'text-emerald-400' },
    purple: { badge: 'bg-purple-500/10 text-purple-400 border-purple-500/20', icon: 'text-purple-400' },
  };

  const [rules, setRules] = useState([]);
  const [violations, setViolations] = useState([]);
  const [violationStats, setViolationStats] = useState([]);
  const [todayInfo, setTodayInfo] = useState({ todayTrades: 0, todayPnl: 0 });
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedType, setSelectedType] = useState(RULE_TEMPLATES[0].type);
  const [ruleValue, setRuleValue] = useState('');
  const [ruleText, setRuleText] = useState('');
  const [accountScope, setAccountScope] = useState(activeTab);
  const [saving, setSaving] = useState(false);
  
  // Daily Review & Streak States
  const [streak, setStreak] = useState(0);
  const [yesterdayReport, setYesterdayReport] = useState(null);
  const [isCommitted, setIsCommitted] = useState(false);

  useEffect(() => {
    setAccountScope(activeTab);
  }, [activeTab]);

  const fetchRules = useCallback(async () => {
    try {
      const res = await fetch(`/api/rules?type=${activeTab}`);
      const json = await res.json();
      if (json.success) setRules(json.data);
    } catch (e) { console.error(e); }
  }, [activeTab]);

  const checkViolations = useCallback(async () => {
    try {
      const now = new Date();
      const localYear = now.getFullYear();
      const localMonth = String(now.getMonth() + 1).padStart(2, '0');
      const localDay = String(now.getDate()).padStart(2, '0');
      const today = `${localYear}-${localMonth}-${localDay}`;

      const res = await fetch('/api/rules/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tradeDate: today, accountType: activeTab })
      });
      const json = await res.json();
      if (json.success) {
        setViolations(json.data.violations);
        setViolationStats(json.data.violationStats || []);
        setTodayInfo({ todayTrades: json.data.todayTrades, todayPnl: json.data.todayPnl });
        if (onViolationChange) onViolationChange(json.data.violations);
      }
    } catch (e) { console.error(e); }
  }, [activeTab, onViolationChange]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([fetchRules(), checkViolations()]);
      setLoading(false);
    })();
  }, [fetchRules, checkViolations]);

  // Evaluate streaks and yesterday's report on frontend
  useEffect(() => {
    if (!trades || trades.length === 0 || !rules) return;
    
    // Group trades by date string 'YYYY-MM-DD'
    const tradesByDate = {};
    trades.forEach(trade => {
      if (!trade.trade_time) return;
      const dateObj = new Date(trade.trade_time.replace(' ', 'T') + 'Z');
      if (isNaN(dateObj.getTime())) return;
      // Convert to local time string
      const localYear = dateObj.getFullYear();
      const localMonth = String(dateObj.getMonth() + 1).padStart(2, '0');
      const localDay = String(dateObj.getDate()).padStart(2, '0');
      const dateStr = `${localYear}-${localMonth}-${localDay}`;
      
      if (!tradesByDate[dateStr]) tradesByDate[dateStr] = [];
      tradesByDate[dateStr].push(trade);
    });

    const activeRules = rules.filter(r => r.is_active === 1);
    const evaluateDay = (dayTrades) => {
      let violatedRules = [];
      let totalLossCost = 0;
      
      const markViolation = (ruleName, cost) => {
        violatedRules.push(ruleName);
        if (cost < 0) totalLossCost += cost;
      };

      activeRules.forEach(rule => {
        if (rule.rule_type === 'no_dca') {
          const dcaLosses = dayTrades.filter(t => isDcaTrade(t) && t.status === 'LOSS');
          if (dcaLosses.length > 0) {
            markViolation(rule.rule_text || 'Cấm Nhồi Lệnh Lỗ', dcaLosses.reduce((sum, t) => sum + t.pnl, 0));
          }
        }
        if (rule.rule_type === 'no_revenge') {
          const revenge = dayTrades.filter(t => (t.user_notes || '').toLowerCase().includes('trả thù'));
          if (revenge.length > 0) markViolation(rule.rule_text || 'Cấm Giao Dịch Trả Thù', revenge.reduce((s,t) => s + (t.status === 'LOSS' ? t.pnl : 0), 0));
        }
        if (rule.rule_type === 'strict_sl') {
          const noSl = dayTrades.filter(t => !t.stop_loss || parseFloat(t.stop_loss) === 0);
          if (noSl.length > 0) markViolation(rule.rule_text || 'Kỷ Luật SL', noSl.reduce((s,t) => s + (t.status === 'LOSS' ? t.pnl : 0), 0));
        }
        if (rule.rule_type === 'max_volume') {
          const overVol = dayTrades.filter(t => parseFloat(t.size) > (rule.rule_value || 9999));
          if (overVol.length > 0) markViolation(rule.rule_text || 'Giới Hạn Volume', overVol.reduce((s,t) => s + (t.status === 'LOSS' ? t.pnl : 0), 0));
        }
        if (rule.rule_type === 'daily_trade_limit') {
          if (dayTrades.length > (rule.rule_value || 999)) markViolation(rule.rule_text || 'Giới Hạn Số Lệnh', 0);
        }
        if (rule.rule_type === 'daily_loss_limit') {
          const dayPnl = dayTrades.reduce((sum, t) => sum + t.pnl, 0);
          if (dayPnl < -(rule.rule_value || 999999)) markViolation(rule.rule_text || 'Giới Hạn Mức Lỗ/Ngày', dayPnl);
        }
        if (rule.rule_type === 'consecutive_loss_limit') {
          let consecutiveLosses = 0;
          let maxConsecutive = 0;
          const sorted = [...dayTrades].sort((a,b) => new Date(a.trade_time) - new Date(b.trade_time));
          sorted.forEach(t => {
            if (t.status === 'LOSS') {
              consecutiveLosses++;
              if (consecutiveLosses > maxConsecutive) maxConsecutive = consecutiveLosses;
            } else if (t.status === 'WIN') {
              consecutiveLosses = 0;
            }
          });
          if (maxConsecutive > (rule.rule_value || 999)) markViolation(rule.rule_text || 'Chuỗi Thua Liên Tiếp', 0);
        }
      });
      
      // Deduplicate violations
      violatedRules = [...new Set(violatedRules)];
      return { violatedRules, totalLossCost, hasViolation: violatedRules.length > 0 };
    };

    // Sorted dates desc
    const sortedDates = Object.keys(tradesByDate).sort((a, b) => b.localeCompare(a));
    
    // Calculate Streak
    let currentStreak = 0;
    for (const date of sortedDates) {
      const result = evaluateDay(tradesByDate[date]);
      if (result.hasViolation) break;
      currentStreak++;
    }
    setStreak(currentStreak);

    // Get Yesterday Report
    const today = new Date();
    const yest = new Date(today);
    yest.setDate(yest.getDate() - 1);
    const yLocalYear = yest.getFullYear();
    const yLocalMonth = String(yest.getMonth() + 1).padStart(2, '0');
    const yLocalDay = String(yest.getDate()).padStart(2, '0');
    const yesterdayStr = `${yLocalYear}-${yLocalMonth}-${yLocalDay}`;
    
    if (tradesByDate[yesterdayStr]) {
      setYesterdayReport(evaluateDay(tradesByDate[yesterdayStr]));
    } else {
      setYesterdayReport(null); // No trades yesterday
    }
    
  }, [trades, rules]);

  const handleAdd = async () => {
    if (!ruleText.trim() || !ruleValue) return;
    setSaving(true);
    try {
      const res = await fetch('/api/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rule_text: ruleText.trim(),
          rule_type: selectedType,
          rule_value: parseFloat(ruleValue),
          account_type: accountScope
        })
      });
      const json = await res.json();
      if (json.success) {
        setRules(prev => [json.data, ...prev]);
        setRuleText(''); setRuleValue(''); setShowAddForm(false);
        await checkViolations();
      }
    } catch (e) { console.error(e); } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    await fetch(`/api/rules?id=${id}`, { method: 'DELETE' });
    setRules(prev => prev.filter(r => r.id !== id));
    await checkViolations();
  };

  const handleToggle = async (rule) => {
    const newActive = rule.is_active ? 0 : 1;
    await fetch('/api/rules', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: rule.id, is_active: newActive })
    });
    setRules(prev => prev.map(r => r.id === rule.id ? { ...r, is_active: newActive } : r));
    await checkViolations();
  };

  const selectedTemplate = RULE_TEMPLATES.find(tItem => tItem.type === selectedType);
  const getTabLabel = (key) => {
    if (key === 'ALL') return 'Tất Cả Tài Khoản';
    const tab = accountTabs.find(t => t.key === key);
    return tab ? tab.label : key;
  };
  const currentAccountLabel = getTabLabel(activeTab);

  return (
    <div className="theme-card rounded-3xl p-5 shadow-xl space-y-4 relative overflow-hidden">

      {/* Decorative */}
      <div className="absolute -top-10 -right-10 w-36 h-36 bg-rose-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between mb-4 relative z-10 cursor-pointer" onClick={onExpand}>
        <h3 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2 theme-title">
          <ShieldAlert className="w-4 h-4 text-rose-500" /> BỘ LUẬT GIAO DỊCH
        </h3>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-500 font-bold border border-rose-500/20 shadow-sm">
          {rules.length} Rules
        </span>
      </div>

      {/* Daily Review & Streak Section */}
      <div className="relative z-10 space-y-4">
        {/* Streak Card */}
        <div className="bg-gradient-to-r from-orange-500/10 to-rose-500/5 border border-orange-500/20 rounded-2xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-full ${streak > 0 ? 'bg-orange-500/20 text-orange-500 animate-pulse' : 'bg-slate-500/20 text-slate-400'}`}>
              <Flame className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-[10px] font-bold text-orange-400 uppercase tracking-widest">Chuỗi Kỷ Luật</h4>
              <p className="text-xl font-black theme-text">
                {streak} <span className="text-sm font-semibold text-slate-500">Ngày</span>
              </p>
            </div>
          </div>
          <div className="text-right">
            {!isCommitted ? (
              <button 
                onClick={() => setIsCommitted(true)}
                className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition cursor-pointer transform hover:scale-105 active:scale-95 flex items-center gap-1"
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Thề Kỷ Luật
              </button>
            ) : (
              <span className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs font-bold rounded-xl flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Đã Cam Kết
              </span>
            )}
          </div>
        </div>

        {/* Yesterday Review */}
        {yesterdayReport && (
          <div className={`p-4 rounded-2xl border ${yesterdayReport.hasViolation ? 'bg-rose-500/5 border-rose-500/20' : 'bg-emerald-500/5 border-emerald-500/20'}`}>
            <div className="flex gap-3">
              {yesterdayReport.hasViolation ? (
                <MessageSquareWarning className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
              ) : (
                <Award className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1">
                <h4 className={`text-xs font-bold uppercase tracking-wider ${yesterdayReport.hasViolation ? 'text-rose-500' : 'text-emerald-500'}`}>
                  Nhận xét ngày hôm qua
                </h4>
                {yesterdayReport.hasViolation ? (
                  <>
                    <p className="text-xs theme-text leading-relaxed">
                      Cảnh báo đỏ! Hôm qua bạn đã phá luật: <strong className="text-rose-400">{yesterdayReport.violatedRules.join(', ')}</strong>.
                      Hậu quả: Đốt mất <strong className="text-rose-400 font-mono">${Math.abs(yesterdayReport.totalLossCost).toLocaleString()}</strong>.
                    </p>
                    <p className="text-[11px] text-slate-500 italic mt-1">
                      Tâm lý của bạn hôm nay có thể đang muốn trả thù thị trường. Hãy dừng lại một nhịp trước khi bấm lệnh!
                    </p>
                  </>
                ) : (
                  <p className="text-xs theme-text leading-relaxed">
                    Tuyệt vời! Hôm qua bạn đã giữ vững kỷ luật (0 vi phạm). Dù kết quả thắng hay thua, bạn đã làm đúng kế hoạch. Hãy tiếp tục phát huy!
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between pt-4 mt-4 border-t theme-border">
        <span className="text-[10px] font-bold text-slate-500 uppercase">Danh Sách Luật ({rules.length})</span>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-violet-500/10 text-violet-400 border border-violet-500/20 hover:bg-violet-500/20 transition cursor-pointer flex items-center gap-1"
        >
          {showAddForm ? 'Đóng' : 'Cài Đặt'}
        </button>
      </div>

      {/* Violation Alert Banner */}
      {violations.length > 0 && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-3 space-y-2 animate-fadeIn">
          <div className="flex items-center gap-2 text-rose-400 font-bold text-xs uppercase tracking-wider">
            <AlertTriangle className="w-4 h-4 animate-pulse" /> ⚠️ {t('ruleViolationTodayBanner')} ({currentAccountLabel})
          </div>
          {violations.map((v, idx) => (
            <div key={idx} className={`text-xs rounded-lg px-3 py-2 border ${v.severity === 'critical' ? 'bg-rose-500/10 border-rose-500/20 text-rose-300 font-medium' : 'bg-amber-500/10 border-amber-500/20 text-amber-300'}`}>
              {v.detail}
            </div>
          ))}
        </div>
      )}

      {/* Today Status (Filtered per account) */}
      <div className="grid grid-cols-2 gap-3">
        <div className="theme-inner-card/50 border theme-border rounded-xl p-3.5">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-400 uppercase font-bold tracking-wider">{t('todayTradesLabel')}</p>
            <span className="text-[10px] text-slate-500">{currentAccountLabel}</span>
          </div>
          <p className="text-2xl font-bold text-white mt-1">{todayInfo.todayTrades}</p>
        </div>
        <div className="theme-inner-card/50 border theme-border rounded-xl p-3.5">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-400 uppercase font-bold tracking-wider">{t('todayPnlLabel')}</p>
            <span className="text-[10px] text-slate-500">{currentAccountLabel}</span>
          </div>
          <p className={`text-2xl font-bold mt-1 ${todayInfo.todayPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {todayInfo.todayPnl >= 0 ? '+' : ''}{(todayInfo.todayPnl || 0).toFixed(2)}$
          </p>
        </div>
      </div>

      {/* Add Rule Form */}
      {showAddForm && (
        <div className="theme-inner-card theme-border/50 rounded-xl p-4 sm:p-5 space-y-3.5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-slate-200 uppercase tracking-wider">{t('selectRuleType')}</p>
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-400">Áp dụng:</span>
              <select
                value={accountScope}
                onChange={e => setAccountScope(e.target.value)}
                className="bg-slate-900 border theme-border text-white text-xs rounded-lg px-2 py-1 focus:outline-none focus:border-violet-500"
              >
                <option value="ALL">🌐 Tất Cả Tài Khoản</option>
                {accountTabs.length > 0 ? accountTabs.filter(t => !t.isAll).map(tab => (
                  <option key={tab.key} value={tab.key}>{tab.label}</option>
                )) : (
                  <>
                    <option value="LIVE">Live Account</option>
                    <option value="BACKTEST">Backtest</option>
                  </>
                )}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {RULE_TEMPLATES.map(tItem => (
              <button
                key={tItem.type}
                onClick={() => {
                  setSelectedType(tItem.type);
                  setRuleValue(String(tItem.defaultValue));
                  setRuleText(tItem.defaultText || '');
                }}
                className={`text-xs font-semibold px-2.5 py-2.5 rounded-xl border transition cursor-pointer flex flex-col items-center gap-1.5 ${selectedType === tItem.type ? 'bg-violet-500/20 border-violet-500/40 text-violet-300' : 'theme-card theme-border text-slate-400 hover:theme-border'}`}
              >
                <span className="text-base">{tItem.icon}</span>
                <span className="text-center leading-snug">{tItem.label}</span>
              </button>
            ))}
          </div>
          {selectedTemplate && (
            <>
              <div className="space-y-2.5">
                <input
                  type="number"
                  value={ruleValue}
                  onChange={e => setRuleValue(e.target.value)}
                  placeholder={t('valuePlaceholder', { unit: selectedTemplate.unit })}
                  className="w-full theme-card theme-border theme-text text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-violet-500 transition shadow-sm"
                />
                <input
                  type="text"
                  value={ruleText}
                  onChange={e => setRuleText(e.target.value)}
                  placeholder={t('textPlaceholder', { val: ruleValue || '?', unit: selectedTemplate.unit })}
                  className="w-full theme-card theme-border theme-text text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-violet-500 transition shadow-sm"
                />
              </div>
              <button
                onClick={handleAdd}
                disabled={saving || !ruleText.trim() || !ruleValue}
                className="w-full py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white font-bold text-xs rounded-xl transition cursor-pointer"
              >
                {saving ? t('saving') : t('saveThisRule')}
              </button>
            </>
          )}
        </div>
      )}

      {/* Rules List */}
      {loading ? (
        <p className="text-xs text-slate-500 italic">{t('loading')}</p>
      ) : rules.length === 0 ? (
        <div className="text-center py-6 text-slate-500 space-y-2">
          <Info className="w-8 h-8 mx-auto text-slate-700" />
          <p className="text-xs">{t('noRulesMessage')}</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {rules.map(rule => {
            const meta = RULE_TYPE_META[rule.rule_type] || { color: 'sky', icon: ShieldAlert, label: rule.rule_type };
            const colors = colorMap[meta.color] || colorMap.sky;
            const MetaIcon = meta.icon;
            const stat = violationStats.find(s => s.rule_id === rule.id);
            const hasViolation = violations.some(v => v.rule_id === rule.id);
            const ruleScopeLabel = getTabLabel(rule.account_type);

            return (
              <div
                key={rule.id}
                className={`flex items-start gap-3 p-3 rounded-xl border transition ${hasViolation ? 'bg-rose-500/5 border-rose-500/20' : rule.is_active ? 'theme-inner-card theme-border' : 'theme-inner-card/20 theme-border opacity-50'}`}
              >
                <div className={`p-1.5 rounded-lg theme-card shrink-0 ${colors.icon}`}>
                  <MetaIcon className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold theme-text">{rule.rule_text}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${colors.badge}`}>{meta.label}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-700 font-mono">
                      {ruleScopeLabel}
                    </span>
                    {rule.rule_value !== null && rule.rule_value !== undefined && <span className="text-[10px] text-slate-500">{t('threshold')}: {rule.rule_value}</span>}
                    {stat && (
                      <span className={`text-[10px] font-semibold ${stat.violations_30d > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {stat.violations_30d > 0 ? t('violations30dCount', { count: stat.violations_30d }) : t('noViolations30d')}
                        {stat.violation_cost_usd !== null && stat.violation_cost_usd !== 0 && ` (USD: ${stat.violation_cost_usd}$)`}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => handleToggle(rule)}
                    className="text-slate-500 hover:text-violet-400 transition cursor-pointer p-1"
                    title={rule.is_active ? t('toggleOffTitle') : t('toggleOnTitle')}
                  >
                    {rule.is_active ? <ToggleRight className="w-5 h-5 text-violet-400" /> : <ToggleLeft className="w-5 h-5" />}
                  </button>
                  <button
                    onClick={() => handleDelete(rule.id)}
                    className="text-slate-700 hover:text-rose-400 transition cursor-pointer p-1"
                    title={t('deleteRuleTitle')}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
