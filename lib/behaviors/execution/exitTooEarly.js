import { BehaviorBase } from '../BehaviorBase';
import { buildEvidence } from '../evidenceBuilder';
import { TAGS } from '../tags';

class ExitTooEarlyBehavior extends BehaviorBase {
  constructor() {
    super();
    this.id = 'exit_too_early';
    this.nameKey = 'bhExitEarly'; // "Chốt non"
    this.category = 'execution';
    this.severity = 7.0;
    this.relatedBehaviors = ['no_tp', 'fear'];
  }

  detect(trades, config) {
    const affected = [];

    trades.forEach(t => {
      if (t.status !== 'WIN') return;
      
      const tp = parseFloat(t.take_profit);
      const entry = parseFloat(t.entry_price);
      const exit = parseFloat(t.exit_price);
      const sl = parseFloat(t.stop_loss);

      let isObservedEarly = false;
      let actualDist = 0;
      let fullDist = 0;
      let rr = 0;

      if (t.planned_rr !== undefined && t.planned_rr !== null && parseFloat(t.planned_rr) > 0) {
        // Use standard DB columns if available
        const prr = parseFloat(t.planned_rr);
        const arr = parseFloat(t.actual_rr || 0);
        if (arr / prr < 0.7) {
          isObservedEarly = true;
          rr = arr;
          fullDist = prr;
          actualDist = arr;
        }
      } else if (tp && entry && exit && tp !== entry) {
        // Fallback to manual calculation
        fullDist = Math.abs(tp - entry);
        actualDist = Math.abs(exit - entry);
        
        // Chốt non khi giá mới đi được < 70% quãng đường đến TP
        if (fullDist > 0 && actualDist / fullDist < 0.7) {
          isObservedEarly = true;
          if (sl && entry !== sl) rr = actualDist / Math.abs(entry - sl);
        }
      }

      // Declared Evidence
      const declaredMistake = t.mistakes && t.mistakes.includes(TAGS.MISTAKE_EARLY_EXIT);
      const manualExit = t.trade_management && t.trade_management.includes(TAGS.MGMT_MANUAL_EXIT);
      const exitReasonFear = t.exit_reason && t.exit_reason.includes(TAGS.EMOTION_FEAR);

      if (!isObservedEarly && !declaredMistake && !exitReasonFear) return;

      affected.push({
        trade: t,
        context: {
          isObservedEarly,
          actualDist,
          fullDist,
          rr,
          declaredMistake,
          manualExit,
          exitReasonFear,
          tp,
          exit,
          size: parseFloat(t.size || 1)
        }
      });
    });

    return affected;
  }
  
  buildEvidence(affectedTrades) {
    const ev = buildEvidence();
    
    // Observed
    const observed = affectedTrades.filter(a => a.context.isObservedEarly);
    if (observed.length > 0) {
      const rrValues = observed.map(a => a.context.rr).filter(rr => rr > 0);
      const avgRR = rrValues.length > 0 ? rrValues.reduce((s, rr) => s + rr, 0) / rrValues.length : null;
      const rrText = avgRR !== null ? ` (Average R:R thực tế: ${avgRR.toFixed(2)})` : '';
      
      const manualCount = observed.filter(a => a.context.manualExit).length;
      if (manualCount > 0 && manualCount === observed.length) {
        ev.addObserved(`Phát hiện ${observed.length} lệnh được đóng thủ công trước khi đạt 70% mục tiêu TP${rrText}.`);
      } else {
        ev.addObserved(`Phát hiện ${observed.length} lệnh đóng khi giá mới đi dưới 70% quãng đường đến TP${rrText}.`);
      }
    }

    // Declared
    const declaredMistakes = affectedTrades.filter(a => a.context.declaredMistake).length;
    if (declaredMistakes > 0) {
      ev.addDeclared(`Bạn tự nhận lỗi "Chốt non / Closed Early" trong ${declaredMistakes} lệnh.`);
    }

    const fearExits = affectedTrades.filter(a => a.context.exitReasonFear).length;
    if (fearExits > 0) {
      ev.addDeclared(`Lý do chốt lời của ${fearExits} lệnh được ghi nhận là do "Sợ hãi / Cảm xúc".`);
    }

    return ev;
  }

  run(trades, config) {
    // Cache detect() result to avoid running it twice (BUG FIX: was called in super.run() AND again below)
    let cachedAffected = null;
    const originalDetect = this.detect.bind(this);
    this.detect = (...args) => {
      cachedAffected = originalDetect(...args);
      return cachedAffected;
    };

    const result = super.run(trades, config);
    
    // Restore original detect
    this.detect = originalDetect;

    if (!result) return null;

    const affected = cachedAffected || [];
    
    const rrValues = affected.map(a => a.context.rr).filter(rr => rr > 0);
    const avgRR = rrValues.length > 0 ? rrValues.reduce((s, rr) => s + rr, 0) / rrValues.length : 0;
    
    // False Positive Validation: Scalper
    // If the trades have good actual RR (>2) despite not hitting full TP, it's a valid scalp, not a mistake
    if (avgRR >= config.falsePositives.SCALPER_MIN_RR_PROFIT && affected.every(a => !a.context.declaredMistake && !a.context.exitReasonFear)) {
       // Suppress if it's highly profitable and user didn't mark it as a mistake
       return null;
    }

    // Override impact to show opportunity cost
    const totalOpportunityCost = affected.reduce((s, a) => {
      const { tp, actualDist, fullDist } = a.context;
      if (!tp || actualDist === 0) return s;
      
      // Calculate missed profit based on actual PnL proportionality
      const actualPnL = parseFloat(a.trade.pnl || 0);
      const expectedPnL = actualPnL * (fullDist / actualDist);
      const opportunityCost = expectedPnL - actualPnL;
      
      return s + Math.max(0, opportunityCost);
    }, 0);

    result.impact = {
      totalDamage: -totalOpportunityCost,
      avgDamage: affected.length > 0 ? -totalOpportunityCost / affected.length : 0,
      worstSingle: 0,
      winrate: 1, 
      profitFactor: 0,
      isOpportunityCost: true,
      note: `Đánh rơi khoảng $${totalOpportunityCost.toFixed(1)} tiền lãi tiềm năng do chốt quá sớm so với TP dự kiến.`
    };
    
    return result;
  }
}

export default new ExitTooEarlyBehavior();
