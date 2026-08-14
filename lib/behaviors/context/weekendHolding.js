import { BehaviorBase } from '../BehaviorBase';
import { noteContains } from '../helpers';
import { buildEvidence } from '../evidenceBuilder';

class WeekendHoldingBehavior extends BehaviorBase {
  constructor() {
    super();
    this.id = 'weekend_holding';
    this.nameKey = 'bhWeekendHolding';
    this.category = 'context';
    this.severity = 7.5;
    this.relatedBehaviors = ['hold_too_long'];
  }

  detect(trades, config) {
    const affected = [];
    const lossTrades = trades.filter(t => t.status === 'LOSS');
    
    lossTrades.forEach(t => {
      const open = new Date(t.trade_time);
      const close = new Date(t.exit_time);
      if (!open || !close || isNaN(open) || isNaN(close)) return;

      const isOvernight = close.getDate() !== open.getDate() || close.getDay() < open.getDay();
      const pnl = Math.abs(parseFloat(t.pnl||0));
      const hasNote = noteContains(t, ['qua đêm', 'cuối tuần', 'qua tuần', 'gap', 'overnight', 'weekend']);

      if ((isOvernight && pnl > 50) || hasNote) {
        affected.push({
          trade: t,
          context: {
            isOvernight,
            hasNote
          }
        });
      }
    });

    return affected;
  }
  
  buildEvidence(affectedTrades) {
    const ev = buildEvidence();
    
    const overnightCount = affectedTrades.filter(a => a.context.isOvernight).length;
    if (overnightCount > 0) {
      ev.addObserved(`Phát hiện ${overnightCount} lệnh bị kẹt qua đêm/cuối tuần (tính toán từ thời gian mở/đóng) dẫn đến thua lỗ nặng (Gap).`);
    }

    const declaredCount = affectedTrades.filter(a => a.context.hasNote).length;
    if (declaredCount > 0) {
      ev.addDeclared(`Bạn đã tự ghi chú/khai báo giữ lệnh qua đêm/cuối tuần trong ${declaredCount} lệnh.`);
    }

    return ev;
  }
  
  calculateConfidence(affectedTrades, evidence) {
    const declaredBoost = evidence.declared.length > 0 ? 0.2 : 0;
    const baseScore = evidence.observed.length > 0 ? 0.70 : 0.60;
    return Math.min(0.98, baseScore + declaredBoost);
  }
}

export default new WeekendHoldingBehavior();
