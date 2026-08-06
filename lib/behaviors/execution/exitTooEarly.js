import { noteContains, getMonthKey, computeTrend } from '../helpers';

export default {
  id: 'exit_too_early',
  nameKey: 'bhExitEarly',
  category: 'execution',
  level: 1,
  severity: 7.0,
  falsePositiveNote: 'Tránh bắt nhầm Scalper: Nếu RR trung bình của các lệnh cắt non >= 2.0R, loại trừ.',

  detect(trades, config) {
    const affected = [];
    const evidence = [];

    trades.forEach(t => {
      if (t.status !== 'WIN') return;
      const tp = parseFloat(t.take_profit);
      const entry = parseFloat(t.entry_price);
      const exit = parseFloat(t.exit_price);
      const sl = parseFloat(t.stop_loss);

      if (!tp || !entry || !exit || tp === entry) return;
      if (noteContains(t, ['tin tức', 'trailing', 'đảo chiều', 'cản'])) return;

      const fullDist = Math.abs(tp - entry);
      const actDist = Math.abs(exit - entry);
      
      // Chốt non khi giá mới đi được < 70% quãng đường đến TP
      if (fullDist > 0 && actDist / fullDist < 0.7) {
        // Tính RR của lệnh này
        let rr = 0;
        if (sl && entry !== sl) {
           rr = actDist / Math.abs(entry - sl);
        }
        affected.push({ trade: t, rr });
      }
    });

    if (affected.length === 0) return null;

    const avgRR = affected.reduce((s, a) => s + a.rr, 0) / affected.length;
    
    // False Positive Validation: Scalper
    if (avgRR >= config.falsePositives.SCALPER_MIN_RR_PROFIT) {
      // Dù chốt non so với TP, nhưng tỷ lệ RR thực tế rất tốt (> 2R), đây là chủ đích Scalp, không phải lỗi tâm lý sợ hãi.
      return null;
    }

    // Confidence Model
    let confidence = 0.82;
    const noteConfirmed = affected.filter(a => {
      const hasNote = noteContains(a.trade, ['chốt non', 'sợ', 'sớm', 'non', 'chưa tới tp']);
      if (hasNote) evidence.push(`Trade #${a.trade.id} - Note xác nhận chốt non do sợ hãi`);
      return hasNote;
    }).length;

    if (noteConfirmed > 0) confidence = 0.95;
    
    if (evidence.length === 0) {
       evidence.push(`Phát hiện ${affected.length} lệnh chốt lời bằng tay khi giá chưa đạt 70% mục tiêu (Average RR: ${avgRR.toFixed(2)}).`);
    }

    const totalOpportunityCost = affected.reduce((s, a) => {
      const tp = parseFloat(a.trade.take_profit);
      const exit = parseFloat(a.trade.exit_price);
      const size = parseFloat(a.trade.size || 1);
      return s + Math.abs(tp - exit) * size;
    }, 0);

    const monthly = {};
    affected.forEach(a => { const m = getMonthKey(a.trade); if (m) monthly[m] = (monthly[m] || 0) + 1; });

    return {
      occurrences: affected.length,
      affectedTradeIds: affected.map(a => a.trade.id),
      impact: {
        totalDamage: -totalOpportunityCost,
        avgDamage: -totalOpportunityCost / affected.length,
        worstSingle: 0,
        winrate: 1, 
        profitFactor: 0,
        isOpportunityCost: true,
        note: `Đánh rơi khoảng $${totalOpportunityCost.toFixed(1)} do chốt lời quá sớm so với kế hoạch ban đầu.`
      },
      confidence,
      evidence,
      coverage: { validated: noteConfirmed, total: affected.length },
      trend: computeTrend(monthly),
      relatedBehaviors: ['no_tp'],
      status: totalOpportunityCost > 100 ? 'high' : 'medium',
      evidenceQuality: noteConfirmed > 0 ? 'high' : 'medium',
    };
  }
};
