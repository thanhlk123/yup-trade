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

class MartingaleBehavior extends BehaviorBase {
  constructor() {
    super();
    this.id = 'martingale';
    this.nameKey = 'bhMartingale';
    this.category = 'risk';
    this.severity = 9.5;
    this.indicators = ['revenge_trading', 'oversized', 'risk_plan_violated'];
  }

  detect(trades, config) {
    const affected = [];
    const sorted = [...trades].sort((a,b) => new Date(a.trade_time) - new Date(b.trade_time));
    
    const riskBump = config?.thresholds?.MARTINGALE_RISK_MULTIPLIER ?? 1.8;
    const timeLimitMins = config?.timeWindows?.MARTINGALE_WINDOW_MINS ?? 30; // Within 30 mins of the loss

    for (let i = 1; i < sorted.length; i++) {
      const current = sorted[i];

      // Find the latest completed LOSS for the same asset before this trade
      let prevLossTrade = null;
      for (let j = i - 1; j >= 0; j--) {
        const candidate = sorted[j];
        if (candidate.asset === current.asset && candidate.status === 'LOSS') {
           // Ensure it actually closed before the current trade opened
           if (candidate.exit_time && new Date(candidate.exit_time) < new Date(current.trade_time)) {
             prevLossTrade = candidate;
             break;
           }
        }
      }

      if (!prevLossTrade) continue;
      
      const timeDiff = minutesBetween(prevLossTrade.exit_time, current.trade_time);
      if (timeDiff === null || timeDiff > timeLimitMins) continue;

      const prevRiskMetric = getRiskMetric(prevLossTrade);
      const currRiskMetric = getRiskMetric(current);

      if (!prevRiskMetric || !currRiskMetric || prevRiskMetric.type !== currRiskMetric.type) continue;
      if (prevRiskMetric.value <= 0) continue;

      const riskMultiplier = currRiskMetric.value / prevRiskMetric.value;
      
      // TRIGGER: Risk escalated significantly
      if (riskMultiplier >= riskBump) {
        
        // Outcome Analysis
        const outcome = current.status; 
        const isFailedMartingale = outcome === 'LOSS';
        
        let lossMultiplier = null;
        let isLossAmplified = false;
        const previousPnl = parseFloat(prevLossTrade.pnl || 0);
        const currentPnl = parseFloat(current.pnl || 0);

        if (isFailedMartingale && previousPnl < 0 && currentPnl < 0) {
          lossMultiplier = Math.abs(currentPnl) / Math.abs(previousPnl);
          if (lossMultiplier >= 1.5) {
            isLossAmplified = true;
          }
        }
        
        const isDeclaredMartingale = current.mistakes?.includes(TAGS.MISTAKE_MARTINGALE) || current.mistakes?.includes('Martingale');
        const riskPlanViolated = current.risk_plan?.includes(TAGS.RISK_VIOLATED) || current.mistakes?.includes(TAGS.MISTAKE_RISK_VIOLATED) || current.mistakes?.includes('Risk_Plan_Violated') || current.risk_plan_violated;

        affected.push({
          trade: current,
          context: {
            asset: current.asset,
            timeDiff,
            riskBumpThreshold: riskBump,
            
            // Risk metrics
            riskMetric: currRiskMetric.type,
            previousRisk: prevRiskMetric.value,
            currentRisk: currRiskMetric.value,
            riskMultiplier,
            
            // Outcome metrics
            outcome,
            isFailedMartingale,
            isLossAmplified,
            previousPnl,
            currentPnl,
            lossMultiplier,
            
            // Supporting Evidence
            riskPlanViolated: !!riskPlanViolated,
            isDeclaredMartingale: !!isDeclaredMartingale,
            
            // Trading Context
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
            
            // Pointers
            prevLossTrade
          }
        });
      }
    }

    return affected;
  }
  
  buildEvidence(affectedTrades) {
    const ev = buildEvidence();
    
    if (affectedTrades.length > 0) {
      const failedCount = affectedTrades.filter(a => a.context.isFailedMartingale).length;
      const amplifiedCount = affectedTrades.filter(a => a.context.isLossAmplified).length;
      const successCount = affectedTrades.filter(a => a.context.outcome === 'WIN').length;
      
      let evidenceStr = `Phát hiện ${affectedTrades.length} chuỗi giao dịch có dấu hiệu Gấp thếp (Martingale): Tăng mức độ rủi ro (risk/size) đột biến trên cùng mã giao dịch ngay sau khi cắt lỗ.\n`;
      
      if (successCount > 0) {
        evidenceStr += `• Có ${successCount} lần bạn gấp thếp thành công và gỡ lại được tiền (Successful Recovery).\n`;
      }
      
      if (failedCount > 0) {
        evidenceStr += `• Có ${failedCount} lần bạn thất bại (Failed Martingale), tiếp tục dính Stop Loss.\n`;
      }

      if (amplifiedCount > 0) {
        // Calculate max loss multiplier for the 'wow' factor
        const maxLossMult = Math.max(...affectedTrades.filter(a => a.context.isLossAmplified).map(a => a.context.lossMultiplier));
        evidenceStr += `• RỦI RO KÉP: Trong đó có ${amplifiedCount} lần khoản lỗ sau phình to nghiêm trọng (cao nhất x${maxLossMult.toFixed(1)} lần so với lệnh trước đó).`;
      }

      ev.addObserved(evidenceStr.trim());
      
      const declaredCount = affectedTrades.filter(a => a.context.isDeclaredMartingale).length;
      if (declaredCount > 0) {
        ev.addDeclared(`Bạn đã tự ghi nhận hành vi "Gấp thếp" (Martingale) ở ${declaredCount} lệnh.`);
      }
      
      const riskViolatedCount = affectedTrades.filter(a => a.context.riskPlanViolated).length;
      if (riskViolatedCount > 0) {
        ev.addContext(`Bối cảnh: Có ${riskViolatedCount} lần hành vi gấp thếp này đi kèm với việc phá vỡ nguyên tắc quản lý rủi ro (Risk Plan Violated).`);
      }
    }

    return ev;
  }
  
  calculateConfidence(affectedTrades, evidence) {
    let maxConfidence = 0;

    affectedTrades.forEach(a => {
      const { isFailedMartingale, isLossAmplified, riskPlanViolated, isDeclaredMartingale } = a.context;
      
      let conf = 0.88; // Pure observed pattern
      
      if (isDeclaredMartingale) {
        conf = 0.98;
      } else if (isFailedMartingale && isLossAmplified) {
        conf = 0.97;
      } else if (isFailedMartingale && riskPlanViolated) {
        conf = 0.96;
      } else if (isFailedMartingale) {
        conf = 0.95;
      } else if (riskPlanViolated) {
        conf = 0.93;
      } else {
        conf = 0.88; // Pure observed WIN
      }

      if (conf > maxConfidence) {
        maxConfidence = conf;
      }
    });

    return maxConfidence;
  }
}

export default new MartingaleBehavior();
