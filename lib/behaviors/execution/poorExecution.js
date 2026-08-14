import { BehaviorBase } from '../BehaviorBase';
import { buildEvidence } from '../evidenceBuilder';
import { TAGS } from '../tags';

class PoorExecutionBehavior extends BehaviorBase {
  constructor() {
    super();
    this.id = 'poor_execution';
    this.nameKey = 'bhPoorExecution';
    this.category = 'execution';
    this.severity = 7.5;
    this.relatedBehaviors = ['fomo', 'early_entry', 'late_entry'];
  }

  detect(trades, config) {
    const affected = [];

    trades.forEach(t => {
      if (t.status !== 'LOSS') return;
      
      const exec = t.execution_quality;
      if (!exec) return;

      const isFomo = exec.includes(TAGS.EXEC_FOMO) || exec.includes(TAGS.EXEC_CHASING);
      const isHesitation = exec.includes(TAGS.EXEC_HESITATION);

      if (isFomo || isHesitation) {
        affected.push({
          trade: t,
          context: {
            exec,
            isFomo,
            isHesitation
          }
        });
      }
    });

    return affected;
  }
  
  buildEvidence(affectedTrades) {
    const ev = buildEvidence();
    if (affectedTrades.length === 0) return ev;
    
    // Observed
    ev.addObserved(`Chất lượng vào lệnh (Execution Quality) kém dẫn đến thua lỗ ở ${affectedTrades.length} giao dịch.`);

    const fomoCount = affectedTrades.filter(a => a.context.isFomo).length;
    if (fomoCount > 0) {
      ev.addObserved(`Có ${fomoCount} lệnh bạn vào theo kiểu đuổi giá (FOMO / Chasing).`);
    }

    const hesitationCount = affectedTrades.filter(a => a.context.isHesitation).length;
    if (hesitationCount > 0) {
      ev.addObserved(`Có ${hesitationCount} lệnh bạn vào theo kiểu chần chừ (Hesitation), lỡ mất vị thế đẹp ban đầu.`);
    }

    return ev;
  }
}

export default new PoorExecutionBehavior();
