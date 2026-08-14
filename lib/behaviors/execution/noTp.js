import { BehaviorBase } from '../BehaviorBase';
import { buildEvidence } from '../evidenceBuilder';
import { noteContains } from '../helpers';
import { TAGS } from '../tags';

class NoTpBehavior extends BehaviorBase {
  constructor() {
    super();
    this.id = 'no_tp';
    this.nameKey = 'bhNoTp';
    this.category = 'execution';
    this.severity = 5.5;
    this.relatedBehaviors = ['hold_too_long', 'exit_too_early'];
  }

  detect(trades, config) {
    const affected = [];

    // Pre-calculate PF for false positive check
    const winTrades = trades.filter(t => t.status === 'WIN');
    const lossTrades = trades.filter(t => t.status === 'LOSS');
    const sumWins = winTrades.reduce((s, t) => s + parseFloat(t.pnl || 0), 0);
    const sumLoss = Math.abs(lossTrades.reduce((s, t) => s + parseFloat(t.pnl || 0), 0));
    const pf = sumLoss > 0 ? sumWins / sumLoss : 0;
    
    // Suppress if scalper/momentum
    if (pf > 2.5 && winTrades.length >= 5) return affected;

    trades.forEach(t => {
      const hasNoTp = !t.take_profit || parseFloat(t.take_profit) === 0 || t.take_profit === '';
      if (!hasNoTp) return;
      
      const isTrailing = noteContains(t, ['trailing', 'trail', 'partial', 'scale out', 'market exit', 'discretionary', 'tùy nghi']);
      if (isTrailing) return;

      const declaredMistake = noteContains(t, ['quên tp', 'không tp', 'no tp']);
      
      affected.push({
        trade: t,
        context: {
          hasNoTp,
          declaredMistake
        }
      });
    });

    return affected;
  }
  
  buildEvidence(affectedTrades) {
    const ev = buildEvidence();
    
    const count = affectedTrades.length;
    if (count > 0) {
      ev.addObserved(`Có ${count} lệnh được thả trôi không thiết lập giá chốt lời (Take Profit).`);
    }

    const declaredCount = affectedTrades.filter(a => a.context.declaredMistake).length;
    if (declaredCount > 0) {
      ev.addDeclared(`Ghi chú của bạn đã xác nhận quên/không set TP trong ${declaredCount} lệnh.`);
    }

    return ev;
  }
  
  calculateConfidence(affectedTrades, evidence) {
    const n = affectedTrades.length;
    const sampleScore = Math.min(0.92, 0.40 + Math.log(n + 1) / Math.log(30) * 0.45);
    const declaredBoost = evidence.declared.length > 0 ? 0.15 : 0;
    return Math.min(0.98, sampleScore + declaredBoost);
  }
}

export default new NoTpBehavior();
