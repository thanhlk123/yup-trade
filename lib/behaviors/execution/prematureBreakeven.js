import { noteContains, getMonthKey, computeTrend, minutesBetween } from '../helpers';

export default {
  id: 'premature_breakeven',
  nameKey: 'bhPrematureBreakeven',
  category: 'execution',
  level: 1,
  severity: 7.5,
  falsePositiveNote: 'Chỉ báo lỗi khi dời SL về Entry và bị cắn ngay tại giá $0. Bao gồm cả lý do tâm lý (sợ hãi) lẫn kỹ thuật (dời sai nhịp).',

  detect(trades, config) {
    const evidence = [];
    let confidence = 0.85;

    const affected = [];
    
    trades.forEach(t => {
      const pnl = parseFloat(t.pnl || 0);
      if (Math.abs(pnl) > 5) return; 

      const tp = parseFloat(t.take_profit);
      const entry = parseFloat(t.entry_price);
      const size = parseFloat(t.size || 1);
      
      if (!tp || !entry || tp === entry) return;

      const hasFearNote = noteContains(t, ['be', 'hòa vốn', 'dời sl', 'breakeven', 'chặn lãi', 'risk free', 'quét be']);
      const mins = minutesBetween(t.trade_time, t.exit_time);
      const isTechnicalError = mins !== null && mins < 60; // Dời BE quá nhanh khi giá chưa thoát nền

      if (!hasFearNote && !isTechnicalError) return;

      const opportunityCost = Math.abs(tp - entry) * size;
      if (opportunityCost < 10) return;

      // Classify subtype
      const subtype = hasFearNote ? 'Fear Driven' : 'Technical Driven';

      affected.push({ trade: t, opportunityCost, subtype });
    });

    if (affected.length === 0) return null;

    const totalDamage = affected.reduce((s, a) => s + a.opportunityCost, 0);
    const monthly = {};
    affected.forEach(({trade}) => { const m = getMonthKey(trade); if (m) monthly[m] = (monthly[m]||0)+1; });

    return {
      occurrences: affected.length,
      affectedTradeIds: affected.map(a => a.trade.id),
      impact: {
        totalDamage: -totalDamage,
        avgDamage: -totalDamage / affected.length,
        worstSingle: 0,
        winrate: 0,
        profitFactor: 0,
        isOpportunityCost: true,
        note: `Chi phí cơ hội bị bỏ lỡ. Gồm: ${affected.filter(a => a.subtype === 'Fear Driven').length} lệnh do tâm lý sợ hãi, ${affected.filter(a => a.subtype === 'Technical Driven').length} lệnh do lỗi kỹ thuật dời quá vội.`,
      },
      confidence,
      evidence,
      
      coverage: { validated: affected.filter(a => a.subtype === 'Fear Driven').length, total: affected.length },
      trend: computeTrend(monthly),
      relatedBehaviors: ['exit_too_early'],
      status: affected.length >= 5 ? 'high' : 'medium',
      evidenceQuality: 'high',
    };
  }
};
