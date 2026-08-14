import { BehaviorBase } from '../BehaviorBase';
import { buildEvidence } from '../evidenceBuilder';
import { TAGS } from '../tags';

class PoorSetupGradeBehavior extends BehaviorBase {
  constructor() {
    super();
    this.id = 'poor_setup_grade';
    this.nameKey = 'bhPoorSetupGrade';
    this.category = 'process'; // Will create process category if not exist
    this.severity = 6.0;
    this.relatedBehaviors = ['overtrading', 'low_confirmation'];
  }

  detect(trades, config) {
    if (trades.length < 5) return [];

    let totalGraded = 0;
    let cGradeLosses = [];

    trades.forEach(t => {
      if (!t.setup_grade) return;
      totalGraded++;

      // Check if it's a C-grade setup (or lower quality tag)
      if (t.setup_grade === TAGS.GRADE_C || t.setup_grade === TAGS.GRADE_C_TAG || t.setup_grade.toUpperCase() === 'C') {
        if (t.status === 'LOSS') {
          cGradeLosses.push({
            trade: t,
            context: {}
          });
        }
      }
    });

    // If more than 30% of graded trades are C-grade losses, trigger behavior
    if (totalGraded > 0 && cGradeLosses.length / totalGraded > 0.3) {
      return cGradeLosses;
    }

    return [];
  }
  
  buildEvidence(affectedTrades) {
    const ev = buildEvidence();
    if (affectedTrades.length === 0) return ev;
    
    // Observed
    ev.addObserved(`Có ${affectedTrades.length} lệnh giao dịch thua lỗ được phân loại là Setup Hạng C (C-grade).`);
    ev.addObserved(`Tỷ lệ giao dịch các setup kém chất lượng đang chiếm quá 30% tổng số lệnh, cho thấy sự thiếu kiên nhẫn trong việc chọn lọc cơ hội (Overtrading/Boredom).`);

    return ev;
  }
}

export default new PoorSetupGradeBehavior();
