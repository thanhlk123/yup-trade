import { getMonthKey, computeTrend, minutesBetween, noteContains } from '../helpers';

export default {
  id: 'high_impact_news',
  nameKey: 'bhHighImpactNews',
  category: 'context',
  level: 2,
  severity: 8.5,
  falsePositiveNote: 'Chỉ bắt hành vi cố tình giao dịch trong lúc có bão tin tức (High Impact News). (Context)',

  detect(trades, config) {
    const evidence = [];
    let confidence = 0.85;

    const lossTrades = trades.filter(t => t.status === 'LOSS');
    const avgLoss = Math.abs(lossTrades.reduce((s,t) => s + parseFloat(t.pnl||0), 0)) / (lossTrades.length || 1);

    const newsTrades = lossTrades.filter(t => {
      const mins = minutesBetween(t.trade_time, t.exit_time);
      const isFast = mins !== null && mins < (config.timeWindows.NEWS_SLIPPAGE_MINS || 5);
      const isHugeLoss = Math.abs(parseFloat(t.pnl||0)) > avgLoss * 1.5;
      
      // Behavior: Trading during news. Consequence: Slippage.
      const hasNote = noteContains(t, ['tin tức', 'news', 'cpi', 'nfp', 'fomc', 'quét hai đầu', 'trượt giá', 'slippage']);

      if ((isFast && isHugeLoss) || hasNote) {
        if (hasNote) evidence.push(`Trade #${t.id} - Bị quét tin tức (Note xác nhận)`);
        else evidence.push(`Trade #${t.id} - Lỗ cực mạnh trong ${Math.round(mins)} phút (Bất thường)`);
        return true;
      }
      return false;
    });

    if (newsTrades.length < 2) return null;

    const totalDamage = newsTrades.reduce((s,t) => s + parseFloat(t.pnl||0), 0);
    const monthly = {};
    newsTrades.forEach(t => { const m = getMonthKey(t); if (m) monthly[m] = (monthly[m]||0)+1; });

    return {
      occurrences: newsTrades.length,
      affectedTradeIds: newsTrades.map(t => t.id),
      impact: {
        totalDamage: totalDamage,
        avgDamage: totalDamage / newsTrades.length,
        worstSingle: Math.min(...newsTrades.map(t => parseFloat(t.pnl||0))),
        winrate: 0,
        profitFactor: 0,
        note: `Hoàn cảnh (Context): Giao dịch lúc có tin tức mạnh (High Impact News). Hậu quả: Trượt giá (Slippage).`,
      },
      confidence,
      evidence,
      
      coverage: { validated: newsTrades.filter(t => noteContains(t, ['tin tức', 'news', 'cpi', 'nfp', 'fomc'])).length, total: newsTrades.length },
      trend: computeTrend(monthly),
      relatedBehaviors: [],
      status: 'high',
      evidenceQuality: 'high',
    };
  }
};
