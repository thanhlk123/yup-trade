import { BehaviorBase } from '../BehaviorBase';
import { TAGS } from '../tags';
import { buildEvidence } from '../evidenceBuilder';

class CounterTrendBehavior extends BehaviorBase {
  constructor() {
    super();
    this.id = 'counter_trend';
    this.nameKey = 'bhCounterTrend';
    this.category = 'context';
    this.severity = 7.5;
    this.relatedBehaviors = ['fomo', 'revenge_trading'];
  }

  detect(trades, config) {
    const affected = [];

    trades.forEach(t => {
      if (t.status !== 'LOSS') return;
      
      let isCounterTrend = t.market_trend === TAGS.TREND_COUNTER;
      
      // Derived Evidence: Compare side with trend
      if (!isCounterTrend && t.market_trend && t.side) {
        if ((t.side === 'BUY' && t.market_trend === TAGS.TREND_DOWN) ||
            (t.side === 'SELL' && t.market_trend === TAGS.TREND_UP)) {
          isCounterTrend = true;
        }
      }

      const mistakeCounterTrend = t.mistakes && t.mistakes.includes(TAGS.MISTAKE_COUNTER_TREND);

      if (isCounterTrend || mistakeCounterTrend) {
        affected.push({
          trade: t,
          context: {
            isCounterTrend,
            mistakeCounterTrend
          }
        });
      }
    });

    return affected;
  }
  
  buildEvidence(affectedTrades) {
    const ev = buildEvidence();
    
    // Observed & Derived
    const observedCount = affectedTrades.filter(a => a.context.isCounterTrend).length;
    if (observedCount > 0) {
      ev.addContext(`Phát hiện ${observedCount} lệnh đánh ngược xu hướng chính (ví dụ: BUY trong Uptrend hoặc cản tàu).`);
    }

    // Declared
    const declaredCount = affectedTrades.filter(a => a.context.mistakeCounterTrend).length;
    if (declaredCount > 0) {
      ev.addDeclared(`Bạn đã tự thừa nhận lỗi "Cản tàu/Ngược xu hướng" trong ${declaredCount} lệnh.`);
    }

    return ev;
  }
  
  calculateConfidence(affectedTrades, evidence) {
    const n = affectedTrades.length;
    const sampleScore = Math.min(0.92, 0.40 + Math.log(n + 1) / Math.log(20) * 0.50);
    const declaredBoost = evidence.declared.length > 0 ? 0.1 : 0;
    return Math.min(0.98, sampleScore + declaredBoost);
  }
}

export default new CounterTrendBehavior();
