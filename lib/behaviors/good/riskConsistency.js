import { BehaviorBase } from '../BehaviorBase';
import { stddev } from '../helpers';
import { buildEvidence } from '../evidenceBuilder';

class RiskConsistencyBehavior extends BehaviorBase {
  constructor() {
    super();
    this.id = 'risk_consistency';
    this.nameKey = 'bhRiskConsistency';
    this.category = 'good';
    this.severity = 5;
    this.relatedBehaviors = [];
  }

  detect(trades, config) {
    const sizes = trades.map(t => parseFloat(t.size||0)).filter(s => s > 0);
    if (sizes.length < 10) return [];
    
    const mean = sizes.reduce((a,b) => a+b, 0) / sizes.length;
    const cv = stddev(sizes) / mean;
    const consistency = Math.round(Math.max(0, (1 - Math.min(cv, 1))) * 100);
    
    if (consistency < 70) return [];
    
    return trades.map(t => ({
      trade: t,
      context: { consistency, mean }
    }));
  }
  
  calculateImpact(affectedTrades, allTrades) {
    const impact = super.calculateImpact(affectedTrades, allTrades);
    if (!impact) return null;
    if (affectedTrades.length > 0) {
      const ctx = affectedTrades[0].context;
      impact.note = `Tính nhất quán đạt mức (Consistency Score: ${ctx.consistency}%). Trung bình bạn đi ${Math.round(ctx.mean*100)/100} lot mỗi lệnh. Quản lý vốn rất tốt!`;
    }
    return impact;
  }

  buildEvidence(affectedTrades) {
    const ev = buildEvidence();
    if (affectedTrades.length > 0) {
      ev.addObserved(`Khối lượng giao dịch (Size) của bạn trên toàn bộ lệnh rất đồng đều (hệ số phân tán cực kỳ thấp).`);
    }
    return ev;
  }
}

export default new RiskConsistencyBehavior();
