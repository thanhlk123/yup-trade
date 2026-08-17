import { BehaviorBase } from '../BehaviorBase';
import { minutesBetween } from '../helpers';
import { buildEvidence } from '../evidenceBuilder';
import { TAGS } from '../tags';

function getRiskMetric(trade) {
  if (trade.risk_percent != null && trade.risk_percent !== '') {
    return { value: parseFloat(trade.risk_percent), type: 'risk_percent' };
  }
  if (trade.risk_amount != null && trade.risk_amount !== '') {
    return { value: parseFloat(trade.risk_amount), type: 'risk_amount' };
  }
  if (trade.size != null && trade.size !== '') {
    return { value: parseFloat(trade.size), type: 'size' };
  }
  return null;
}

class RevengeBehavior extends BehaviorBase {
  constructor() {
    super();
    this.id = 'revenge_trading';
    this.nameKey = 'bhRevenge';
    this.category = 'psychological';
    this.severity = 8.0;
    
    // Semantic shift: "Indicators" thay vì "Related/Causal"
    this.indicators = ['oversized', 'martingale', 'risk_plan_violated'];
  }

  detect(trades, config) {
    const affected = [];
    const sorted = [...trades].sort((a,b) => new Date(a.trade_time) - new Date(b.trade_time));
    const revengeWindow = config?.timeWindows?.REVENGE_WINDOW_MINS ?? 30;

    for (let i = 0; i < sorted.length; i++) {
      const current = sorted[i];

      // 1. Declared Evidence (Explicit)
      const isDeclaredRevenge = current.mistakes && current.mistakes.includes(TAGS.MISTAKE_REVENGE);
      
      // 2. Context / Emotion (Not primary trigger by itself, but strong context)
      const hasAngerEmotion = current.emotions && current.emotions.includes(TAGS.EMOTION_ANGER);
      const hasFrustrationEmotion = current.emotions && current.emotions.includes(TAGS.EMOTION_FRUSTRATION);
      const isEmotionalContext = hasAngerEmotion || hasFrustrationEmotion;

      // Risk Plan Violated Context (Could be declared via mistakes or flagged elsewhere)
      const hasRiskPlanViolated = current.mistakes && current.mistakes.includes('Risk_Plan_Violated') || current.risk_plan_violated;

      // 3. Observed Sequence Evidence
      // Pattern: Previous LOSS -> short interval -> RISK/SIZE increase
      let observedRevengePattern = false;
      let prevLossTrade = null;
      let timeDiff = null;
      let riskIncreasePct = null;
      let riskMultiplier = null;
      let usedRiskMetric = null;
      let prevRiskMetric = null;
      let currRiskMetric = null;

      if (i > 0) {
        prevLossTrade = sorted[i - 1];
        if (prevLossTrade.status === 'LOSS' && prevLossTrade.exit_time) {
          timeDiff = minutesBetween(prevLossTrade.exit_time, current.trade_time);
          
          prevRiskMetric = getRiskMetric(prevLossTrade);
          currRiskMetric = getRiskMetric(current);
          
          if (timeDiff !== null && timeDiff >= 0 && timeDiff <= revengeWindow && 
              prevRiskMetric && currRiskMetric && 
              prevRiskMetric.type === currRiskMetric.type && // Must compare apples to apples
              prevRiskMetric.value > 0 && currRiskMetric.value > prevRiskMetric.value * 1.1) {
             
             observedRevengePattern = true;
             usedRiskMetric = currRiskMetric.type;
             riskIncreasePct = ((currRiskMetric.value - prevRiskMetric.value) / prevRiskMetric.value) * 100;
             riskMultiplier = currRiskMetric.value / prevRiskMetric.value;
          }
        }
      }

      // EMOTIONS ARE NOT A PRIMARY TRIGGER! They only attach if there is an actual behavior triggered.
      if (isDeclaredRevenge || observedRevengePattern) {
        affected.push({
          trade: current,
          context: {
            // Sequence
            timeDiff,
            revengeWindow,
            
            // Risk
            riskMetric: usedRiskMetric,
            previousRisk: prevRiskMetric ? prevRiskMetric.value : null,
            currentRisk: currRiskMetric ? currRiskMetric.value : null,
            riskIncreasePct,
            riskMultiplier,
            
            // Previous trade
            prevLossTrade,
            prevLossPnl: prevLossTrade ? parseFloat(prevLossTrade.pnl || 0) : null,
            
            // Plan & Emotion
            riskPlanViolated: !!hasRiskPlanViolated,
            hasAngerEmotion,
            hasFrustrationEmotion,
            isEmotionalContext,
            isDeclaredRevenge,
            observedRevengePattern,
            
            // Trading Context (Rich data for AI Coach to analyze behavioral contradictions)
            previousSetup: prevLossTrade?.setup || null,
            currentSetup: current.setup || null,
            previousQuality: prevLossTrade?.quality || null,
            currentQuality: current.quality || null,
            previousConfluences: prevLossTrade?.confluences || null,
            currentConfluences: current.confluences || null,
            previousEntryModel: prevLossTrade?.entry_model || null,
            currentEntryModel: current.entry_model || null,
            previousHtfBias: prevLossTrade?.htf_bias || null,
            currentHtfBias: current.htf_bias || null,
          }
        });
      }
    }

    return affected;
  }
  
  buildEvidence(affectedTrades) {
    const ev = buildEvidence();
    
    // 1. Observed Sequence (The 'wow' evidence)
    const sequenceTrades = affectedTrades.filter(a => a.context.observedRevengePattern);
    if (sequenceTrades.length > 0) {
      const window = sequenceTrades[0].context.revengeWindow;
      
      const avgTime = sequenceTrades.reduce((sum, t) => sum + t.context.timeDiff, 0) / sequenceTrades.length;
      const minTime = Math.min(...sequenceTrades.map(t => t.context.timeDiff));
      const avgRiskInc = sequenceTrades.reduce((sum, t) => sum + t.context.riskIncreasePct, 0) / sequenceTrades.length;
      const maxRiskMult = Math.max(...sequenceTrades.map(t => t.context.riskMultiplier));

      ev.addObserved(
        `Phát hiện ${sequenceTrades.length} chuỗi giao dịch có dấu hiệu trả thù (Vào lệnh ngay sau LOSS < ${window} phút và tăng rủi ro/khối lượng).\n` +
        `• Khoảng cách trung bình sau lệnh thua: ${avgTime.toFixed(1)} phút (Nhanh nhất: ${minTime.toFixed(1)} phút)\n` +
        `• Mức độ tăng rủi ro trung bình: +${avgRiskInc.toFixed(1)}% (Cao nhất: x${maxRiskMult.toFixed(1)} lần)`
      );
    }

    // 2. Declared (Mistakes)
    const declaredCount = affectedTrades.filter(a => a.context.isDeclaredRevenge).length;
    if (declaredCount > 0) {
      ev.addDeclared(`Bạn đã tự thừa nhận lỗi "Giao dịch trả thù" (#Mistake_Revenge) ở ${declaredCount} lệnh.`);
    }

    // 3. Context (Emotions & Risk Plan & Setup Contradictions)
    let contextStr = '';
    
    const riskViolatedCount = affectedTrades.filter(a => a.context.riskPlanViolated).length;
    if (riskViolatedCount > 0) {
      contextStr += `• Có ${riskViolatedCount} lệnh vi phạm kế hoạch quản lý vốn (Risk Plan Violated) khi đang ở trạng thái trả thù.\n`;
    }
    
    const emotionCount = affectedTrades.filter(a => a.context.isEmotionalContext).length;
    if (emotionCount > 0) {
      contextStr += `• Bối cảnh tâm lý: "Tức giận / Cáu kỉnh" được ghi nhận trong ${emotionCount} lệnh.\n`;
    }
    
    const setupDegradedCount = affectedTrades.filter(a => a.context.previousQuality && a.context.currentQuality && a.context.previousQuality < a.context.currentQuality).length; // Assuming 'A' < 'C' in string comparison, meaning degraded. Might need a proper mapping if quality is A, B, C.
    // Simplifying setup contradiction phrasing for aggregate:
    if (affectedTrades.some(a => a.context.previousSetup && a.context.currentSetup && a.context.previousSetup !== a.context.currentSetup)) {
      contextStr += `• Có sự thay đổi hoặc suy giảm về Setup / Entry Model ngay sau lệnh thua.\n`;
    }
    
    if (contextStr) {
      ev.addContext(contextStr.trim());
    }

    return ev;
  }

  calculateConfidence(affectedTrades, evidence) {
    let maxConfidence = 0;

    affectedTrades.forEach(a => {
      const { isDeclaredRevenge, isEmotionalContext, observedRevengePattern, riskPlanViolated } = a.context;
      
      let conf = 0;
      if (observedRevengePattern && isDeclaredRevenge) {
        conf = 0.98;
      } else if (isDeclaredRevenge) {
        conf = 0.98; // User declared Revenge is highly confident
      } else if (observedRevengePattern && riskPlanViolated && isEmotionalContext) {
        conf = 0.97;
      } else if (observedRevengePattern && isEmotionalContext) {
        conf = 0.95;
      } else if (observedRevengePattern && riskPlanViolated) {
        conf = 0.94;
      } else if (observedRevengePattern) {
        conf = 0.85; // Purely system observed sequence
      }
      
      if (conf > maxConfidence) {
        maxConfidence = conf;
      }
    });

    return maxConfidence;
  }
}

export default new RevengeBehavior();
