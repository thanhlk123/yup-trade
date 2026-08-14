import { BehaviorBase } from '../BehaviorBase';
import { buildEvidence } from '../evidenceBuilder';

class StreakManagementBehavior extends BehaviorBase {
  constructor() {
    super();
    this.id = 'streak_management';
    this.nameKey = 'bhStreakManagement';
    this.category = 'good';
    this.severity = 5;
    this.relatedBehaviors = [];
  }

  detect(trades, config) {
    const affected = [];
    const sorted = [...trades].sort((a,b) => new Date(a.trade_time) - new Date(b.trade_time));
    let currentStreak = 0;
    let streaks = 0;
    
    for (let i = 0; i < sorted.length - 1; i++) {
      if (sorted[i].status === 'WIN') {
        currentStreak++;
      } else {
        currentStreak = 0;
      }
      
      if (currentStreak >= 3) {
        streaks++;
        const nextTrade = sorted[i+1];
        const prevAvgSize = sorted.slice(i-2, i+1).reduce((s,t) => s + parseFloat(t.size||0), 0) / 3;
        const nextSize = parseFloat(nextTrade.size||0);
        
        if (nextSize > 0 && nextSize <= prevAvgSize * 1.2) {
          affected.push({
            trade: nextTrade,
            context: {
              streaksCount: streaks
            }
          });
        }
      }
    }

    if (affected.length < 2) return [];
    
    const consistency = Math.round((affected.length / (streaks || 1)) * 100);
    if (consistency < 60) return []; // Only flag if they actually have good control

    return affected;
  }
  
  calculateImpact(affectedTrades, allTrades) {
    const impact = super.calculateImpact(affectedTrades, allTrades);
    if (!impact) return null;
    impact.note = `Sự điềm tĩnh giúp bạn giữ vững kỷ luật đi lệnh, không bị cuốn vào tâm lý hưng phấn (Overconfidence) sau chuỗi thắng.`;
    return impact;
  }

  buildEvidence(affectedTrades) {
    const ev = buildEvidence();
    if (affectedTrades.length > 0) {
      ev.addObserved(`Phát hiện ${affectedTrades.length} lần bạn giữ nguyên kỷ luật đi lệnh (không tăng vol quá đà) ngay sau chuỗi thắng liên tiếp (Winning Streak >= 3 lệnh).`);
    }
    return ev;
  }
}

export default new StreakManagementBehavior();
