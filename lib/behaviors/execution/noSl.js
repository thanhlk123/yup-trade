import { noteContains, getMonthKey, computeTrend } from '../helpers';

export default {
  id: 'no_sl',
  nameKey: 'bhNoSl',
  category: 'execution',
  level: 1,
  severity: 8.5,
  falsePositiveNote: 'Có thể dùng Mental Stop — avg loss tương đồng với tổng thể. Loại trừ note "mental stop".',

  detect(trades, config) {
    const affected = [];
    const evidence = [];

    trades.forEach(t => {
      const noSlField = !t.stop_loss || parseFloat(t.stop_loss) === 0 || t.stop_loss === '';
      if (!noSlField) return;
      if (noteContains(t, ['mental stop', 'structure stop', 'ms stop'])) return;
      affected.push(t);
    });

    if (affected.length === 0) return null;

    const lossTrades = affected.filter(t => t.status === 'LOSS');
    const winTrades  = affected.filter(t => t.status === 'WIN');
    const totalDamage = lossTrades.reduce((s, t) => s + parseFloat(t.pnl || 0), 0);
    const sumWins     = winTrades.reduce((s, t) => s + parseFloat(t.pnl || 0), 0);
    const sumLoss     = Math.abs(totalDamage);

    const allLoss = trades.filter(t => t.status === 'LOSS');
    const globalAvgLoss = allLoss.length > 0
      ? Math.abs(allLoss.reduce((s,t) => s + parseFloat(t.pnl || 0), 0)) / allLoss.length : 0;
    const affAvgLoss = lossTrades.length > 0 ? sumLoss / lossTrades.length : 0;
    
    // False Positive Validation: Mental Stop
    const isMentalStop = affAvgLoss > 0 && globalAvgLoss > 0 && affAvgLoss < globalAvgLoss * config.falsePositives.MENTAL_STOP_MAX_RR_LOSS;

    if (isMentalStop) {
      // Reject entirely if it's clearly a mental stop (loss is very strictly controlled)
      return null;
    }

    const noteConfirmed = affected.filter(t => {
      const hasNote = noteContains(t, ['no sl', 'không sl', 'no stop', 'quên sl']);
      if (hasNote) evidence.push(`Trade #${t.id} - Note xác nhận: Không đặt SL`);
      return hasNote;
    }).length;

    // Confidence Model
    let confidence = 0.85; // Base confidence
    if (noteConfirmed > 0) confidence = 0.98; // Boost if explicitly noted
    
    // Push general evidence
    if (evidence.length === 0) {
      evidence.push(`Phát hiện ${affected.length} lệnh giao dịch không có giá trị Stop Loss trên hệ thống.`);
    }

    const monthly = {};
    affected.forEach(t => { const m = getMonthKey(t); if (m) monthly[m] = (monthly[m] || 0) + 1; });

    return {
      occurrences: affected.length,
      affectedTradeIds: affected.map(t => t.id),
      impact: {
        totalDamage,
        avgDamage: lossTrades.length > 0 ? totalDamage / lossTrades.length : 0,
        worstSingle: lossTrades.length > 0 ? Math.min(...lossTrades.map(t => parseFloat(t.pnl || 0))) : 0,
        winrate: affected.length > 0 ? winTrades.length / affected.length : 0,
        profitFactor: sumLoss > 0 ? sumWins / sumLoss : (sumWins > 0 ? 9.9 : 0),
        isOpportunityCost: false,
        note: `Thiệt hại ròng từ ${lossTrades.length} lệnh thả trôi không có điểm dừng lỗ.`
      },
      confidence,
      evidence,
      coverage: { validated: noteConfirmed, total: affected.length },
      trend: computeTrend(monthly),
      relatedBehaviors: ['hold_too_long'],
      status: totalDamage < -100 ? 'critical' : 'high',
      evidenceQuality: noteConfirmed > 0 ? 'high' : 'medium',
    };
  }
};
