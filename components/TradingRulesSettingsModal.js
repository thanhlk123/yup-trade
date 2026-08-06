'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, ShieldAlert, Plus, Trash2, ToggleLeft, ToggleRight, AlertTriangle, CheckCircle2, TrendingDown, ListChecks, Info, Flame } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';

export default function TradingRulesSettingsModal({ 
  isOpen, 
  onClose, 
  rules = [], 
  violations = [], 
  violationStats = [], 
  loading = false,
  activeTab = 'ALL',
  accountTabs = [],
  onAddRule,
  onToggleRule,
  onDeleteRule,
  saving = false
}) {
  const { t } = useLanguage();

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

  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedType, setSelectedType] = useState(RULE_TEMPLATES[0].type);
  const [ruleValue, setRuleValue] = useState('');
  const [ruleText, setRuleText] = useState('');
  const [accountScope, setAccountScope] = useState(activeTab);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isOpen || !mounted) return null;

  const handleAddSubmit = async () => {
    if (!ruleText.trim() || !ruleValue) return;
    const success = await onAddRule({
      rule_text: ruleText.trim(),
      rule_type: selectedType,
      rule_value: parseFloat(ruleValue),
      account_type: accountScope
    });
    if (success) {
      setRuleText('');
      setRuleValue('');
      setShowAddForm(false);
    }
  };

  const selectedTemplate = RULE_TEMPLATES.find(tItem => tItem.type === selectedType);
  const getTabLabel = (key) => {
    if (key === 'ALL') return t('rulesScopeAll').replace('🌐 ', ''); // Remove icon for badge if preferred, or just return t('rulesScopeAll')
    const tab = accountTabs.find(t => t.key === key);
    return tab ? tab.label : key;
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm cursor-pointer"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-5xl max-h-[95vh] flex flex-col theme-card theme-border border rounded-3xl shadow-2xl overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between p-5 lg:p-6 border-b theme-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-rose-500/10 rounded-xl text-rose-500">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold theme-text uppercase tracking-wider">{t('rulesSettingsModalTitle')}</h2>
              <p className="text-sm theme-text-sub">{t('rulesSettingsModalSubtitle')}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 theme-text-sub hover:theme-text hover:bg-slate-500/10 rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 lg:p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar bg-slate-500/5">
          
          <div className="flex items-center justify-between">
            <span className="text-xs lg:text-sm font-bold theme-text-sub uppercase tracking-wider">{t('rulesListTitle')} ({rules.length})</span>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="px-4 py-2 text-xs lg:text-sm font-bold rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500/20 transition cursor-pointer flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="w-4 h-4" /> {t('rulesAddBtn')}
            </button>
          </div>

          {/* Add Rule Form */}
          {showAddForm && (
            <div className="theme-inner-card theme-border border rounded-2xl p-5 lg:p-6 space-y-5 shadow-sm">
              <div className="flex items-center justify-between border-b theme-border pb-4">
                <p className="text-sm font-bold theme-text uppercase tracking-wider">{t('selectRuleType')}</p>
                <div className="flex items-center gap-2 text-sm">
                  <span className="theme-text-sub">{t('rulesScopeLabel')}</span>
                  <select
                    value={accountScope}
                    onChange={e => setAccountScope(e.target.value)}
                    className="theme-card theme-border border theme-text text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    <option value="ALL">{t('rulesScopeAll')}</option>
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
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {RULE_TEMPLATES.map(tItem => (
                  <button
                    key={tItem.type}
                    onClick={() => {
                      setSelectedType(tItem.type);
                      setRuleValue(String(tItem.defaultValue));
                      setRuleText(tItem.defaultText || '');
                    }}
                    className={`text-sm font-semibold p-3.5 rounded-xl border transition cursor-pointer flex flex-col items-center gap-2 ${selectedType === tItem.type ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-500 shadow-sm' : 'theme-card theme-border theme-text-sub hover:border-emerald-500/30 hover:text-emerald-500'}`}
                  >
                    <span className="text-2xl">{tItem.icon}</span>
                    <span className="text-center leading-snug line-clamp-2">{tItem.label}</span>
                  </button>
                ))}
              </div>
              {selectedTemplate && (
                <div className="space-y-4 pt-3">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <input
                      type="number"
                      value={ruleValue}
                      onChange={e => setRuleValue(e.target.value)}
                      placeholder={t('valuePlaceholder', { unit: selectedTemplate.unit })}
                      className="col-span-1 theme-card theme-border border theme-text text-base rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500 transition shadow-sm"
                    />
                    <input
                      type="text"
                      value={ruleText}
                      onChange={e => setRuleText(e.target.value)}
                      placeholder={t('textPlaceholder', { val: ruleValue || '?', unit: selectedTemplate.unit })}
                      className="col-span-2 theme-card theme-border border theme-text text-base rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500 transition shadow-sm"
                    />
                  </div>
                  <button
                    onClick={handleAddSubmit}
                    disabled={saving || !ruleText.trim() || !ruleValue}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-sm rounded-xl transition cursor-pointer"
                  >
                    {saving ? t('saving') : t('saveThisRule')}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Rules List */}
          {loading ? (
            <p className="text-sm theme-text-sub italic">{t('loading')}</p>
          ) : rules.length === 0 ? (
            <div className="text-center py-12 theme-inner-card/50 rounded-3xl border theme-border border-dashed theme-text-sub space-y-3">
              <Info className="w-10 h-10 mx-auto opacity-50" />
              <p className="text-base">{t('rulesNoRules') || t('noRulesEnabled')}</p>
              <button 
                onClick={() => setShowAddForm(true)}
                className="text-sm font-bold text-emerald-500 hover:text-emerald-400 cursor-pointer"
              >
                {t('rulesClickToAdd') || t('setupNow')}
              </button>
            </div>
          ) : (
            <div className="space-y-3 lg:space-y-4">
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
                    className={`flex items-center gap-4 p-4 lg:p-5 rounded-2xl border transition shadow-sm ${hasViolation ? 'bg-rose-500/5 border-rose-500/20' : rule.is_active ? 'theme-inner-card theme-border' : 'theme-inner-card/30 theme-border opacity-60'}`}
                  >
                    <div className={`p-3 rounded-xl theme-card shrink-0 border theme-border shadow-sm ${colors.icon}`}>
                      <MetaIcon className="w-6 h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-base font-bold ${hasViolation ? 'text-rose-500' : 'theme-text'}`}>{rule.rule_text}</p>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className={`text-xs px-2.5 py-0.5 rounded-md border font-semibold ${colors.badge}`}>{meta.label}</span>
                        <span className="text-xs px-2.5 py-0.5 rounded-md theme-card theme-text-sub border theme-border font-mono">
                          {ruleScopeLabel}
                        </span>
                        {rule.rule_value !== null && rule.rule_value !== undefined && <span className="text-[10px] font-medium text-slate-500">{t('threshold')}: {rule.rule_value}</span>}
                        {stat && (
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${stat.violations_30d > 0 ? 'bg-rose-500/10 text-rose-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                            {stat.violations_30d > 0 ? t('violations30dCount', { count: stat.violations_30d }) : t('noViolations30d')}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-3 shrink-0 border-l theme-border pl-5 ml-3">
                      <button
                        onClick={() => onToggleRule(rule)}
                        className={`transition cursor-pointer p-1.5 rounded-full ${rule.is_active ? 'text-emerald-500 hover:bg-emerald-500/10' : 'theme-text-sub hover:bg-slate-500/10'}`}
                        title={rule.is_active ? t('toggleOffTitle') : t('toggleOnTitle')}
                      >
                        {rule.is_active ? <ToggleRight className="w-8 h-8" /> : <ToggleLeft className="w-8 h-8" />}
                      </button>
                      <button
                        onClick={() => onDeleteRule(rule.id)}
                        className="theme-text-sub hover:text-rose-500 hover:bg-rose-500/10 transition cursor-pointer p-2 rounded-xl"
                        title={t('deleteRuleTitle')}
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
