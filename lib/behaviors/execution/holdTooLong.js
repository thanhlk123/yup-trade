import { noteContains, getMonthKey, computeTrend, hoursBetween, minutesBetween } from '../helpers';

export default {
  id: 'hold_too_long',
  nameKey: 'bhHoldLoss',
  category: 'execution',
  level: 1,
  severity: 7.5,
  falsePositiveNote: 'Chỉ bắt LOSS giữ > 24h khi: không có SL, hoặc note xác nhận tâm lý không cắt lỗ.',

  detect(trades, config) {
    const evidence = [];
    let confidence = 0.85;

    const affected = trades.filter(t => {
      if (t.status !== 'LOSS') return false;
      const mins = minutesBetween(t.trade_time, t.exit_time);
      if (mins === null) return false;
      
      const thresholdMins = config.timeWindows.HOLD_TOO_LONG_HOURS * 60;
      if (mins > thresholdMins) {
        const hasSl = t.stop_loss && parseFloat(t.stop_loss) > 0;
        if (!hasSl || noteContains(t, ['giữ', 'hold', 'không cắt', 'hope', 'hy vọng', 'bám', 'chờ hồi'])) {
          evidence.push(`Trade #${t.id} - Gồng lỗ trong ${Math.round(mins/60)} giờ`);
          return true;
        }
      }
      return false;
    });
    if (affected.length === 0) return null;

    const totalDamage = affected.reduce((s,t) => s + parseFloat(t.pnl||0), 0);
    const noteValidated = affected.filter(t =>
      noteContains(t, ['giữ', 'hold', 'không cắt', 'hope', 'hy vọng', 'bám', 'chờ hồi'])
    ).length;
    const monthly = {};
    affected.forEach(t => { const m = getMonthKey(t); if (m) monthly[m] = (monthly[m]||0)+1; });

    return {
      occurrences: affected.length,
      affectedTradeIds: affected.map(t => t.id),
      impact: {
        totalDamage,
        avgDamage: affected.length > 0 ? totalDamage / affected.length : 0,
        worstSingle: affected.length > 0 ? Math.min(...affected.map(t => parseFloat(t.pnl||0))) : 0,
        winrate: 0, profitFactor: 0,
      },
      confidence,
      evidence,
      coverage: { validated: noteValidated, total: affected.length },
      trend: computeTrend(monthly),
      relatedBehaviors: ['no_sl', 'dca'],
      status: affected.length >= 3 ? 'critical' : 'high',
      evidenceQuality: noteValidated > 0 ? 'high' : 'medium',
    };
  }
};
