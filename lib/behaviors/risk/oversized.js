import { BehaviorBase } from '../BehaviorBase';
import { median, percentile } from '../helpers';
import { buildEvidence } from '../evidenceBuilder';
import { TAGS } from '../tags';
import { computeRMultiple } from '../../engine/statsEngine';

class OversizedBehavior extends BehaviorBase {
  constructor() {
    super();
    this.id = 'oversized';
    this.nameKey = 'Risk Oversizing'; // Renamed to reflect Risk
    this.category = 'risk';
    this.severity = 8.0; // Increased severity as this is now risk-adjusted
    this.relatedBehaviors = ['revenge_trading', 'risk_plan_violated'];
  }

  detect(trades, config) {
    const affected = [];

    // 1. Group sizes and risks by asset
    const statsByAsset = {};
    trades.forEach(t => {
      const sz = parseFloat(t.size || 0);
      const asset = t.asset || 'UNKNOWN';
      
      const sl = parseFloat(t.stop_loss) || 0;
      const entry = parseFloat(t.entry_price) || 0;
      let riskInDollar = 0;
      if (sl > 0 && entry > 0 && sz > 0) {
        riskInDollar = Math.abs(entry - sl) * sz;
      }

      if (sz > 0) {
        if (!statsByAsset[asset]) statsByAsset[asset] = { sizes: [], risks: [] };
        statsByAsset[asset].sizes.push(sz);
        if (riskInDollar > 0) statsByAsset[asset].risks.push(riskInDollar);
      }
    });

    // 2. Calculate Robust Baseline (P50, P90) per asset via Trimmed Sample
    const baselineByAsset = {};
    Object.keys(statsByAsset).forEach(asset => {
      const { sizes, risks } = statsByAsset[asset];
      if (sizes.length >= 5) {
        // Step A: Calculate raw median to identify gross outliers
        const rawMedSize = median(sizes);
        
        // Step B: Trim outliers (> 2x median) to prevent baseline contamination
        const trimmedSizes = sizes.filter(s => s <= rawMedSize * 2);
        
        // Step C: Calculate true robust baseline
        // If trimming removed everything (unlikely), fallback to raw
        const validSizes = trimmedSizes.length >= 3 ? trimmedSizes : sizes;
        const medSize = median(validSizes);
        const p90Size = percentile(validSizes, 0.90);
        
        let medRisk = 0;
        let p90Risk = 0;
        if (risks.length >= 5) {
            const rawMedRisk = median(risks);
            const trimmedRisks = risks.filter(r => r <= rawMedRisk * 2);
            const validRisks = trimmedRisks.length >= 3 ? trimmedRisks : risks;
            medRisk = median(validRisks);
            p90Risk = percentile(validRisks, 0.90);
        }

        baselineByAsset[asset] = { 
            medSize, p90Size, 
            medRisk, p90Risk 
        };
      }
    });

    // 3. Detect anomalies
    trades.forEach(t => {
      const sz = parseFloat(t.size || 0);
      const asset = t.asset || 'UNKNOWN';
      const sl = parseFloat(t.stop_loss) || 0;
      const entry = parseFloat(t.entry_price) || 0;
      let riskInDollar = 0;
      if (sl > 0 && entry > 0 && sz > 0) {
        riskInDollar = Math.abs(entry - sl) * sz;
      }

      const declaredRiskViolation = t.risk_plan && t.risk_plan.includes(TAGS.RISK_VIOLATED);
      const mistakeOversize = t.mistakes && t.mistakes.includes(TAGS.MISTAKE_OVERRISK);
      const declared = declaredRiskViolation || mistakeOversize;

      let isStatisticalAnomaly = false;
      let anomalyType = null;
      const baseline = baselineByAsset[asset];

      if (baseline && sz > baseline.p90Size) {
         if (baseline.medRisk > 0 && riskInDollar > 0) {
             // Risk must actually increase significantly (> 1.2x median risk)
             if (riskInDollar >= baseline.medRisk * 1.2) {
                 isStatisticalAnomaly = true;
                 anomalyType = 'risk_oversizing';
             }
         } else if (sz >= baseline.medSize * 1.5) {
             // Fallback: If no SL data, check if size is at least 1.5x median
             isStatisticalAnomaly = true;
             anomalyType = 'sizing_anomaly';
         }
      }

      if (isStatisticalAnomaly || declared) {
        affected.push({
          trade: t,
          context: {
            asset,
            sz,
            riskInDollar,
            baseline,
            isStatisticalAnomaly,
            anomalyType,
            declaredRiskViolation,
            mistakeOversize
          }
        });
      }
    });

    return affected;
  }

  analyze(trades, config) {
    const affected = this.detect(trades, config);
    if (!affected || affected.length === 0) return null;

    // Separate Statistical Anomalies from Declared Only
    const statisticalAnomalies = affected.filter(a => a.context.isStatisticalAnomaly);

    if (statisticalAnomalies.length === 0) {
      return {
        id: this.id,
        nameKey: this.nameKey,
        category: this.category,
        severity: 5.0, // Lower severity for purely self-declared without stats
        occurrences: affected.length,
        affectedTradeIds: affected.map(a => a.trade.id),
        confidence: 0.95,
        impact: this.calculateImpact(affected.map(a => a.trade), trades),
        evidence: this.buildEvidence(affected, 'declared_violation', {}),
        classification: 'declared_violation',
        metrics: { topAssetStats: null, totalAnomalyCount: 0, assetStats: {} }
      };
    }

    // Group statistical anomalies by asset for Edge Analysis
    const anomaliesByAsset = {};
    const normalsByAsset = {};
    const anomalyTradeIds = new Set(statisticalAnomalies.map(a => a.trade.id));

    trades.forEach(t => {
      const asset = t.asset || 'UNKNOWN';
      if (anomalyTradeIds.has(t.id)) {
        if (!anomaliesByAsset[asset]) anomaliesByAsset[asset] = [];
        anomaliesByAsset[asset].push(t);
      } else {
        const sz = parseFloat(t.size || 0);
        if (sz > 0) {
          if (!normalsByAsset[asset]) normalsByAsset[asset] = [];
          normalsByAsset[asset].push(t);
        }
      }
    });

    let totalAnomalyCount = 0;
    let totalNormalCount = 0;
    const assetStats = {};
    const classWeights = { harmful: 0, effective: 0, underperforming: 0, neutral: 0 };

    Object.keys(anomaliesByAsset).forEach(asset => {
      const anomalyTrs = anomaliesByAsset[asset];
      const normalTrs = normalsByAsset[asset] || [];

      if (normalTrs.length === 0) {
        assetStats[asset] = {
          asset,
          anomalyCount: anomalyTrs.length,
          normalCount: 0,
          assetClass: 'insufficient_baseline'
        };
        return;
      }

      // 1. Calculate R-Multiple for all trades (using statsEngine)
      const calcAvgR = (arr) => {
          let sumR = 0;
          let count = 0;
          arr.forEach(t => {
              const r = computeRMultiple(t); // We don't have global avgLoss here easily, so we rely on trades with SL
              if (r !== null && r !== undefined && !isNaN(r)) {
                  sumR += r;
                  count++;
              }
          });
          return count > 0 ? sumR / count : null;
      };

      let normExpR = calcAvgR(normalTrs);
      let anomExpR = calcAvgR(anomalyTrs);

      // Fallback to PnL if R-Multiple cannot be calculated (e.g. no Stop Losses used)
      let usedMetric = 'R';
      if (normExpR === null || anomExpR === null) {
          const calcExpPnL = (arr) => arr.reduce((sum, t) => sum + (parseFloat(t.pnl) || 0), 0) / arr.length;
          normExpR = calcExpPnL(normalTrs);
          anomExpR = calcExpPnL(anomalyTrs);
          usedMetric = '$';
      }

      const delta = anomExpR - normExpR;

      // Classify based on R-Multiple (or PnL if fallback)
      let assetClass = this.classifyEdge(normExpR, anomExpR);

      classWeights[assetClass] += anomalyTrs.length;
      totalAnomalyCount += anomalyTrs.length;
      totalNormalCount += normalTrs.length;

      const largestSize = Math.max(...anomalyTrs.map(t => parseFloat(t.size || 0)));
      const worstLoss = Math.min(...anomalyTrs.map(t => parseFloat(t.pnl || 0)));

      assetStats[asset] = {
        asset,
        normalCount: normalTrs.length,
        anomalyCount: anomalyTrs.length,
        normExp: normExpR,
        anomExp: anomExpR,
        usedMetric,
        delta,
        assetClass,
        baseline: statisticalAnomalies.find(a => a.context.asset === asset)?.context.baseline,
        largestSize,
        worstLoss
      };
    });

    // Global Classification without majority-vote suppression
    let classification = 'inconclusive';
    if (totalAnomalyCount >= 3) {
      if (classWeights['harmful'] > 0 && classWeights['effective'] > 0) {
          classification = 'mixed';
      } else if (classWeights['harmful'] > 0 && classWeights['underperforming'] > 0) {
          classification = 'harmful'; // Group negative patterns
      } else {
          // Sort by weight
          const sorted = Object.entries(classWeights).sort((a, b) => b[1] - a[1]);
          classification = sorted[0][0];
          if (classWeights[classification] === 0) classification = 'neutral';
      }
    }

    // Find Top Affected Asset
    const assets = Object.values(assetStats);
    let topAffectedAsset = null;
    let maxDeltaMagnitude = 0;
    if (assets.length > 0) {
      topAffectedAsset = assets.reduce((a, b) => a.anomalyCount > b.anomalyCount ? a : b);
      maxDeltaMagnitude = Math.max(...assets.map(a => Math.abs(a.delta || 0)));
    }

    // Confidence calculation based on BOTH normal + oversized sample sizes AND effect size
    const totalTradesForAffectedAssets = totalAnomalyCount + totalNormalCount;
    let statisticalConf = 0.5;
    
    if (totalTradesForAffectedAssets > 0) {
        const anomalyRatio = totalAnomalyCount / totalTradesForAffectedAssets;
        
        if (totalTradesForAffectedAssets < 10 || totalAnomalyCount < 3) {
            statisticalConf = 0.4; // Insufficient data
        } else {
            // Sample Size Factor (Max 0.6 weight)
            const sampleSizeFactor = Math.min(1.0, anomalyRatio * 3.0); // e.g. 33% anomaly ratio gives full weight
            
            // Effect Size Factor (Max 0.4 weight)
            // Assuming 0.5R or $50 delta is a "large" effect size
            const deltaThreshold = topAffectedAsset?.usedMetric === 'R' ? 0.5 : 50;
            const effectSizeFactor = Math.min(1.0, maxDeltaMagnitude / deltaThreshold);
            
            // Blended Confidence Formula
            const blendedScore = (sampleSizeFactor * 0.6) + (effectSizeFactor * 0.4);
            
            // Base confidence starts at 0.5, scales up to 0.95 based on blend
            statisticalConf = Math.min(0.95, 0.5 + (blendedScore * 0.45));
        }
    }

    const hasDeclared = affected.some(a => a.context.declaredRiskViolation || a.context.mistakeOversize);
    const confidence = {
      statistical: statisticalConf,
      declared: hasDeclared ? 0.95 : 0
    };

    const evidence = this.buildEvidence(affected, classification, assetStats, topAffectedAsset);
    const impact = this.calculateImpact(statisticalAnomalies.map(a => a.trade), trades);

    if (classification === 'harmful' || classification === 'underperforming' || classification === 'mixed') {
      const losingOversized = statisticalAnomalies.filter(a => (parseFloat(a.trade.pnl) || 0) < 0).map(a => a.trade);
      const totalLoss = losingOversized.reduce((sum, t) => sum + Math.abs(parseFloat(t.pnl) || 0), 0);
      impact.totalDamage = totalLoss; // Financial Damage
      
      // Inject Edge Degradation Context
      if (topAffectedAsset && topAffectedAsset.usedMetric === 'R') {
          impact.edgeDeltaR = topAffectedAsset.delta;
          impact.riskAdjustedDamage = true;
      }
    } else {
      impact.totalDamage = 0;
    }

    // Name determination: If NO assets use 'R' metric, it's just Sizing Anomaly globally.
    const hasRiskDataGlobally = assets.some(a => a.usedMetric === 'R');
    const finalNameKey = hasRiskDataGlobally ? 'Risk Oversizing' : 'Sizing Anomaly';

    return {
      id: this.id,
      nameKey: finalNameKey,
      category: this.category,
      severity: (classification === 'harmful' || classification === 'underperforming') ? this.severity : 0,
      occurrences: affected.length,
      affectedTradeIds: affected.map(a => a.trade.id),
      confidence,
      impact,
      detection: {
        thresholdLogic: hasRiskDataGlobally ? "Size > True_P90 AND Risk > TrueRisk_Med * 1.2" : "Size > True_P90 AND Size >= True_Med * 1.5 (No SL Data)"
      },
      evidence: evidence.toObject(),
      metrics: {
        topAffectedAsset,
        totalAnomalyCount,
        assetStats
      },
      classification,
      coaching: this.generateCoaching(classification, topAffectedAsset)
    };
  }

  generateCoaching(classification, topAsset) {
    if (classification === 'declared_violation') return "WHAT THE DATA SAYS: Hệ thống ghi nhận vi phạm quy tắc rủi ro do bạn tự khai báo, nhưng chưa đủ dữ liệu thống kê để đo lường độ suy giảm Edge.";
    if (!topAsset || topAsset.assetClass === 'insufficient_baseline') return "WHAT THE DATA SAYS: Chưa đủ dữ liệu lệnh Normal làm baseline để so sánh tác động của Risk Oversizing.";

    const metric = topAsset.usedMetric === 'R' ? 'R' : '$';
    const fmt = n => (n >= 0 ? '+' : '-') + Math.abs(n).toFixed(2) + metric;
    const actionName = topAsset.usedMetric === 'R' ? 'Risk Oversize' : 'Sizing Anomaly';

    if (classification === 'harmful') {
      return `WHAT THE DATA SAYS: Khi risk/volume tăng vọt, expectancy của bạn giảm từ ${fmt(topAsset.normExp)} xuống ${fmt(topAsset.anomExp)} / trade. Đánh lớn đang trực tiếp phá hủy lợi thế (Edge) của bạn.`;
    } else if (classification === 'effective') {
      return `WHAT THE DATA SAYS: Các lệnh ${actionName} hiện có risk-adjusted expectancy cao hơn baseline (${fmt(topAsset.anomExp)} so với ${fmt(topAsset.normExp)}).`;
    } else if (classification === 'underperforming') {
      return `WHAT THE DATA SAYS: Đánh lớn vẫn có lãi tổng thể, nhưng hiệu suất trên mỗi đồng rủi ro (R-Multiple) sụt giảm từ ${fmt(topAsset.normExp)} xuống ${fmt(topAsset.anomExp)}. Bạn đang gồng rủi ro cao hơn mức cần thiết cho phần lợi nhuận thu về.`;
    } else if (classification === 'mixed') {
      return `WHAT THE DATA SAYS: Việc tăng rủi ro bất thường đang tạo ra kết quả trái chiều. Có tài sản mang lại Edge tốt, nhưng cũng có tài sản đang phá hủy lợi nhuận của bạn. Hãy rà soát lại theo từng mã.`;
    }
    return "WHAT THE DATA SAYS: Hiệu suất rủi ro không có thay đổi đáng kể so với mức bình thường.";
  }

  run(trades, config) {
    return this.analyze(trades, config);
  }

  buildEvidence(affectedTrades, classification, assetStats, topAffectedAsset) {
    const ev = buildEvidence();

    const observedTrades = affectedTrades.filter(a => a.context.isStatisticalAnomaly);
    if (observedTrades.length > 0) {
      ev.addObserved(`Phát hiện ${observedTrades.length} lệnh có độ phơi nhiễm Rủi ro/Khối lượng cao đột biến so với baseline.`);
      
      const sample = observedTrades.slice(0, 3);
      sample.forEach(a => {
        let text = `[${a.context.asset}] Size ${a.context.sz} (Ngưỡng P90: ${a.context.baseline?.p90Size?.toFixed(2) || 'N/A'})`;
        if (a.context.riskInDollar > 0) {
            text += ` - Risk: $${a.context.riskInDollar.toFixed(2)}`;
        }
        ev.addObserved(text);
      });
    }

    const mistakes = affectedTrades.filter(a => a.context.declaredRiskViolation || a.context.mistakeOversize).length;
    if (mistakes > 0) {
      ev.addDeclared(`Bạn đã tự thừa nhận lỗi "Vào vol lớn / Oversized" trong ${mistakes} lệnh.`);
    }

    if (classification === 'declared_violation') {
      ev.addContext(`Hệ thống ghi nhận sự chênh lệch rủi ro do bạn tự khai báo, nhưng chưa đủ dữ liệu thống kê để kết luận độ suy giảm Edge.`);
    } else if (topAffectedAsset && topAffectedAsset.assetClass !== 'insufficient_baseline') {
      const metric = topAffectedAsset.usedMetric === 'R' ? 'R' : '$';
      const fmt = n => (n >= 0 ? '+' : '-') + Math.abs(n).toFixed(2) + metric;
      const actionName = topAffectedAsset.usedMetric === 'R' ? 'Risk Oversize' : 'Oversize';

      ev.addContext(`Phân tích hiệu suất trên ${topAffectedAsset.asset}: Lệnh Normal đạt ${fmt(topAffectedAsset.normExp)}, nhưng lệnh ${actionName} đạt ${fmt(topAffectedAsset.anomExp)} (Edge Delta: ${fmt(topAffectedAsset.delta)}).`);
    }

    return ev;
  }
}

export default new OversizedBehavior();
