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
  const recent = monthly[months[months.length - 1]] || 0;
  const prev = monthly[months[months.length - 2]] || 0;
  if (prev === 0) return { direction: 'stable', change: 0, monthly, months };
  const change = Math.round(((recent - prev) / prev) * 100);
  return {
    direction: change < -15 ? 'improving' : change > 15 ? 'worsening' : 'stable',
    change,
    monthly,
    months,
  };
}
