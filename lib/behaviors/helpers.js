export function hoursBetween(t1, t2) {
  if (!t1 || !t2) return null;
  const d1 = new Date(t1).getTime();
  const d2 = new Date(t2).getTime();
  if (isNaN(d1) || isNaN(d2)) return null;
  return (d2 - d1) / (1000 * 60 * 60);
}

export function minutesBetween(t1, t2) {
  const h = hoursBetween(t1, t2);
  return h !== null ? h * 60 : null;
}

export function isStopLossEmpty(sl) {
  return sl == null || String(sl).trim() === '' || Number(sl) === 0;
}

export function getDateStr(t) {
  if (!t) return null;
  try { return new Date(t).toISOString().slice(0, 10); } catch { return null; }
}

export function getMonthKey(trade) {
  try {
    const d = new Date(trade.trade_time);
    if (isNaN(d)) return null;
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  } catch { return null; }
}

export function median(arr) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function stddev(arr) {
  if (arr.length < 2) return 0;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  return Math.sqrt(arr.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / arr.length);
}

export function noteContains(trade, keywords) {
  const text = ((trade.user_notes || '') + ' ' + (trade.setup_tag || '')).toLowerCase();
  return keywords.some(kw => text.includes(kw.toLowerCase()));
}

export function computeTrend(monthly) {
  const months = Object.keys(monthly).filter(Boolean).sort();
  if (months.length < 2) return { direction: 'stable', change: 0, monthly, months };

  // Weighted moving average: most recent month gets highest weight
  // With 2 months: weighted = (3*recent + 1*prev) / 4
  // With 3+ months: weighted = (3*m[n] + 2*m[n-1] + 1*m[n-2]) / 6 vs (3*m[n-1] + 2*m[n-2] + 1*m[n-3]) / 6
  const n = months.length;
  let recentWMA, prevWMA;

  if (n >= 3) {
    const w = [monthly[months[n-1]] || 0, monthly[months[n-2]] || 0, monthly[months[n-3]] || 0];
    recentWMA = (3 * w[0] + 2 * w[1] + 1 * w[2]) / 6;
    // Shift window back one month for prev WMA
    const pIdx = n >= 4 ? [months[n-2], months[n-3], months[n-4]] : [months[n-2], months[n-3], months[n-3]];
    const p = pIdx.map(m => monthly[m] || 0);
    prevWMA = (3 * p[0] + 2 * p[1] + 1 * p[2]) / 6;
  } else {
    // Only 2 months: simple weighted
    recentWMA = (3 * (monthly[months[n-1]] || 0) + 1 * (monthly[months[n-2]] || 0)) / 4;
    prevWMA = monthly[months[n-2]] || 0;
  }

  if (prevWMA === 0) return { direction: 'stable', change: 0, monthly, months };
  const change = Math.round(((recentWMA - prevWMA) / prevWMA) * 100);
  return {
    direction: change < -15 ? 'improving' : change > 15 ? 'worsening' : 'stable',
    change,
    monthly,
    months,
  };
}

export function percentile(arr, p) {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    if (p <= 0) return sorted[0];
    if (p >= 1) return sorted[sorted.length - 1];

    const index = (sorted.length - 1) * p;
    const lower = Math.floor(index);
    const upper = lower + 1;
    const weight = index % 1;

    if (upper >= sorted.length) return sorted[lower];
    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}
