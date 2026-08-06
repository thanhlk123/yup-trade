/**
 * Utility helper for managing Trade Account Types & Filtering
 */

// TRADE_TYPES is deprecated as tabs are dynamically configured in localStorage.
// However, we export it as an empty object just in case it is imported somewhere.
export const TRADE_TYPES = {};

export const SUPPORTED_SYMBOLS = [
  'XAUUSD', 'XAGUSD', 'EURUSD', 'GBPUSD', 'USDJPY', 'GBPJPY', 'AUDUSD', 'USDCAD', 'USDCHF', 'NZDUSD',
  'EURGBP', 'EURJPY', 'EURCHF', 'EURAUD', 'EURNZD', 'EURCAD', 'GBPCHF', 'GBPAUD', 'GBPNZD', 'GBPCAD',
  'AUDJPY', 'AUDCHF', 'AUDCAD', 'AUDNZD', 'NZDJPY', 'NZDCHF', 'NZDCAD', 'CADJPY', 'CADCHF', 'CHFJPY',
  'US30', 'NAS100', 'SPX500', 'GER40', 'UK100', 'JPN225', 'AUS200', 'USOIL', 'UKOIL',
  'BTCUSD', 'ETHUSD', 'AAPL', 'TSLA', 'AMZN', 'NVDA', 'MSFT', 'META', 'GOOGL'
];

export function isSymbolSupported(symbol) {
  if (!symbol) return false;
  
  const cleanSym = symbol.toUpperCase().replace(/[^A-Z0-9]/g, '');
  
  // Exact match after removing symbols
  if (SUPPORTED_SYMBOLS.includes(cleanSym)) return true;
  
  // Prefix match (e.g. XAUUSDm -> XAUUSD)
  const prefixMatch = SUPPORTED_SYMBOLS.find(s => cleanSym.startsWith(s));
  return !!prefixMatch;
}

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

export function extractTechnicalWeaknesses(trade, t = (k) => k) {
  const weaknesses = [];

  if (trade.stop_loss === null || trade.stop_loss === undefined || parseFloat(trade.stop_loss) === 0 || trade.stop_loss === '') {
    if (trade.status === 'LOSS') {
      weaknesses.push(t('techNoSlLoss'));
    } else if (trade.status === 'WIN') {
      weaknesses.push(t('techNoSlWin'));
    }
  }

  if (trade.take_profit === null || trade.take_profit === undefined || parseFloat(trade.take_profit) === 0 || trade.take_profit === '') {
    weaknesses.push(t('techNoTp'));
  }

  if (trade.trade_time && trade.exit_time) {
    const start = new Date(trade.trade_time).getTime();
    const end = new Date(trade.exit_time).getTime();
    if (!isNaN(start) && !isNaN(end)) {
      const diffHours = (end - start) / (1000 * 60 * 60);
      
      if (trade.status === 'LOSS') {
        if (diffHours > 24) {
          weaknesses.push(t('techHoldLoss'));
        } else if (diffHours > 0 && diffHours < (5 / 60)) {
          weaknesses.push(t('techPanicCut'));
        }
      } else if (trade.status === 'WIN') {
        if (diffHours > 0 && diffHours < (2 / 60)) {
          weaknesses.push(t('techEarlyExit'));
        }
      }
    }
  }

  return weaknesses;
}

export function extractTechnicalStrengths(trade, t = (k) => k) {
  const strengths = [];
  
  if (trade.stop_loss !== null && trade.stop_loss !== undefined && parseFloat(trade.stop_loss) > 0) {
    strengths.push(t('techSlDiscipline'));
  }

  if (trade.status === 'WIN') {
    if (trade.trade_time && trade.exit_time) {
      const start = new Date(trade.trade_time).getTime();
      const end = new Date(trade.exit_time).getTime();
      if (!isNaN(start) && !isNaN(end)) {
        const diffHours = (end - start) / (1000 * 60 * 60);
        if (diffHours >= 1 && diffHours <= 24) {
          strengths.push(t('techPatientHold'));
        } else if (diffHours < 1 && diffHours > (5 / 60)) {
          strengths.push(t('techQuickWin'));
        }
      }
    }
    
    if (trade.take_profit !== null && trade.take_profit !== undefined && parseFloat(trade.take_profit) > 0) {
      strengths.push(t('techTpPlan'));
    }
  } else if (trade.status === 'LOSS') {
    if (trade.trade_time && trade.exit_time) {
      const start = new Date(trade.trade_time).getTime();
      const end = new Date(trade.exit_time).getTime();
      if (!isNaN(start) && !isNaN(end)) {
        const diffHours = (end - start) / (1000 * 60 * 60);
        if (diffHours > (2 / 60) && diffHours <= 4) {
          strengths.push(t('techCutLoss'));
        }
      }
    }
  }

  return strengths;
}
