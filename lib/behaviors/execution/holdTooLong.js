import { BehaviorBase } from '../BehaviorBase';
import { minutesBetween, isStopLossEmpty } from '../helpers';
import { buildEvidence } from '../evidenceBuilder';
import { TAGS } from '../tags';
class HoldTooLongBehavior extends BehaviorBase {
  constructor() {
    super();
    this.id = 'hold_too_long';
    this.nameKey = 'bhHoldLoss'; // "Gồng lỗ"
    this.category = 'execution';
    this.severity = 7.5;
    this.relatedBehaviors = ['no_sl', 'dca', 'risk_plan_violated'];
  }

  detect(trades, config) {
    const affected = [];
    const thresholdMins = (config.timeWindows.HOLD_TOO_LONG_HOURS || 24) * 60;

    trades.forEach(t => {
      if (t.status !== 'LOSS') return;
      
      const mins = minutesBetween(t.trade_time, t.exit_time);
      if (mins === null) return;
      
      // Observed
      const isHoldLong = mins > thresholdMins;
      const noSlField = isStopLossEmpty(t.stop_loss);
      
      // Declared
      const declaredMistake = t.mistakes && t.mistakes.includes(TAGS.MISTAKE_HOLD_LOSS);
      const emotionHope = t.emotions && t.emotions.includes(TAGS.EMOTION_HOPE);
      const riskViolation = t.risk_plan && t.risk_plan.includes(TAGS.RISK_VIOLATED);

      // Condition: Held longer than threshold AND (no SL OR declared they made a mistake holding loss)
      if (isHoldLong && (noSlField || declaredMistake || emotionHope)) {
        affected.push({
          trade: t,
          context: {
            mins,
            noSlField,
            declaredMistake,
            emotionHope,
            riskViolation
          }
        });
      }
    });

    return affected;
  }
  
  buildEvidence(affectedTrades) {
    const ev = buildEvidence();
    
    // Observed
    ev.addObserved(`Phát hiện ${affectedTrades.length} lệnh giao dịch thua lỗ bị giữ (gồng) trong thời gian quá lâu (vượt ngưỡng 24 giờ).`);
    
    const noSlCount = affectedTrades.filter(a => a.context.noSlField).length;
    if (noSlCount > 0) {
      ev.addObserved(`Có ${noSlCount} lệnh không có Stop Loss trong nhóm lệnh thua được giữ quá 24 giờ.`);
    }

    const riskViolationCount = affectedTrades.filter(a => a.context.riskViolation).length;
    if (riskViolationCount > 0) {
      ev.addDeclared(`Kế hoạch quản trị rủi ro bị đánh dấu "Violated" trong ${riskViolationCount} lệnh.`);
    }

    // Declared
    const declaredMistakes = affectedTrades.filter(a => a.context.declaredMistake).length;
    if (declaredMistakes > 0) {
      ev.addDeclared(`Bạn đã tự thừa nhận lỗi "Gồng lỗ" trong ${declaredMistakes} lệnh.`);
    }

    const emotionHope = affectedTrades.filter(a => a.context.emotionHope).length;
    if (emotionHope > 0) {
      ev.addDeclared(`Tâm lý "Hy vọng (Hope)" xuất hiện trong ${emotionHope} lệnh, cản trở việc cắt lỗ.`);
    }

    return ev;
  }
}

export default new HoldTooLongBehavior();
