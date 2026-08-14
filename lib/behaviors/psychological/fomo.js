import { BehaviorBase } from '../BehaviorBase';
import { buildEvidence } from '../evidenceBuilder';
import { TAGS } from '../tags';
import { median } from '../helpers';

class FomoBehavior extends BehaviorBase {
  constructor() {
    super();
    this.id = 'fomo';
    this.nameKey = 'bhFomo';
    this.category = 'psychological';
    this.severity = 8.5;
    this.relatedBehaviors = ['counter_trend', 'risk_plan_violated', 'early_entry'];
  }

  detect(trades, config) {
    const affected = [];
    const sorted = [...trades].sort((a, b) => new Date(a.trade_time) - new Date(b.trade_time));
    
    // Calculate user's median re-entry interval
    const intervals = [];
    for (let i = 1; i < sorted.length; i++) {
       const prev = sorted[i - 1];
       const curr = sorted[i];
       if (prev.exit_time) {
          const diffMins = (new Date(curr.trade_time) - new Date(prev.exit_time)) / 60000;
          if (diffMins > 0 && diffMins < 60 * 24) { // ignore > 1 day gaps for baseline
             intervals.push(diffMins);
          }
       }
    }
    const medianInterval = median(intervals) || 60; // fallback 60m

    sorted.forEach((t, i) => {
      let score = 0;
      const tradeEvidence = { declared: [], observed: [], derived: [] };
      let classification = null;

      const emotions = t.emotions ? t.emotions.toLowerCase() : '';
      const mistakes = t.mistakes ? t.mistakes.toLowerCase() : '';
      const notes = t.user_notes ? t.user_notes.toLowerCase() : '';
      const exec = t.execution_quality ? t.execution_quality.toLowerCase() : '';

      // 1. Explicit FOMO Declaration (+100)
      let declaredFomo = false;
      if (emotions.includes(TAGS.EMOTION_FOMO.toLowerCase()) || mistakes.includes(TAGS.MISTAKE_FOMO.toLowerCase())) {
        declaredFomo = true;
      } else if (notes.includes('fomo') || notes.includes('sợ lỡ') || notes.includes('chạy mất')) {
        declaredFomo = true;
      }
      
      if (declaredFomo) {
        score += 100;
        tradeEvidence.declared.push('Tự khai báo mắc tâm lý FOMO.');
      }

      // 2. Early Entry / Chasing (+35)
      let earlyEntry = false;
      if (mistakes.includes(TAGS.MISTAKE_EARLY_ENTRY.toLowerCase()) || 
          exec.includes(TAGS.EXEC_FOMO.toLowerCase()) || 
          exec.includes(TAGS.EXEC_CHASING.toLowerCase()) ||
          notes.includes('vào vội') || notes.includes('đuổi giá')) {
        earlyEntry = true;
        score += 35;
        tradeEvidence.observed.push('Vào lệnh sớm hoặc đuổi theo giá.');
      }

      // 3. Rapid Re-entry (+20) & Post-loss (+25)
      let rapidReentry = false;
      let postLoss = false;
      if (i > 0) {
        const prev = sorted[i - 1];
        if (prev.exit_time) {
           const diffMins = (new Date(t.trade_time) - new Date(prev.exit_time)) / 60000;
           if (diffMins > 0) {
              // Rapid if < 15m AND < median (prevent scalper false positive)
              // Or extremely rapid (< 30% of their normal pace)
              if ((diffMins < 15 && medianInterval > 20) || (diffMins < medianInterval * 0.3)) {
                 rapidReentry = true;
                 score += 20;
                 tradeEvidence.observed.push(`Vào lệnh lại quá vội vàng (${Math.round(diffMins)} phút, bình thường: ${Math.round(medianInterval)} phút).`);
                 
                 if (prev.status === 'LOSS') {
                    postLoss = true;
                    score += 25;
                    tradeEvidence.derived.push('Vào lệnh bốc đồng ngay sau một lệnh thua lỗ.');
                 }
              }
           }
        }
      }

      // 4. Inverted RR (+5)
      let invertedRR = false;
      const entry = parseFloat(t.entry_price);
      const tp = parseFloat(t.take_profit);
      const sl = parseFloat(t.stop_loss);
      if (entry && tp && sl && entry !== sl && entry !== tp) {
        const risk = Math.abs(entry - sl);
        const reward = Math.abs(tp - entry);
        if (risk > 0 && reward / risk < 1.0) {
          invertedRR = true;
          score += 5;
        }
      }

      // 5. Counter Trend (+10)
      let counterTrend = false;
      if ((t.market_trend === TAGS.TREND_BEARISH && t.side === 'BUY') || 
          (t.market_trend === TAGS.TREND_BULLISH && t.side === 'SELL')) {
         counterTrend = true;
         score += 10;
      }

      // 6. Manual Exit (+5)
      let manualExit = false;
      if (t.exit_reason && t.exit_reason.includes(TAGS.MGMT_MANUAL_EXIT)) {
         manualExit = true;
         score += 5;
      }
      
      // Determine Classification
      let independentEvidenceCount = 0;
      if (earlyEntry) independentEvidenceCount++;
      if (rapidReentry) independentEvidenceCount++;
      if (invertedRR || counterTrend || manualExit) independentEvidenceCount++;
      
      if (declaredFomo) {
          classification = 'confirmed';
      } else if (independentEvidenceCount >= 2 && score >= 50) {
          classification = 'strong_inference';
      } else if (score >= 30) {
          classification = 'possible_signal';
      }
      
      // Only flag Confirmed and Strong Inference
      if (classification === 'confirmed' || classification === 'strong_inference') {
          if (!declaredFomo) {
              if (invertedRR) tradeEvidence.derived.push('R:R đảo ngược (Reward < Risk).');
              if (counterTrend) tradeEvidence.derived.push('Đánh ngược xu hướng chính.');
          }
          
          affected.push({
            trade: t,
            context: {
               classification,
               score,
               earlyEntry,
               rapidReentry,
               postLoss,
               invertedRR
            }
          });
      }
    });

    return affected;
  }
  
  buildEvidence(affectedTrades) {
    const ev = buildEvidence();
    if (affectedTrades.length === 0) return ev;
    
    const confirmedCount = affectedTrades.filter(a => a.context.classification === 'confirmed').length;
    const inferredCount = affectedTrades.filter(a => a.context.classification === 'strong_inference').length;

    // Declared
    if (confirmedCount > 0) {
      ev.addDeclared(`Có ${confirmedCount} lệnh được xếp loại "Confirmed FOMO" do bạn tự khai báo hoặc ghi chú rõ ràng.`);
    }

    // Observed
    const earlyCount = affectedTrades.filter(a => a.context.earlyEntry).length;
    if (earlyCount > 0) {
      ev.addObserved(`Có ${earlyCount} lệnh có hành vi vào sớm (Early Entry) hoặc đuổi theo giá (Chasing).`);
    }
    
    const rapidCount = affectedTrades.filter(a => a.context.rapidReentry).length;
    if (rapidCount > 0) {
      ev.addObserved(`Có ${rapidCount} lệnh được vào vội vàng (Rapid Re-entry) nhanh hơn nhiều so với nhịp giao dịch trung bình của bạn.`);
    }

    // Derived
    if (inferredCount > 0) {
      ev.addDerived(`Có ${inferredCount} lệnh không được khai báo nhưng hệ thống xếp loại "Strong Inference FOMO" do hội tụ từ 2 bằng chứng độc lập trở lên.`);
    }
    
    const postLossCount = affectedTrades.filter(a => a.context.postLoss).length;
    if (postLossCount > 0) {
      ev.addDerived(`Trong đó, ${postLossCount} lệnh FOMO xảy ra ngay sau một lệnh thua lỗ (dấu hiệu của Post-loss Impulse).`);
    }

    return ev;
  }

  calculateConfidence(affectedTrades, evidence) {
    // Override confidence to reflect the new scoring accuracy
    const confirmedCount = affectedTrades.filter(a => a.context.classification === 'confirmed').length;
    const inferredCount = affectedTrades.filter(a => a.context.classification === 'strong_inference').length;
    
    const total = affectedTrades.length;
    if (total === 0) return 0;
    
    // Confirmed trades give 98% confidence. Inferred gives ~80%. We do a weighted average.
    const weightedConf = ((confirmedCount * 0.98) + (inferredCount * 0.82)) / total;
    
    // Sample size penalty if very few trades
    const n = total;
    const sampleMultiplier = Math.min(1.0, 0.5 + Math.log(n + 1) / Math.log(20) * 0.5);
    
    return Math.min(0.98, weightedConf * sampleMultiplier);
  }
}

export default new FomoBehavior();
