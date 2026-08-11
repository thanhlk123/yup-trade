'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { Search, Plus } from 'lucide-react';

export function normalizeSlug(text) {
  if (!text) return '';
  return text.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'd')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

export default function TagCombobox({
  tags = [],
  selectedTags = [], // Array of string tags like '#Setup_Breakout'
  onSelect, // (tagObj) => void
  onRemove, // (tagObj | string) => void
  onAddNew, // (text) => void
  placeholder = "Tìm kiếm thẻ...",
  isDark = true,
  singleSelect = false,
  categoryFilter = null // 'setups' or 'mistakes'
}) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef(null);
  const listboxRef = useRef(null);

  const availableTags = useMemo(() => {
    let list = tags;
    if (categoryFilter) {
       list = list.filter(t => t.category === categoryFilter || t.category === (categoryFilter === 'setups' ? 'trends' : 'strengths')); // rough mapping
    }
    return list;
  }, [tags, categoryFilter]);

  const filteredItems = useMemo(() => {
    if (!query.trim()) {
      return availableTags.slice(0, 50).map(t => ({ ...t, score: 0 }));
    }

    const searchSlug = normalizeSlug(query);
    const searchLower = query.toLowerCase();

    let scored = availableTags.map(tag => {
      let score = 0;
      const tagSlug = normalizeSlug(tag.label);
      const tagLower = (tag.label || '').toLowerCase();

      // Exact Match
      if (tagSlug === searchSlug) score = 100;
      // Prefix Match
      else if (tagSlug.startsWith(searchSlug)) score = 80;
      // Acronym Match (e.g. "bd" -> "bat day")
      else {
        const words = tagSlug.split('-');
        const acronym = words.map(w => w[0]).join('');
        if (acronym.startsWith(searchSlug)) score = 70;
        // Includes Match
        else if (tagSlug.includes(searchSlug) || tagLower.includes(searchLower)) score = 50;
      }

      return { ...tag, score };
    }).filter(t => t.score > 0);

    // Sort by score
    scored.sort((a, b) => b.score - a.score);

    return scored;
  }, [query, availableTags]);

  useEffect(() => {
    // Auto-select logic
    if (filteredItems.length > 0 && query.trim()) {
      const topScore = filteredItems[0].score;
      const secondScore = filteredItems[1]?.score || 0;
      // If Top 1 is much better than Top 2 (delta >= 10), auto-select it.
      if (topScore - secondScore >= 10) {
        setSelectedIndex(0);
      } else {
        setSelectedIndex(-1); // Force user to manually pick
      }
    } else {
      setSelectedIndex(-1);
    }
  }, [filteredItems, query]);

  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === 'Enter') {
         // Pass event to parent if needed
         return; 
      }
      return;
    }

    const maxIndex = filteredItems.length + (query.trim() && !filteredItems.find(t => normalizeSlug(t.label) === normalizeSlug(query)) ? 1 : 0) - 1;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, maxIndex)); 
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      
      if (selectedIndex >= 0 && selectedIndex < filteredItems.length) {
        handleSelect(filteredItems[selectedIndex]);
      } else if (selectedIndex === filteredItems.length || query.trim()) {
        // Create new tag
        const exactMatch = filteredItems.find(t => normalizeSlug(t.label) === normalizeSlug(query));
        if (exactMatch) {
          handleSelect(exactMatch);
        } else {
          if (onAddNew) onAddNew(query.trim());
          setQuery('');
          setIsOpen(false);
        }
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  const handleSelect = (item) => {
    onSelect(item);
    if (singleSelect) {
      setIsOpen(false);
    }
    setQuery('');
    inputRef.current?.focus();
  };

  const isSelected = (tag) => {
    return selectedTags.includes(tag.tag);
  };

  return (
    <div className="relative w-full">
      
      {/* Selected Tags Display */}
      {selectedTags.length > 0 && !singleSelect && (
        <div className="flex flex-wrap gap-2 mb-2">
          {selectedTags.map((tagString, idx) => {
            const fullTag = tags.find(t => t.tag === tagString);
            const label = fullTag ? fullTag.label : tagString;
            return (
              <span key={idx} className={`inline-flex items-center px-2 py-1 rounded text-sm font-medium ${isDark ? 'bg-[#2a2e39] text-gray-200' : 'bg-gray-200 text-gray-800'}`}>
                {label}
                <button onClick={(e) => { e.preventDefault(); onRemove(tagString); }} className="ml-1 text-gray-400 hover:text-rose-500">&times;</button>
              </span>
            );
          })}
        </div>
      )}

      {/* Input */}
      <div className={`relative flex items-center w-full px-3 py-2 rounded-lg border focus-within:ring-2 focus-within:ring-blue-500 transition-colors ${
        isDark ? 'bg-[#1a1e29] border-[#2a2e39] text-gray-100' : 'bg-white border-gray-300 text-gray-900'
      }`}>
        <Search size={16} className={`mr-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
        <input
          ref={inputRef}
          type="text"
          value={singleSelect && !isOpen && selectedTags.length > 0 ? (tags.find(t => t.tag === selectedTags[0])?.label || selectedTags[0]) : query}
          onChange={(e) => {
             setQuery(e.target.value);
             if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => {
             setIsOpen(true);
             if (singleSelect && selectedTags.length > 0) setQuery(''); 
          }}
          onBlur={() => setTimeout(() => setIsOpen(false), 200)}
          onKeyDown={handleKeyDown}
          placeholder={singleSelect && selectedTags.length > 0 ? '' : placeholder}
          className="w-full bg-transparent outline-none text-sm placeholder-gray-500"
        />
        {singleSelect && selectedTags.length > 0 && !isOpen && (
          <button 
             onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRemove(selectedTags[0]); setQuery(''); inputRef.current?.focus(); }} 
             className="absolute right-3 text-gray-400 hover:text-rose-500"
          >&times;</button>
        )}
      </div>

      {/* Dropdown List */}
      {isOpen && (
        <div 
          ref={listboxRef}
          className={`absolute z-50 w-full mt-1 max-h-60 overflow-y-auto rounded-lg shadow-xl border ${
            isDark ? 'bg-[#131722] border-[#2a2e39]' : 'bg-white border-gray-200'
          }`}
        >
          {filteredItems.length > 0 ? (
            <ul className="py-1">
              {filteredItems.map((item, idx) => {
                const selected = isSelected(item);
                const active = selectedIndex === idx;
                return (
                  <li
                    key={item.tag}
                    onClick={() => handleSelect(item)}
                    className={`px-3 py-2 text-sm cursor-pointer flex items-center justify-between ${
                      active ? (isDark ? 'bg-[#2a2e39]' : 'bg-gray-100') : ''
                    } ${selected ? 'opacity-50' : 'hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-[#2a2e39] dark:hover:text-gray-100'}`}
                  >
                    <span className={isDark ? 'text-gray-200' : 'text-gray-800'}>{item.label}</span>
                    {active && <span className="text-xs text-blue-500">Enter để chọn</span>}
                  </li>
                );
              })}
              {query.trim() && !filteredItems.find(t => normalizeSlug(t.label) === normalizeSlug(query)) && (
                <li
                  onClick={() => {
                    if (onAddNew) onAddNew(query.trim());
                    setQuery('');
                  }}
                  className={`px-3 py-2 text-sm cursor-pointer flex items-center text-blue-500 ${
                    selectedIndex === filteredItems.length ? (isDark ? 'bg-[#2a2e39]' : 'bg-gray-100') : 'hover:bg-gray-100 dark:hover:bg-[#2a2e39]'
                  }`}
                >
                  <Plus size={14} className="mr-2" /> Tạo mới thẻ "{query.trim()}"
                </li>
              )}
            </ul>
          ) : (
            <div className="p-3 text-sm text-center text-gray-500">
              {query.trim() ? (
                 <button 
                   onClick={(e) => { e.preventDefault(); if (onAddNew) onAddNew(query.trim()); setQuery(''); }}
                   className="flex items-center justify-center w-full text-blue-500 hover:underline"
                 >
                   <Plus size={14} className="mr-1" /> Tạo mới "{query.trim()}"
                 </button>
              ) : 'Không có thẻ nào'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
