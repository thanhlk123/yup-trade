'use client';

import { useState, useEffect, useCallback } from 'react';
import { ListChecks, Flame, Settings, CheckCircle2, AlertTriangle, ShieldAlert, TrendingDown, Clock, Activity, Target } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { isDcaTrade } from '@/lib/tradeUtils';
import TradingRulesSettingsModal from './TradingRulesSettingsModal';
import confetti from 'canvas-confetti';

export default function TradingRules({ trades = [], activeTab = 'ALL', onViolationChange, accountTabs = [] }) {
  const { t } = useLanguage();

  const [rules, setRules] = useState([]);
  const [violations, setViolations] = useState([]);
  const [violationStats, setViolationStats] = useState([]);
  const [todayInfo, setTodayInfo] = useState({ todayTrades: 0, todayPnl: 0 });
  const [loading, setLoading] = useState(true);
  
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [streak, setStreak] = useState(0);
  const [isCommitted, setIsCommitted] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchRules = useCallback(async () => {
    try {
      const res = await fetch(`/api/rules?type=${activeTab}`);
      const json = await res.json();
      if (json.success) {
        setRules(json.data || []);
      }
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

  const handleAddRule = async (ruleData) => {
    setSaving(true);
    try {
      const res = await fetch('/api/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ruleData)
      });
      const json = await res.json();
      if (json.success) {
        setRules(prev => [json.data, ...prev]);
        await checkViolations();
        return true;
      }
    } catch (e) { console.error(e); } finally { setSaving(false); }
    return false;
  };

  const handleToggleRule = async (rule) => {
    const newActive = rule.is_active ? 0 : 1;
    await fetch('/api/rules', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: rule.id, is_active: newActive })
    });
    setRules(prev => prev.map(r => r.id === rule.id ? { ...r, is_active: newActive } : r));
    await checkViolations();
  };

  const handleDeleteRule = async (id) => {
    await fetch(`/api/rules?id=${id}`, { method: 'DELETE' });
    setRules(prev => prev.filter(r => r.id !== id));
    await checkViolations();
  };

  const handleEndDay = () => {
    setIsCommitted(true);
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#34d399', '#fbbf24', '#60a5fa']
    });
  };

  const activeRules = rules.filter(r => r.is_active === 1);
  const activeRulesCount = activeRules.length;

  const getRuleStatus = (rule) => {
    const hasViolation = violations.some(v => v.rule_id === rule.id);
    
    if (rule.rule_type === 'daily_trade_limit') {
      const limit = rule.rule_value || 0;
      if (todayInfo.todayTrades === 0) return { label: 'Chưa có lệnh', color: 'gray', icon: null };
      if (todayInfo.todayTrades > limit || hasViolation) return { label: `${todayInfo.todayTrades}/${limit}`, color: 'red', icon: AlertTriangle };
      return { label: `${todayInfo.todayTrades}/${limit}`, color: 'green', icon: CheckCircle2 };
    }
    
    if (rule.rule_type === 'daily_loss_limit' || rule.rule_type === 'max_volume') {
      if (hasViolation) return { label: 'Vi phạm', color: 'red', icon: AlertTriangle };
      if (todayInfo.todayTrades > 0) return { label: 'An toàn', color: 'green', icon: CheckCircle2 };
      return { label: 'Chưa có lệnh', color: 'gray', icon: null };
    }

    if (hasViolation) {
      // Find how many times violated today if possible, else just "Vi phạm"
      const violationCount = violations.filter(v => v.rule_id === rule.id).length;
      return { label: `Vi phạm${violationCount > 1 ? ` (${violationCount})` : ''}`, color: 'red', icon: AlertTriangle };
    } else if (todayInfo.todayTrades > 0) {
      return { label: 'An toàn', color: 'green', icon: CheckCircle2 };
    }
    return { label: 'Chưa có lệnh', color: 'gray', icon: null };
  };

  const renderStatusBadge = (status) => {
    if (status.color === 'green') {
      return <span className="text-emerald-500 font-bold text-[13px]">{status.label}</span>;
    }
    if (status.color === 'red') {
      return <span className="text-rose-500 font-bold text-[13px]">{status.label}</span>;
    }
    return <span className="theme-text-sub font-semibold text-[13px]">{status.label}</span>;
  };

  const renderRuleIcon = (ruleType, statusColor) => {
    let Icon = CheckCircle2;
    if (ruleType === 'no_dca') Icon = ShieldAlert;
    if (ruleType === 'no_revenge' || ruleType === 'consecutive_loss_limit') Icon = AlertTriangle;
    if (ruleType === 'daily_trade_limit') Icon = ListChecks;
    if (ruleType === 'max_volume' || ruleType === 'daily_loss_limit') Icon = TrendingDown;

    if (statusColor === 'red') {
      return <div className="p-1.5 rounded-full bg-rose-500/10 text-rose-500 border border-rose-500/20"><AlertTriangle className="w-4 h-4" /></div>;
    }
    if (statusColor === 'green') {
      return <div className="p-1.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"><CheckCircle2 className="w-4 h-4" /></div>;
    }
    return <div className="w-7 h-7 rounded-full border border-slate-500/30"></div>; // Empty circle for gray
  };

  const isProfit = todayInfo.todayPnl >= 0;

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        
        {/* PnL HIGHLIGHT CARD */}
        <div className={`theme-card border rounded-3xl p-6 shadow-xl relative overflow-hidden flex flex-col ${isProfit ? 'border-emerald-500/20' : 'border-rose-500/20'}`}>
          <div className={`absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl opacity-20 pointer-events-none ${isProfit ? 'bg-emerald-500' : 'bg-rose-500'}`} />
          
          <div className="relative z-10 flex flex-col h-full justify-between gap-6">
            <div className="flex flex-col items-center justify-center flex-1 text-center mt-2">
              <div className="flex items-center gap-2 mb-4">
                <div className={`p-2 rounded-xl ${isProfit ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                  <Activity className="w-5 h-5" />
                </div>
                <h2 className="text-sm font-bold uppercase tracking-widest theme-text-sub">{t('todayProfit')}</h2>
              </div>
              <div className="flex items-baseline gap-2">
                <span className={`text-6xl font-black tracking-tighter ${isProfit ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {isProfit ? '+' : ''}{(todayInfo.todayPnl || 0).toFixed(2)}
                </span>
                <span className={`text-xl font-bold ${isProfit ? 'text-emerald-500/60' : 'text-rose-500/60'}`}>USD</span>
              </div>
            </div>

            <div className="flex items-center justify-around border-t theme-border pt-5 mt-auto">
              <div className="text-center">
                <p className="text-[10px] font-bold theme-text-sub uppercase tracking-wider mb-2">{t('tradesTaken')}</p>
                <p className="text-3xl font-black theme-text">{todayInfo.todayTrades}</p>
              </div>
              <div className="w-px h-12 theme-border border-l" />
              <div className="text-center">
                <p className="text-[10px] font-bold theme-text-sub uppercase tracking-wider mb-2">{t('statusLabel')}</p>
                <div className="flex items-center justify-center gap-1.5 mt-1">
                  {violations.length > 0 ? (
                    <span className="text-sm font-bold text-rose-500 flex items-center gap-1.5"><AlertTriangle className="w-5 h-5"/> {t('statusViolated')}</span>
                  ) : todayInfo.todayTrades > 0 ? (
                    <span className="text-sm font-bold text-emerald-500 flex items-center gap-1.5"><CheckCircle2 className="w-5 h-5"/> {t('statusSafe')}</span>
                  ) : (
                    <span className="text-sm font-bold theme-text-sub flex items-center gap-1.5"><Clock className="w-5 h-5"/> {t('statusNoTrades')}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* DAILY DISCIPLINE WIDGET (Like the screenshot) */}
        <div className="theme-card theme-border rounded-3xl p-6 shadow-xl relative overflow-hidden backdrop-blur-xl flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between mb-6 relative z-10">
            <h3 className="text-base font-bold theme-text flex items-center gap-2">
              <ListChecks className="w-5 h-5 text-sky-500" /> {t('dailyDiscipline')}
            </h3>
            <div className="flex items-center gap-3">
              {streak > 0 && (
                <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-orange-500/10 text-orange-500 border border-orange-500/20 shadow-sm flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5" /> {streak} Days Streak
                </span>
              )}
              <button 
                onClick={() => setIsSettingsOpen(true)}
                className="p-1.5 theme-text-sub hover:theme-text theme-inner-card hover:bg-slate-500/10 rounded-xl transition cursor-pointer border theme-border shadow-sm"
                title={t('settingsTitle')}
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Rules List */}
          <div className="space-y-3 relative z-10 flex-1 overflow-y-auto max-h-[280px] custom-scrollbar pr-2 mr-[-8px]">
            {loading ? (
              <p className="text-xs theme-text-sub italic py-2">{t('loading')}</p>
            ) : activeRulesCount === 0 ? (
              <div className="text-center py-6 border theme-border border-dashed rounded-2xl theme-inner-card/30">
                <p className="text-xs theme-text-sub mb-2">{t('noRulesEnabled')}</p>
                <button 
                  onClick={() => setIsSettingsOpen(true)}
                  className="text-xs font-bold text-violet-500 hover:text-violet-400 transition"
                >
                  {t('setupNow')}
                </button>
              </div>
            ) : (
              activeRules.map(rule => {
                const status = getRuleStatus(rule);
                const isRed = status.color === 'red';
                const isGreen = status.color === 'green';
                
                // Colors matching the exact screenshot aesthetic
                const bgClass = isRed ? 'bg-rose-500/10' : isGreen ? 'bg-emerald-500/10' : 'theme-inner-card/40';
                const borderClass = isRed ? 'border-rose-500/20' : isGreen ? 'border-emerald-500/20' : 'theme-border';
                const textClass = isRed ? 'text-slate-200' : isGreen ? 'text-slate-200' : 'theme-text-sub';

                return (
                  <div 
                    key={rule.id} 
                    className={`flex items-center justify-between px-4 py-3.5 rounded-2xl border transition ${bgClass} ${borderClass}`}
                  >
                    <div className="flex items-center gap-4">
                      {renderRuleIcon(rule.rule_type, status.color)}
                      <span className={`text-[15px] font-medium theme-text`}>
                        {rule.rule_text}
                      </span>
                    </div>
                    <div>
                      {renderStatusBadge(status)}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* End Day Button */}
          <div className="mt-auto pt-6 relative z-10">
            <button
              onClick={handleEndDay}
              disabled={isCommitted}
              className={`w-full py-3.5 rounded-xl text-base font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-sm ${
                isCommitted 
                  ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 opacity-80 cursor-default'
                  : 'theme-inner-card theme-border theme-text hover:bg-slate-500/10 hover:border-slate-400'
              }`}
            >
              {isCommitted ? (
                <>
                  <CheckCircle2 className="w-5 h-5" /> {t('disciplineCompleted')}
                </>
              ) : (
                <>
                  <Clock className="w-5 h-5" /> {t('endDayBtn')}
                </>
              )}
            </button>
          </div>
        </div>

      </div>

      {/* Settings Modal */}
      <TradingRulesSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        rules={rules}
        violations={violations}
        violationStats={violationStats}
        loading={loading}
        activeTab={activeTab}
        accountTabs={accountTabs}
        onAddRule={handleAddRule}
        onToggleRule={handleToggleRule}
        onDeleteRule={handleDeleteRule}
        saving={saving}
      />
    </>
  );
}
