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
    
    // Semantic shift: Từ "Causal behaviors" sang "Indicators/Context"
    this.indicators = ['risk_plan_violated', 'hold_too_long'];
  }

  detect(trades, config) {
    const affected = [];

    trades.forEach(t => {
      // 1. Observed: SL field is empty, 0, or malformed
      const sl = parseFloat(t.stop_loss);
      const hasNoSl = !Number.isFinite(sl) || sl <= 0;
      
      // 2. Declared: Explicitly tagged as mistake
      const isDeclared = t.mistakes && t.mistakes.includes(TAGS.MISTAKE_NO_SL);
      
      if (!hasNoSl && !isDeclared) return;
      
      // 3. Suppression: Mental Stop is the ONLY valid exception for No SL
      if (t.user_notes && t.user_notes.toLowerCase().includes('mental stop')) return;

      // 4. Context / Indicators: Gather contextual info for UI but don't use as primary trigger
      const hasRiskViolated = t.risk_plan && t.risk_plan.includes(TAGS.RISK_VIOLATED);
      
      affected.push({
        trade: t,
        context: {
          hasNoSl,
          isDeclared,
          hasRiskViolated
        }
      });
    });

    return affected;
  }
  
  buildEvidence(affectedTrades) {
    const ev = buildEvidence();
    
    // Observed
    const observedCount = affectedTrades.filter(a => a.context.hasNoSl).length;
    if (observedCount > 0) {
      ev.addObserved(`${observedCount} lệnh không có giá trị Stop Loss trên hệ thống.`);
    }
    
    // Declared
    const declaredCount = affectedTrades.filter(a => a.context.isDeclared).length;
    if (declaredCount > 0) {
      ev.addDeclared(`${declaredCount} lệnh được tự đánh dấu lỗi "No SL".`);
    }
    
    // Context
    const riskViolatedCount = affectedTrades.filter(a => a.context.hasRiskViolated).length;
    if (riskViolatedCount > 0) {
      ev.addContext(`${riskViolatedCount} lệnh có bối cảnh vi phạm Risk Plan (#Risk_Violated).`);
    }

    return ev;
  }
  
  calculateConfidence(affectedTrades, evidence) {
    // If they explicitly declared it, confidence is very high
    if (evidence.declared.length > 0) return 0.98;
    // Otherwise, observed empty SL is strong enough (Severity 8.5)
    return 0.85; 
  }
}

export default new NoSLBehavior();
