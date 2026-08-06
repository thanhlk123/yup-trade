import { getMonthKey, computeTrend } from '../helpers';

export default {
  id: 'rr_inversion',
  nameKey: 'bhRrInversion',
  category: 'risk',
  level: 2,
  severity: 8.5,
  falsePositiveNote: 'Chỉ kích hoạt khi Lỗ TB > 1.5 lần Lãi TB VÀ tổng kết vẫn lỗ ròng hoặc hòa vốn. Scalping siêu winrate thì bỏ qua.',

  detect(trades, config) {
    const evidence = [];
    let confidence = 0.85;

    const winTrades = trades.filter(t => t.status === 'WIN');
    const lossTrades = trades.filter(t => t.status === 'LOSS');
    
    if (winTrades.length < 5 || lossTrades.length < 5) return null;

    const sumWins = winTrades.reduce((s,t) => s + parseFloat(t.pnl||0), 0);
    const sumLoss = Math.abs(lossTrades.reduce((s,t) => s + parseFloat(t.pnl||0), 0));
    
    const avgWin = sumWins / winTrades.length;
    const avgLoss = sumLoss / lossTrades.length;

    if (avgLoss <= avgWin * 1.5) return null; // Not inverted enough

    // Exception: If they are highly profitable despite inverse R:R (e.g. 90% WR Scalper)
    const winrate = winTrades.length / trades.length;
    const profitFactor = sumLoss > 0 ? sumWins / sumLoss : 9.9;
    if (profitFactor > 1.5) return null;

    // Structural damage: How much money lost compared to maintaining 1:1 RR?
    // If they maintained 1:1, avgLoss would equal avgWin.
    const idealSumLoss = avgWin * lossTrades.length;
    const structuralDamage = sumLoss - idealSumLoss; // The extra amount lost due to inversion
    
    if (structuralDamage <= 0) return null;

    const monthly = {};
    lossTrades.forEach(t => { const m = getMonthKey(t); if (m) monthly[m] = (monthly[m]||0)+1; });

    return {
      occurrences: lossTrades.length,
      affectedTradeIds: lossTrades.map(t => t.id),
      impact: {
        totalDamage: -structuralDamage,
        avgDamage: -structuralDamage / lossTrades.length,
        worstSingle: Math.min(...lossTrades.map(t => parseFloat(t.pnl||0))),
        winrate: winrate,
        profitFactor: profitFactor,
        note: `Trung bình Lãi: $${avgWin.toFixed(0)} | Trung bình Lỗ: $${avgLoss.toFixed(0)}. Thiệt hại cơ cấu là khoản chênh lệch do tỷ lệ này.`,
      },
      confidence,
      evidence,
      
      coverage: { validated: lossTrades.length, total: lossTrades.length }, // Mathematical
      trend: computeTrend(monthly),
      relatedBehaviors: ['hold_too_long', 'exit_too_early'],
      status: structuralDamage > 500 ? 'critical' : 'high',
      evidenceQuality: 'high', // Hard math
    };
  }
};
