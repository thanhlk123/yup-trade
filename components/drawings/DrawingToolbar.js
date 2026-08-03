'use client';

import React, { useState, useEffect, useRef } from 'react';
import { MousePointer2, PenLine, ArrowUpRight, Square, Type, ChevronRight, Trash2 } from 'lucide-react';

const TOOL_GROUPS = [
  {
    id: 'cursor',
    isSingle: true,
    tools: [
      { id: 'cursor', title: 'Con trỏ', light: 'bg-indigo-100 text-indigo-600', dark: 'bg-indigo-500/20 text-indigo-400', icon: <MousePointer2 className="w-4 h-4" /> }
    ]
  },
  {
    id: 'lines',
    tools: [
      { id: 'trendline', title: 'Đường Xu Hướng', light: 'bg-amber-100 text-amber-600', dark: 'bg-amber-500/20 text-amber-400', icon: (
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="4" y1="20" x2="20" y2="4" />
            <circle cx="4" cy="20" r="1.5" fill="currentColor" />
            <circle cx="20" cy="4" r="1.5" fill="currentColor" />
          </svg>
        ) 
      },
      { id: 'ray', title: 'Tia', light: 'bg-emerald-100 text-emerald-600', dark: 'bg-emerald-500/20 text-emerald-400', icon: <ArrowUpRight className="w-4 h-4" /> },
      { id: 'path', title: 'Đường dẫn', light: 'bg-indigo-100 text-indigo-600', dark: 'bg-indigo-500/20 text-indigo-400', icon: (
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 20L10 10L16 16L20 4" />
            <circle cx="4" cy="20" r="1.5" fill="currentColor" />
            <circle cx="10" cy="10" r="1.5" fill="currentColor" />
            <circle cx="16" cy="16" r="1.5" fill="currentColor" />
            <circle cx="20" cy="4" r="1.5" fill="currentColor" />
          </svg>
        ) 
      }
    ]
  },
  {
    id: 'text',
    tools: [
      { id: 'text', title: 'Ghi chú', light: 'bg-blue-100 text-blue-600', dark: 'bg-blue-500/20 text-blue-400', icon: <Type className="w-4 h-4" /> },
      { id: 'price_label', title: 'Nhãn giá', light: 'bg-blue-100 text-blue-600', dark: 'bg-blue-500/20 text-blue-400', icon: (
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
            <line x1="7" y1="7" x2="7.01" y2="7"></line>
          </svg>
        ) 
      }
    ]
  },
  {
    id: 'shapes',
    tools: [
      { id: 'fibo', title: 'Fibo thoái lui', light: 'bg-pink-100 text-pink-600', dark: 'bg-pink-500/20 text-pink-400', icon: (
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="5" x2="21" y2="5" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="19" x2="21" y2="19" />
            <line x1="5" y1="3" x2="19" y2="21" strokeDasharray="3 3" />
          </svg>
        ) 
      },
      { id: 'fibo_extension', title: 'Fibo mở rộng', light: 'bg-rose-100 text-rose-600', dark: 'bg-rose-500/20 text-rose-400', icon: (
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="4 20 12 6 20 16" strokeDasharray="3 3" />
            <line x1="6" y1="6" x2="22" y2="6" />
            <line x1="6" y1="11" x2="22" y2="11" />
            <line x1="6" y1="16" x2="22" y2="16" />
          </svg>
        ) 
      },
      { id: 'parallel_channel', title: 'Kênh song song', light: 'bg-purple-100 text-purple-600', dark: 'bg-purple-500/20 text-purple-400', icon: (
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="4" y1="20" x2="16" y2="8" />
            <line x1="8" y1="24" x2="20" y2="12" />
          </svg>
        ) 
      },
      { id: 'rectangle', title: 'Hình hộp', light: 'bg-cyan-100 text-cyan-600', dark: 'bg-cyan-500/20 text-cyan-400', icon: <Square className="w-4 h-4" /> },
      { id: 'arrow_up', title: 'Mũi tên lên', light: 'bg-emerald-100 text-emerald-600', dark: 'bg-emerald-500/20 text-emerald-400', icon: (
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 21V3M5 10L12 3L19 10" />
          </svg>
        ) 
      },
      { id: 'arrow_down', title: 'Mũi tên xuống', light: 'bg-red-100 text-red-600', dark: 'bg-red-500/20 text-red-400', icon: (
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3V21M5 14L12 21L19 14" />
          </svg>
        ) 
      }
    ]
  },
  {
    id: 'positions',
    tools: [
      { id: 'long_position', title: 'Vị thế mua', light: 'bg-emerald-100 text-emerald-600', dark: 'bg-emerald-500/20 text-emerald-400', icon: (
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="4" width="16" height="8" fill="rgba(16,185,129,0.3)" stroke="#10b981" />
            <rect x="4" y="12" width="16" height="8" fill="rgba(239,68,68,0.3)" stroke="#ef4444" />
          </svg>
        ) 
      },
      { id: 'short_position', title: 'Vị thế bán', light: 'bg-red-100 text-red-600', dark: 'bg-red-500/20 text-red-400', icon: (
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="4" width="16" height="8" fill="rgba(239,68,68,0.3)" stroke="#ef4444" />
            <rect x="4" y="12" width="16" height="8" fill="rgba(16,185,129,0.3)" stroke="#10b981" />
          </svg>
        ) 
      }
    ]
  }
];

export default function DrawingToolbar({ activeTool, setActiveTool, theme }) {
  const toolbarRef = useRef(null);
  const [openMenu, setOpenMenu] = useState(null);
  
  // Track the most recently selected tool for each group so the main button icon represents it
  const [lastSelected, setLastSelected] = useState({
    cursor: 'cursor',
    lines: 'trendline',
    text: 'text',
    shapes: 'fibo',
    positions: 'long_position'
  });

  // Keep lastSelected in sync if activeTool changes externally (e.g. user hits ESC to cursor)
  useEffect(() => {
    for (const group of TOOL_GROUPS) {
      if (group.tools.some(t => t.id === activeTool)) {
        setLastSelected(prev => ({ ...prev, [group.id]: activeTool }));
        break;
      }
    }
  }, [activeTool]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleGroupClick = (group, e) => {
    e.stopPropagation();
    if (group.isSingle) {
      setActiveTool(group.tools[0].id);
      setOpenMenu(null);
    } else {
      // Toggle menu or activate the last selected tool
      if (openMenu === group.id) {
        setOpenMenu(null);
      } else {
        setOpenMenu(group.id);
      }
    }
  };

  const handleToolClick = (toolId, groupId, e) => {
    e.stopPropagation();
    setActiveTool(toolId);
    setLastSelected(prev => ({ ...prev, [groupId]: toolId }));
    setOpenMenu(null);
  };

  return (
    <div 
      ref={toolbarRef}
      className={`hide-on-capture absolute left-4 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-2 p-1.5 rounded-xl border shadow-xl backdrop-blur ${
        theme === 'light' ? 'bg-white/80 border-slate-300' : 'bg-slate-900/80 border-white/10'
      }`}
    >
      {TOOL_GROUPS.map((group) => {
        // Active Tool in this group
        const currentActiveToolId = lastSelected[group.id] || group.tools[0].id;
        const currentToolDef = group.tools.find(t => t.id === currentActiveToolId) || group.tools[0];
        
        // Is any tool in this group currently the globally active tool?
        const isGroupActive = group.tools.some(t => t.id === activeTool);
        
        const activeClasses = theme === 'light' ? currentToolDef.light : currentToolDef.dark;
        const inactiveClasses = theme === 'light' ? 'text-slate-500 hover:bg-slate-100' : 'text-slate-400 hover:bg-white/5';
        
        const isMenuOpen = openMenu === group.id;

        return (
          <div key={group.id} className="relative flex items-center">
            <button 
              onClick={(e) => handleGroupClick(group, e)} 
              className={`p-2 rounded-lg transition relative flex items-center justify-center ${isGroupActive ? activeClasses : inactiveClasses} ${isMenuOpen ? (theme === 'light' ? 'bg-slate-100' : 'bg-white/10') : ''}`} 
            >
              {currentToolDef.icon}
              
              {/* Caret to indicate a flyout menu (except for single tools) */}
              {!group.isSingle && (
                <div className="absolute right-0.5 bottom-0.5">
                  <svg width="6" height="6" viewBox="0 0 10 10" fill="currentColor">
                    <path d="M9 1L1 9V1H9Z" opacity="0.6"/>
                  </svg>
                </div>
              )}
            </button>
            
            {/* Flyout Menu */}
            {isMenuOpen && !group.isSingle && (
              <div className={`absolute left-full ml-2 py-1.5 rounded-xl border flex flex-col shadow-2xl z-50 min-w-[160px] ${
                theme === 'light' ? 'bg-white border-slate-200' : 'bg-slate-800 border-slate-700'
              }`}>
                {group.tools.map(tool => {
                  const isThisToolActive = activeTool === tool.id;
                  const itemActiveClasses = theme === 'light' ? tool.light : tool.dark;
                  const itemInactiveClasses = theme === 'light' ? 'text-slate-600 hover:bg-slate-50' : 'text-slate-300 hover:bg-white/5';
                  
                  return (
                    <button
                      key={tool.id}
                      onClick={(e) => handleToolClick(tool.id, group.id, e)}
                      className={`flex items-center gap-3 px-3 py-2 mx-1.5 rounded-lg transition text-xs font-medium ${isThisToolActive ? itemActiveClasses : itemInactiveClasses}`}
                    >
                      <div className="flex-shrink-0">
                        {tool.icon}
                      </div>
                      <span className="whitespace-nowrap">{tool.title}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* Clear All Drawings Button */}
      <div className={`w-8 h-px my-1 ${theme === 'light' ? 'bg-slate-200' : 'bg-white/10'}`} />
      <div className="relative group flex items-center">
        <button 
          onClick={() => {
            if (window.confirm('Bạn có chắc chắn muốn xóa toàn bộ hình vẽ và ghi chú trên biểu đồ này?')) {
              window.dispatchEvent(new CustomEvent('tv_clear_drawings'));
            }
          }} 
          className={`p-2 rounded-lg transition ${theme === 'light' ? 'text-rose-500 hover:bg-rose-50' : 'text-rose-400 hover:bg-rose-500/10'}`} 
        >
          <Trash2 className="w-4 h-4" />
        </button>
        
        {/* Custom Tooltip */}
        <div className={`absolute left-full ml-2.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 whitespace-nowrap z-50 flex items-center border ${
          theme === 'light' 
            ? 'bg-white text-slate-800 border-slate-200 shadow-lg' 
            : 'bg-slate-800 text-slate-200 border-slate-700 shadow-xl'
        }`}>
          {/* Tooltip Arrow (SVG) */}
          <svg 
            className={`absolute right-[calc(100%-1px)] top-1/2 -translate-y-1/2 w-1.5 h-3 ${theme === 'light' ? 'text-white drop-shadow-[-1px_0_0_#cbd5e1]' : 'text-slate-800 drop-shadow-[-1px_0_0_#334155]'}`} 
            viewBox="0 0 4 8" 
            fill="currentColor"
          >
            <path d="M4 0L0 4L4 8V0Z" />
          </svg>
          Xóa toàn bộ hình vẽ
        </div>
      </div>
    </div>
  );
}
