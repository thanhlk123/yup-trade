'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Loader2, 
  Sparkles, 
  AlertTriangle, 
  Calendar, 
  ChevronDown, 
  ChevronUp, 
  FileSpreadsheet, 
  Edit3, 
  BrainCircuit, 
  CheckCircle2,
  Maximize2,
  Upload,
  Layers,
  Clock,
  Check
} from 'lucide-react';
import { useLanguageStore } from '@/app/core/i18n/store';

export const safeParseDate = (dateStr) => {
  if (!dateStr) return null;
  let cleaned = dateStr.trim().replace(/\./g, '-').replace(/\//g, '-');
  
  // YYYY-MM-DD HH:mm:ss -> replace first space with T and append Z to force UTC parsing
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(cleaned)) {
    cleaned = cleaned.replace(' ', 'T');
    if (!cleaned.endsWith('Z') && !cleaned.includes('+') && !cleaned.includes('-')) {
      cleaned += 'Z';
    }
    return new Date(cleaned);
  }
  
  // DD-MM-YYYY HH:mm:ss or MM-DD-YYYY HH:mm:ss
  const dmYMatch = cleaned.match(/^(\d{1,2})-(\d{1,2})-(\d{4})[ T](\d{1,2}):(\d{1,2})(:(\d{1,2}))?/);
  if (dmYMatch) {
    const [_, p1, p2, year, hour, minute, __, second] = dmYMatch;
    const sec = second || '00';
    let day, month;
    if (parseInt(p1, 10) > 12) {
      day = p1; month = p2;
    } else if (parseInt(p2, 10) > 12) {
      month = p1; day = p2;
    } else {
      // Ambiguous (e.g. 05-08-2026). Default to DD-MM (UK/VN format)
      day = p1; month = p2;
    }
    return new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hour.padStart(2, '0')}:${minute.padStart(2, '0')}:${sec.padStart(2, '0')}Z`);
  }
  
  return new Date(cleaned);
};

export const parseNumber = (val) => {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  const str = String(val).trim();
  const lastComma = str.lastIndexOf(',');
  const lastDot = str.lastIndexOf('.');
  if (lastComma > lastDot) {
    // European format: 1.234,56 or 1234,56
    return parseFloat(str.replace(/\./g, '').replace(',', '.').replace(/[^0-9.-]/g, '')) || 0;
  }
  // US format: 1,234.56 or 1234.56
  return parseFloat(str.replace(/,/g, '').replace(/[^0-9.-]/g, '')) || 0;
};

const pad = (n) => String(n).padStart(2, '0');

export const formatToSqlDateTime = (date) => {
  if (!date || isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

export const convertToUtcSql = (dateStr, sourceOffsetHours = 0) => {
  if (!dateStr) return null;
  let str = String(dateStr).trim();

  // Try matching numeric date format "YYYY-MM-DD HH:mm:ss" or "YYYY/MM/DD HH:mm:ss"
  const matchIso = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})[\sT](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/);
  let utcDate;
  if (matchIso) {
    const year = parseInt(matchIso[1], 10);
    const month = parseInt(matchIso[2], 10) - 1;
    const day = parseInt(matchIso[3], 10);
    const hour = parseInt(matchIso[4], 10);
    const min = parseInt(matchIso[5], 10);
    const sec = parseInt(matchIso[6] || '0', 10);

    utcDate = new Date(Date.UTC(year, month, day, hour - sourceOffsetHours, min, sec));
  } else {
    const parsed = safeParseDate(str);
    if (!parsed || isNaN(parsed.getTime())) return null;
    utcDate = new Date(parsed.getTime() - (sourceOffsetHours * 60 * 60 * 1000));
  }

  return `${utcDate.getUTCFullYear()}-${pad(utcDate.getUTCMonth() + 1)}-${pad(utcDate.getUTCDate())} ${pad(utcDate.getUTCHours())}:${pad(utcDate.getUTCMinutes())}:${pad(utcDate.getUTCSeconds())}`;
};

const getTimeMs = (timeStr, fallbackTimeStr) => {
  if (!timeStr) {
    if (fallbackTimeStr) return getTimeMs(fallbackTimeStr);
    return 0;
  }
  const d = safeParseDate(timeStr);
  return d && !isNaN(d.getTime()) ? d.getTime() : 0;
};

const parseCSVText = (text) => {
  const lines = [];
  let row = [""];
  let inQuotes = false;
  
  const firstFewLines = text.split('\n').slice(0, 5).join('\n');
  const commas = (firstFewLines.match(/,/g) || []).length;
  const semicolons = (firstFewLines.match(/;/g) || []).length;
  const separator = commas >= semicolons ? ',' : ';';

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (c === '"') {
        if (next === '"') {
          row[row.length - 1] += '"';
          i++; 
        } else {
          inQuotes = false;
        }
      } else {
        row[row.length - 1] += c;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
      } else if (c === separator) {
        row.push("");
      } else if (c === '\r' || c === '\n') {
        if (c === '\r' && next === '\n') i++; 
        lines.push(row);
        row = [""];
      } else {
        row[row.length - 1] += c;
      }
    }
  }
  if (row.length > 1 || row[0] !== "") lines.push(row);
  return lines;
};

const findHeaderAndMap = (rows) => {
  const exactKeywords = {
    asset: ['asset', 'symbol', 'pair', 'cặp tiền', 'tài sản', 'mã', 'instrument', 'ticker', 'product', 'item', 'currency', 'market', 'contract'],
    side: ['side', 'action', 'direction', 'type', 'lệnh', 'chiều', 'mua/bán', 'buy/sell', 'b/s', 'trade type', 'order type', 'transaction type', 'bs'],
    size: ['size', 'volume', 'vol', 'quantity', 'qty', 'khối lượng', 'kl', 'lots', 'lot', 'amount', 'units'],
    entry_price: ['entry_price', 'entry', 'entry price', 'giá vào', 'gia vào', 'giá entry', 'giá mua', 'giá bán', 'open price', 'open_price', 'openprice', 'open rate', 'entry rate', 'fill price'],
    exit_price: ['exit_price', 'exit', 'exit price', 'giá ra', 'gia ra', 'giá exit', 'giá đóng', 'close price', 'close_price', 'closeprice', 'close rate', 'exit rate', 'closing price'],
    pnl: ['pnl', 'profit', 'loss', 'profit/loss', 'lợi nhuận', 'loi nhuan', 'kết quả', 'p&l', 'realized_pnl', 'net profit', 'realized pnl', 'net pnl', 'total profit', 'net_profit', 'closed pnl'],
    trade_time: ['trade_time', 'time', 'date', 'datetime', 'timestamp', 'thời gian', 'ngày', 'ngay', 'date_time', 'open datetime', 'open_datetime', 'open time', 'open_time', 'opened', 'created time', 'create time', 'open date'],
    exit_time: ['exit_time', 'exit time', 'close time', 'close datetime', 'close_time', 'close_datetime', 'thời gian ra', 'thời gian thoát', 'thoát lệnh', 'ngày đóng', 'ngay dong', 'closed', 'close date', 'done time'],
    stop_loss: ['stop_loss', 'stop loss', 'sl', 'cắt lỗ', 'cat lo', 's / l', 's/l', 'stoploss'],
    take_profit: ['take_profit', 'take profit', 'tp', 'chốt lời', 'chot loi', 't / p', 't/p', 'takeprofit'],
    user_notes: ['user_notes', 'notes', 'comment', 'ghi chú', 'ghi chu', 'mô tả', 'description', 'remarks'],
    trade_type: ['trade_type', 'trade type', 'loại', 'loai', 'account', 'account type']
  };

  const partialKeywords = {
    take_profit: ['take profit', 'tp', 't / p', 't/p'],
    stop_loss: ['stop loss', 'sl', 's / l', 's/l'],
    entry_price: ['open price', 'entry', 'giá vào', 'open rate', 'fill price'],
    exit_price: ['close price', 'exit', 'giá ra', 'close rate', 'closing price'],
    pnl: ['profit', 'pnl', 'loss', 'lợi nhuận', 'net pnl'],
    trade_time: ['open time', 'datetime', 'time', 'date', 'thời gian', 'opened', 'create time'],
    exit_time: ['close time', 'exit time', 'close datetime', 'thoát lệnh', 'closed', 'close date'],
    asset: ['symbol', 'asset', 'pair', 'instrument', 'item'],
    side: ['side', 'type', 'chiều', 'action', 'buy/sell'],
    size: ['volume', 'vol', 'size', 'qty', 'lots', 'amount'],
    user_notes: ['notes', 'comment', 'ghi chú', 'remark']
  };

  let bestRowIdx = -1;
  let bestMatchCount = -1;
  let bestMapping = {};

  for (let r = 0; r < Math.min(rows.length, 15); r++) {
    const row = rows[r];
    const mapping = {};
    let matchCount = 0;
    const mappedCols = new Set();
    const priceCols = [];

    for (let c = 0; c < row.length; c++) {
      const cell = (row[c] || '').trim().toLowerCase();
      if (cell === 'price' || cell === 'giá') {
        priceCols.push(c);
      }
    }

    for (let c = 0; c < row.length; c++) {
      const cell = (row[c] || '').trim().toLowerCase();
      if (!cell) continue;

      for (const [field, keywords] of Object.entries(exactKeywords)) {
        if (mapping[field] === undefined && keywords.includes(cell)) {
          mapping[field] = c;
          mappedCols.add(c);
          matchCount++;
          break;
        }
      }
    }

    if (priceCols.length >= 2) {
      if (mapping.entry_price === undefined) {
        mapping.entry_price = priceCols[0];
        mappedCols.add(priceCols[0]);
        matchCount++;
      }
      if (mapping.exit_price === undefined) {
        mapping.exit_price = priceCols[1];
        mappedCols.add(priceCols[1]);
        matchCount++;
      }
    } else if (priceCols.length === 1 && mapping.entry_price === undefined) {
      mapping.entry_price = priceCols[0];
      mappedCols.add(priceCols[0]);
      matchCount++;
    }

    for (let c = 0; c < row.length; c++) {
      if (mappedCols.has(c)) continue;
      const cell = (row[c] || '').trim().toLowerCase();
      if (!cell) continue;

      for (const [field, keywords] of Object.entries(partialKeywords)) {
        if (mapping[field] === undefined) {
          const matched = keywords.some(k => cell.includes(k));
          if (matched) {
            mapping[field] = c;
            mappedCols.add(c);
            matchCount++;
            break;
          }
        }
      }
    }

    if (matchCount > bestMatchCount && matchCount >= 2) {
      bestMatchCount = matchCount;
      bestRowIdx = r;
      bestMapping = mapping;
    }
  }

  if (bestRowIdx === -1 || bestMatchCount < 2) {
    for (let r = 0; r < Math.min(rows.length, 10); r++) {
      const row = rows[r];
      if (row.length < 3) continue;
      const mapping = {};
      let dataScore = 0;

      for (let c = 0; c < row.length; c++) {
        const val = (row[c] || '').trim();
        if (!val) continue;

        if (/^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}/.test(val) || /^\d{2}[-/.]\d{2}[-/.]\d{4}/.test(val)) {
          if (mapping.trade_time === undefined) {
            mapping.trade_time = c;
            dataScore++;
          } else if (mapping.exit_time === undefined) {
            mapping.exit_time = c;
            dataScore++;
          }
        }
        else if (/^(BUY|SELL|BUY_LIMIT|SELL_LIMIT|BUY_STOP|SELL_STOP)$/i.test(val)) {
          if (mapping.side === undefined) {
            mapping.side = c;
            dataScore++;
          }
        }
        else if (/^[A-Z]{3,8}(USD|EUR|GBP|JPY|CAD|AUD|CHF)?$/i.test(val) && val.length <= 10 && !/^(BUY|SELL|WIN|LOSS)$/i.test(val)) {
          if (mapping.asset === undefined) {
            mapping.asset = c;
            dataScore++;
          }
        }
      }

      if (dataScore >= 2) {
        bestRowIdx = r > 0 ? r - 1 : 0;
        bestMapping = mapping;
        break;
      }
    }
  }

  return { headerRowIndex: bestRowIdx, mapping: bestMapping };
};

const parseRowsToTrades = (rows, headerRowIndex, mapping, sourceTimezoneOffset, globalTargetAccount) => {
  const trades = [];
  const startRow = headerRowIndex === -1 ? 0 : headerRowIndex + 1;

  for (let i = startRow; i < rows.length; i++) {
    const row = rows[i];
    if (row.length === 0 || (row.length === 1 && !row[0].trim())) continue;

    const getVal = (field) => {
      const colIdx = mapping[field];
      if (colIdx === undefined || colIdx >= row.length) return '';
      return (row[colIdx] || '').trim();
    };

    const asset = getVal('asset').toUpperCase() || 'XAUUSD';
    
    let rawSide = getVal('side').toUpperCase();
    let side = 'BUY';
    if (rawSide.startsWith('S') || rawSide.includes('SELL') || rawSide.startsWith('BÁN') || rawSide.includes('BAN')) {
      side = 'SELL';
    }

    const size = parseNumber(getVal('size')) || 0.01;
    const entry_price = parseNumber(getVal('entry_price')) || 0;
    const exit_price = parseNumber(getVal('exit_price')) || 0;
    
    let pnlVal = getVal('pnl');
    let pnl = 0;
    if (pnlVal !== '') {
      pnl = parseNumber(pnlVal) || 0;
    } else {
      if (side === 'BUY') {
        pnl = (exit_price - entry_price) * size;
      } else {
        pnl = (entry_price - exit_price) * size;
      }
      pnl = Math.round(pnl * 100) / 100;
    }

    let trade_time = getVal('trade_time') || null;
    let exit_time = getVal('exit_time') || null;

    if (trade_time && trade_time.length <= 8 && trade_time.includes(':')) {
      const d = new Date().toISOString().substring(0, 10);
      trade_time = `${d} ${trade_time}`;
    }

    if (exit_time && exit_time.length <= 8 && exit_time.includes(':')) {
      const d = new Date().toISOString().substring(0, 10);
      exit_time = `${d} ${exit_time}`;
    }

    const raw_trade_time = trade_time;
    const raw_exit_time = exit_time;

    trade_time = convertToUtcSql(raw_trade_time, sourceTimezoneOffset);
    exit_time = convertToUtcSql(raw_exit_time, sourceTimezoneOffset);

    const stop_loss = getVal('stop_loss') ? parseNumber(getVal('stop_loss')) : null;
    const take_profit = getVal('take_profit') ? parseNumber(getVal('take_profit')) : null;
    const user_notes = getVal('user_notes') || '';
    let trade_type = getVal('trade_type') || globalTargetAccount;

    trades.push({
      asset, side, size, entry_price, exit_price, pnl,
      stop_loss, take_profit, raw_trade_time, raw_exit_time,
      trade_time, exit_time, user_notes, trade_type, selected: true
    });
  }
  return trades;
};

const groupTradesBlock = (symbolGroups, groupedResult) => {
  symbolGroups.forEach(groupTrades => {
    if (groupTrades.length === 1) {
      groupedResult.push(groupTrades[0]);
    } else {
      groupTrades.sort((a, b) => getTimeMs(a.trade_time) - getTimeMs(b.trade_time));

      const firstTrade = groupTrades[0];
      const { asset, side, trade_type } = firstTrade;

      let totalSize = 0, totalPnl = 0, weightedEntrySum = 0, weightedExitSum = 0;
      const slValues = [], tpValues = [];

      let datePartLocal = '';
      if (firstTrade.trade_time) {
          const d = new Date(firstTrade.trade_time.replace(' ', 'T') + 'Z');
          if (!isNaN(d.getTime())) {
              datePartLocal = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
          } else {
              datePartLocal = firstTrade.trade_time.split(' ')[0] || '';
          }
      }
      let notesSummary = `[Giao dịch DCA gộp từ ${groupTrades.length} lệnh ngày ${datePartLocal}]\n`;

      groupTrades.forEach((t, idx) => {
        totalSize += t.size;
        totalPnl += t.pnl;
        weightedEntrySum += t.entry_price * t.size;
        weightedExitSum += (t.exit_price || t.entry_price) * t.size;

        if (t.stop_loss) slValues.push(t.stop_loss);
        if (t.take_profit) tpValues.push(t.take_profit);

        let timePartLocal = '';
        if (t.trade_time) {
            const d = new Date(t.trade_time.replace(' ', 'T') + 'Z');
            if (!isNaN(d.getTime())) {
                timePartLocal = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
            } else {
                timePartLocal = t.trade_time.split(' ')[1] || '';
            }
        }
        notesSummary += `- Lệnh #${idx + 1}: Vol ${t.size} | Entry ${t.entry_price} -> Exit ${t.exit_price} | PnL: ${t.pnl >= 0 ? '+' : ''}${t.pnl} USD${timePartLocal ? ` lúc ${timePartLocal}` : ''}\n`;
        if (t.user_notes) notesSummary += `  Ghi chú: ${t.user_notes}\n`;
      });

      const avgEntryPrice = totalSize > 0 ? Math.round((weightedEntrySum / totalSize) * 100000) / 100000 : 0;
      const avgExitPrice = totalSize > 0 ? Math.round((weightedExitSum / totalSize) * 100000) / 100000 : 0;
      const avgSl = slValues.length > 0 ? Math.round((slValues.reduce((sum, v) => sum + v, 0) / slValues.length) * 100000) / 100000 : null;
      const avgTp = tpValues.length > 0 ? Math.round((tpValues.reduce((sum, v) => sum + v, 0) / tpValues.length) * 100000) / 100000 : null;

      const latestExitTrade = [...groupTrades].sort((a, b) => getTimeMs(a.exit_time, a.trade_time) - getTimeMs(b.exit_time, b.trade_time))[groupTrades.length - 1];

      groupedResult.push({
        asset, side, size: Math.round(totalSize * 1000) / 1000,
        entry_price: avgEntryPrice, exit_price: avgExitPrice,
        pnl: Math.round(totalPnl * 100) / 100,
        stop_loss: avgSl, take_profit: avgTp,
        raw_trade_time: firstTrade.raw_trade_time,
        raw_exit_time: latestExitTrade ? latestExitTrade.raw_exit_time : null,
        trade_time: firstTrade.trade_time,
        exit_time: latestExitTrade ? latestExitTrade.exit_time : null,
        user_notes: notesSummary.trim(),
        trade_type, selected: true, is_grouped: true, grouped_count: groupTrades.length
      });
    }
  });
};

const groupDCATrades = (tradesList) => {
  const categories = {};
  tradesList.forEach(trade => {
    const key = `${trade.asset}_${trade.side}_${trade.trade_type}`;
    if (!categories[key]) categories[key] = [];
    categories[key].push(trade);
  });

  const groupedResult = [];
  Object.entries(categories).forEach(([catKey, catTrades]) => {
    catTrades.sort((a, b) => getTimeMs(a.trade_time) - getTimeMs(b.trade_time));
    const symbolGroups = [];
    let currentGroup = null;

    catTrades.forEach(t => {
      if (!currentGroup) {
        currentGroup = [t];
      } else {
        const tradeOpenTimeMs = getTimeMs(t.trade_time);
        let latestExitTimeMs = 0;
        let firstTradeTimeMs = getTimeMs(currentGroup[0].trade_time);
        currentGroup.forEach(g => {
          const exitTimeMs = getTimeMs(g.exit_time);
          if (exitTimeMs > latestExitTimeMs) latestExitTimeMs = exitTimeMs;
        });
        
        // If no trade has an exit time, group them if they fall within 4 hours (14400000 ms) of the first trade
        if (latestExitTimeMs === 0) {
          latestExitTimeMs = firstTradeTimeMs + (4 * 60 * 60 * 1000);
        }

        if (tradeOpenTimeMs <= latestExitTimeMs) {
          currentGroup.push(t);
        } else {
          symbolGroups.push(currentGroup);
          currentGroup = [t];
        }
      }
    });

    if (currentGroup) symbolGroups.push(currentGroup);
    groupTradesBlock(symbolGroups, groupedResult);
  });

  groupedResult.sort((a, b) => {
    if (!a.trade_time) return 1;
    if (!b.trade_time) return -1;
    return getTimeMs(a.trade_time) - getTimeMs(b.trade_time);
  });
  return groupedResult;
};

export default function ImportCSVModal({ isOpen, onClose, onSuccess, existingTrades = [], accountTabs = [], activeTab }) {
  const t = useLanguageStore(state => state.t);
  const language = useLanguageStore(state => state.language);
  const [file, setFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [parsedTrades, setParsedTrades] = useState([]);
  const [rawParsedTrades, setRawParsedTrades] = useState([]); // Backup of raw parsed trades without DCA
  const [step, setStep] = useState('input'); // 'input' | 'preview'
  const [groupDCA, setGroupDCA] = useState(true);
  const [sourceTimezoneOffset, setSourceTimezoneOffset] = useState(0);
  const [localOffsetHours, setLocalOffsetHours] = useState(7);
  const [localTzName, setLocalTzName] = useState('Asia/Ho_Chi_Minh');
  const [globalTargetAccount, setGlobalTargetAccount] = useState('LIVE');
  const [isGlobalAccountDropdownOpen, setIsGlobalAccountDropdownOpen] = useState(false);
  const [filterStartDate, setFilterStartDate] = useState('');
  const [showAdvancedConfigs, setShowAdvancedConfigs] = useState(false);

  useEffect(() => {
    if (activeTab && activeTab !== 'ALL') {
      setGlobalTargetAccount(activeTab);
    } else if (accountTabs && accountTabs.length > 0) {
      const validTab = accountTabs.find(t => !t.isAll);
      if (validTab) setGlobalTargetAccount(validTab.key);
    }
  }, [activeTab, accountTabs]);

  useEffect(() => {
    if (!globalTargetAccount) return;
    try {
      const suffix = `_${globalTargetAccount}`;
      
      const savedTz = localStorage.getItem(`ai_trading_csv_source_tz${suffix}`);
      if (savedTz !== null && savedTz !== undefined && !isNaN(parseFloat(savedTz))) {
        setSourceTimezoneOffset(parseFloat(savedTz));
      } else {
        setSourceTimezoneOffset(0);
      }
      
      const savedDate = localStorage.getItem(`ai_trading_csv_filter_start_date${suffix}`);
      if (savedDate) {
        setFilterStartDate(savedDate);
      } else {
        setFilterStartDate('');
      }

      const savedDca = localStorage.getItem(`ai_trading_csv_group_dca${suffix}`);
      if (savedDca !== null && savedDca !== undefined) {
        setGroupDCA(savedDca === 'true');
      } else {
        setGroupDCA(true);
      }
    } catch (e) {
      console.error(e);
    }
  }, [globalTargetAccount]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setLocalOffsetHours(-(new Date().getTimezoneOffset() / 60));
      setLocalTzName(Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Ho_Chi_Minh');
    }
  }, []);

  const handleTimezoneChange = (val) => {
    const num = parseFloat(val);
    setSourceTimezoneOffset(num);
    if (typeof window !== 'undefined' && globalTargetAccount) {
      localStorage.setItem(`ai_trading_csv_source_tz_${globalTargetAccount}`, String(num));
    }
    if (rawParsedTrades && rawParsedTrades.length > 0) {
      const updatedRaw = rawParsedTrades.map(t => ({
        ...t,
        trade_time: convertToUtcSql(t.raw_trade_time || t.trade_time, num),
        exit_time: convertToUtcSql(t.raw_exit_time || t.exit_time, num),
      }));
      setRawParsedTrades(updatedRaw);
      const updatedDCA = groupDCA ? groupDCATrades(updatedRaw) : updatedRaw;
      setParsedTrades(checkDuplicates(updatedDCA));
    }
  };

  const localOffsetSign = localOffsetHours >= 0 ? `+${localOffsetHours}` : `${localOffsetHours}`;

  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  
  const [expandedIndex, setExpandedIndex] = useState(null);
  const [activeNotesEditIdx, setActiveNotesEditIdx] = useState(null);
  const [tempNotesText, setTempNotesText] = useState('');
  const fileInputRef = useRef(null);

  if (!isOpen) return null;



  const checkDuplicates = (tradesList) => {
    return tradesList.map(trade => {
      const isDuplicate = existingTrades.some(et => {
        const etTime = et.trade_time ? new Date(et.trade_time.replace(' ', 'T')).getTime() : 0;
        const tradeTime = trade.trade_time ? new Date(trade.trade_time.replace(' ', 'T')).getTime() : 0;
        
        // Only consider time match if both have dates and are within 60s
        const timeMatch = etTime > 0 && tradeTime > 0 && Math.abs(etTime - tradeTime) < 60000;
        
        return et.asset === trade.asset &&
          et.side === trade.side &&
          et.trade_type === trade.trade_type &&
          timeMatch &&
          Math.abs(et.size - trade.size) < 0.0001 &&
          Math.abs(et.pnl - trade.pnl) < 0.01;
      });
      return {
        ...trade,
        is_duplicate: isDuplicate,
        selected: isDuplicate ? false : trade.selected
      };
    });
  };

  const processCSVContent = (text) => {
    try {
      const rows = parseCSVText(text);
      if (rows.length < 2) {
        setError('File CSV trống hoặc không có đủ dữ liệu.');
        return;
      }

      const { headerRowIndex, mapping } = findHeaderAndMap(rows);
      let tradesList = parseRowsToTrades(rows, headerRowIndex, mapping, sourceTimezoneOffset, globalTargetAccount);

      if (filterStartDate) {
        const filterD = new Date(filterStartDate + 'T00:00:00Z');
        if (!isNaN(filterD.getTime())) {
          tradesList = tradesList.filter(t => {
            if (!t.raw_trade_time) return true;
            const tradeD = safeParseDate(t.raw_trade_time);
            if (!tradeD || isNaN(tradeD.getTime())) return true;
            return tradeD.getTime() >= filterD.getTime();
          });
        }
      }

      if (tradesList.length === 0) {
        setError('Không có lệnh nào hợp lệ (hoặc không có lệnh nào sau ngày lọc). Vui lòng kiểm tra lại định dạng file CSV hoặc ngày lọc.');
        return;
      }

      setRawParsedTrades(tradesList);

      const finalTrades = groupDCA ? groupDCATrades(tradesList) : tradesList;
      const flaggedTrades = checkDuplicates(finalTrades);
      setParsedTrades(flaggedTrades);
      setStep('preview');
      setError('');
    } catch (err) {
      console.error(err);
      setError('Lỗi khi phân tích nội dung file CSV. Vui lòng đảm bảo định dạng hợp lệ.');
    }
  };

  const processFile = (selectedFile) => {
    if (selectedFile) {
      if (!selectedFile.name.endsWith('.csv')) {
        setError('Chỉ chấp nhận file định dạng .csv');
        return;
      }
      setFile(selectedFile);
      const reader = new FileReader();
      reader.onload = (event) => processCSVContent(event.target.result);
      reader.readAsText(selectedFile);
    }
  };

  const handleFileChange = (e) => processFile(e.target.files[0]);

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => setDragOver(false);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    processFile(e.dataTransfer.files[0]);
  };

  const triggerFileSelect = () => {
    fileInputRef.current.click();
  };

  const handleDCAToggle = () => {
    const nextGroupDCA = !groupDCA;
    setGroupDCA(nextGroupDCA);
    if (typeof window !== 'undefined' && globalTargetAccount) {
      localStorage.setItem(`ai_trading_csv_group_dca_${globalTargetAccount}`, String(nextGroupDCA));
    }
    if (rawParsedTrades.length > 0) {
      const updated = nextGroupDCA ? groupDCATrades(rawParsedTrades) : rawParsedTrades;
      setParsedTrades(checkDuplicates(updated));
    }
  };

  const handleFieldChange = (index, field, value) => {
    setParsedTrades((prev) =>
      prev.map((trade, idx) => {
        if (idx === index) {
          const updated = { ...trade, [field]: value };
          if (field === 'pnl') {
            const pnlNum = parseFloat(value) || 0;
            updated.status = pnlNum > 0 ? 'WIN' : pnlNum < 0 ? 'LOSS' : 'BREAKEVEN';
          }
          return updated;
        }
        return trade;
      })
    );
  };

  const toggleSelectTrade = (index) => {
    setParsedTrades((prev) =>
      prev.map((trade, idx) =>
        idx === index ? { ...trade, selected: !trade.selected } : trade
      )
    );
  };

  const toggleExpand = (index) => {
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  const runBulkAI = async () => {
    const selectedTrades = parsedTrades.filter((t) => t.selected);
    if (selectedTrades.length === 0) {
      setError('Vui lòng chọn ít nhất một lệnh để phân tích.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/trades/analyze-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trades: selectedTrades, lang: language }),
      });

      const result = await response.json();
      if (result.success && result.trades) {
        // Merge analyzed results back into the list
        setParsedTrades((prev) =>
          prev.map((trade) => {
            if (!trade.selected) return trade;
            
            const matchedAnalyzed = result.trades.find(
              (at) => 
                at.asset === trade.asset && 
                at.side === trade.side && 
                at.trade_time === trade.trade_time &&
                at.size === trade.size
            );

            if (matchedAnalyzed) {
              return {
                ...trade,
                setup_tag: matchedAnalyzed.setup_tag,
                ai_evaluation: matchedAnalyzed.ai_evaluation
              };
            }
            return trade;
          })
        );
        setError('');
      } else {
        setError(result.error || 'Lỗi khi gọi API phân tích AI.');
      }
    } catch (err) {
      console.error(err);
      setError('Lỗi kết nối mạng khi phân tích AI.');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    const selectedTrades = parsedTrades.filter((t) => t.selected);
    if (selectedTrades.length === 0) {
      setError('Vui lòng chọn ít nhất một lệnh để nhập.');
      return;
    }

    setImporting(true);
    setError('');

    try {
      const response = await fetch('/api/trades/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trades: selectedTrades }),
      });

      const result = await response.json();
      if (result.success) {
        if (onSuccess) onSuccess();
        onClose();
        // Reset states
        setSourceTimezoneOffset(0);
        setFile(null);
        setParsedTrades([]);
        setRawParsedTrades([]);
        setStep('input');
        
        if (result.aiFailed) {
          alert("Import thành công! Tuy nhiên, hệ thống AI (Gemini) đang bị nghẽn mạng nên các lệnh tạm thời chỉ được lưu dưới dạng dữ liệu gốc (chưa có phân tích tự động). Bạn có thể phân tích lại sau!");
        }
      } else {
        setError(result.error || 'Đã xảy ra lỗi khi nhập lịch sử giao dịch.');
      }
    } catch (err) {
      console.error(err);
      setError('Lỗi mạng khi lưu lịch sử giao dịch.');
    } finally {
      setImporting(false);
    }
  };

  // Compute preview metrics
  const activeTrades = parsedTrades.filter((t) => t.selected);
  const totalPnl = activeTrades.reduce((sum, t) => sum + (parseFloat(t.pnl) || 0), 0);
  const winTrades = activeTrades.filter((t) => t.pnl > 0).length;
  const winRate = activeTrades.length > 0 ? Math.round((winTrades / activeTrades.length) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center theme-inner-card/80 backdrop-blur-sm p-4 animate-fade-in">
      <div className="relative w-full max-w-4xl theme-card border theme-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b theme-border flex items-center justify-between theme-inner-card">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-sky-500/10 rounded-lg text-sky-400">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">{t('csvModalTitle')}</h2>
              <p className="text-xs text-slate-400">{t('csvModalSubtitle')}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mx-6 mt-4 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-start gap-3 text-rose-400 text-sm">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* STEP 1: Upload File Input */}
          {step === 'input' && !loading && (
            <div className="space-y-6">
              
              {/* Drag and Drop Zone */}
              <div 
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={triggerFileSelect}
                className={`border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center gap-4 cursor-pointer transition ${
                  dragOver 
                    ? 'border-sky-500 bg-sky-500/5' 
                    : 'theme-border hover:theme-border theme-inner-card/20 hover:theme-inner-card/45'
                }`}
              >
                <input 
                  type="file" 
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".csv"
                  className="hidden" 
                />
                
                <div className="p-4 theme-inner-card border theme-border rounded-2xl text-sky-400">
                  <Upload className="w-8 h-8 animate-pulse" />
                </div>
                
                <div className="text-center space-y-1.5">
                  <p className="text-sm font-semibold text-white">{t('csvDragDropTitle')}</p>
                  <p className="text-xs text-slate-500">{t('csvDragDropSubtitle')}</p>
                </div>
              </div>

              {/* Configurations */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Global Account Selection Option (Only if in ALL tab) */}
                {activeTab === 'ALL' && (
                  <div className="theme-inner-card p-4 rounded-xl space-y-2.5 col-span-1 md:col-span-2 border theme-border">
                    <label className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-emerald-400"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
                      {t('csvSelectAccountTab') || 'Chọn Tài Khoản'}
                    </label>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setIsGlobalAccountDropdownOpen(!isGlobalAccountDropdownOpen)}
                        className="w-full theme-inner-card border theme-border rounded-xl px-3 py-2 text-xs text-white outline-none cursor-pointer font-semibold focus:border-emerald-500 flex items-center justify-between"
                      >
                        <span className="truncate">
                          {(() => {
                            const options = accountTabs && accountTabs.length > 0 ? accountTabs.filter(t => !t.isAll) : [
                              { key: 'LIVE', label: 'Live' },
                              { key: 'BACKTEST', label: 'Backtest' }
                            ];
                            const selected = options.find(o => o.key === globalTargetAccount);
                            return selected ? selected.label : globalTargetAccount;
                          })()}
                        </span>
                        <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${isGlobalAccountDropdownOpen ? 'rotate-180' : ''}`} />
                      </button>
                      
                      {isGlobalAccountDropdownOpen && (
                        <>
                          <div 
                            className="fixed inset-0 z-[100]" 
                            onClick={() => setIsGlobalAccountDropdownOpen(false)}
                          ></div>
                          <div className="absolute top-full left-0 right-0 mt-1 z-[101] theme-inner-card border theme-border rounded-xl shadow-xl overflow-hidden animate-fade-in py-1">
                            {(accountTabs && accountTabs.length > 0 ? accountTabs.filter(t => !t.isAll) : [
                              { key: 'LIVE', label: 'Live Account' },
                              { key: 'BACKTEST', label: 'Backtest' }
                            ]).map((tab) => (
                              <button
                                key={tab.key}
                                type="button"
                                onClick={() => {
                                  setGlobalTargetAccount(tab.key);
                                  setIsGlobalAccountDropdownOpen(false);
                                }}
                                className={`w-full text-left px-3 py-2 text-xs transition-colors cursor-pointer flex items-center justify-between ${
                                  globalTargetAccount === tab.key 
                                    ? 'bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 font-semibold' 
                                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                                }`}
                              >
                                <span>{tab.label}</span>
                                {globalTargetAccount === tab.key && <Check className="w-4 h-4" />}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Advanced Settings Toggle */}
                <div className="col-span-1 md:col-span-2 mt-2">
                  <button
                    type="button"
                    onClick={() => setShowAdvancedConfigs(!showAdvancedConfigs)}
                    className="w-full flex items-center justify-center gap-2 text-xs font-semibold text-slate-400 hover:text-white theme-inner-card border theme-border rounded-xl py-3 transition cursor-pointer outline-none focus:outline-none focus:ring-0"
                  >
                    {showAdvancedConfigs ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    Cài đặt nâng cao (Lưu tự động theo tài khoản)
                  </button>
                </div>
                
                {showAdvancedConfigs && (
                  <>
                    {/* Timezone Selection Option */}
                    <div className="theme-inner-card p-4 rounded-xl space-y-2.5 col-span-1 md:col-span-2 border theme-border animate-fade-in">
                      <label className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-amber-400" /> {t('csvTimezoneHeader')}
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <span className="text-[11px] text-slate-400 block mb-1 font-medium">{t('csvSourceTzLabel')}</span>
                          <select
                            value={sourceTimezoneOffset}
                            onChange={(e) => handleTimezoneChange(parseFloat(e.target.value))}
                            className="w-full theme-inner-card border theme-border rounded-xl px-3 py-2 text-xs text-white outline-none cursor-pointer font-semibold focus:border-sky-500"
                          >
                            <option value={0}>{t('tzOpt0')}</option>
                            <option value={7}>{t('tzOpt7')}</option>
                            <option value={3}>{t('tzOpt3')}</option>
                            <option value={2}>{t('tzOpt2')}</option>
                            <option value={8}>{t('tzOpt8')}</option>
                            <option value={1}>{t('tzOpt1')}</option>
                            <option value={-5}>{t('tzOptNeg5')}</option>
                            <option value={-4}>{t('tzOptNeg4')}</option>
                            <option value={-7}>{t('tzOptNeg7')}</option>
                          </select>
                        </div>
                        <div>
                          <span className="text-[11px] text-slate-400 block mb-1 font-medium">{t('csvTargetTzLabel')}</span>
                          <div className="text-[11px] text-slate-300 theme-card border theme-border rounded-xl px-3 py-2 flex flex-col justify-center h-[38px]">
                            <span className="font-semibold text-emerald-400 flex items-center justify-between">
                              <span>{t('csvUtcStandard')}</span>
                              <span className="text-[10px] text-slate-400 font-mono">{t('csvLocalTzAutoFormat')}</span>
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Filter Date Option */}
                    <div className="theme-inner-card p-4 rounded-xl flex flex-col gap-2 col-span-1 md:col-span-2 border theme-border animate-fade-in">
                      <label className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                        <Calendar className="w-4 h-4 text-purple-400" /> Nhập từ ngày (Tùy chọn)
                      </label>
                      <p className="text-[11px] text-slate-400">Chỉ nhập các lệnh từ ngày này đến hiện tại. Bỏ trống để nhập tất cả. Hữu ích khi file lịch sử CSV quá dài.</p>
                      <input
                        type="date"
                        value={filterStartDate}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFilterStartDate(val);
                          if (typeof window !== 'undefined' && globalTargetAccount) {
                            localStorage.setItem(`ai_trading_csv_filter_start_date_${globalTargetAccount}`, val);
                          }
                        }}
                        className="w-full sm:w-1/3 theme-inner-card border theme-border focus:border-sky-500 rounded-xl px-3 py-2 text-sm text-white outline-none cursor-pointer"
                      />
                    </div>

                    {/* DCA Option */}
                    <div className="theme-inner-card p-4 rounded-xl flex items-start gap-3.5 col-span-1 md:col-span-2 animate-fade-in">
                      <div className="pt-0.5">
                        <input 
                          type="checkbox"
                          id="groupDCA"
                          checked={groupDCA}
                          onChange={handleDCAToggle}
                          className="w-4 h-4 rounded theme-border theme-card text-sky-500 focus:ring-sky-500 cursor-pointer"
                        />
                      </div>
                      <label htmlFor="groupDCA" className="space-y-1 cursor-pointer">
                        <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5 text-sky-400" /> {t('csvGroupDcaTitle')}
                        </span>
                        <p className="text-xs text-slate-500 leading-relaxed">
                          {t('csvGroupDcaDesc')}
                        </p>
                      </label>
                    </div>
                  </>
                )}

              </div>

              {/* Sample format guide */}
              <div className="theme-inner-card p-4 border theme-border rounded-xl space-y-2.5">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  {t('csvGuideTitle')}
                </span>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {t('csvGuideDesc')}
                </p>
                <div className="theme-inner-card border border-slate-900 rounded-lg p-3 overflow-x-auto">
                  <pre className="font-mono text-[10px] text-slate-400 leading-relaxed">
                    {t('csvSampleHeader')}<br/>
                    2026-07-21 09:30, XAUUSD, BUY, 0.1, 2320.5, 2322.0, 15.0, 2315, 2335, {t('csvSampleRow1Note')}<br/>
                    2026-07-21 09:45, XAUUSD, BUY, 0.2, 2318.0, 2322.0, 80.0, 2315, 2335, {t('csvSampleRow2Note')}
                  </pre>
                </div>
              </div>

            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
              <div className="relative">
                <div className="w-16 h-16 border-4 border-sky-500/20 border-t-sky-500 rounded-full animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center text-sky-400">
                  <Sparkles className="w-6 h-6 animate-pulse" />
                </div>
              </div>
              <div className="text-center space-y-1 animate-pulse">
                <p className="text-sm font-semibold text-white">{t('csvAiAnalyzingTitle')}</p>
                <p className="text-xs text-slate-500">{t('csvAiAnalyzingDesc')}</p>
              </div>
            </div>
          )}

          {/* STEP 2: Preview List */}
          {step === 'preview' && !loading && (
            <div className="space-y-6 animate-fade-in">
              
              {/* Parsed Summary Stats */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 theme-inner-card/80 p-4 border theme-border rounded-xl">
                <div className="grid grid-cols-3 gap-4 flex-1">
                  <div className="text-center border-r theme-border/80">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">{t('csvTotalTradesCount')}</span>
                    <span className="text-xl font-bold text-white font-mono">{activeTrades.length} / {parsedTrades.length}</span>
                  </div>
                  <div className="text-center border-r theme-border/80">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">{t('csvWinRateStat')}</span>
                    <span className="text-xl font-bold text-sky-400 font-mono">{winRate}%</span>
                  </div>
                  <div className="text-center">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">{t('csvTotalPnlEst')}</span>
                    <span className={`text-xl font-bold font-mono ${totalPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {totalPnl >= 0 ? '+' : ''}{totalPnl.toLocaleString()} USD
                    </span>
                  </div>
                </div>
              </div>

              {/* Options bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 theme-inner-card/30 p-3 border theme-border rounded-xl">
                <div className="flex flex-wrap gap-4 items-center">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-400">
                    <input 
                      type="checkbox"
                      checked={groupDCA}
                      onChange={handleDCAToggle}
                      className="w-3.5 h-3.5 rounded theme-border theme-card text-sky-500 focus:ring-sky-500 cursor-pointer"
                    />
                    <span>{t('csvGroupDcaCheck')}</span>
                  </label>

                </div>
                
                {/* AI Trigger button in preview */}
                <button
                  type="button"
                  onClick={runBulkAI}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 rounded-lg text-xs font-bold transition border border-purple-500/20 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{t('csvAiAnalyzeCheck')}</span>
                </button>
              </div>

              {/* Parsed Trades List */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t('csvColActions')} ({parsedTrades.length})</h4>

                <div className="space-y-3">
                  {parsedTrades.map((trade, idx) => {
                    const isWin = trade.pnl > 0;
                    const isLoss = trade.pnl < 0;
                    const isExpanded = expandedIndex === idx;
                    const ai = trade.ai_evaluation;

                    return (
                      <div 
                        key={idx}
                        className={`theme-inner-card border rounded-xl overflow-hidden transition ${
                          trade.selected 
                            ? 'theme-border theme-inner-card' 
                            : trade.is_duplicate
                              ? 'border-amber-500/10 opacity-60 bg-amber-500/5'
                              : 'border-slate-900 opacity-50 theme-inner-card/10'
                        }`}
                      >
                        {/* Summary Header */}
                        <div className="flex items-center justify-between p-3.5 gap-3">
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={trade.selected}
                              onChange={() => toggleSelectTrade(idx)}
                              className="w-4 h-4 rounded theme-border theme-card text-sky-500 focus:ring-sky-500 cursor-pointer"
                            />
                            
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              trade.side === 'BUY' 
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                                : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            }`}>
                              {trade.side}
                            </span>
                            
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-sm text-white">{t('csvOrderNum', { num: idx + 1 })}</span>
                                <span className="text-xs text-slate-400 font-semibold">{trade.asset}</span>
                                
                                {trade.is_grouped && (
                                  <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-sky-500/10 text-sky-400 border border-sky-500/20 flex items-center gap-1">
                                    <Layers className="w-2.5 h-2.5" />
                                    {t('csvGroupedDcaCount', { count: trade.grouped_count })}
                                  </span>
                                )}

                                {trade.is_duplicate && (
                                  <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1">
                                    {t('csvDuplicateEntry')}
                                  </span>
                                )}

                                {ai && (
                                  <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                                    {t('csvAiRating', { rating: ai.decision_rating })}
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-500 font-medium font-mono">
                                  {t('csvTradeDetails', { vol: trade.size, entry: trade.entry_price, setup: trade.setup_tag || t('csvUnclassified') })}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <span className={`font-mono font-bold text-sm ${
                                isWin ? 'text-emerald-400' : isLoss ? 'text-rose-400' : 'text-slate-400'
                              }`}>
                                {trade.pnl >= 0 ? '+' : ''}{trade.pnl} USD
                              </span>
                              <span className="block text-[9px] text-slate-500 font-mono">
                                {trade.trade_time}
                              </span>
                            </div>
                            
                            <button
                              onClick={() => toggleExpand(idx)}
                              className="p-1 text-slate-400 hover:text-white rounded hover:theme-card cursor-pointer"
                            >
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Expandable details panel */}
                        {isExpanded && (
                          <div className="px-4 pb-4 border-t border-slate-900/60 theme-inner-card pt-4 space-y-4 text-xs animate-slide-down">
                            
                            {/* Inputs */}
                            <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
                              <div>
                                <label className="block text-[10px] text-slate-500 uppercase font-semibold mb-1">{t('csvColAsset')}</label>
                                <input
                                  type="text"
                                  value={trade.asset}
                                  onChange={(e) => handleFieldChange(idx, 'asset', e.target.value.toUpperCase())}
                                  className="w-full theme-inner-card border theme-border focus:border-sky-500 rounded-lg px-2 py-1.5 text-white outline-none"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] text-slate-500 uppercase font-semibold mb-1">{t('csvColSide')}</label>
                                <select
                                  value={trade.side}
                                  onChange={(e) => handleFieldChange(idx, 'side', e.target.value)}
                                  className="w-full theme-inner-card border theme-border focus:border-sky-500 rounded-lg px-2 py-1.5 text-white outline-none"
                                >
                                  <option value="BUY">BUY</option>
                                  <option value="SELL">SELL</option>
                                </select>
                              </div>
                              {activeTab === 'ALL' && (
                                <div>
                                  <label className="block text-[10px] text-slate-500 uppercase font-semibold mb-1">{t('csvSelectAccountTab')}</label>
                                  <select
                                    value={trade.trade_type || 'LIVE'}
                                    onChange={(e) => handleFieldChange(idx, 'trade_type', e.target.value)}
                                    className="w-full theme-inner-card border theme-border focus:border-sky-500 rounded-lg px-2 py-1.5 text-white outline-none"
                                  >
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
                              )}
                              <div>
                                <label className="block text-[10px] text-slate-500 uppercase font-semibold mb-1">Volume (Size)</label>
                                <input
                                  type="number"
                                  step="any"
                                  value={trade.size}
                                  onChange={(e) => handleFieldChange(idx, 'size', parseFloat(e.target.value) || 0)}
                                  className="w-full theme-inner-card border theme-border focus:border-sky-500 rounded-lg px-2 py-1.5 text-white outline-none"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] text-slate-500 uppercase font-semibold mb-1">Kết quả PnL ($)</label>
                                <input
                                  type="number"
                                  step="any"
                                  value={trade.pnl}
                                  onChange={(e) => handleFieldChange(idx, 'pnl', parseFloat(e.target.value) || 0)}
                                  className="w-full theme-inner-card border theme-border focus:border-sky-500 rounded-lg px-2 py-1.5 text-white outline-none"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] text-slate-500 uppercase font-semibold mb-1">Nhãn Setup</label>
                                <input
                                  type="text"
                                  value={trade.setup_tag || ''}
                                  onChange={(e) => handleFieldChange(idx, 'setup_tag', e.target.value)}
                                  className="w-full theme-inner-card border theme-border focus:border-sky-500 rounded-lg px-2 py-1.5 text-white outline-none"
                                />
                              </div>
                            </div>

                            {/* Prices inputs */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 border-t border-slate-900/40 pt-3">
                              <div>
                                <label className="block text-[10px] text-slate-500 uppercase font-semibold mb-1">Giá vào (Entry)</label>
                                <input
                                  type="number"
                                  step="any"
                                  value={trade.entry_price}
                                  onChange={(e) => handleFieldChange(idx, 'entry_price', parseFloat(e.target.value) || 0)}
                                  className="w-full theme-inner-card border theme-border focus:border-sky-500 rounded-lg px-2 py-1.5 text-white outline-none"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] text-slate-500 uppercase font-semibold mb-1">Giá ra (Exit)</label>
                                <input
                                  type="number"
                                  step="any"
                                  value={trade.exit_price}
                                  onChange={(e) => handleFieldChange(idx, 'exit_price', parseFloat(e.target.value) || 0)}
                                  className="w-full theme-inner-card border theme-border focus:border-sky-500 rounded-lg px-2 py-1.5 text-white outline-none"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] text-slate-500 uppercase font-semibold mb-1">Cắt lỗ (Stop Loss)</label>
                                <input
                                  type="number"
                                  step="any"
                                  value={trade.stop_loss || ''}
                                  onChange={(e) => handleFieldChange(idx, 'stop_loss', e.target.value ? parseFloat(e.target.value) : null)}
                                  placeholder="None"
                                  className="w-full theme-inner-card border theme-border focus:border-sky-500 rounded-lg px-2 py-1.5 text-white outline-none"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] text-slate-500 uppercase font-semibold mb-1">Chốt lời (Take Profit)</label>
                                <input
                                  type="number"
                                  step="any"
                                  value={trade.take_profit || ''}
                                  onChange={(e) => handleFieldChange(idx, 'take_profit', e.target.value ? parseFloat(e.target.value) : null)}
                                  placeholder="None"
                                  className="w-full theme-inner-card border theme-border focus:border-sky-500 rounded-lg px-2 py-1.5 text-white outline-none"
                                />
                              </div>
                            </div>

                            {/* User notes and context */}
                            <div className="grid grid-cols-1 gap-2 pt-3 border-t border-slate-900/40">
                              <div className="flex items-center justify-between">
                                <label className="block text-[10px] text-slate-500 uppercase font-semibold">Ghi chú & Chi tiết lệnh</label>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveNotesEditIdx(idx);
                                    setTempNotesText(trade.user_notes || '');
                                  }}
                                  className="text-[10px] text-sky-400 hover:text-sky-300 flex items-center gap-1 transition cursor-pointer"
                                >
                                  <Maximize2 className="w-3 h-3" />
                                  <span>Mở rộng ghi chú</span>
                                </button>
                              </div>
                              <textarea
                                value={trade.user_notes || ''}
                                onChange={(e) => handleFieldChange(idx, 'user_notes', e.target.value)}
                                rows="4"
                                className="w-full theme-inner-card border theme-border focus:border-sky-500 rounded-lg px-3 py-2 text-white outline-none resize-y min-h-[90px] font-mono"
                              ></textarea>
                            </div>

                            {/* AI Evaluation */}
                            {ai && (
                              <div className="border-t border-slate-900/60 pt-3 space-y-3 bg-purple-500/5 p-3 rounded-lg border border-purple-500/10">
                                <span className="text-purple-400 font-bold uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                                  <Sparkles className="w-3.5 h-3.5 animate-pulse" /> Đánh giá từ AI Coach
                                </span>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
                                  <div className="theme-inner-card p-2.5 rounded-lg border theme-border">
                                    <span className="text-emerald-400 font-semibold block text-[10px] mb-1">ĐIỂM MẠNH</span>
                                    {ai.strengths?.length > 0 ? (
                                      <ul className="list-disc list-inside space-y-0.5 text-slate-350">
                                        {ai.strengths.map((s, i) => <li key={i}>{s}</li>)}
                                      </ul>
                                    ) : (
                                      <span className="text-slate-500 italic">Không có phân tích điểm mạnh</span>
                                    )}
                                  </div>
                                  <div className="theme-inner-card p-2.5 rounded-lg border theme-border">
                                    <span className="text-rose-400 font-semibold block text-[10px] mb-1">SAI LẦM / ĐIỂM YẾU</span>
                                    {ai.weaknesses?.length > 0 ? (
                                      <ul className="list-disc list-inside space-y-0.5 text-slate-350">
                                        {ai.weaknesses.map((w, i) => <li key={i}>{w}</li>)}
                                      </ul>
                                    ) : (
                                      <span className="text-slate-500 italic">Không có lỗi rõ ràng</span>
                                    )}
                                  </div>
                                </div>

                                <div className="theme-inner-card border border-slate-900/60 p-2.5 rounded-lg">
                                  <span className="text-slate-400 font-bold block text-[9px] uppercase tracking-wider mb-0.5">Lời khuyên của Coach:</span>
                                  <p className="text-slate-300 italic leading-relaxed font-serif text-xs">{ai.advice}</p>
                                </div>
                              </div>
                            )}

                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t theme-border theme-inner-card flex justify-between items-center gap-3">
          
          {step === 'preview' ? (
            <button
              onClick={() => {
                setStep('input');
                setFile(null);
                setError('');
              }}
              className="px-5 py-2 rounded-xl text-sm font-semibold text-slate-400 hover:text-white theme-inner-card border theme-border hover:bg-slate-800 transition cursor-pointer outline-none focus:outline-none focus:ring-0"
            >
              {t('csvBtnBack')}
            </button>
          ) : (
            <div></div>
          )}

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl text-sm font-semibold text-slate-400 hover:text-white theme-inner-card border theme-border hover:bg-slate-800 transition cursor-pointer outline-none focus:outline-none focus:ring-0"
            >
              {t('cancel')}
            </button>
            
            {step === 'preview' && (
              <button
                onClick={handleImport}
                disabled={importing || activeTrades.length === 0}
                className="relative px-6 py-2 bg-gradient-to-r from-sky-500 to-teal-600 hover:from-sky-400 hover:to-teal-500 text-slate-950 font-bold text-sm rounded-xl shadow-lg shadow-sky-500/10 hover:shadow-sky-500/20 transition flex items-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {importing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t('csvBtnProcessing')}
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    {t('csvBtnSaveTrades', { count: activeTrades.length })}
                  </>
                )}
              </button>
            )}
          </div>

        </div>

      </div>

      {/* Expanded Notes Edit Sub-Modal */}
      {activeNotesEditIdx !== null && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center theme-inner-card/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="relative w-full max-w-2xl theme-card border theme-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            
            <div className="px-6 py-4 border-b theme-border flex items-center justify-between theme-inner-card">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-sky-500/10 rounded-lg text-sky-400">
                  <Maximize2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">
                    Chi tiết Ghi chú - Lệnh #{activeNotesEditIdx + 1}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Cặp tiền: {parsedTrades[activeNotesEditIdx]?.asset || 'N/A'}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setActiveNotesEditIdx(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-850 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 flex-1 flex flex-col min-h-0">
              <textarea
                value={tempNotesText}
                onChange={(e) => setTempNotesText(e.target.value)}
                autoFocus
                placeholder={t('csvNotesDetailPlaceholder')}
                className="w-full flex-1 theme-inner-card border theme-border focus:border-sky-500 focus:ring-1 focus:ring-sky-500 rounded-xl p-4 text-white placeholder-slate-650 transition outline-none resize-none text-sm leading-relaxed font-mono min-h-[300px]"
              ></textarea>
            </div>

            <div className="px-6 py-4 border-t theme-border theme-inner-card flex justify-end gap-3">
              <button
                onClick={() => setActiveNotesEditIdx(null)}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-400 hover:text-white theme-inner-card border theme-border hover:bg-slate-800 transition cursor-pointer outline-none focus:outline-none focus:ring-0"
              >
                {t('cancel')}
              </button>
              <button
                onClick={() => {
                  handleFieldChange(activeNotesEditIdx, 'user_notes', tempNotesText);
                  setActiveNotesEditIdx(null);
                }}
                className="px-5 py-2 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-sm rounded-xl shadow-lg transition cursor-pointer"
              >
                {t('save')}
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
