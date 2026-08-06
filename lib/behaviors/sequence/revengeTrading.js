import { noteContains, getMonthKey, computeTrend, minutesBetween } from '../helpers';

export default {
  id: 'revenge_trading',
  nameKey: 'bhRevenge',
  category: 'sequence',
  level: 3,
  severity: 8.0,
  falsePositiveNote: 'Lệnh thua → lệnh tiếp theo trong 30 phút VÀ tăng size ≥10%. Yêu cầu có exit_time.',

  detect(trades, config) {
    const evidence = [];
    let confidence = 0.85;

    const sorted = [...trades].sort((a,b) => new Date(a.trade_time) - new Date(b.trade_time));
    const pairs = [];
    for (let i = 0; i < sorted.length - 1; i++) {
      const trigger = sorted[i];
      if (trigger.status !== 'LOSS') continue;
      if (!trigger.exit_time) continue;
      const next = sorted[i + 1];
      const mins = minutesBetween(trigger.exit_time, next.trade_time);
      if (mins === null || mins < 0 || mins > 15) continue;
      const origSize = parseFloat(trigger.size || 0), nextSize = parseFloat(next.size || 0);
      if (origSize <= 0 || nextSize <= origSize * 1.1) continue;
      pairs.push({ trigger, revenge: next });
    }
    if (pairs.length === 0) return null;

    // Chỉ đưa lệnh Trả thù (revenge) vào danh sách Lỗi Sai
    const affectedIds = [...new Set(pairs.map(p => p.revenge.id))];
    const outcomes = pairs.map(p => p.revenge);
    const lossTrades = outcomes.filter(t => t.status === 'LOSS');
    const winTrades  = outcomes.filter(t => t.status === 'WIN');
    const totalDamage = lossTrades.reduce((s,t) => s + parseFloat(t.pnl||0), 0);
    const sumWins = winTrades.reduce((s,t) => s + parseFloat(t.pnl||0), 0);
    const sumLoss = Math.abs(totalDamage);
    const noteValidated = pairs.filter(({revenge}) =>
      noteContains(revenge, ['trả thù','revenge','tức','bực','gỡ lại','lấy lại','angry','frustrated','cố','gỡ'])
    ).length;
    const monthly = {};
    pairs.forEach(({trigger}) => { const m = getMonthKey(trigger); if (m) monthly[m] = (monthly[m]||0)+1; });

    return {
      occurrences: pairs.length,
      affectedTradeIds: affectedIds,
      impact: {
        totalDamage,
        avgDamage: pairs.length > 0 ? totalDamage / pairs.length : 0,
        worstSingle: lossTrades.length > 0 ? Math.min(...lossTrades.map(t => parseFloat(t.pnl||0))) : 0,
        winrate: outcomes.length > 0 ? winTrades.length / outcomes.length : 0,
        profitFactor: sumLoss > 0 ? sumWins / sumLoss : 0,
      },
      confidence,
      evidence,
      coverage: { validated: noteValidated, total: pairs.length },
      trend: computeTrend(monthly),
      relatedBehaviors: ['dca','oversized','martingale'],
      status: pairs.length >= 5 ? 'critical' : pairs.length >= 2 ? 'high' : 'medium',
      evidenceQuality: noteValidated > 0 ? 'high' : 'medium',
    };
  }
};
