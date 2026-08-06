import { noteContains, getMonthKey, computeTrend } from '../helpers';

export default {
  id: 'no_tp',
  nameKey: 'bhNoTp',
  category: 'execution',
  level: 1,
  severity: 5.5,
  falsePositiveNote: 'Loại trừ trailing/partial/scale out. Suppress nếu Profit Factor > 2.5 (Scalper chuyên nghiệp).',

  detect(trades, config) {
    const affected = [];
    const evidence = [];

    trades.forEach(t => {
      const noTpField = !t.take_profit || parseFloat(t.take_profit) === 0 || t.take_profit === '';
      if (!noTpField) return;
      if (noteContains(t, ['trailing', 'trail', 'partial', 'scale out', 'market exit', 'discretionary', 'tùy nghi'])) return;
      affected.push(t);
    });

    if (affected.length < 3) return null;

    const winTrades  = affected.filter(t => t.status === 'WIN');
    const lossTrades = affected.filter(t => t.status === 'LOSS');
    const sumWins = winTrades.reduce((s,t) => s + parseFloat(t.pnl||0), 0);
    const sumLoss = Math.abs(lossTrades.reduce((s,t) => s + parseFloat(t.pnl||0), 0));
    const pf = sumLoss > 0 ? sumWins / sumLoss : 0;

    // False Positive Validation: Scalper / Momentum Trader
    if (pf > 2.5 && winTrades.length >= 5) return null;

    const totalDamage = lossTrades.reduce((s,t) => s + parseFloat(t.pnl||0), 0);
    const monthly = {};
    affected.forEach(t => { const m = getMonthKey(t); if (m) monthly[m] = (monthly[m]||0)+1; });

    let confidence = 0.78;
    const noteConfirmed = affected.filter(t => {
      const hasNote = noteContains(t, ['quên tp', 'không tp', 'no tp']);
      if (hasNote) evidence.push(`Trade #${t.id} - Note xác nhận không TP`);
      return hasNote;
    }).length;

    if (noteConfirmed > 0) confidence = 0.95;
    if (evidence.length === 0) evidence.push(`Có ${affected.length} lệnh hoàn toàn thả trôi không có Take Profit, Profit Factor hiện tại: ${pf.toFixed(2)}`);

    return {
      occurrences: affected.length,
      affectedTradeIds: affected.map(t => t.id),
      impact: {
        totalDamage,
        avgDamage: affected.length > 0 ? totalDamage / affected.length : 0,
        worstSingle: lossTrades.length > 0 ? Math.min(...lossTrades.map(t => parseFloat(t.pnl||0))) : 0,
        winrate: affected.length > 0 ? winTrades.length / affected.length : 0,
        profitFactor: pf,
        isOpportunityCost: false,
        note: `Tổng số tiền thua lỗ từ các lệnh không có kế hoạch chốt lời rõ ràng.`
      },
      confidence,
      evidence,
      coverage: { validated: noteConfirmed, total: affected.length },
      trend: computeTrend(monthly),
      relatedBehaviors: ['hold_too_long', 'exit_too_early'],
      status: affected.length >= 5 ? 'high' : 'medium',
      evidenceQuality: noteConfirmed > 0 ? 'high' : 'medium',
    };
  }
};
