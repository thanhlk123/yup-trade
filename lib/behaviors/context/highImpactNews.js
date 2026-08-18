import { BehaviorBase } from '../BehaviorBase';
import { minutesBetween, noteContains } from '../helpers';
import { buildEvidence } from '../evidenceBuilder';
import { TAGS } from '../tags';

function getMedian(arr) {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

class HighImpactNewsBehavior extends BehaviorBase {
  constructor() {
    super();
    this.id = 'high_impact_news';
    this.nameKey = 'bhHighImpactNews';
    this.category = 'context';
    this.severity = 8.5; // Base severity, will be dynamically considered by damage inside the priority engine
    this.relatedBehaviors = ['risk_plan_violated', 'impulsive_entry', 'no_sl'];
  }

  detect(trades, config) {
    const affected = [];
    const lossTrades = trades.filter(t => t.status === 'LOSS');
    const lossValues = lossTrades.map(t => Math.abs(parseFloat(t.pnl || 0)));
    const globalMedianLoss = getMedian(lossValues) || 1;

    trades.forEach(t => {
      // 1. Calculate Core Metrics
      const durationMinutes = minutesBetween(t.trade_time, t.exit_time);
      const actualPnL = parseFloat(t.pnl || 0);
      const actualLoss = actualPnL < 0 ? Math.abs(actualPnL) : 0;
      
      let plannedRisk = parseFloat(t.risk_amount);
      let plannedRiskSource = 'UNKNOWN';
      
      if (!isNaN(plannedRisk) && plannedRisk > 0) {
          plannedRiskSource = 'EXACT';
      } else {
          const entry = parseFloat(t.entry_price);
          const sl = parseFloat(t.stop_loss);
          const vol = parseFloat(t.size || 0);
          if (entry > 0 && sl > 0 && vol > 0) {
              plannedRisk = Math.abs(entry - sl) * vol;
              plannedRiskSource = 'ESTIMATED';
          }
      }

      // Leave-one-out typical loss
      const typicalLoss = getMedian(lossValues.filter(val => val !== actualLoss)) || globalMedianLoss;
      
      const actualRiskR = (plannedRiskSource !== 'UNKNOWN' && plannedRisk > 0) ? (actualLoss / plannedRisk) : null;
      const lossVsTypical = actualLoss > 0 ? (actualLoss / typicalLoss) : 0;
      const riskPlanDeviation = actualRiskR !== null && actualRiskR > 1.5;

      // 2. Extract Independent Signals
      const structuredDeclaration = t.mistakes?.includes(TAGS.MISTAKE_NEWS) || false;
      const keywordDeclaration = noteContains(t, ['tin tức', 'news', 'cpi', 'nfp', 'fomc', 'quét hai đầu', 'trượt giá', 'slippage']);
      
      const fastExecution = durationMinutes !== null && durationMinutes < (config?.timeWindows?.NEWS_SLIPPAGE_MINS || 5);
      
      // Anomalies only matter if it's a loss
      const abnormalRiskDeviation = actualLoss > 0 && riskPlanDeviation && plannedRiskSource === 'EXACT';
      const abnormalLossVsTypical = actualLoss > 0 && lossVsTypical > 2.0;

      // 3. Evaluate Evidence & Classification
      let score = 0;
      if (structuredDeclaration) score += 4;
      if (keywordDeclaration) score += 2;
      if (fastExecution) score += 1;
      if (abnormalRiskDeviation) score += 2;
      if (abnormalLossVsTypical) score += 1;

      if (score >= 1) {
          let classification = 'CANDIDATE';
          if (structuredDeclaration || keywordDeclaration) {
              classification = 'USER_DECLARED';
          } else if (score >= 3) {
              classification = 'POSSIBLE';
          }

          // Counter Evidence
          const counterEvidence = [];
          if (!structuredDeclaration && !keywordDeclaration && fastExecution && actualLoss > 0 && !abnormalRiskDeviation && !abnormalLossVsTypical) {
              counterEvidence.push('Lệnh đóng nhanh nhưng rủi ro tổn thất hoàn toàn nằm trong mức bình thường (không có slippage bất thường).');
          }
          if (classification !== 'USER_DECLARED' && actualPnL > 0) {
              // If it's a WIN trade, and we don't have explicit declaration, we can't reliably guess it's news just because it's fast.
              counterEvidence.push('Lệnh có lãi, thiếu bằng chứng xác thực từ người dùng để khẳng định đây là trade bão tin tức.');
          }

          // Confidence Penalty
          let confidence = 0.5;
          if (classification === 'USER_DECLARED') {
              confidence = structuredDeclaration ? 0.98 : 0.90;
          } else if (classification === 'POSSIBLE') {
              confidence = counterEvidence.length > 0 ? 0.45 : 0.75;
          } else {
              confidence = 0.3; // CANDIDATE
          }

          if (confidence >= 0.4) {
              affected.push({
                tradeId: t.id,
                trade: t,
                classification,
                signals: {
                   structuredDeclaration,
                   keywordDeclaration,
                   fastExecution,
                   abnormalRiskDeviation,
                   abnormalLossVsTypical
                },
                metrics: {
                   durationMinutes,
                   plannedRisk: (plannedRiskSource !== 'UNKNOWN') ? plannedRisk : null,
                   plannedRiskSource,
                   actualPnL,
                   actualLoss,
                   actualRiskR,
                   typicalLoss,
                   lossVsTypical,
                   riskPlanDeviation
                },
                counterEvidence,
                confidence
              });
          }
      }
    });

    return affected;
  }
  
  buildEvidence(affectedTrades) {
    const ev = buildEvidence();
    
    affectedTrades.forEach(a => {
        const { classification, signals, metrics, counterEvidence, trade } = a;
        const isWin = metrics.actualPnL > 0;
        
        let msg = '';
        if (classification === 'USER_DECLARED') {
           msg = `⚠️ Bạn đã tự khai báo giao dịch trong vùng bão tin tức. `;
        } else {
           msg = `⚠️ Khả năng lệnh chịu ảnh hưởng của biến động bất thường (News/Whipsaw). `;
        }
        
        if (isWin) {
           msg += `Lệnh này bạn đã ĂN MAY và có lãi ${metrics.actualPnL > 0 ? '+' : ''}$${metrics.actualPnL.toFixed(2)}. Tuy nhiên, trade tin tức vẫn là một thói quen rủi ro. `;
        } else {
           msg += `Thiệt hại: Lỗ $${metrics.actualLoss.toFixed(2)}. Lệnh đóng nhanh sau ${metrics.durationMinutes !== null ? metrics.durationMinutes.toFixed(1) : '?'} phút. `;
           
           if (signals.abnormalRiskDeviation) {
              msg += `Điểm đáng báo động là lỗ vượt kế hoạch tới ${metrics.actualRiskR.toFixed(1)}R (Dấu hiệu Slippage/Quét thanh khoản). `;
           } else if (signals.abnormalLossVsTypical) {
              msg += `Lỗ gấp ${metrics.lossVsTypical.toFixed(1)} lần mức lỗ thông thường của bạn. `;
           }
        }

        if (counterEvidence.length > 0) {
           msg += `[Phản biện hệ thống: ${counterEvidence.join(' ')}]`;
        }
        
        if (classification === 'USER_DECLARED') {
            ev.addDeclared(msg);
        } else {
            ev.addObserved(msg);
        }
    });

    return ev;
  }
  
  calculateConfidence(affectedTrades, evidence) {
    if (affectedTrades.length === 0) return 0;
    // Aggregate by max confidence + boost for multiple signals
    const confidences = affectedTrades.map(a => a.confidence);
    const maxConf = Math.max(...confidences);
    
    const highConfTrades = confidences.filter(c => c > 0.8).length;
    let boost = highConfTrades * 0.05;
    
    return Math.min(0.98, maxConf + boost);
  }
}

export default new HighImpactNewsBehavior();
