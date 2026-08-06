/**
 * Trading Improvement Engine — Stats Engine
 * 100% code, zero AI. Calculates all core trading metrics from raw trades.
 */

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Compute R-Multiple for a trade.
 * R = PnL / (initial risk in $)
 * Initial risk = |entry - stop_loss| * size
 * Falls back to pnl / avg_loss if no SL.
 */
export function computeRMultiple(trade, avgLoss = null) {
  const pnl = parseFloat(trade.pnl) || 0;
  const sl = parseFloat(trade.stop_loss);
  const entry = parseFloat(trade.entry_price);
  const size = parseFloat(trade.size);

  if (sl > 0 && entry > 0 && size > 0) {
    const riskPerUnit = Math.abs(entry - sl);
    const riskInDollar = riskPerUnit * size;
    if (riskInDollar > 0) return pnl / riskInDollar;
  }

  // Fallback: use average loss as 1R
  if (avgLoss && avgLoss > 0) return pnl / avgLoss;

  return null;
}

/** Returns Vietnam local day key YYYY-MM-DD */
function toLocalDay(dateStr) {
  if (!dateStr) return null;
  const isoStr = dateStr.includes('T') ? dateStr : dateStr.replace(' ', 'T') + 'Z';
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
}

/** Returns hour (0-23) in Vietnam local time */
function toLocalHour(dateStr) {
  if (!dateStr) return null;
  const isoStr = dateStr.includes('T') ? dateStr : dateStr.replace(' ', 'T') + 'Z';
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return null;
  return parseInt(d.toLocaleString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', hour: 'numeric', hour12: false }), 10);
}

/** Returns day of week 0=Sun ... 6=Sat in Vietnam local time */
function toLocalDow(dateStr) {
  if (!dateStr) return null;
  const isoStr = dateStr.includes('T') ? dateStr : dateStr.replace(' ', 'T') + 'Z';
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', weekday: 'short' });
}

/** Vietnam local trading session from trade_time hour */
function toSession(dateStr) {
  const hour = toLocalHour(dateStr);
  if (hour === null) return 'Unknown';
  // Asia: 6:00–13:00, London: 13:00–19:30, NY: 19:30–03:00(next day)
  if (hour >= 6 && hour < 13) return 'Asian';
  if (hour >= 13 && hour < 20) return 'London';
  return 'New York';
}

/** Duration in minutes between trade_time and exit_time */
function holdMinutes(trade) {
  if (!trade.trade_time || !trade.exit_time) return null;
  const start = new Date((trade.trade_time.includes('T') ? trade.trade_time : trade.trade_time.replace(' ', 'T') + 'Z'));
  const end = new Date((trade.exit_time.includes('T') ? trade.exit_time : trade.exit_time.replace(' ', 'T') + 'Z'));
  if (isNaN(start) || isNaN(end)) return null;
  return (end - start) / 60000;
}

// ─── Core Metrics ─────────────────────────────────────────────────────────────

/**
 * calculateCoreMetrics(trades)
 * Returns: { winRate, expectancy, profitFactor, avgRR, maxDrawdown, totalTrades, wins, losses }
 */
export function calculateCoreMetrics(trades) {
  if (!trades || trades.length === 0) return null;

  let wins = 0, losses = 0, breakevens = 0;
  let totalPnl = 0, grossProfit = 0, grossLoss = 0;
  let peak = 0, maxDrawdown = 0, runningPnl = 0;
  const rMultiples = [];

  // First pass — compute average loss for R fallback
  const lossValues = trades.filter(t => t.status === 'LOSS').map(t => Math.abs(parseFloat(t.pnl) || 0));
  const avgLoss = lossValues.length > 0 ? lossValues.reduce((a, b) => a + b, 0) / lossValues.length : 0;

  trades.forEach(t => {
    const pnl = parseFloat(t.pnl) || 0;
    totalPnl += pnl;

    if (t.status === 'WIN') { wins++; grossProfit += pnl; }
    else if (t.status === 'LOSS') { losses++; grossLoss += Math.abs(pnl); }
    else breakevens++;

    // Drawdown
    runningPnl += pnl;
    if (runningPnl > peak) peak = runningPnl;
    const dd = peak - runningPnl;
    if (dd > maxDrawdown) maxDrawdown = dd;

    // R-Multiple
    const r = computeRMultiple(t, avgLoss);
    if (r !== null) rMultiples.push(r);
  });

  const total = wins + losses + breakevens;
  const winRate = total > 0 ? Math.round((wins / total) * 1000) / 10 : 0;
  const profitFactor = grossLoss > 0 ? Math.round((grossProfit / grossLoss) * 100) / 100 : (grossProfit > 0 ? 999 : 0);
  const avgRR = rMultiples.length > 0 ? Math.round((rMultiples.reduce((a, b) => a + b, 0) / rMultiples.length) * 100) / 100 : 0;

  // Expectancy = (WinRate * avgWin) - (LossRate * avgLoss) expressed in R
  const avgWinR = rMultiples.filter(r => r > 0).length > 0
    ? rMultiples.filter(r => r > 0).reduce((a, b) => a + b, 0) / rMultiples.filter(r => r > 0).length
    : 0;
  const avgLossR = rMultiples.filter(r => r < 0).length > 0
    ? Math.abs(rMultiples.filter(r => r < 0).reduce((a, b) => a + b, 0) / rMultiples.filter(r => r < 0).length)
    : 0;
  const wr = total > 0 ? wins / total : 0;
  const lr = total > 0 ? losses / total : 0;
  const expectancy = Math.round(((wr * avgWinR) - (lr * avgLossR)) * 100) / 100;

  return {
    totalTrades: total,
    wins,
    losses,
    breakevens,
    winRate,
    totalPnl: Math.round(totalPnl * 100) / 100,
    grossProfit: Math.round(grossProfit * 100) / 100,
    grossLoss: Math.round(grossLoss * 100) / 100,
    profitFactor,
    avgRR,
    expectancy,
    maxDrawdown: Math.round(maxDrawdown * 100) / 100,
  };
}

// ─── Breakdown Engines ─────────────────────────────────────────────────────────

function buildGroup(key, pnl, status) {
  return {
    key,
    trades: 1,
    wins: status === 'WIN' ? 1 : 0,
    losses: status === 'LOSS' ? 1 : 0,
    pnl,
    grossProfit: pnl > 0 ? pnl : 0,
    grossLoss: pnl < 0 ? Math.abs(pnl) : 0,
  };
}

function mergeGroup(g, pnl, status) {
  g.trades++;
  g.pnl += pnl;
  if (status === 'WIN') { g.wins++; g.grossProfit += pnl; }
  else if (status === 'LOSS') { g.losses++; g.grossLoss += Math.abs(pnl); }
}

function finalizeGroups(map) {
  return Object.values(map).map(g => ({
    key: g.key,
    trades: g.trades,
    wins: g.wins,
    losses: g.losses,
    winRate: g.trades > 0 ? Math.round((g.wins / g.trades) * 1000) / 10 : 0,
    pnl: Math.round(g.pnl * 100) / 100,
    profitFactor: g.grossLoss > 0 ? Math.round((g.grossProfit / g.grossLoss) * 100) / 100 : (g.grossProfit > 0 ? 999 : 0),
  })).sort((a, b) => b.pnl - a.pnl);
}

/** Group trades by session (Asian / London / New York) */
export function groupBySession(trades) {
  const map = {};
  trades.forEach(t => {
    const key = toSession(t.trade_time);
    const pnl = parseFloat(t.pnl) || 0;
    if (!map[key]) map[key] = buildGroup(key, pnl, t.status);
    else mergeGroup(map[key], pnl, t.status);
  });
  return finalizeGroups(map);
}

/** Group trades by asset */
export function groupByAsset(trades) {
  const map = {};
  trades.forEach(t => {
    const key = (t.asset || 'Unknown').toUpperCase();
    const pnl = parseFloat(t.pnl) || 0;
    if (!map[key]) map[key] = buildGroup(key, pnl, t.status);
    else mergeGroup(map[key], pnl, t.status);
  });
  return finalizeGroups(map);
}

/** Group trades by day of week */
export function groupByDayOfWeek(trades) {
  const DOW_ORDER = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const map = {};
  trades.forEach(t => {
    const key = toLocalDow(t.trade_time) || 'Unknown';
    const pnl = parseFloat(t.pnl) || 0;
    if (!map[key]) map[key] = buildGroup(key, pnl, t.status);
    else mergeGroup(map[key], pnl, t.status);
  });
  return Object.values(map)
    .map(g => ({
      key: g.key,
      trades: g.trades,
      wins: g.wins,
      losses: g.losses,
      winRate: g.trades > 0 ? Math.round((g.wins / g.trades) * 1000) / 10 : 0,
      pnl: Math.round(g.pnl * 100) / 100,
    }))
    .sort((a, b) => (DOW_ORDER.indexOf(a.key) || 99) - (DOW_ORDER.indexOf(b.key) || 99));
}

/** Group trades by hour-of-day (Vietnam time) */
export function groupByHour(trades) {
  const map = {};
  trades.forEach(t => {
    const h = toLocalHour(t.trade_time);
    if (h === null) return;
    const key = `${String(h).padStart(2, '0')}:00`;
    const pnl = parseFloat(t.pnl) || 0;
    if (!map[key]) map[key] = buildGroup(key, pnl, t.status);
    else mergeGroup(map[key], pnl, t.status);
  });
  return finalizeGroups(map).sort((a, b) => a.key.localeCompare(b.key));
}

/** Group trades by daily count (how many trades per day) */
export function groupByDay(trades) {
  const dayMap = {};
  trades.forEach(t => {
    const day = toLocalDay(t.trade_time);
    if (!day) return;
    if (!dayMap[day]) dayMap[day] = [];
    dayMap[day].push(t);
  });
  return dayMap; // { 'YYYY-MM-DD': [trade, ...] }
}

// Re-export helpers for use in other engines
export { toLocalDay, toLocalHour, toLocalDow, toSession, holdMinutes };
