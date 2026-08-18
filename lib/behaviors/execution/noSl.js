import { BehaviorBase } from '../BehaviorBase';
import { buildEvidence } from '../evidenceBuilder';
import { TAGS } from '../tags';

export function getTradeMetrics(t) {
  const size = parseFloat(t.size) || 1;
  const entry = parseFloat(t.entry_price);
  const exit = parseFloat(t.exit_price);
  const sl = parseFloat(t.stop_loss);
  const pnl = parseFloat(t.pnl);

  const realizedLossUsd = pnl < 0 ? Math.abs(pnl) : 0;
  const realizedLossPerSize = realizedLossUsd / size;

  let initialRiskUsd = null;
  let initialRiskPerSize = null;

  // Estimated initial risk based on PnL value per point (assuming linear mapping)
  if (Number.isFinite(entry) && Number.isFinite(exit) && Number.isFinite(sl) && Number.isFinite(pnl) && entry !== exit) {
     const valuePerPoint = Math.abs(pnl / (entry - exit));
     initialRiskUsd = Math.abs(entry - sl) * valuePerPoint;
     if (initialRiskUsd > 0) {
       initialRiskPerSize = initialRiskUsd / size;
     } else {
       initialRiskUsd = null;
       initialRiskPerSize = null;
     }
  }
  
  return {
    initialRiskUsd,
    initialRiskPerSize,
    realizedLossUsd,
    realizedLossPerSize
  };
}

export function extractBaselineLosses(trades) {
  const riskDistortingTags = [
    TAGS.MISTAKE_NO_SL, TAGS.MISTAKE_DCA, TAGS.MISTAKE_OVERRISK, TAGS.MISTAKE_MOVED_SL
  ];
  
  return trades
    .filter(t => {
       const sl = parseFloat(t.stop_loss);
       const pnl = parseFloat(t.pnl) || 0;
       let m = [];
       try { m = JSON.parse(t.mistakes || "[]"); } catch(e) { m = typeof t.mistakes === 'string' ? [t.mistakes] : []; }
       const hasRiskDistorting = m.some(tag => riskDistortingTags.includes(tag));
       return pnl < 0 && Number.isFinite(sl) && sl > 0 && !hasRiskDistorting;
    })
    .map(t => getTradeMetrics(t).realizedLossPerSize)
    .filter(r => r > 0)
    .sort((a, b) => a - b);
}

class NoSLBehavior extends BehaviorBase {
  constructor() {
    super();
    this.id = 'no_sl';
    this.nameKey = 'bhNoSl'; // "Không đặt Stop Loss"
    this.category = 'risk';
    this.severity = 8.0; 
    
    this.indicators = ['risk_plan_violated', 'mental_stop_failure'];
  }

  detect(trades, config) {
    const affected = [];
    const maxLossRatio = config.falsePositives?.MENTAL_STOP_MAX_LOSS_RATIO || 1.2;

    // Apples-to-apples comparison: Use realized loss for mental stop checking
    const disciplinedRealizedLosses = extractBaselineLosses(trades);

    const medianRealizedLossPerSizeBaseline = disciplinedRealizedLosses.length > 0 
      ? disciplinedRealizedLosses[Math.floor(disciplinedRealizedLosses.length / 2)] 
      : null;

    trades.forEach(t => {
      const sl = parseFloat(t.stop_loss);
      const metrics = getTradeMetrics(t);
      const isLoss = metrics.realizedLossUsd > 0;
      
      const hasNoSl = !Number.isFinite(sl) || sl <= 0;
      
      let mistakes = [];
      try { mistakes = t.mistakes ? JSON.parse(t.mistakes) : []; } catch (e) { mistakes = typeof t.mistakes === 'string' ? [t.mistakes] : []; }
      const isDeclared = mistakes.includes(TAGS.MISTAKE_NO_SL) || mistakes.includes('#Mistake_NoSl');
      
      if (!hasNoSl) return; 

      let lossVsBaseline = null;
      if (isLoss && medianRealizedLossPerSizeBaseline !== null && medianRealizedLossPerSizeBaseline > 0) {
         lossVsBaseline = metrics.realizedLossPerSize / medianRealizedLossPerSizeBaseline;
      }

      const userNotes = (t.user_notes || '').toLowerCase();
      const declaredMentalStop = userNotes.includes('mental stop') || userNotes.includes('mental sl');
      
      let mentalStopFailure = false;
      if (declaredMentalStop && isLoss && lossVsBaseline !== null && lossVsBaseline > maxLossRatio) {
         mentalStopFailure = true; 
      }

      const hasRiskViolated = t.risk_plan === 'Violated' || t.risk_plan === TAGS.RISK_VIOLATED;
      
      let emotions = [];
      try { emotions = t.emotions ? JSON.parse(t.emotions) : []; } catch(e) {}
      
      affected.push({
        trade: t,
        context: {
          hasNoSl,
          isDeclared,
          declaredMentalStop,
          mentalStopFailure,
          lossVsBaseline,
          hasRiskViolated,
          emotions,
          metrics
        }
      });
    });

    return affected;
  }

  analyze(trades, config) {
    const affected = this.detect(trades, config);
    if (!affected || affected.length === 0) return null;

    const losingNoSl = affected
        .filter(a => a.context.metrics.realizedLossUsd > 0)
        .map(a => a.context.metrics.realizedLossPerSize);
        
    const losingYesSl = extractBaselineLosses(trades);

    losingNoSl.sort((a, b) => a - b);
    
    const medLossNoSl = losingNoSl.length > 0 ? losingNoSl[Math.floor(losingNoSl.length / 2)] : 0;
    const medLossYesSl = losingYesSl.length > 0 ? losingYesSl[Math.floor(losingYesSl.length / 2)] : 0;

    const maxLossNoSl = losingNoSl.length > 0 ? losingNoSl[losingNoSl.length - 1] : 0;
    const p90Idx = Math.floor((losingNoSl.length - 1) * 0.9);
    const p90LossNoSl = losingNoSl.length > 0 && p90Idx >= 0 ? losingNoSl[p90Idx] : 0;
    const maxLossYesSl = losingYesSl.length > 0 ? losingYesSl[losingYesSl.length - 1] : 0;

    const mentalStopFailures = affected.filter(a => a.context.mentalStopFailure).length;
    const MIN_TAIL_SAMPLE = config.thresholds?.MIN_TAIL_SAMPLE || 10;
    const minBaselineTrades = config.thresholds?.MIN_BASELINE_TRADES || 10;
    const baselineLossCount = losingYesSl.length;
    const hasReliableBaseline = baselineLossCount >= minBaselineTrades;

    let classification = 'NO_OBSERVED_DAMAGE';
    if (losingNoSl.length > 0) {
      classification = 'NO_SL_HARMFUL'; // Default if there are losses
      if (mentalStopFailures > 0) {
        classification = 'MENTAL_STOP_FAILURE';
      } else if (hasReliableBaseline && losingNoSl.length >= MIN_TAIL_SAMPLE && p90LossNoSl > medLossYesSl * 2.5 && medLossYesSl > 0) {
        classification = 'NO_SL_TAIL_RISK';
      } else if (hasReliableBaseline && medLossNoSl > medLossYesSl * 1.5 && medLossYesSl > 0) {
        classification = 'NO_SL_HARMFUL';
      }
    }
    
    let severity = this.severity; 
    
    if (classification === 'NO_OBSERVED_DAMAGE') {
      severity = 4.0;
    } else {
      if (classification === 'MENTAL_STOP_FAILURE') {
        const failureRatio = mentalStopFailures / affected.length;
        severity = Math.min(9.8, 8.5 + (failureRatio * 1.0)); 
      } else if (classification === 'NO_SL_TAIL_RISK') {
        severity = 9.2;
      } else if (classification === 'NO_SL_HARMFUL') {
        severity = 8.5;
      }
    }

    const confidence = this.calculateConfidence(affected, medLossNoSl, medLossYesSl, hasReliableBaseline);
    const impact = this.calculateImpact(affected.map(a => a.trade), trades);

    let coaching = '';
    if (classification === 'MENTAL_STOP_FAILURE') {
      coaching = `Dữ liệu không ủng hộ việc "Mental Stop" đang được thực hiện như một Stop Loss thực sự: Có ${mentalStopFailures} lệnh vượt quá ngưỡng rủi ro cơ sở (${config.falsePositives?.MENTAL_STOP_MAX_LOSS_RATIO || 1.2}x Median Loss).`;
    } else if (classification === 'NO_SL_TAIL_RISK') {
      coaching = `Hành vi thả rông Stoploss đang tạo ra Tail Risk (rủi ro đuôi): Mức lỗ P90 của bạn chạm $${p90LossNoSl.toFixed(2)} (quy đổi 1 lot), vượt xa mức cho phép của kỷ luật.`;
    } else if (classification === 'NO_SL_HARMFUL') {
      coaching = `Hành vi không đặt Stoploss đang làm mất lợi thế (Edge): Lệnh lỗ không SL có trung vị thiệt hại $${medLossNoSl.toFixed(2)} (quy đổi 1 lot), cao gấp ${(medLossNoSl / medLossYesSl).toFixed(1)} lần so với các lệnh tuân thủ kỷ luật ($${medLossYesSl.toFixed(2)}).`;
    } else {
      coaching = "Dù các lệnh không Stoploss hiện tại chưa gây thiệt hại (chưa dính bão lớn), đây vẫn là lỗ hổng quản trị rủi ro tiềm ẩn nguy cơ cháy tài khoản khi gặp Tail Risk (thiên nga đen).";
    }

    return {
      id: this.id,
      nameKey: this.nameKey,
      category: this.category,
      severity,
      occurrences: affected.length,
      affectedTradeIds: affected.map(a => a.trade.id),
      confidence,
      impact,
      evidence: this.buildEvidence(affected, medLossNoSl, medLossYesSl, maxLossNoSl, maxLossYesSl, mentalStopFailures, classification, config).toObject(),
      classification,
      coaching
    };
  }
  
  buildEvidence(affectedTrades, medLossNoSl, medLossYesSl, maxLossNoSl, maxLossYesSl, mentalStopFailures, classification, config) {
    const ev = buildEvidence();
    
    const observedCount = affectedTrades.length; 
    const declaredCount = affectedTrades.filter(a => a.context.isDeclared).length;
    const contradictionCount = observedCount - declaredCount;

    if (declaredCount > 0 && contradictionCount > 0) {
      ev.addObserved(`Có ${observedCount} lệnh thực tế không SL, nhưng bạn chỉ tự nhận lỗi (tag #Mistake_NoSl) ở ${declaredCount} lệnh. Bỏ sót ${contradictionCount} lệnh.`);
    } else if (declaredCount > 0 && contradictionCount === 0) {
      ev.addObserved(`Có ${observedCount} lệnh thực tế không SL. Bạn đã nhận thức và tự tag đúng 100% các lệnh này.`);
    } else {
      ev.addObserved(`Hệ thống ghi nhận ${observedCount} lệnh thực thi hoàn toàn không có dữ liệu Stop Loss.`);
    }

    if (mentalStopFailures > 0) {
      ev.addObserved(`Kiểm chứng Mental Stop: ${mentalStopFailures} lệnh được ghi chú Mental Stop nhưng thực tế gồng lỗ vượt mốc rủi ro cho phép.`);
    }
    
    if (classification === 'NO_SL_TAIL_RISK' && maxLossYesSl > 0) {
      ev.addContext(`Rủi ro đuôi (Tail Risk): Khoản lỗ max (quy đổi 1 lot) khi không SL là $${maxLossNoSl.toFixed(2)}, nguy hiểm hơn mức max $${maxLossYesSl.toFixed(2)} của lệnh kỷ luật.`);
    } else if (medLossNoSl > medLossYesSl && medLossYesSl > 0) {
      ev.addContext(`Chênh lệch thiệt hại: Trung vị thiệt hại (quy đổi 1 lot) của lệnh kỷ luật là $${medLossYesSl.toFixed(2)}, trong khi lệnh không SL mất tới $${medLossNoSl.toFixed(2)}.`);
    }

    const allEmotions = affectedTrades.flatMap(a => a.context.emotions);
    if (allEmotions.length >= 3) {
      const hopeCount = allEmotions.filter(e => e.includes('Hope')).length;
      const fearCount = allEmotions.filter(e => e.includes('Fear')).length;
      if (hopeCount > 0 || fearCount > 0) {
         ev.addContext(`Sự đồng xuất hiện (Co-occurrence): Trạng thái không SL thường xuất hiện cùng lúc với cảm xúc ${[hopeCount > 0 ? '#Hope' : '', fearCount > 0 ? '#Fear' : ''].filter(Boolean).join(', ')}.`);
      }
    }

    return ev;
  }
  
  calculateConfidence(affectedTrades, medLossNoSl, medLossYesSl, hasReliableBaseline) {
    const declaredCount = affectedTrades.filter(a => a.context.isDeclared).length;
    const observedCount = affectedTrades.length;
    const isStatisticallyProven = hasReliableBaseline && (medLossNoSl > medLossYesSl * 1.5) && medLossYesSl > 0;
    
    let baseConfidence = 0.85;

    if (isStatisticallyProven) {
        baseConfidence = 0.90;
    } else if (!hasReliableBaseline) {
        baseConfidence = 0.70;
    }

    // Partial/Full corroboration bump
    if (declaredCount > 0 && observedCount > 0) {
        if (declaredCount === observedCount) {
            baseConfidence += 0.03; // Full corroboration
        } else {
            baseConfidence += 0.01; // Partial corroboration
        }
    }
    
    return Math.min(0.99, baseConfidence);
  }

  run(trades, config) {
    return this.analyze(trades, config);
  }
}

export default new NoSLBehavior();
