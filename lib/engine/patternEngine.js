/**
 * Trading Improvement Engine — Pattern Engine
 * Finds cross-dimension patterns with statistical significance.
 * A pattern = combination of conditions → measurable outcome.
 * Only patterns with >= 3 trade samples are considered significant.
 */

import { groupByDay, toLocalDay, toLocalHour, toSession, toLocalDow } from './statsEngine.js';

const MIN_SAMPLE = 3;

function pnlStats(trades) {
  const wins = trades.filter(t => t.status === 'WIN').length;
  const losses = trades.filter(t => t.status === 'LOSS').length;
  const total = trades.length;
  const totalPnl = trades.reduce((s, t) => s + (parseFloat(t.pnl) || 0), 0);
  const winRate = total > 0 ? Math.round((wins / total) * 1000) / 10 : 0;
  const avgPnl = total > 0 ? Math.round((totalPnl / total) * 100) / 100 : 0;
  return { total, wins, losses, winRate, totalPnl: Math.round(totalPnl * 100) / 100, avgPnl };
}

/**
 * detectPatterns(trades)
 * @returns Array of { dimension, key, finding, impact, sampleSize, pnl, winRate }
 */
export function detectPatterns(trades) {
  if (!trades || trades.length < MIN_SAMPLE) return [];
  const findings = [];

  // ── 1. Session patterns ──────────────────────────────────────────────────
  const sessionMap = {};
  trades.forEach(t => {
    const s = toSession(t.trade_time);
    if (!sessionMap[s]) sessionMap[s] = [];
    sessionMap[s].push(t);
  });
  Object.entries(sessionMap).forEach(([session, group]) => {
    if (group.length < MIN_SAMPLE) return;
    const s = pnlStats(group);
    findings.push({
      dimension: 'session',
      key: session,
      finding: `${session}: ${s.total} lệnh, WR ${s.winRate}%, PnL ${s.totalPnl > 0 ? '+' : ''}${s.totalPnl}$`,
      pnl: s.totalPnl,
      winRate: s.winRate,
      sampleSize: s.total,
      impact: Math.abs(s.totalPnl),
      isPositive: s.totalPnl > 0,
    });
  });

  // ── 2. Day of week patterns ───────────────────────────────────────────────
  const dowMap = {};
  trades.forEach(t => {
    const d = toLocalDow(t.trade_time) || 'Unknown';
    if (!dowMap[d]) dowMap[d] = [];
    dowMap[d].push(t);
  });
  Object.entries(dowMap).forEach(([dow, group]) => {
    if (group.length < MIN_SAMPLE) return;
    const s = pnlStats(group);
    findings.push({
      dimension: 'day_of_week',
      key: dow,
      finding: `${dow}: ${s.total} lệnh, WR ${s.winRate}%, PnL ${s.totalPnl > 0 ? '+' : ''}${s.totalPnl}$`,
      pnl: s.totalPnl,
      winRate: s.winRate,
      sampleSize: s.total,
      impact: Math.abs(s.totalPnl),
      isPositive: s.totalPnl > 0,
    });
  });

  // ── 3. Asset patterns ─────────────────────────────────────────────────────
  const assetMap = {};
  trades.forEach(t => {
    const a = (t.asset || 'Unknown').toUpperCase();
    if (!assetMap[a]) assetMap[a] = [];
    assetMap[a].push(t);
  });
  Object.entries(assetMap).forEach(([asset, group]) => {
    if (group.length < MIN_SAMPLE) return;
    const s = pnlStats(group);
    findings.push({
      dimension: 'asset',
      key: asset,
      finding: `${asset}: ${s.total} lệnh, WR ${s.winRate}%, PnL ${s.totalPnl > 0 ? '+' : ''}${s.totalPnl}$`,
      pnl: s.totalPnl,
      winRate: s.winRate,
      sampleSize: s.total,
      impact: Math.abs(s.totalPnl),
      isPositive: s.totalPnl > 0,
    });
  });

  // ── 4. Overtrade day pattern ──────────────────────────────────────────────
  const dayGroups = groupByDay(trades);
  const overtradeDays = Object.entries(dayGroups).filter(([, g]) => g.length > 3);
  if (overtradeDays.length >= MIN_SAMPLE) {
    // Extract lệnh 4+ từ những ngày overtrade
    const excessTrades = overtradeDays.flatMap(([, g]) => {
      const sorted = [...g].sort((a, b) => new Date(a.trade_time) - new Date(b.trade_time));
      return sorted.slice(3);
    });
    if (excessTrades.length >= MIN_SAMPLE) {
      const s = pnlStats(excessTrades);
      findings.push({
        dimension: 'behavior',
        key: 'overtrade_excess',
        finding: `Lệnh thứ 4+ trong ngày overtrade: ${s.total} lệnh, WR ${s.winRate}%, PnL ${s.totalPnl > 0 ? '+' : ''}${s.totalPnl}$`,
        pnl: s.totalPnl,
        winRate: s.winRate,
        sampleSize: s.total,
        impact: Math.abs(s.totalPnl),
        isPositive: s.totalPnl > 0,
      });
    }
  }

  // ── 5. Emotion patterns (parsed from notes) ───────────────────────────────
  const emotionKeywords = {
    'FOMO/Cảm xúc': ['fomo', 'sợ lỡ', 'đuổi', 'chasing'],
    'Revenge/Gỡ vốn': ['revenge', 'trả thù', 'gỡ', 'recover', 'tức'],
    'Tự tin/Có plan': ['tự tin', 'confident', 'theo plan', 'đúng plan', 'có kế hoạch'],
    'Tilt/Nóng đầu': ['tilt', 'cay', 'bực', 'panic', 'hoảng'],
  };
  const emotionMap = {};
  trades.forEach(t => {
    const notes = (t.user_notes || '').toLowerCase();
    Object.entries(emotionKeywords).forEach(([emotion, keywords]) => {
      if (keywords.some(kw => notes.includes(kw))) {
        if (!emotionMap[emotion]) emotionMap[emotion] = [];
        emotionMap[emotion].push(t);
      }
    });
  });
  Object.entries(emotionMap).forEach(([emotion, group]) => {
    if (group.length < MIN_SAMPLE) return;
    const s = pnlStats(group);
    findings.push({
      dimension: 'emotion',
      key: emotion,
      finding: `Khi ${emotion}: ${s.total} lệnh, WR ${s.winRate}%, PnL ${s.totalPnl > 0 ? '+' : ''}${s.totalPnl}$`,
      pnl: s.totalPnl,
      winRate: s.winRate,
      sampleSize: s.total,
      impact: Math.abs(s.totalPnl),
      isPositive: s.totalPnl > 0,
    });
  });

  // ── 6. Late night patterns (after 22:00) ──────────────────────────────────
  const lateTrades = trades.filter(t => {
    const h = toLocalHour(t.trade_time);
    return h !== null && (h >= 22 || h < 3);
  });
  if (lateTrades.length >= MIN_SAMPLE) {
    const s = pnlStats(lateTrades);
    findings.push({
      dimension: 'time',
      key: 'late_night',
      finding: `Trade sau 22:00: ${s.total} lệnh, WR ${s.winRate}%, PnL ${s.totalPnl > 0 ? '+' : ''}${s.totalPnl}$`,
      pnl: s.totalPnl,
      winRate: s.winRate,
      sampleSize: s.total,
      impact: Math.abs(s.totalPnl),
      isPositive: s.totalPnl > 0,
    });
  }

  // ── 7. No SL trades pattern ───────────────────────────────────────────────
  const noSlTrades = trades.filter(t => !t.stop_loss || parseFloat(t.stop_loss) <= 0);
  if (noSlTrades.length >= MIN_SAMPLE) {
    const s = pnlStats(noSlTrades);
    findings.push({
      dimension: 'risk',
      key: 'no_sl',
      finding: `Trade không SL: ${s.total} lệnh, WR ${s.winRate}%, PnL ${s.totalPnl > 0 ? '+' : ''}${s.totalPnl}$`,
      pnl: s.totalPnl,
      winRate: s.winRate,
      sampleSize: s.total,
      impact: Math.abs(s.totalPnl),
      isPositive: s.totalPnl > 0,
    });
  }

  // Sort by impact descending
  return findings.sort((a, b) => b.impact - a.impact);
}
