import { BehaviorBase } from '../BehaviorBase';
import { TAGS } from '../tags';
import { buildEvidence } from '../evidenceBuilder';

function getTrendDirection(trendText) {
    if (!trendText) return 'UNKNOWN';
    const t = trendText.toLowerCase();
    if (t.includes('bullish') || t.includes('up') || t.includes('tăng')) return 'UP';
    if (t.includes('bearish') || t.includes('down') || t.includes('giảm')) return 'DOWN';
    if (t.includes('sideway') || t.includes('range') || t.includes('đi ngang')) return 'RANGE';
    return 'UNKNOWN';
}

function hasMeaningfulText(text) {
    if (!text || typeof text !== 'string') return false;
    const clean = text.trim();
    if (clean.length < 3) return false;
    if (clean.toLowerCase() === 'none' || clean.toLowerCase() === 'null') return false;
    return true;
}

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
      // 1. Safe parsing of mistakes
      let mistakes = [];
      if (Array.isArray(t.mistakes)) {
          mistakes = t.mistakes;
      } else if (typeof t.mistakes === 'string') {
          try {
              mistakes = JSON.parse(t.mistakes);
              if (!Array.isArray(mistakes)) mistakes = [];
          } catch (e) {
              mistakes = [t.mistakes];
          }
      }

      // 2. MTF Trend Analysis
      const ltfTrend = getTrendDirection(t.market_trend);
      const htfTrend = getTrendDirection(t.htf_context);
      
      let explicitDeclaration = mistakes.includes(TAGS.MISTAKE_COUNTER_TREND) || t.market_trend === TAGS.TREND_COUNTER;
      let derivedExposure = false;
      let isProHtf = false;

      if (t.side) {
          const isBuying = t.side === 'BUY';
          const isSelling = t.side === 'SELL';
          
          // Check LTF opposition
          const opposesLtf = (isBuying && ltfTrend === 'DOWN') || (isSelling && ltfTrend === 'UP');
          
          // Check HTF alignment
          const alignsWithHtf = (isBuying && htfTrend === 'UP') || (isSelling && htfTrend === 'DOWN');
          const opposesHtf = (isBuying && htfTrend === 'DOWN') || (isSelling && htfTrend === 'UP');

          if (htfTrend !== 'UNKNOWN') {
              if (opposesHtf) {
                  derivedExposure = true; // HTF is king, opposing it is counter-trend exposure
              } else if (alignsWithHtf) {
                  isProHtf = true;
                  derivedExposure = false; // Even if opposes LTF, it's pro HTF, so NOT counter-trend
              }
          } else if (ltfTrend !== 'UNKNOWN') {
              // No HTF context, rely on LTF
              if (opposesLtf) {
                  derivedExposure = true;
              }
          }
      }

      if (!explicitDeclaration && !derivedExposure) return;

      // 3. POI & Confluences Checking (Blind counter trend)
      const hasPoi = hasMeaningfulText(t.poi);
      const hasConfluences = hasMeaningfulText(t.confluences) || (Array.isArray(t.confluences) && t.confluences.length > 0);
      const isBlindCounterTrend = !hasPoi && !hasConfluences;

      // 4. Determine if it's a Violation
      const hasBadExecution = t.execution_quality === TAGS.EXEC_FOMO || t.execution_quality === TAGS.EXEC_CHASING;
      const hasBadGrade = t.setup_grade === TAGS.GRADE_C || t.setup_grade === TAGS.GRADE_C_TAG || t.setup_grade === 'D' || t.setup_grade === 'C';
      const isLoss = t.status === 'LOSS';
      
      const hasDamageOrBadSetup = isLoss || hasBadExecution || hasBadGrade;
      
      let classification = 'UNKNOWN';
      if (explicitDeclaration) {
          classification = 'EXPLICIT_VIOLATION';
      } else if (derivedExposure) {
          if (isBlindCounterTrend) {
              classification = 'CONFIRMED_VIOLATION'; // Blind counter trend is always a violation
          } else if (hasDamageOrBadSetup) {
              classification = 'CONFIRMED_VIOLATION'; // Failed or bad execution
          } else {
              classification = 'EXPOSURE_ONLY'; // Valid counter-trend with POI and good setup/outcome
          }
      }

      if (classification !== 'UNKNOWN') {
          affected.push({
             tradeId: t.id,
             trade: t,
             classification,
             signals: {
                explicitDeclaration,
                derivedExposure,
                hasDamageOrBadSetup,
                isBlindCounterTrend,
                isProHtf
             },
             metrics: {
                ltfTrend,
                htfTrend,
                marketTrend: t.market_trend || 'Unknown',
                side: t.side,
                status: t.status,
                setupGrade: t.setup_grade || 'N/A',
                hasPoi,
                hasConfluences
             }
          });
      }
    });

    return affected;
  }
  
  buildEvidence(affectedTrades) {
    const ev = buildEvidence();
    
    let totalExposure = 0;
    let exposureWins = 0;

    affectedTrades.forEach(a => {
        const { tradeId, classification, signals, metrics } = a;
        totalExposure++;
        if (metrics.status === 'WIN') exposureWins++;
        
        let msg = `Trade #${tradeId}: Khung LTF = ${metrics.ltfTrend}, Khung HTF = ${metrics.htfTrend}, Side = ${metrics.side}, Result = ${metrics.status}. `;
        
        if (classification === 'EXPLICIT_VIOLATION') {
            msg += `-> Vi phạm: Trader tự khai báo đánh cản tàu (ngược xu hướng).`;
            ev.addDeclared(msg);
        } else if (classification === 'CONFIRMED_VIOLATION') {
            if (signals.isBlindCounterTrend) {
                msg += `-> Vi phạm: Đánh ngược xu hướng MÙ QUÁNG, không có điểm tựa POI hay hội tụ nào. Lệnh này quá rủi ro (đánh cờ bạc).`;
            } else {
                msg += `-> Vi phạm: Đánh ngược xu hướng và dẫn đến kết quả tồi tệ (Lỗ/Setup kém).`;
            }
            ev.addObserved(msg);
        } else if (classification === 'EXPOSURE_ONLY') {
            msg += `-> Exposure: Có đánh ngược xu hướng nhưng thiết lập có cơ sở (Có POI/Hội tụ) và chiến thắng. BRS không ghi nhận là Lỗi.`;
            ev.addContext(msg);
        }
    });
    
    // Win-rate context
    if (totalExposure > 0) {
        const winRate = ((exposureWins / totalExposure) * 100).toFixed(0);
        let statMsg = `[STAT] Thống kê tỷ lệ đánh ngược xu hướng (Counter-Trend) của Trader: ${winRate}% thắng (${exposureWins}/${totalExposure} lệnh). `;
        if (winRate < 40) {
            statMsg += `Hiệu suất rất tệ, Trader không có kỹ năng bắt đỉnh đáy, cần chấm dứt ngay thói quen cản tàu.`;
        } else if (winRate > 60) {
            statMsg += `Hiệu suất tốt, Trader có khả năng đánh Reversal/Pullback khá sắc bén.`;
        } else {
            statMsg += `Hiệu suất trung bình.`;
        }
        ev.addContext(statMsg);
    }

    return ev;
  }
  
  calculateConfidence(affectedTrades, evidence) {
    const violationTrades = affectedTrades.filter(a => a.classification !== 'EXPOSURE_ONLY');
    const n = violationTrades.length;

    if (n === 0) {
      return 0; // Don't trigger behavior if there are no violations
    }

    const sampleScore = Math.min(
        0.92,
        0.40 + (Math.log(n + 1) / Math.log(20)) * 0.50
    );

    const declaredBoost = evidence.declared.length > 0 ? 0.10 : 0;

    return Math.min(0.98, sampleScore + declaredBoost);
  }
}

export default new CounterTrendBehavior();
