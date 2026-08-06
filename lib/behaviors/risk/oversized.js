import { getMonthKey, computeTrend, median } from '../helpers';

export default {
  id: 'oversized',
  nameKey: 'bhOversized',
  category: 'risk',
  level: 2,
  severity: 7.0,

  detect(trades, config) {
    const evidence = [];
    let confidence = 0.85;

    const sizes = trades.map(t => parseFloat(t.size||0)).filter(s => s > 0);
    if (sizes.length < 5) return null;
    const med = median(sizes);
    if (med === 0) return null;

    const threshold = config.thresholds.OVERSIZED_MEDIAN_MULTIPLIER || 3.0;

    const affected = trades.filter(t => parseFloat(t.size||0) > med * threshold);
    if (affected.length < 2) return null;

    affected.forEach(t => {
      evidence.push(`Trade #${t.id} size ${t.size} (gấp ${(parseFloat(t.size)/med).toFixed(1)} lần trung bình)`);
    });

    const lossTrades = affected.filter(t => t.status === 'LOSS');
    const winTrades  = affected.filter(t => t.status === 'WIN');
    const overWinrate  = affected.length > 0 ? winTrades.length / affected.length : 0;
    const globalWinrate = trades.filter(t => t.status === 'WIN').length / trades.length;

    if (overWinrate >= globalWinrate) return null;

    const totalDamage = lossTrades.reduce((s,t) => s + parseFloat(t.pnl||0), 0);
    const sumWins = winTrades.reduce((s,t) => s + parseFloat(t.pnl||0), 0);
    const sumLoss = Math.abs(totalDamage);
    const monthly = {};
    affected.forEach(t => { const m = getMonthKey(t); if (m) monthly[m] = (monthly[m]||0)+1; });

    return {
      occurrences: affected.length,
      affectedTradeIds: affected.map(t => t.id),
      impact: {
        totalDamage,
        avgDamage: affected.length > 0 ? totalDamage / affected.length : 0,
        worstSingle: lossTrades.length > 0 ? Math.min(...lossTrades.map(t => parseFloat(t.pnl||0))) : 0,
        winrate: overWinrate,
        profitFactor: sumLoss > 0 ? sumWins / sumLoss : 0,
      },
      confidence,
      evidence,
      
      coverage: { validated: 0, total: affected.length },
      trend: computeTrend(monthly),
      relatedBehaviors: ['dca','revenge_trading'],
      status: affected.length >= 5 ? 'high' : 'medium',
      evidenceQuality: 'high',
      falsePositiveNote: `Threshold: > 3× median lot (${med.toFixed(2)}). Suppress nếu winrate oversized ≥ global.`,
    };
  }
};
