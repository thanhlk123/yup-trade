'use client';
import { useState, useRef } from 'react';
import { Plus, X } from 'lucide-react';
import { useLanguageStore } from '@/appV2/core/i18n/store';
import { useDashboardStore } from '@/appV2/features/dashboard/store/dashboardStore';
import { useThemeStore } from '@/appV2/core/theme/store';

export default function AccountTabs() {
  const t = useLanguageStore(state => state.t);
  const accountTabs = useDashboardStore(state => state.accountTabs);
  const activeTab = useDashboardStore(state => state.activeTab);
  const setActiveTab = useDashboardStore(state => state.setActiveTab);
  
  // Local state for drag and drop / renaming
  const [draggedTab, setDraggedTab] = useState(null);
  const [dragOverTab, setDragOverTab] = useState(null);
  const [heldTab, setHeldTab] = useState(null);
  const [editingTabKey, setEditingTabKey] = useState(null);
  const [editingTabName, setEditingTabName] = useState('');
  
  const holdTimeout = useRef(null);
  
  // Handlers for deleting, renaming, adding (Mock implementations for now, but UI logic is exact)
  const [isAddTabModalOpen, setIsAddTabModalOpen] = useState(false);
  const [newTabName, setNewTabName] = useState('');
  const [newTabColor, setNewTabColor] = useState('emerald');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const loadAccountTabs = useDashboardStore(state => state.loadAccountTabs);
  
  const handleAddAccountTab = async () => {
    if (!newTabName.trim()) return;
    setIsSubmitting(true);
    const cleanKey = 'TAB_' + newTabName.trim().toUpperCase().replace(/[^A-Z0-9]/g, '_');
    
    const highestOrderBeforeAll = accountTabs
      .filter(t => !t.isAll)
      .reduce((max, t) => Math.max(max, t.order || 0), -1);
      
    const newOrder = highestOrderBeforeAll + 1;

    try {
      const res = await fetch('/api/account-tabs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: cleanKey,
          label: newTabName.trim(),
          color: newTabColor,
          isAll: false,
          display_order: newOrder
        })
      });
      const data = await res.json();
      
      if (data.success) {
        await loadAccountTabs();
        setActiveTab(cleanKey);
        setIsAddTabModalOpen(false);
        setNewTabName('');
        setNewTabColor('emerald');
      } else {
        alert('Failed to add tab: ' + data.error);
      }
    } catch (e) {
      console.error(e);
      alert('Error adding tab');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleDeleteAccountTab = (tab) => { console.log('Delete Tab', tab) };
  
  const handleSaveInlineRename = async () => {
    if (!editingTabName.trim() || !editingTabKey) {
      setEditingTabKey(null);
      return;
    }
    // Optimistic update should be done in store ideally, but for now we mock
    setEditingTabKey(null);
    console.log('Renaming tab', editingTabKey, 'to', editingTabName);
  };

  const theme = useThemeStore(state => state.theme);
  const themeStyles = useThemeStore(state => state.themeStyles);

  const activeStyles = {
    emerald: theme === 'light'
      ? 'bg-emerald-500 text-slate-950 shadow-md font-extrabold border border-emerald-600/30'
      : 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 shadow-md font-extrabold',
    rose: theme === 'light'
      ? 'bg-rose-500 text-white shadow-md font-extrabold border border-rose-600/30'
      : 'bg-gradient-to-r from-rose-500 to-red-600 text-white shadow-md font-extrabold',
    blue: theme === 'light'
      ? 'bg-blue-600 text-white shadow-md font-extrabold border border-blue-700/30'
      : 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-md font-extrabold',
    sky: theme === 'light'
      ? 'bg-sky-500 text-slate-950 shadow-md font-extrabold border border-sky-600/30'
      : 'bg-gradient-to-r from-sky-500 to-cyan-500 text-slate-950 shadow-md font-extrabold',
    amber: theme === 'light'
      ? 'bg-amber-500 text-slate-950 shadow-md font-extrabold border border-amber-600/30'
      : 'bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 shadow-md font-extrabold',
    violet: theme === 'light'
      ? 'bg-violet-600 text-white shadow-md font-extrabold border border-violet-700/30'
      : 'bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-md font-extrabold',
    slate: theme === 'light'
      ? 'bg-white text-slate-900 shadow-md font-extrabold border border-slate-300'
      : 'bg-slate-800 text-white shadow-sm font-extrabold border border-slate-700'
  };

  const inactiveStyle = theme === 'light'
    ? 'text-slate-600 hover:text-slate-900 hover:bg-white/60 hover:shadow-sm font-bold'
    : 'text-slate-400 hover:text-white hover:bg-slate-700/50 hover:shadow-sm font-semibold';

  const inputActiveStyles = {
    emerald: theme === 'light'
      ? 'bg-emerald-500 text-white shadow-inner font-extrabold border-2 border-emerald-700'
      : 'bg-emerald-500 text-white shadow-inner font-extrabold border-2 border-emerald-300',
    rose: theme === 'light'
      ? 'bg-rose-500 text-white shadow-inner font-extrabold border-2 border-rose-700'
      : 'bg-rose-500 text-white shadow-inner font-extrabold border-2 border-rose-300',
    blue: theme === 'light'
      ? 'bg-blue-600 text-white shadow-inner font-extrabold border-2 border-blue-800'
      : 'bg-blue-600 text-white shadow-inner font-extrabold border-2 border-blue-300',
    sky: theme === 'light'
      ? 'bg-sky-500 text-white shadow-inner font-extrabold border-2 border-sky-700'
      : 'bg-sky-500 text-white shadow-inner font-extrabold border-2 border-sky-300',
    amber: theme === 'light'
      ? 'bg-amber-500 text-white shadow-inner font-extrabold border-2 border-amber-700'
      : 'bg-amber-500 text-white shadow-inner font-extrabold border-2 border-amber-300',
    violet: theme === 'light'
      ? 'bg-violet-600 text-white shadow-inner font-extrabold border-2 border-violet-800'
      : 'bg-violet-500 text-white shadow-inner font-extrabold border-2 border-violet-300',
    slate: theme === 'light'
      ? 'bg-slate-700 text-white shadow-inner font-extrabold border-2 border-slate-900'
      : 'bg-slate-800 text-white shadow-inner font-extrabold border-2 border-slate-500'
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div className={`flex backdrop-blur-md p-1.5 rounded-2xl w-full md:max-w-3xl text-xs sm:text-sm font-semibold flex-wrap items-center gap-1.5 transition-colors duration-300 ${themeStyles.switcherBg} border`}>
        
        {/* Render "Tất Cả Lệnh" as fixed on the left */}
        {(() => {
          const allTab = accountTabs.find(t => t.isAll);
          if (!allTab) return null;
          
          const isActive = activeTab === allTab.key;
            
          return (
            <div key={allTab.key} className="relative group flex-1 min-w-[105px]">
              <button
                onClick={() => setActiveTab(allTab.key)}
                className={`w-full py-2 px-3 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  isActive ? (activeStyles[allTab.color] || activeStyles.slate) : inactiveStyle
                }`}
              >
                <span>{t('tabAll')}</span>
              </button>
            </div>
          );
        })()}

        {/* Render draggable tabs */}
        {accountTabs.filter(t => !t.isAll).map((tab) => {
          const isActive = activeTab === tab.key;
          const isDragging = draggedTab?.key === tab.key;
          const isDragOver = dragOverTab?.key === tab.key;

          return (
            <div 
              key={tab.key} 
              className={`relative group flex-1 min-w-[105px] transition-all duration-200 ${isDragging ? 'opacity-50' : 'opacity-100'} ${isDragOver && draggedTab?.key !== tab.key ? 'scale-105 outline-dashed outline-2 outline-emerald-500/50 outline-offset-2 rounded-xl' : ''} ${heldTab === tab.key ? 'animate-wiggle' : ''}`}
              draggable
              onPointerDown={(e) => {
                holdTimeout.current = setTimeout(() => {
                  setHeldTab(tab.key);
                }, 150);
              }}
              onPointerUp={() => {
                clearTimeout(holdTimeout.current);
                setHeldTab(null);
              }}
              onPointerLeave={() => {
                clearTimeout(holdTimeout.current);
                setHeldTab(null);
              }}
              onDragStart={(e) => {
                setDraggedTab(tab);
                setHeldTab(tab.key);
                if (e.dataTransfer) {
                  e.dataTransfer.effectAllowed = 'move';
                }
              }}
              onDragOver={(e) => {
                e.preventDefault();
                if (draggedTab && draggedTab.key !== tab.key) {
                  setDragOverTab(tab);
                }
              }}
              onDragLeave={() => {
                if (dragOverTab?.key === tab.key) {
                  setDragOverTab(null);
                }
              }}
              onDrop={async (e) => {
                e.preventDefault();
                if (!draggedTab || draggedTab.key === tab.key) {
                  setDraggedTab(null);
                  setDragOverTab(null);
                  return;
                }
                
                // Optimistic reorder will go here, currently mocked to avoid massive file changes
                console.log("Reorder tabs", draggedTab.key, "to", tab.key);
                setDraggedTab(null);
                setDragOverTab(null);
              }}
              onDragEnd={() => {
                setDraggedTab(null);
                setDragOverTab(null);
                setHeldTab(null);
              }}
            >
              {editingTabKey === tab.key ? (
                <input
                  type="text"
                  value={editingTabName}
                  autoFocus
                  onChange={(e) => setEditingTabName(e.target.value)}
                  onBlur={handleSaveInlineRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveInlineRename();
                    if (e.key === 'Escape') setEditingTabKey(null);
                  }}
                  className={`custom-input w-full py-1.5 px-2 text-center rounded-lg outline-none text-xs ${inputActiveStyles[tab.color] || inputActiveStyles.emerald}`}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <button
                  onClick={() => setActiveTab(tab.key)}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    setEditingTabKey(tab.key);
                    setEditingTabName(tab.label);
                  }}
                  title={"Nháy đúp để đổi tên, giữ để kéo thả"}
                  className={`w-full py-2 px-3 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    isActive
                      ? activeStyles[tab.color] || activeStyles.emerald
                      : inactiveStyle
                  }`}
                >
                  <span>{tab.label}</span>
                </button>
              )}

              {accountTabs.length > 2 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteAccountTab(tab);
                  }}
                  title={"Xóa tab này"}
                  className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 transition p-1 bg-rose-600 text-white rounded-full hover:bg-rose-500 cursor-pointer shadow-md z-10"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}

        {/* Button to Add New Dynamic Tab */}
        <button
          onClick={() => setIsAddTabModalOpen(true)}
          className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 ml-1 shadow-sm ${
            theme === 'light'
              ? 'bg-emerald-600 text-white hover:bg-emerald-700 border border-emerald-600'
              : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
          }`}
          title={t('addTabModalTitle')}
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{t('addTabBtn')}</span>
        </button>
      </div>

      {isAddTabModalOpen && (
        <div className="fixed inset-0 z-[150] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className={`${themeStyles.card} border ${themeStyles.border} rounded-3xl p-6 sm:p-8 w-full max-w-md space-y-6 shadow-2xl relative font-sans`}>
            <div className={`flex items-center justify-between border-b ${themeStyles.border} pb-3`}>
              <h3 className={`text-base font-extrabold flex items-center gap-2 ${themeStyles.titleText}`}>
                <Plus className="w-5 h-5 text-emerald-500" />
                <span>{t('addTabModalTitle')}</span>
              </h3>
              <button
                onClick={() => setIsAddTabModalOpen(false)}
                className={`p-1.5 hover:bg-slate-500/10 rounded-xl transition cursor-pointer ${themeStyles.subtext}`}
                title={t('cancel')}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ${themeStyles.subtext}`}>
                  {t('tabNameLabel')}
                </label>
                <input
                  type="text"
                  value={newTabName}
                  onChange={(e) => setNewTabName(e.target.value)}
                  placeholder={t('tabNamePlaceholder')}
                  className={`w-full ${themeStyles.innerCard} ${themeStyles.border} border text-sm rounded-xl px-4 py-3 outline-none focus:border-emerald-500 font-bold transition shadow-sm ${themeStyles.titleText}`}
                  autoFocus
                />
              </div>

              <div>
                <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ${themeStyles.subtext}`}>
                  {t('badgeColorLabel')}
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {[
                    { id: 'emerald', bg: 'bg-emerald-500', name: t('colorEmerald') || 'Emerald' },
                    { id: 'sky', bg: 'bg-sky-500', name: t('colorSky') || 'Sky' },
                    { id: 'amber', bg: 'bg-amber-500', name: t('colorAmber') || 'Amber' },
                    { id: 'violet', bg: 'bg-violet-500', name: t('colorViolet') || 'Violet' },
                    { id: 'rose', bg: 'bg-rose-500', name: t('colorRose') || 'Rose' },
                  ].map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setNewTabColor(c.id)}
                      className={`h-10 rounded-xl ${c.bg} transition flex items-center justify-center cursor-pointer ${
                        newTabColor === c.id ? 'ring-2 ring-white dark:ring-slate-900 scale-105 font-bold shadow-lg' : 'opacity-70 hover:opacity-100'
                      }`}
                      title={c.name}
                    >
                      {newTabColor === c.id && <span className="font-bold text-white dark:text-slate-950 text-xs">✓</span>}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className={`flex items-center justify-end gap-3 border-t ${themeStyles.border} pt-4`}>
              <button
                onClick={() => setIsAddTabModalOpen(false)}
                className={`px-4 py-2 ${themeStyles.innerCard} ${themeStyles.border} border font-bold text-xs rounded-xl transition cursor-pointer hover:opacity-80 ${themeStyles.titleText}`}
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleAddAccountTab}
                disabled={!newTabName.trim() || isSubmitting}
                className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-white dark:text-slate-950 font-black text-xs rounded-xl transition shadow-lg shadow-emerald-500/20 cursor-pointer"
              >
                {t('createTabBtn')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
