import { BehaviorBase } from '../BehaviorBase';
import { hoursBetween } from '../helpers';
import { buildEvidence } from '../evidenceBuilder';

class QuickLossCuttingBehavior extends BehaviorBase {
  constructor() {
    super();
    this.id = 'quick_loss_cutting';
    this.nameKey = 'bhQuickLossCutting';
    this.category = 'good';
    this.severity = 5;
    this.relatedBehaviors = [];
  }

  detect(trades, config) {
    const wins = [];
    const losses = [];
    
    trades.forEach(t => {
      const h = hoursBetween(t.trade_time, t.exit_time);
      if (h === null || h <= 0) return;
      if (t.status === 'WIN') wins.push(h);
      else if (t.status === 'LOSS') losses.push(h);
    });

    if (wins.length < 5 || losses.length < 5) return [];

    const avgWinDuration = wins.reduce((a,b) => a+b, 0) / wins.length;
    const avgLossDuration = losses.reduce((a,b) => a+b, 0) / losses.length;

    if (avgLossDuration >= avgWinDuration * 0.5) return [];

    return trades.filter(t => t.status === 'LOSS').map(t => ({
      trade: t,
      context: { avgLossDuration, avgWinDuration }
    }));
  }
  
  calculateImpact(affectedTrades, allTrades) {
    const impact = super.calculateImpact(affectedTrades, allTrades);
    if (!impact) return null;
    
    if (affectedTrades.length > 0) {
      const ctx = affectedTrades[0].context;
      const actualLoss = Math.abs(affectedTrades.reduce((s, a) => s + parseFloat(a.trade.pnl || 0), 0));
      
      let saved = 0;
      if (ctx.avgLossDuration > 0) {
        const projectedLoss = actualLoss * (ctx.avgWinDuration / ctx.avgLossDuration);
        saved = Math.round(projectedLoss - actualLoss);
      }
      saved = Math.min(saved, actualLoss * 2);
      
      impact.note = `Bạn cắt lỗ nhanh gấp ${Math.round(ctx.avgWinDuration/ctx.avgLossDuration)} lần so với gồng lời. Ước tính số tiền cứu được: ~$${saved}.`;
    }
    return impact;
  }

  buildEvidence(affectedTrades) {
    const ev = buildEvidence();
    if (affectedTrades.length > 0) {
      ev.addObserved(`Kỷ luật cắt lỗ tuyệt vời! Thống kê cho thấy thời gian bạn giữ các lệnh lỗ (chấp nhận sai) ngắn hơn rất nhiều so với thời gian gồng lời.`);
    }
    return ev;
  }
}

export default new QuickLossCuttingBehavior();
