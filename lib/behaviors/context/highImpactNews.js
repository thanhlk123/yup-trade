import { BehaviorBase } from '../BehaviorBase';
import { minutesBetween, noteContains } from '../helpers';
import { buildEvidence } from '../evidenceBuilder';

class HighImpactNewsBehavior extends BehaviorBase {
  constructor() {
    super();
    this.id = 'high_impact_news';
    this.nameKey = 'bhHighImpactNews';
    this.category = 'context';
    this.severity = 8.5;
    this.relatedBehaviors = [];
  }

  detect(trades, config) {
    const affected = [];
    const lossTrades = trades.filter(t => t.status === 'LOSS');
    const avgLoss = Math.abs(lossTrades.reduce((s,t) => s + parseFloat(t.pnl||0), 0)) / (lossTrades.length || 1);

    lossTrades.forEach(t => {
      const mins = minutesBetween(t.trade_time, t.exit_time);
      const isFast = mins !== null && mins < (config?.timeWindows?.NEWS_SLIPPAGE_MINS || 5);
      const isHugeLoss = Math.abs(parseFloat(t.pnl||0)) > avgLoss * 1.5;
      
      const hasNote = noteContains(t, ['tin tức', 'news', 'cpi', 'nfp', 'fomc', 'quét hai đầu', 'trượt giá', 'slippage']);

      if ((isFast && isHugeLoss) || hasNote) {
        affected.push({
          trade: t,
          context: {
            hasNote,
            isFastAndHuge: isFast && isHugeLoss,
            mins
          }
        });
      }
    });

    return affected;
  }
  
  buildEvidence(affectedTrades) {
    const ev = buildEvidence();
    
    const observedCount = affectedTrades.filter(a => a.context.isFastAndHuge).length;
    if (observedCount > 0) {
      ev.addObserved(`Phát hiện ${observedCount} lệnh bị quét thua lỗ cực mạnh (vượt trung bình) chỉ trong vòng vài phút ngắn ngủi (Dấu hiệu trượt giá do tin tức).`);
    }

    const declaredCount = affectedTrades.filter(a => a.context.hasNote).length;
    if (declaredCount > 0) {
      ev.addDeclared(`Bạn đã tự ghi chú/khai báo dính bão tin tức (High Impact News) trong ${declaredCount} lệnh.`);
    }

    return ev;
  }
  
  calculateConfidence(affectedTrades, evidence) {
    const declaredBoost = evidence.declared.length > 0 ? 0.2 : 0;
    const baseScore = evidence.observed.length > 0 ? 0.75 : 0.60;
    return Math.min(0.98, baseScore + declaredBoost);
  }
}

export default new HighImpactNewsBehavior();
