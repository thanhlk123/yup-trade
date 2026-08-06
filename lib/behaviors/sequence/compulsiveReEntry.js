import { getMonthKey, computeTrend, minutesBetween } from '../helpers';

export default {
  id: 'compulsive_re_entry',
  nameKey: 'bhCompulsiveReEntry',
  category: 'sequence',
  level: 1,
  severity: 8.0,
  falsePositiveNote: 'Khác Revenge (cay cú đánh to/ngược), đây là hành vi cố chấp mù quáng vào lại cùng 1 lệnh y chang (cùng chiều, cùng giá) vừa bị SL.',

  detect(trades, config) {
    const evidence = [];
    let confidence = 0.85;

    const sorted = [...trades].sort((a,b) => new Date(a.trade_time) - new Date(b.trade_time));
    const reEntries = [];

    for (let i = 0; i < sorted.length - 1; i++) {
      const t1 = sorted[i];
      if (t1.status !== 'LOSS') continue;

      const t2 = sorted[i+1];
      if (t2.status !== 'LOSS') continue;

      const mins = minutesBetween(t1.exit_time, t2.trade_time);
      if (mins !== null && mins < 15 && t1.asset === t2.asset && t1.side === t2.side) {
        const p1 = parseFloat(t1.entry_price);
        const p2 = parseFloat(t2.entry_price);
        if (p1 && p2 && Math.abs(p1 - p2) / p1 < 0.005) {
          reEntries.push({ t1, t2 });
        }
      }
    }

    if (reEntries.length === 0) return null;

    let totalDamage = 0;
    const affectedIds = new Set();
    reEntries.forEach(({t2}) => {
      totalDamage += parseFloat(t2.pnl||0);
      affectedIds.add(t2.id);
    });

    const monthly = {};
    reEntries.forEach(({t2}) => { const m = getMonthKey(t2); if (m) monthly[m] = (monthly[m]||0)+1; });

    return {
      occurrences: reEntries.length,
      affectedTradeIds: Array.from(affectedIds),
      impact: {
        totalDamage: totalDamage,
        avgDamage: totalDamage / reEntries.length,
        worstSingle: Math.min(...reEntries.map(r => parseFloat(r.t2.pnl||0))),
        winrate: 0,
        profitFactor: 0,
        note: `Hành vi: Bị cắn Stop Loss xong ngay lập tức mua/bán lại y chang lệnh đó. Thiệt hại dâng hiến vô ích do thiếu kiên nhẫn.`,
      },
      confidence,
      evidence,
      
      coverage: { validated: 0, total: reEntries.length },
      trend: computeTrend(monthly),
      relatedBehaviors: ['revenge_trading'],
      status: totalDamage < -200 ? 'high' : 'medium',
      evidenceQuality: 'high',
    };
  }
};
