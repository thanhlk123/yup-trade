/**
 * Trading Improvement Engine — Behavior Engine
 * Detects trading habits (good and bad) from raw trade data.
 * 100% code, zero AI. Each habit has: frequency, lastSeen, avgLoss, avgProfit, trend, confidence.
 */

import { groupByDay, toLocalDay, toLocalHour, holdMinutes, computeRMultiple } from './statsEngine.js';

// ─── Habit Definitions ────────────────────────────────────────────────────────

const HABIT_DEFS = {
  // BAD HABITS
  overtrade: {
    id: 'overtrade',
    label: 'Overtrade (>3 lệnh/ngày)',
    type: 'bad',
    category: 'discipline',
  },
  revenge_trade: {
    id: 'revenge_trade',
    label: 'Revenge Trade (vào lệnh ngay sau khi thua)',
    type: 'bad',
    category: 'psychology',
  },
  no_stop_loss: {
    id: 'no_stop_loss',
    label: 'Không đặt Stop Loss',
    type: 'bad',
    category: 'risk',
  },
  dca_averaging: {
    id: 'dca_averaging',
    label: 'DCA / Nhồi lệnh âm',
    type: 'bad',
    category: 'risk',
  },
  early_exit: {
    id: 'early_exit',
    label: 'Chốt non (thoát lệnh quá sớm)',
    type: 'bad',
    category: 'execution',
  },
  panic_cut: {
    id: 'panic_cut',
    label: 'Cắt lỗ hoảng loạn (< 5 phút)',
    type: 'bad',
    category: 'psychology',
  },
  overnight_loss: {
    id: 'overnight_loss',
    label: 'Gồng lỗ qua đêm (>24h)',
    type: 'bad',
    category: 'risk',
  },
  fomo_entry: {
    id: 'fomo_entry',
    label: 'FOMO / Vào lệnh cảm xúc',
    type: 'bad',
    category: 'psychology',
  },
  move_sl: {
    id: 'move_sl',
    label: 'Dời Stop Loss (mất kỷ luật SL)',
    type: 'bad',
    category: 'discipline',
  },
  counter_trend: {
    id: 'counter_trend',
    label: 'Đánh ngược xu hướng',
    type: 'bad',
    category: 'execution',
  },
  no_confirmation: {
    id: 'no_confirmation',
    label: 'Vào lệnh không có xác nhận',
    type: 'bad',
    category: 'execution',
  },
  late_trade: {
    id: 'late_trade',
    label: 'Trade muộn (sau 22:00)',
    type: 'bad',
    category: 'discipline',
  },
  // GOOD HABITS
  strict_sl: {
    id: 'strict_sl',
    label: 'Kỷ luật đặt Stop Loss',
    type: 'good',
    category: 'risk',
  },
  patient_hold: {
    id: 'patient_hold',
    label: 'Gồng lời kiên nhẫn (1-24h)',
    type: 'good',
    category: 'execution',
  },
  quick_win: {
    id: 'quick_win',
    label: 'Chốt lời dứt khoát',
    type: 'good',
    category: 'execution',
  },
  plan_entry: {
    id: 'plan_entry',
    label: 'Vào lệnh có kế hoạch (có TP)',
    type: 'good',
    category: 'discipline',
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hasTag(notes, tag) {
  return (notes || '').toLowerCase().includes(tag.toLowerCase());
}

function recencyWeight(lastSeenDate) {
  if (!lastSeenDate) return 0.5;
  const daysDiff = (Date.now() - new Date(lastSeenDate).getTime()) / 86400000;
  if (daysDiff <= 14) return 1.5;
  if (daysDiff <= 30) return 1.0;
  return 0.7;
}

function computeTrend(occurrences) {
  // occurrences is an array of dates (sorted ASC). Compare first half vs second half.
  if (occurrences.length < 4) return 'Stable';
  const mid = Math.floor(occurrences.length / 2);
  const firstHalf = occurrences.slice(0, mid).length;
  const secondHalf = occurrences.slice(mid).length;
  if (secondHalf > firstHalf * 1.3) return 'Increasing';
  if (secondHalf < firstHalf * 0.7) return 'Decreasing';
  return 'Stable';
}

// ─── Main Detector ─────────────────────────────────────────────────────────────

/**
 * detectHabits(trades)
 * @param {Array} trades - raw trades from DB
 * @returns {Array} habits — sorted by impactScore DESC
 */
export function detectHabits(trades) {
  if (!trades || trades.length === 0) return [];

  const avgLoss = (() => {
    const ls = trades.filter(t => t.status === 'LOSS').map(t => Math.abs(parseFloat(t.pnl) || 0));
    return ls.length > 0 ? ls.reduce((a, b) => a + b, 0) / ls.length : 0;
  })();

  // Accumulator: { habitId: { tradeIds, dates, pnls } }
  const acc = {};

  function addOccurrence(habitId, tradeId, date, pnl) {
    if (!acc[habitId]) acc[habitId] = { tradeIds: [], dates: [], pnls: [] };
    acc[habitId].tradeIds.push(tradeId);
    acc[habitId].dates.push(date);
    acc[habitId].pnls.push(parseFloat(pnl) || 0);
  }

  // ── Per-trade detection ────────────────────────────────────────────────────
  const sortedTrades = [...trades].sort((a, b) =>
    new Date(a.trade_time || 0) - new Date(b.trade_time || 0)
  );

  sortedTrades.forEach((t, idx) => {
    const notes = (t.user_notes || '').toLowerCase();
    const pnl = parseFloat(t.pnl) || 0;
    const day = toLocalDay(t.trade_time) || '';
    const hour = toLocalHour(t.trade_time);
    const holdMins = holdMinutes(t);

    // BAD: No Stop Loss
    if (!t.stop_loss || parseFloat(t.stop_loss) <= 0) {
      addOccurrence('no_stop_loss', t.id, day, pnl);
    }

    // BAD: DCA / Averaging
    if (hasTag(notes, 'dca') || hasTag(notes, '#mistake_dca') || hasTag(notes, 'giao dịch dca') || hasTag(notes, 'nhồi')) {
      addOccurrence('dca_averaging', t.id, day, pnl);
    }

    // BAD: FOMO
    if (hasTag(notes, 'fomo') || hasTag(notes, '#mistake_fomo') || hasTag(notes, 'sợ lỡ') || hasTag(notes, 'đuổi')) {
      addOccurrence('fomo_entry', t.id, day, pnl);
    }

    // BAD: Move SL
    if (hasTag(notes, '#mistake_movesl') || hasTag(notes, 'dời sl') || hasTag(notes, 'move sl')) {
      addOccurrence('move_sl', t.id, day, pnl);
    }

    // BAD: Counter Trend
    if (hasTag(notes, '#mistake_countertrend') || hasTag(notes, 'ngược xu hướng') || hasTag(notes, 'counter')) {
      addOccurrence('counter_trend', t.id, day, pnl);
    }

    // BAD: No Confirmation
    if (hasTag(notes, '#mistake_noconfirmation') || hasTag(notes, 'chưa xác nhận') || hasTag(notes, 'no confirm')) {
      addOccurrence('no_confirmation', t.id, day, pnl);
    }

    // BAD: Early Exit / Chốt non
    if (hasTag(notes, '#mistake_earlyexit') || hasTag(notes, 'chốt non') || hasTag(notes, 'thoát sớm')) {
      addOccurrence('early_exit', t.id, day, pnl);
    } else if (t.status === 'WIN' && holdMins !== null && holdMins < 2 && holdMins > 0) {
      // Heuristic: won in <2 minutes — likely chốt non
      addOccurrence('early_exit', t.id, day, pnl);
    }

    // BAD: Panic cut (LOSS in <5 min)
    if (t.status === 'LOSS' && holdMins !== null && holdMins > 0 && holdMins < 5) {
      addOccurrence('panic_cut', t.id, day, pnl);
    }

    // BAD: Overnight Loss (held >24h while losing)
    if (t.status === 'LOSS' && holdMins !== null && holdMins > 24 * 60) {
      addOccurrence('overnight_loss', t.id, day, pnl);
    }

    // BAD: Late trade (after 22:00 Vietnam time)
    if (hour !== null && (hour >= 22 || hour < 3)) {
      addOccurrence('late_trade', t.id, day, pnl);
    }

    // BAD: Revenge trade — LOSS followed by another trade within 30 min
    if (idx > 0 && t.status === 'LOSS') {
      // Check next trade
      const next = sortedTrades[idx + 1];
      if (next) {
        const tEnd = t.exit_time ? new Date(t.exit_time.replace(' ', 'T') + 'Z') : null;
        const nStart = next.trade_time ? new Date(next.trade_time.replace(' ', 'T') + 'Z') : null;
        if (tEnd && nStart && !isNaN(tEnd) && !isNaN(nStart)) {
          const gapMins = (nStart - tEnd) / 60000;
          if (gapMins >= 0 && gapMins <= 30) {
            addOccurrence('revenge_trade', next.id, toLocalDay(next.trade_time) || '', parseFloat(next.pnl) || 0);
          }
        }
      }
    }

    // GOOD: Strict SL
    if (t.stop_loss && parseFloat(t.stop_loss) > 0) {
      addOccurrence('strict_sl', t.id, day, pnl);
    }

    // GOOD: Patient hold (WIN, held 1h-24h)
    if (t.status === 'WIN' && holdMins !== null && holdMins >= 60 && holdMins <= 24 * 60) {
      addOccurrence('patient_hold', t.id, day, pnl);
    }

    // GOOD: Quick decisive win (WIN, held 5-60 min)
    if (t.status === 'WIN' && holdMins !== null && holdMins >= 5 && holdMins < 60) {
      addOccurrence('quick_win', t.id, day, pnl);
    }

    // GOOD: Plan entry (has TP)
    if (t.take_profit && parseFloat(t.take_profit) > 0) {
      addOccurrence('plan_entry', t.id, day, pnl);
    }
  });

  // ── Per-day detection (Overtrade) ─────────────────────────────────────────
  const dayGroups = groupByDay(trades);
  Object.entries(dayGroups).forEach(([day, dayTrades]) => {
    if (dayTrades.length > 3) {
      // Overtrade day: add an occurrence for each excess trade
      const sorted = [...dayTrades].sort((a, b) => new Date(a.trade_time) - new Date(b.trade_time));
      for (let i = 3; i < sorted.length; i++) {
        addOccurrence('overtrade', sorted[i].id, day, parseFloat(sorted[i].pnl) || 0);
      }
      // Also record the day-level occurrence (count as 1 overtrade day)
      // Add 1 occurrence per overtrade day for frequency counting
      addOccurrence('overtrade', `day_${day}`, day, 0);
    }
  });

  // ── Build result ──────────────────────────────────────────────────────────
  const results = [];

  Object.entries(acc).forEach(([habitId, data]) => {
    const def = HABIT_DEFS[habitId];
    if (!def) return;

    const { tradeIds, dates, pnls } = data;
    const frequency = tradeIds.length;
    const sortedDates = [...dates].filter(Boolean).sort();
    const lastSeen = sortedDates[sortedDates.length - 1] || null;

    const lossPnls = pnls.filter(p => p < 0);
    const gainPnls = pnls.filter(p => p > 0);
    const avgLossPnl = lossPnls.length > 0 ? lossPnls.reduce((a, b) => a + b, 0) / lossPnls.length : 0;
    const avgGainPnl = gainPnls.length > 0 ? gainPnls.reduce((a, b) => a + b, 0) / gainPnls.length : 0;
    const totalImpactPnl = pnls.reduce((a, b) => a + b, 0);

    const trend = computeTrend(sortedDates);
    const rw = recencyWeight(lastSeen);

    // Impact Score = frequency * |avgLoss| * 10 * confidence * recencyWeight
    // For good habits, impact is positive (frequency * avgGain * 10 * rw)
    let impactScore = 0;
    let confidence = Math.min(1.0, Math.log10(frequency + 1) / 2); // 0→1 based on frequency

    if (def.type === 'bad') {
      const perOccurrenceLoss = Math.abs(avgLossPnl) > 0 ? Math.abs(avgLossPnl) : Math.abs(totalImpactPnl) / Math.max(frequency, 1);
      impactScore = Math.round(frequency * perOccurrenceLoss * confidence * rw);
    } else {
      impactScore = Math.round(frequency * Math.abs(avgGainPnl) * confidence * rw);
    }

    results.push({
      habitId,
      label: def.label,
      type: def.type,
      category: def.category,
      frequency,
      lastSeen,
      avgLoss: Math.round(avgLossPnl * 100) / 100,
      avgGain: Math.round(avgGainPnl * 100) / 100,
      totalImpactPnl: Math.round(totalImpactPnl * 100) / 100,
      trend,
      confidence: Math.round(confidence * 100) / 100,
      impactScore,
      tradeIds: tradeIds.filter(id => typeof id === 'number'),
    });
  });

  // Sort: bad habits by impactScore DESC, good habits by frequency DESC
  const bad = results.filter(h => h.type === 'bad').sort((a, b) => b.impactScore - a.impactScore);
  const good = results.filter(h => h.type === 'good').sort((a, b) => b.frequency - a.frequency);

  return { bad, good };
}
