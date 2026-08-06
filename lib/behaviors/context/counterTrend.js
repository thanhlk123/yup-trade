import { noteContains, getMonthKey, computeTrend } from '../helpers';

export default {
  id: 'counter_trend',
  nameKey: 'bhCounterTrend',
  category: 'context',
  level: 1,
  severity: 7.5,
  falsePositiveNote: 'Giao dịch ngược xu hướng (bắt đáy/cản tàu) dẫn đến thua lỗ. Không phải hành động sai (ai cũng có quyền trade ngược trend), nhưng bối cảnh này gây lỗ.',

  detect(trades, config) {
    const evidence = [];
    let confidence = 0.85;

    const affected = trades.filter(t => {
      if (t.status !== 'LOSS') return false;
      return noteContains(t, ['bắt đáy', 'cản', 'ngược xu hướng', 'đảo chiều', 'cản tàu', 'counter trend', 'dao rơi', 'bắt đỉnh']);
    });

    if (affected.length === 0) return null;

    const totalDamage = Math.abs(affected.reduce((s,t) => s + parseFloat(t.pnl||0), 0));
    const monthly = {};
    affected.forEach(t => { const m = getMonthKey(t); if (m) monthly[m] = (monthly[m]||0)+1; });

    return {
      occurrences: affected.length,
      affectedTradeIds: affected.map(t => t.id),
      impact: {
        totalDamage: -totalDamage,
        avgDamage: -totalDamage / affected.length,
        worstSingle: Math.min(...affected.map(t => parseFloat(t.pnl||0))),
        winrate: 0,
        profitFactor: 0,
        note: `Hoàn cảnh (Context): Các giao dịch có tính chất chặn đầu xu hướng. Mức thiệt hại gộp.`,
      },
      confidence,
      evidence,
      
      coverage: { validated: affected.length, total: affected.length },
      trend: computeTrend(monthly),
      relatedBehaviors: [],
      status: totalDamage > 200 ? 'high' : 'medium',
      evidenceQuality: 'high',
    };
  }
};
