import { BehaviorBase } from '../BehaviorBase';
import { buildEvidence } from '../evidenceBuilder';
import { TAGS } from '../tags';

class NoSLBehavior extends BehaviorBase {
  constructor() {
    super();
    this.id = 'no_sl';
    this.nameKey = 'bhNoSl'; // "Không đặt Stop Loss"
    this.category = 'risk';
    this.severity = 8.5;
    this.relatedBehaviors = ['risk_plan_violated', 'hold_too_long'];
  }

  detect(trades, config) {
    const affected = [];

    trades.forEach(t => {
      // Observed evidence: Stop Loss field is empty or 0
      const noSlField = !t.stop_loss || parseFloat(t.stop_loss) === 0 || t.stop_loss === '';
      
      // Declared evidence: Risk Plan explicitly says No SL or Violated
      const riskViolated = t.risk_plan && t.risk_plan.includes(TAGS.RISK_VIOLATED);
      const mistakeNoSl = t.mistakes && t.mistakes.includes(TAGS.MISTAKE_NO_SL);
      
      // Derived evidence: Did they close manually?
      const manualExit = t.management && t.management.includes(TAGS.MGMT_MANUAL_EXIT);
      
      if (!noSlField && !mistakeNoSl) return;
      
      // False Positive Guard: "Mental Stop"
      // If the user's notes explicitly declare a mental stop, we skip it
      if (t.user_notes && t.user_notes.toLowerCase().includes('mental stop')) return;
      
      affected.push(t);
    });

    return affected;
  }
  
  buildEvidence(affectedTrades) {
    const ev = buildEvidence();
    
    // Observed
    ev.addObserved(`Phát hiện ${affectedTrades.length} lệnh giao dịch hoàn toàn thả trôi không có giá trị Stop Loss.`);
    
    // Declared
    const declaredMistakes = affectedTrades.filter(a => a.mistakes && a.mistakes.includes(TAGS.MISTAKE_NO_SL)).length;
    if (declaredMistakes > 0) {
      ev.addDeclared(`${declaredMistakes} lệnh được người dùng tự nhận lỗi "No SL".`);
    }
    
    const riskViolations = affectedTrades.filter(a => a.risk_plan && a.risk_plan.includes(TAGS.RISK_VIOLATED)).length;
    if (riskViolations > 0) {
      ev.addDeclared(`${riskViolations} lệnh đi kèm với việc thừa nhận vi phạm kế hoạch rủi ro (Risk Plan Violated).`);
    }

    return ev;
  }
  
  calculateConfidence(affectedTrades, evidence) {
    // If they explicitly declared it, confidence is very high
    if (evidence.declared.length > 0) return 0.98;
    return 0.85; // Observed only
  }
}

export default new NoSLBehavior();
