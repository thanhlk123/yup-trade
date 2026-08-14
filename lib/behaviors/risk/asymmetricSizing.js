import { BehaviorBase } from '../BehaviorBase';
import { median } from '../helpers';
import { buildEvidence } from '../evidenceBuilder';
import { TAGS } from '../tags';

class AsymmetricSizingBehavior extends BehaviorBase {
  constructor() {
    super();
    this.id = 'asymmetric_sizing';
    this.nameKey = 'bhAsymmetricSizing';
    this.category = 'risk';
    this.severity = 7.5;
    this.relatedBehaviors = ['oversized', 'martingale', 'risk_plan_violated'];
  }

  detect(trades, config) {
    const winTrades = trades.filter(t => t.status === 'WIN' && parseFloat(t.size||0) > 0);
    const lossTrades = trades.filter(t => t.status === 'LOSS' && parseFloat(t.size||0) > 0);
    
    if (winTrades.length < 5 || lossTrades.length < 5) return [];

    const winSizes = winTrades.map(t => parseFloat(t.size));
    const lossSizes = lossTrades.map(t => parseFloat(t.size));
    
    const medWinSize = median(winSizes);
    const medLossSize = median(lossSizes);

    // Asymmetric Risk Rule: Median size of losses must be 1.5x larger than median size of wins
    if (medLossSize <= medWinSize * 1.5) return [];

    const affected = [];
    lossTrades.forEach(t => {
      // Declared evidence
      const declaredRiskViolation = t.risk_plan && t.risk_plan.includes(TAGS.RISK_VIOLATED);
      const mistakeOversize = t.mistakes && t.mistakes.includes(TAGS.MISTAKE_OVERRISK);
      
      affected.push({
        trade: t,
        context: {
          medWinSize,
          medLossSize,
          declaredRiskViolation,
          mistakeOversize
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
    ev.addObserved(`Kích thước vào lệnh không cân xứng (Asymmetric Sizing).`);
    ev.addObserved(`Khối lượng trung vị của các lệnh Lỗ (${context.medLossSize.toFixed(2)}) cao gấp 1.5x khối lượng trung vị của các lệnh Lãi (${context.medWinSize.toFixed(2)}).`);

    // Declared
    const riskViolations = affectedTrades.filter(a => a.context.declaredRiskViolation).length;
    if (riskViolations > 0) {
      ev.addDeclared(`Có ${riskViolations} lệnh lỗ được đánh dấu vi phạm Kế hoạch Rủi ro (Risk Plan Violated).`);
    }
    
    const mistakeOversize = affectedTrades.filter(a => a.context.mistakeOversize).length;
    if (mistakeOversize > 0) {
      ev.addDeclared(`Bạn đã tự thừa nhận lỗi về khối lượng lớn (Oversized) trong ${mistakeOversize} lệnh thua này.`);
    }

    return ev;
  }
  
  calculateConfidence(affectedTrades, evidence) {
    return evidence.declared.length > 0 ? 0.95 : 0.90;
  }
  
  run(trades, config) {
    const result = super.run(trades, config);
    if (!result || result.occurrences === 0) return null;
    
    // Need to recalculate structural damage just like V1
    
    const lossTrades = trades.filter(t => t.status === 'LOSS' && parseFloat(t.size||0) > 0);
    const winTrades = trades.filter(t => t.status === 'WIN' && parseFloat(t.size||0) > 0);
    const medWinSize = median(winTrades.map(t => parseFloat(t.size)));
    
    const actualLossPnL = Math.abs(lossTrades.reduce((s,t) => s + parseFloat(t.pnl||0), 0));
    
    let idealLossPnL = 0;
    lossTrades.forEach(t => {
      const pnl = Math.abs(parseFloat(t.pnl||0));
      const sz = parseFloat(t.size);
      if (sz > 0) {
        idealLossPnL += (pnl / sz) * medWinSize; // Scale down the loss to the medWinSize
      }
    });

    const damage = actualLossPnL - idealLossPnL;
    if (damage <= 0) return null;

    result.impact.totalDamage = -damage;
    result.impact.avgDamage = -damage / result.occurrences;
    result.impact.note = `Thiệt hại cơ cấu là khoản tiền mất thêm do sử dụng khối lượng lớn hơn mức bình thường lúc giao dịch thua lỗ.`;
    
    return result;
  }
}

export default new AsymmetricSizingBehavior();
