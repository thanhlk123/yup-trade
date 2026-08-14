import { BehaviorBase } from '../BehaviorBase';
import { median, percentile } from '../helpers';
import { buildEvidence } from '../evidenceBuilder';
import { TAGS } from '../tags';

class OversizedBehavior extends BehaviorBase {
  constructor() {
    super();
    this.id = 'oversized';
    this.nameKey = 'Position Sizing'; // Sizing Anomaly
    this.category = 'risk';
    this.severity = 7.0;
    this.relatedBehaviors = ['revenge_trading', 'risk_plan_violated'];
  }

  detect(trades, config) {
    const affected = [];
    
    // 1. Group sizes by asset
    const sizeByAsset = {};
    trades.forEach(t => {
      const sz = parseFloat(t.size || 0);
      const asset = t.asset || 'UNKNOWN';
      if (sz > 0) {
        if (!sizeByAsset[asset]) sizeByAsset[asset] = [];
        sizeByAsset[asset].push(sz);
      }
    });
    
    // 2. Calculate baseline (P50, P90) per asset
    const baselineByAsset = {};
    Object.keys(sizeByAsset).forEach(asset => {
      const sizes = sizeByAsset[asset];
      if (sizes.length >= 5) {
        const med = median(sizes);
        const p90 = percentile(sizes, 0.90);
        // Use P90 as the primary threshold. Median is used later as a magnitude check.
        const anomalyThreshold = p90;
        baselineByAsset[asset] = { med, p90, anomalyThreshold };
      }
    });

    // 3. Detect anomalies
    trades.forEach(t => {
      const sz = parseFloat(t.size || 0);
      const asset = t.asset || 'UNKNOWN';
      
      const declaredRiskViolation = t.risk_plan && t.risk_plan.includes(TAGS.RISK_VIOLATED);
      const mistakeOversize = t.mistakes && t.mistakes.includes(TAGS.MISTAKE_OVERRISK);
      const declared = declaredRiskViolation || mistakeOversize;
      
      let isStatisticalAnomaly = false;
      const baseline = baselineByAsset[asset];
      
      // True Anomaly: Exceeds P90 AND is at least 1.5x the Median
      if (baseline && sz > baseline.anomalyThreshold && sz >= baseline.med * 1.5) {
        isStatisticalAnomaly = true;
      }
      
      if (isStatisticalAnomaly || declared) {
        affected.push({
          trade: t,
          context: {
            asset,
            sz,
            baseline,
            isStatisticalAnomaly,
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
      // If we only have declared violations, we don't have statistical edge degradation.
      // We label it as a declared anomaly rather than 'harmful' sizing degradation.
      return {
          id: this.id,
          nameKey: this.nameKey,
          category: this.category,
          severity: 5.0, // Lower severity since it's just self-declared without statistical proof
          occurrences: affected.length,
          affectedTradeIds: affected.map(a => a.trade.id),
          confidence: 0.95, // Self-declared
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
    
    // Calculate Edge per asset and classify each asset
    let totalAnomalyCount = 0;
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
       
       const calcExp = (arr) => arr.reduce((sum, t) => sum + (parseFloat(t.pnl)||0), 0) / arr.length;
       const normExp = calcExp(normalTrs);
       const anomExp = calcExp(anomalyTrs);
       const delta = anomExp - normExp;
       
       // Standard Edge Classification from Base
       let assetClass = this.classifyEdge(normExp, anomExp);
       
       classWeights[assetClass] += anomalyTrs.length;
       totalAnomalyCount += anomalyTrs.length;
       
       const largestSize = Math.max(...anomalyTrs.map(t => parseFloat(t.size || 0)));
       const worstLoss = Math.min(...anomalyTrs.map(t => parseFloat(t.pnl || 0)));
       
       assetStats[asset] = {
           asset,
           normalCount: normalTrs.length,
           anomalyCount: anomalyTrs.length,
           normExp,
           anomExp,
           delta,
           assetClass,
           baseline: statisticalAnomalies.find(a => a.context.asset === asset)?.context.baseline,
           largestSize,
           worstLoss
       };
    });
    
    // Global Classification by majority weighted votes (with Tie-break)
    let classification = 'inconclusive';
    if (totalAnomalyCount >= 3) {
        const sorted = Object.entries(classWeights).sort((a, b) => b[1] - a[1]);
        if (sorted.length > 1 && sorted[0][1] > 0 && sorted[0][1] === sorted[1][1]) {
            classification = 'mixed';
        } else {
            classification = sorted[0][0];
            if (classWeights[classification] === 0) classification = 'neutral';
        }
    }
    
    // Find Top Affected Asset to display in evidence/UI
    const assets = Object.values(assetStats);
    let topAffectedAsset = null;
    if (assets.length > 0) {
        topAffectedAsset = assets.reduce((a, b) => a.anomalyCount > b.anomalyCount ? a : b);
    }
    
    // Confidence calculation based on sample size (Data Confidence)
    let statisticalConf = 0.5;
    if (totalAnomalyCount < 3) statisticalConf = 0.4;
    else if (totalAnomalyCount <= 9) statisticalConf = 0.6;
    else if (totalAnomalyCount <= 29) statisticalConf = 0.8;
    else statisticalConf = 0.95;

    const hasDeclared = affected.some(a => a.context.declaredRiskViolation || a.context.mistakeOversize);
    const confidence = {
        statistical: statisticalConf,
        declared: hasDeclared ? 0.95 : 0
    };
    
    const evidence = this.buildEvidence(affected, classification, assetStats, topAffectedAsset);
    const impact = this.calculateImpact(statisticalAnomalies.map(a => a.trade), trades);
    
    if (classification === 'harmful') {
       const losingOversized = statisticalAnomalies.filter(a => (parseFloat(a.trade.pnl) || 0) < 0).map(a => a.trade);
       const totalLoss = losingOversized.reduce((sum, t) => sum + Math.abs(parseFloat(t.pnl) || 0), 0);
       impact.totalDamage = totalLoss;
    } else {
       impact.totalDamage = 0;
    }

    // Return Behavior Result Contract
    return {
      id: this.id,
      nameKey: this.nameKey,
      category: this.category,
      severity: classification === 'harmful' ? this.severity : 0,
      occurrences: affected.length,
      affectedTradeIds: affected.map(a => a.trade.id),
      confidence,
      impact,
      
      // New Contract Fields
      detection: {
         thresholdLogic: "size > P90 AND size >= 1.5 * Median"
      },
      evidence: evidence.toObject(),
      metrics: {
        topAffectedAsset,
        totalAnomalyCount,
        assetStats
      },
      comparison: {
         // Placeholder for detailed comparison metrics
      },
      classification,
      coaching: this.generateCoaching(classification, topAffectedAsset)
    };
  }

  generateCoaching(classification, topAsset) {
      if (classification === 'declared_violation') return "WHAT THE DATA SAYS: Hệ thống ghi nhận vi phạm quy tắc do bạn tự khai báo, nhưng chưa đủ dữ liệu thống kê để đo lường độ suy giảm Edge.";
      if (!topAsset || topAsset.assetClass === 'insufficient_baseline') return "WHAT THE DATA SAYS: Chưa đủ dữ liệu lệnh Normal làm baseline để so sánh tác động của Oversizing.";
      
      const fmt = n => (n >= 0 ? '+' : '-') + '$' + Math.abs(n).toFixed(2);
      
      if (classification === 'harmful') {
          return `WHAT THE DATA SAYS: Khi position size vượt baseline, expectancy của bạn giảm từ ${fmt(topAsset.normExp)} xuống ${fmt(topAsset.anomExp)} / trade. Đánh Volume lớn đang trực tiếp phá hủy lợi thế (Edge) của bạn.`;
      } else if (classification === 'effective') {
          return `WHAT THE DATA SAYS: Oversized trades đang mang lại mức expectancy xuất sắc (${fmt(topAsset.anomExp)}/trade so với ${fmt(topAsset.normExp)} bình thường). Bạn đang có High Conviction cực tốt.`;
      } else if (classification === 'underperforming') {
          return `WHAT THE DATA SAYS: Volume lớn vẫn có lãi, nhưng hiệu suất trên mỗi lệnh đang giảm đi (từ ${fmt(topAsset.normExp)} xuống ${fmt(topAsset.anomExp)}). Lợi nhuận không bù đắp được tỷ lệ rủi ro tăng thêm.`;
      } else if (classification === 'mixed') {
          return `WHAT THE DATA SAYS: Hiệu quả khi đánh Volume lớn của bạn đang bất nhất giữa các mã tài sản, không tạo ra một Edge rõ ràng.`;
      }
      return "WHAT THE DATA SAYS: Hiệu suất đánh Volume lớn không có thay đổi đáng kể so với mức bình thường.";
  }

  run(trades, config) {
    return this.analyze(trades, config);
  }

  buildEvidence(affectedTrades, classification, assetStats, topAffectedAsset) {
    const ev = buildEvidence();
    
    // Observed Statistical Anomalies
    const observedTrades = affectedTrades.filter(a => a.context.isStatisticalAnomaly);
    if (observedTrades.length > 0) {
      ev.addObserved(`Phát hiện ${observedTrades.length} lệnh có khối lượng vượt ngưỡng bất thường (P90) và lớn hơn 1.5x Median của Asset.`);
      
      const sample = observedTrades.slice(0, 3);
      sample.forEach(a => {
        ev.addObserved(`[${a.context.asset}] Size ${a.context.sz} (Ngưỡng P90: ${a.context.baseline?.anomalyThreshold?.toFixed(2) || 'N/A'})`);
      });
    }

    // Declared
    const declaredRisk = affectedTrades.filter(a => a.context.declaredRiskViolation).length;
    if (declaredRisk > 0) {
      ev.addDeclared(`Có ${declaredRisk} lệnh được bạn xác nhận là Vi phạm Kế hoạch Rủi ro (Risk Plan Violated).`);
    }

    const mistakes = affectedTrades.filter(a => a.context.mistakeOversize).length;
    if (mistakes > 0) {
      ev.addDeclared(`Bạn đã tự thừa nhận lỗi "Vào vol lớn / Oversized" trong ${mistakes} lệnh.`);
    }
    
    // Coaching insights (Derived)
    if (classification === 'declared_violation') {
        ev.addDerived(`Hệ thống ghi nhận sự chênh lệch rủi ro do bạn tự khai báo, nhưng chưa đủ dữ liệu thống kê để kết luận độ suy giảm Edge.`);
    } else if (topAffectedAsset && topAffectedAsset.assetClass !== 'insufficient_baseline') {
        const fmt = n => (n >= 0 ? '+' : '-') + '$' + Math.abs(n).toFixed(2);
        
        ev.addDerived(`Phân tích hiệu suất trên ${topAffectedAsset.asset}: Lệnh Normal đạt ${fmt(topAffectedAsset.normExp)}, nhưng lệnh Oversized (vượt P90) đạt ${fmt(topAffectedAsset.anomExp)} (Edge Delta: ${fmt(topAffectedAsset.delta)}).`);
    }

    return ev;
  }
  
  calculateConfidence(affectedTrades, evidence) {
    // Delegate to Base for standard { statistical, declared } structure
    return super.calculateConfidence(affectedTrades, evidence);
  }
}

export default new OversizedBehavior();
