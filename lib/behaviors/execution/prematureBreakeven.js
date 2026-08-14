import { BehaviorBase } from '../BehaviorBase';
import { noteContains, minutesBetween } from '../helpers';
import { buildEvidence } from '../evidenceBuilder';

class PrematureBreakevenBehavior extends BehaviorBase {
  constructor() {
    super();
    this.id = 'premature_breakeven';
    this.nameKey = 'bhPrematureBreakeven';
    this.category = 'execution';
    this.severity = 7.5;
    this.relatedBehaviors = ['exit_too_early'];
  }

  detect(trades, config) {
    const affected = [];
    
    trades.forEach(t => {
      const pnl = parseFloat(t.pnl || 0);
      if (Math.abs(pnl) > 5) return; 

      const tp = parseFloat(t.take_profit);
      const entry = parseFloat(t.entry_price);
      const size = parseFloat(t.size || 1);
      
      if (!tp || !entry || tp === entry) return;

      const hasFearNote = noteContains(t, ['be', 'hòa vốn', 'dời sl', 'breakeven', 'chặn lãi', 'risk free', 'quét be']);
      const mins = minutesBetween(t.trade_time, t.exit_time);
      const isTechnicalError = mins !== null && mins < 60;

      if (!hasFearNote && !isTechnicalError) return;

      const opportunityCost = Math.abs(tp - entry) * size;
      if (opportunityCost < 10) return;

      affected.push({
        trade: t,
        context: {
          hasFearNote,
          isTechnicalError,
          mins
        }
      });
    });

    return affected;
  }
  
  buildEvidence(affectedTrades) {
    const ev = buildEvidence();
    
    const technicalCount = affectedTrades.filter(a => a.context.isTechnicalError).length;
    if (technicalCount > 0) {
      ev.addObserved(`Phát hiện ${technicalCount} lệnh dời SL về hòa vốn quá sớm (dưới 60 phút) khiến lệnh bị quét oan (Technical Driven).`);
    }

    const fearCount = affectedTrades.filter(a => a.context.hasFearNote).length;
    if (fearCount > 0) {
      ev.addDeclared(`Bạn ghi chú/khai báo dời hòa vốn (BE) quá sớm do tâm lý hoặc sợ hãi trong ${fearCount} lệnh (Fear Driven).`);
    }

    return ev;
  }
  
  calculateConfidence(affectedTrades, evidence) {
    const n = affectedTrades.length;
    const sampleScore = Math.min(0.92, 0.40 + Math.log(n + 1) / Math.log(20) * 0.45);
    const declaredBoost = evidence.declared.length > 0 ? 0.15 : 0;
    return Math.min(0.98, sampleScore + declaredBoost);
  }
}

export default new PrematureBreakevenBehavior();
