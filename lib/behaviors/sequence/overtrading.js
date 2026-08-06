import { getDateStr, getMonthKey, computeTrend } from '../helpers';

export default {
  id: 'overtrading',
  nameKey: 'bhOvertrading',
  category: 'sequence',
  level: 3,
  severity: 6.5,
  falsePositiveNote: 'Threshold: > 8 lệnh/ngày VÀ ngày đó lỗ ròng. Ngày giao dịch nhiều nhưng lời thì KHÔNG bị bắt.',

  detect(trades, config) {
    const evidence = [];
    let confidence = 0.85;

    const dayGroups = {};
    trades.forEach(t => {
      const d = getDateStr(t.trade_time); if (!d) return;
      if (!dayGroups[d]) dayGroups[d] = [];
      dayGroups[d].push(t);
    });
    const overtradeDays = Object.entries(dayGroups).filter(([, g]) => {
      if (g.length <= (config.thresholds.OVERTRADING_DAILY_TRADES || 8)) return false;
      const dayPnl = g.reduce((s, t) => s + parseFloat(t.pnl || 0), 0);
      return dayPnl < 0;
    });
    if (overtradeDays.length === 0) return null;

    const allTrades  = overtradeDays.flatMap(([,g]) => g);
    const affectedIds = [...new Set(allTrades.map(t => t.id))];
    const lossTrades = allTrades.filter(t => t.status === 'LOSS');
    const winTrades  = allTrades.filter(t => t.status === 'WIN');
    const totalDamage = lossTrades.reduce((s,t) => s + parseFloat(t.pnl||0), 0);
    const sumWins = winTrades.reduce((s,t) => s + parseFloat(t.pnl||0), 0);
    const sumLoss = Math.abs(totalDamage);
    const monthly = {};
    overtradeDays.forEach(([date]) => { const m = date.slice(0,7); monthly[m] = (monthly[m]||0)+1; });

    return {
      occurrences: overtradeDays.length,
      affectedTradeIds: affectedIds,
      impact: {
        totalDamage,
        avgDamage: overtradeDays.length > 0 ? totalDamage / overtradeDays.length : 0,
        worstSingle: lossTrades.length > 0 ? Math.min(...lossTrades.map(t => parseFloat(t.pnl||0))) : 0,
        winrate: allTrades.length > 0 ? winTrades.length / allTrades.length : 0,
        profitFactor: sumLoss > 0 ? sumWins / sumLoss : 0,
        avgTradesPerDay: Math.round((allTrades.length / overtradeDays.length) * 10) / 10,
        note: `Ước tính phí giao dịch (Commission/Spread) đã đốt thêm khoảng $${(allTrades.length * 1.5).toFixed(1)} trong các ngày này (Consequence: Fee Bleed).`
      },
      confidence,
      evidence,
      
      coverage: { validated: 0, total: affectedIds.length },
      trend: computeTrend(monthly),
      relatedBehaviors: ['revenge_trading','dca'],
      status: overtradeDays.length >= 5 ? 'high' : 'medium',
      evidenceQuality: 'high',
    };
  }
};
