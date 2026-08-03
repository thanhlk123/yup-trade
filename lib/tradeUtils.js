/**
 * Utility helper for managing Trade Account Types & Filtering
 */

// TRADE_TYPES is deprecated as tabs are dynamically configured in localStorage.
// However, we export it as an empty object just in case it is imported somewhere.
export const TRADE_TYPES = {};

/**
 * Gets badge info (text & CSS classes) for a given trade_type
 * @param {string} type 
 * @param {string} lang
 * @param {Array} customTabs
 */
export function getTradeTypeBadge(type, lang = 'vi', customTabs = []) {
  const isEn = lang === 'en';
  const isZh = lang === 'zh';
  const isKo = lang === 'ko';
  const isEs = lang === 'es';

  // Check if type matches a custom account tab
  if (customTabs && Array.isArray(customTabs)) {
    const found = customTabs.find(t => t.key === type || t.label === type);
    if (found) {
      const colorMap = {
        emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20',
        rose: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20',
        blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20',
        amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20',
        sky: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20',
        violet: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20',
        slate: 'bg-slate-800/20 text-slate-300 border border-slate-700',
      };
      return {
        text: found.label,
        className: colorMap[found.color] || colorMap.emerald
      };
    }
  }

  // Default fallback if not found in customTabs
  if (type === 'LIVE') {
    return {
      text: isEn ? 'Live Account' : isZh ? '实盘' : isKo ? '라이브' : isEs ? 'Cuenta Real' : 'Tài Khoản Live',
      className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
    };
  } else if (type === 'BACKTEST') {
    return {
      text: 'Backtest',
      className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
    };
  } else {
    return {
      text: type || 'Standard',
      className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
    };
  }
}

/**
 * Builds SQLite WHERE clause for filtering trade_type
 * @param {string} type - 'ALL' | 'LIVE' | 'BACKTEST' | custom string
 * @param {boolean} hasWhere - Whether a WHERE keyword has already been added
 */
export function getTradeTypeFilter(type, hasWhere = false) {
  if (!type || type === 'ALL') return { sql: '', params: [] };

  const prefix = hasWhere ? ' AND ' : ' WHERE ';

  return {
    sql: `${prefix}trade_type = ?`,
    params: [type]
  };
}

export function hasContextNotes(trade) {
  const notes = (trade.user_notes || '').trim();
  if (!notes) return false;
  
  if (notes.length < 15) return false;
  
  const notesLower = notes.toLowerCase();
  const bulkKeywords = ['gộp lệnh', 'gộp', 'tổng cộng', 'lệnh gộp', 'chia đều', 'thua nhẹ', 'hòa hết', 'note gộp'];
  if (bulkKeywords.some(keyword => notesLower.includes(keyword))) {
    return false;
  }
  
  return true;
}

export function isDcaTrade(trade) {
  const notes = (trade.user_notes || '').trim().toLowerCase();
  return notes.includes('giao dịch dca gộp') || notes.includes('dca gộp') || (trade.setup_tag || '').toLowerCase().includes('dca');
}

export function extractTechnicalWeaknesses(trade) {
  const weaknesses = [];

  if (trade.stop_loss === null || trade.stop_loss === undefined || parseFloat(trade.stop_loss) === 0 || trade.stop_loss === '') {
    if (trade.status === 'LOSS') {
      weaknesses.push('Không đặt Stop Loss an toàn (Rủi ro cháy tài khoản)');
    } else if (trade.status === 'WIN') {
      weaknesses.push('Thắng nhờ may mắn (Giao dịch không có Stop Loss)');
    }
  }

  if (trade.take_profit === null || trade.take_profit === undefined || parseFloat(trade.take_profit) === 0 || trade.take_profit === '') {
    weaknesses.push('Thiếu kế hoạch chốt lời (Không đặt Take Profit)');
  }

  if (trade.trade_time && trade.exit_time) {
    const start = new Date(trade.trade_time).getTime();
    const end = new Date(trade.exit_time).getTime();
    if (!isNaN(start) && !isNaN(end)) {
      const diffHours = (end - start) / (1000 * 60 * 60);
      
      if (trade.status === 'LOSS') {
        if (diffHours > 24) {
          weaknesses.push('Gồng lỗ qua ngày (Thiếu kỷ luật cắt lỗ)');
        } else if (diffHours > 0 && diffHours < (5 / 60)) {
          weaknesses.push('Cắt lỗ hoảng loạn / Đặt SL quá ngắn dễ bị quét');
        }
      } else if (trade.status === 'WIN') {
        if (diffHours > 0 && diffHours < (2 / 60)) {
          weaknesses.push('Chốt non (Tâm lý sợ mất lãi / Ăn quá mỏng)');
        }
      }
    }
  }

  return weaknesses;
}

export function extractTechnicalStrengths(trade) {
  const strengths = [];
  
  if (trade.stop_loss !== null && trade.stop_loss !== undefined && parseFloat(trade.stop_loss) > 0) {
    strengths.push('Kỷ luật đặt Stop Loss đầy đủ');
  }

  if (trade.status === 'WIN') {
    if (trade.trade_time && trade.exit_time) {
      const start = new Date(trade.trade_time).getTime();
      const end = new Date(trade.exit_time).getTime();
      if (!isNaN(start) && !isNaN(end)) {
        const diffHours = (end - start) / (1000 * 60 * 60);
        if (diffHours >= 1 && diffHours <= 24) {
          strengths.push('Gồng lời kiên nhẫn (Giữ lệnh tốt)');
        } else if (diffHours < 1 && diffHours > (5 / 60)) {
          strengths.push('Chốt lời dứt khoát / Đánh nhanh thắng nhanh');
        }
      }
    }
    
    if (trade.take_profit !== null && trade.take_profit !== undefined && parseFloat(trade.take_profit) > 0) {
      strengths.push('Giao dịch có kế hoạch (Đặt TP rõ ràng)');
    }
  } else if (trade.status === 'LOSS') {
    if (trade.trade_time && trade.exit_time) {
      const start = new Date(trade.trade_time).getTime();
      const end = new Date(trade.exit_time).getTime();
      if (!isNaN(start) && !isNaN(end)) {
        const diffHours = (end - start) / (1000 * 60 * 60);
        if (diffHours > (2 / 60) && diffHours <= 4) {
          strengths.push('Cắt lỗ đúng lúc, không gồng lỗ lâu');
        }
      }
    }
  }

  return strengths;
}
