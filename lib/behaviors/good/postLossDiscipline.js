import { BehaviorBase } from '../BehaviorBase';
import { hoursBetween } from '../helpers';
import { buildEvidence } from '../evidenceBuilder';

class PostLossDisciplineBehavior extends BehaviorBase {
  constructor() {
    super();
    this.id = 'post_loss_discipline';
    this.nameKey = 'bhPostLossDiscipline';
    this.category = 'good';
    this.severity = 5;
    this.relatedBehaviors = [];
  }

  detect(trades, config) {
    const affected = [];
    const sorted = [...trades].sort((a,b) => new Date(a.trade_time) - new Date(b.trade_time));
    let validLossEvents = 0;
    
    for (let i = 0; i < sorted.length - 1; i++) {
      if (sorted[i].status !== 'LOSS') continue;
      
      const trigger = sorted[i];
      if (!trigger.exit_time) continue;
      
      const next = sorted[i+1];
      const h = hoursBetween(trigger.exit_time, next.trade_time);
      
      validLossEvents++;

      const waited = h !== null && h >= 2;
      const reducedSize = parseFloat(next.size||0) <= parseFloat(trigger.size||0) * 0.8;

      if (waited || reducedSize) {
        affected.push(next);
      }
    }

    if (affected.length < 3) return [];
    
    const consistency = Math.round((affected.length / validLossEvents) * 100);
    if (consistency < 60) return [];

    return affected;
  }
  
  calculateImpact(affectedTrades, allTrades) {
    const impact = super.calculateImpact(affectedTrades, allTrades);
    if (!impact) return null;
    impact.note = `Kỷ luật tuyệt vời sau thua lỗ. Việc này giúp bạn triệt tiêu hoàn toàn rủi ro của Revenge Trading (Giao dịch trả thù) và Overtrading.`;
    return impact;
  }

  buildEvidence(affectedTrades) {
    const ev = buildEvidence();
    if (affectedTrades.length > 0) {
      ev.addObserved(`Phát hiện ${affectedTrades.length} lần bạn rất điềm tĩnh sau khi chạm SL: Chủ động nghỉ ngơi trên 2 tiếng HOẶC giảm khối lượng ở lệnh tiếp theo để xoa dịu tâm lý.`);
    }
    return ev;
  }
}

export default new PostLossDisciplineBehavior();
