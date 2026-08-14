import { BehaviorBase } from '../BehaviorBase';
import { buildEvidence } from '../evidenceBuilder';
import { TAGS } from '../tags';

class RrInversionBehavior extends BehaviorBase {
  constructor() {
    super();
    this.id = 'rr_inversion';
    this.nameKey = 'bhRrInversion';
    this.category = 'risk';
    this.severity = 8.5;
    this.relatedBehaviors = ['hold_too_long', 'exit_too_early', 'risk_plan_violated'];
  }

  detect(trades, config) {
    const winTrades = trades.filter(t => t.status === 'WIN');
    const lossTrades = trades.filter(t => t.status === 'LOSS');
    
    if (winTrades.length < 5 || lossTrades.length < 5) return [];

    // Use actual_rr from DB if available, fallback to PnL average
    const useActualRr = trades.some(t => t.actual_rr !== undefined && t.actual_rr !== null);
    
    let avgWin = 0;
    let avgLoss = 0;

    if (useActualRr) {
      avgWin = winTrades.reduce((s,t) => s + parseFloat(t.actual_rr||0), 0) / winTrades.length;
      const sumLossRr = Math.abs(lossTrades.reduce((s,t) => s + parseFloat(t.actual_rr||0), 0));
      avgLoss = sumLossRr / lossTrades.length;
    } else {
      const sumWins = winTrades.reduce((s,t) => s + parseFloat(t.pnl||0), 0);
      const sumLoss = Math.abs(lossTrades.reduce((s,t) => s + parseFloat(t.pnl||0), 0));
      avgWin = sumWins / winTrades.length;
      avgLoss = sumLoss / lossTrades.length;
    }

    // Must be structurally inverted
    if (avgLoss <= avgWin * 1.5) return [];

    // The trades affected are technically all loss trades that contribute to this average
    const affected = [];
    lossTrades.forEach(t => {
      // Declared evidence
      const declaredRiskViolation = t.risk_plan && t.risk_plan.includes(TAGS.RISK_VIOLATED);
      const mistakeRr = t.mistakes && (t.mistakes.includes('RR') || t.mistakes.includes('Reward'));
      
      affected.push({
        trade: t,
        context: {
          avgWin,
          avgLoss,
          declaredRiskViolation,
          mistakeRr
        }
      });
    });

    return affected;
  }
  
  buildEvidence(affectedTrades) {
    const ev = buildEvidence();
    if (affectedTrades.length === 0) return ev;
    
    const context = affectedTrades[0].context;
    
    // Observed
    ev.addObserved(`Tỷ lệ Lỗ/Lãi (R:R) bị đảo ngược. Lỗ trung bình ($${context.avgLoss.toFixed(0)}) cao gấp 1.5x so với Lãi trung bình ($${context.avgWin.toFixed(0)}).`);
    ev.addObserved(`Kèm theo Profit Factor thấp (dưới 1.5), cho thấy chiến lược giao dịch đang không có lợi thế toán học.`);

    // Declared
    const riskViolations = affectedTrades.filter(a => a.context.declaredRiskViolation).length;
    if (riskViolations > 0) {
      ev.addDeclared(`Có ${riskViolations} lệnh lỗ trong nhóm này được đánh dấu vi phạm Kế hoạch Rủi ro (Risk Plan Violated).`);
    }
    
    const mistakeRr = affectedTrades.filter(a => a.context.mistakeRr).length;
    if (mistakeRr > 0) {
      ev.addDeclared(`Bạn đã tự thừa nhận lỗi về Tỷ lệ R:R trong ${mistakeRr} lệnh.`);
    }

    return ev;
  }
  
  calculateConfidence(affectedTrades, evidence) {
    return evidence.declared.length > 0 ? 0.95 : 0.90; // High confidence because math doesn't lie
  }
  
  run(trades, config) {
    const result = super.run(trades, config);
    if (!result) return null;
    
    // Override impact structurally
    const winTrades = trades.filter(t => t.status === 'WIN');
    const lossTrades = trades.filter(t => t.status === 'LOSS');
    const avgWin = winTrades.reduce((s,t) => s + parseFloat(t.pnl||0), 0) / (winTrades.length || 1);
    
    const idealSumLoss = avgWin * lossTrades.length; // if RR was 1:1 (per each loss trade)
    const structuralDamage = Math.abs(result.impact.totalDamage) - idealSumLoss;
    
    if (structuralDamage <= 0) return null;

    // BUG FIX: avgDamage divides by lossTrades (the trades that form the inversion), not total occurrences
    result.impact.totalDamage = -structuralDamage;
    result.impact.avgDamage = lossTrades.length > 0 ? -structuralDamage / lossTrades.length : 0;
    result.impact.note = `Thiệt hại cơ cấu là khoản chênh lệch mất đi do duy trì tỷ lệ Lỗ lớn hơn Lãi, tính trên giả định R:R tối thiểu 1:1.`;
    
    return result;
  }
}

export default new RrInversionBehavior();
