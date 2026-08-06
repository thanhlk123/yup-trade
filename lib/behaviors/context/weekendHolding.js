import { getMonthKey, computeTrend } from '../helpers';

export default {
  id: 'weekend_holding',
  nameKey: 'bhWeekendHolding',
  category: 'context',
  level: 1,
  severity: 7.5,
  falsePositiveNote: 'Bắt hành vi giữ lệnh trong ngày (Day Trading) qua thời điểm đóng cửa (qua đêm/qua cuối tuần). (Context)',

  detect(trades, config) {
    const evidence = [];
    let confidence = 0.85;

    const lossTrades = trades.filter(t => t.status === 'LOSS');
    const gapTrades = lossTrades.filter(t => {
      const open = new Date(t.trade_time);
      const close = new Date(t.exit_time);
      if (!open || !close) return false;

      const isOvernight = close.getDate() !== open.getDate() || close.getDay() < open.getDay();
      const pnl = Math.abs(parseFloat(t.pnl||0));
      return isOvernight && pnl > 50; 
    });

    if (gapTrades.length < 3) return null;

    const totalDamage = gapTrades.reduce((s,t) => s + parseFloat(t.pnl||0), 0);
    const monthly = {};
    gapTrades.forEach(t => { const m = getMonthKey(t); if (m) monthly[m] = (monthly[m]||0)+1; });

    return {
      occurrences: gapTrades.length,
      affectedTradeIds: gapTrades.map(t => t.id),
      impact: {
        totalDamage: totalDamage,
        avgDamage: totalDamage / gapTrades.length,
        worstSingle: Math.min(...gapTrades.map(t => parseFloat(t.pnl||0))),
        winrate: 0,
        profitFactor: 0,
        note: `Hoàn cảnh (Context): Kẹt lệnh qua đêm/cuối tuần. Hậu quả: Trượt giá nhảy Gap ngoài tầm kiểm soát.`,
      },
      confidence,
      evidence,
      
      coverage: { validated: 0, total: gapTrades.length },
      trend: computeTrend(monthly),
      relatedBehaviors: ['hold_too_long'],
      status: 'medium',
      evidenceQuality: 'medium',
    };
  }
};
