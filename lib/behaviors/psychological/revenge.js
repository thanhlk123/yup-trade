import { BehaviorBase } from '../BehaviorBase';
import { minutesBetween } from '../helpers';
import { buildEvidence } from '../evidenceBuilder';
import { TAGS } from '../tags';

class RevengeBehavior extends BehaviorBase {
  constructor() {
    super();
    this.id = 'revenge_trading';
    this.nameKey = 'bhRevenge';
    this.category = 'psychological';
    this.severity = 8.0;
    this.relatedBehaviors = ['oversized', 'martingale', 'risk_plan_violated'];
  }

  detect(trades, config) {
    const affected = [];
    const sorted = [...trades].sort((a,b) => new Date(a.trade_time) - new Date(b.trade_time));

    for (let i = 0; i < sorted.length; i++) {
      const current = sorted[i];

      // Declared Evidence
      const declaredMistake = current.mistakes && current.mistakes.includes(TAGS.MISTAKE_REVENGE);
      const emotionAngry = current.emotions && current.emotions.includes(TAGS.EMOTION_ANGER);

      // Observed Sequence Evidence (Was there a loss right before this?)
      let isSequenceRevenge = false;
      let prevLossTrade = null;
      let timeDiff = null;

      if (i > 0) {
        prevLossTrade = sorted[i - 1];
        if (prevLossTrade.status === 'LOSS' && prevLossTrade.exit_time) {
          timeDiff = minutesBetween(prevLossTrade.exit_time, current.trade_time);
          
          // Use config window (REVENGE_WINDOW_MINS = 30) with an increased size (>10% bigger)
          const revengeWindow = config?.timeWindows?.REVENGE_WINDOW_MINS ?? 30;
          const origSize = parseFloat(prevLossTrade.size || 0);
          const currentSize = parseFloat(current.size || 0);
          
          if (timeDiff !== null && timeDiff >= 0 && timeDiff <= revengeWindow && origSize > 0 && currentSize > origSize * 1.1) {
             isSequenceRevenge = true;
          }
        }
      }

      if (declaredMistake || emotionAngry || isSequenceRevenge) {
        affected.push({
          trade: current,
          context: {
            declaredMistake,
            emotionAngry,
            isSequenceRevenge,
            prevLossTrade,
            timeDiff
          }
        });
      }
    }

    return affected;
  }
  
  buildEvidence(affectedTrades) {
    const ev = buildEvidence();
    
    // Observed
    const sequenceRevengeCount = affectedTrades.filter(a => a.context.isSequenceRevenge).length;
    if (sequenceRevengeCount > 0) {
      ev.addObserved(`Phát hiện ${sequenceRevengeCount} lệnh vào ngay lập tức (<15 phút) sau khi vừa bị Stop Loss, đồng thời TĂNG KHỐI LƯỢNG so với lệnh thua trước đó.`);
    }

    // Declared
    const emotionAngryCount = affectedTrades.filter(a => a.context.emotionAngry).length;
    if (emotionAngryCount > 0) {
      ev.addDeclared(`Tâm lý "Trả thù (Revenge) / Tức giận / Muốn gỡ" được ghi nhận trong ${emotionAngryCount} lệnh.`);
    }

    const mistakesCount = affectedTrades.filter(a => a.context.declaredMistake).length;
    if (mistakesCount > 0) {
      ev.addDeclared(`Bạn đã tự thừa nhận lỗi "Giao dịch trả thù" ở ${mistakesCount} lệnh.`);
    }

    return ev;
  }

  calculateConfidence(affectedTrades, evidence) {
    const n = affectedTrades.length;
    const sampleScore = Math.min(0.92, 0.35 + Math.log(n + 1) / Math.log(20) * 0.50);
    const observedBoost = evidence.observed.length > 0 ? 0.08 : 0;
    const declaredBoost = evidence.declared.length > 0 ? 0.15 : 0;
    return Math.min(0.98, sampleScore + observedBoost + declaredBoost);
  }
}

export default new RevengeBehavior();
