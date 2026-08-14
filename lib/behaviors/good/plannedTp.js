import { BehaviorBase } from '../BehaviorBase';
import { buildEvidence } from '../evidenceBuilder';

class PlannedTpBehavior extends BehaviorBase {
  constructor() {
    super();
    this.id = 'planned_tp';
    this.nameKey = 'bhPlannedTp';
    this.category = 'good';
    this.severity = 5;
    this.relatedBehaviors = [];
  }

  detect(trades, config) {
    const hasTP = trades.filter(t => t.take_profit && parseFloat(t.take_profit) > 0);
    if (hasTP.length < 5) return [];

    const rrValues = hasTP.filter(t => t.stop_loss && parseFloat(t.stop_loss) > 0).map(t => {
      const entry = parseFloat(t.entry_price), tp = parseFloat(t.take_profit), sl = parseFloat(t.stop_loss);
      const side = (t.side||'').toUpperCase();
      if (side === 'BUY' || side === 'LONG') {
        const risk = Math.abs(entry - sl), reward = Math.abs(tp - entry);
        return risk > 0 ? reward / risk : null;
      } else {
        const risk = Math.abs(sl - entry), reward = Math.abs(entry - tp);
        return risk > 0 ? reward / risk : null;
      }
    }).filter(v => v !== null && v > 0 && v < 20);
    
    const avgRr = rrValues.length > 0
      ? Math.round((rrValues.reduce((a,b) => a+b, 0) / rrValues.length) * 10) / 10 : 0;

    return hasTP.map(t => ({
      trade: t,
      context: { avgRr }
    }));
  }
  
  calculateImpact(affectedTrades, allTrades) {
    const impact = super.calculateImpact(affectedTrades, allTrades);
    if (!impact) return null;
    if (affectedTrades.length > 0) {
      const ctx = affectedTrades[0].context;
      impact.note = `Tuân thủ việc lên kế hoạch chốt lời giúp bạn duy trì tỷ lệ R:R trung bình dự kiến rất tích cực là ${ctx.avgRr}:1.`;
    }
    return impact;
  }

  buildEvidence(affectedTrades) {
    const ev = buildEvidence();
    if (affectedTrades.length > 0) {
      ev.addObserved(`Có ${affectedTrades.length} lệnh được thiết lập chốt lời (Take Profit) rõ ràng từ ban đầu.`);
    }
    return ev;
  }
}

export default new PlannedTpBehavior();
