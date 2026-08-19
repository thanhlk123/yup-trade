import { BehaviorBase } from '../BehaviorBase';
import { median, percentile, parseTags, calculateInitialRisk, calculateMAD } from '../helpers';
import { buildEvidence } from '../evidenceBuilder';
import { TAGS } from '../tags';
import { computeRMultiple } from '../../engine/statsEngine';

class OversizedBehavior extends BehaviorBase {
  constructor() {
    super();
    this.id = 'oversized';
    this.nameKey = 'Risk Oversizing';
    this.category = 'risk';
    this.severity = 8.0; 
    
    // Semantic change: Oversizing CAN lead to revenge trading or risk plan violation, 
    // but we do not claim causality in this behavior alone.
    this.relatedBehaviors = ['revenge_trading', 'risk_plan_violated'];
    this.description = 'Lệnh vi phạm lỗi này khi Khối lượng giao dịch (Volume) cao bất thường, hoặc Rủi ro cắt lỗ (Risk) cao bất thường so với thói quen giao dịch của bạn.';
  }

  classifyEdge(normalExp, anomalyExp) {
    if (anomalyExp < 0 && anomalyExp < normalExp) return 'harmful';
    if (anomalyExp > 0 && anomalyExp > normalExp) return 'effective';
    if (anomalyExp > 0 && anomalyExp < normalExp) return 'underperforming';
    if (anomalyExp < 0 && anomalyExp > normalExp) return 'improved_but_negative';
    return 'neutral';
  }

  detect(trades, config) {
    const observations = [];
    const statsByAsset = {};

    // 1. Group valid sizes and risks by asset
    trades.forEach(t => {
      const sz = parseFloat(t.size || 0);
      const asset = t.asset || 'UNKNOWN';
      const riskUnits = calculateInitialRisk(t);

      if (!statsByAsset[asset]) statsByAsset[asset] = { sizes: [], risks: [] };
      if (sz > 0) statsByAsset[asset].sizes.push(sz);
      if (riskUnits > 0) statsByAsset[asset].risks.push(riskUnits);
    });

    // 2. Compute baseline per asset ONCE
    const baselines = {};
    Object.keys(statsByAsset).forEach(asset => {
        const { sizes, risks } = statsByAsset[asset];
        let medSize = 0, p90Size = 0, medRisk = 0, p90Risk = 0;
        
        if (sizes.length >= 3) {
            medSize = median(sizes);
            const madSize = calculateMAD(sizes);
            const validSizes = madSize > 0 ? sizes.filter(s => Math.abs(s - medSize) <= 3 * madSize) : sizes.filter(s => s === medSize);
            const finalSizes = validSizes.length >= 3 ? validSizes : sizes;
            p90Size = percentile(finalSizes, 0.90);
        }

        if (risks.length >= 3) {
            medRisk = median(risks);
            const madRisk = calculateMAD(risks);
            const validRisks = madRisk > 0 ? risks.filter(r => Math.abs(r - medRisk) <= 3 * madRisk) : risks.filter(r => r === medRisk);
            const finalRisks = validRisks.length >= 3 ? validRisks : risks;
            medRisk = median(finalRisks); // Re-calculate median on filtered risks for robustness
            p90Risk = percentile(finalRisks, 0.90);
        }

        baselines[asset] = { 
            medSize, p90Size, 
            medRisk, p90Risk,
            sizeCount: sizes.length,
            riskCount: risks.length,
            riskCoverage: sizes.length > 0 ? (risks.length / sizes.length) : 0
        };
    });

    // 3. Evaluate trades against pre-calculated baselines
    trades.forEach(t => {
      const sz = parseFloat(t.size || 0);
      const asset = t.asset || 'UNKNOWN';
      const riskUnits = calculateInitialRisk(t);

      const riskPlanTags = parseTags(t.risk_plan);
      const mistakeTags = parseTags(t.mistakes);
      const hasDeclared = riskPlanTags.includes(TAGS.RISK_VIOLATED) || mistakeTags.includes(TAGS.MISTAKE_OVERRISK);

      const baseline = baselines[asset];
      
      let sizeAnomaly = false;
      let anomalyType = null;
      let riskAnomalyReason = [];
      let riskSeverity = null;

      if (baseline) {
         if (baseline.sizeCount >= 5 && sz > baseline.p90Size) {
             sizeAnomaly = true;
         }
         
         if (baseline.riskCount >= 5) {
             // MODERATE requires n >= 5
             if (baseline.medRisk > 0 && riskUnits >= baseline.medRisk * 1.5) {
                 riskSeverity = 'MODERATE';
                 riskAnomalyReason.push('MEDIAN_MULTIPLE_EXCEEDED');
             }
             // STRONG requires n >= 10 for P90 to be robust
             if (baseline.riskCount >= 10 && riskUnits > baseline.p90Risk) {
                 riskSeverity = 'STRONG';
                 riskAnomalyReason.push('P90_EXCEEDED');
             }
         }
         
         const riskAnomaly = riskSeverity !== null;

         if (sizeAnomaly && riskAnomaly) anomalyType = 'SIZE_AND_RISK';
         else if (sizeAnomaly) {
             anomalyType = riskUnits === 0 ? 'INSUFFICIENT_RISK_DATA' : 'SIZE_ONLY';
         }
         else if (riskAnomaly) anomalyType = 'RISK_ONLY';
      }

      const isStatisticalAnomaly = (anomalyType === 'SIZE_AND_RISK' || anomalyType === 'RISK_ONLY');

      let evidenceStatus = 'normal';
      if (isStatisticalAnomaly && hasDeclared) evidenceStatus = 'confirmed';
      else if (isStatisticalAnomaly && !hasDeclared) evidenceStatus = 'statistical';
      else if (!isStatisticalAnomaly && hasDeclared) evidenceStatus = 'conflicted';

      if (evidenceStatus !== 'normal' || anomalyType === 'INSUFFICIENT_RISK_DATA') {
        observations.push({
          trade: t,
          context: {
            asset, sz, riskUnits,
            baseline,
            anomalyType,
            riskAnomalyReason,
            riskSeverity,
            evidenceStatus
          }
        });
      }
    });

    return observations;
  }

  analyze(trades, config) {
    const observations = this.detect(trades, config);
    if (!observations || observations.length === 0) return null;

    const populationNormal = [];
    const detectedAnomalies = [];
    
    const obsMap = new Map(observations.map(o => [o.trade.id, o]));
    
    trades.forEach(t => {
        const obs = obsMap.get(t.id);
        if (obs) {
            if (obs.context.evidenceStatus === 'statistical' || obs.context.evidenceStatus === 'confirmed') {
                detectedAnomalies.push(obs);
            }
        } else {
            populationNormal.push(t);
        }
    });

    const anomaliesByAsset = {};
    const normalsByAsset = {};

    populationNormal.forEach(t => {
      const asset = t.asset || 'UNKNOWN';
      const sz = parseFloat(t.size || 0);
      if (sz > 0) {
        if (!normalsByAsset[asset]) normalsByAsset[asset] = [];
        normalsByAsset[asset].push(t);
      }
    });

    detectedAnomalies.forEach(obs => {
      const asset = obs.context.asset;
      if (!anomaliesByAsset[asset]) anomaliesByAsset[asset] = [];
      anomaliesByAsset[asset].push(obs); // push observation object to access baseline later
    });

    const assetStats = {};
    const classWeights = { harmful: 0, effective: 0, underperforming: 0, neutral: 0, improved_but_negative: 0, inconclusive: 0 };
    
    let totalValidAnomRCount = 0;
    
    let sumWeightedDeltaR = 0;
    let sumDeltaWeights = 0;

    const assetConfidences = [];
    const comparableAnomalies = [];

    Object.keys(anomaliesByAsset).forEach(asset => {
      const anomalyObs = anomaliesByAsset[asset];
      const anomalyTrs = anomalyObs.map(o => o.trade);
      const normalTrs = normalsByAsset[asset] || [];

      const calcAvgR = (arr) => {
          let sumR = 0;
          let count = 0;
          const validRs = [];
          arr.forEach(t => {
              const r = computeRMultiple(t);
              if (r !== null && r !== undefined && !isNaN(r)) {
                  sumR += r;
                  count++;
                  validRs.push(r);
              }
          });
          return { avg: count > 0 ? sumR / count : null, count, validRs };
      };

      const normData = calcAvgR(normalTrs);
      const anomData = calcAvgR(anomalyTrs);

      const medianLooBaselines = () => {
          const validLoo = anomalyObs.map(o => o.context.baseline).filter(b => b);
          if (validLoo.length === 0) return null;
          return {
              medRisk: median(validLoo.map(b => b.medRisk)),
              p90Risk: median(validLoo.map(b => b.p90Risk)),
              riskCoverage: median(validLoo.map(b => b.riskCoverage))
          };
      };
      
      const assetBaselineSummary = medianLooBaselines();

      // Enforce Minimum Anomaly Sample and Normal Sample
      if (normData.count < 5 || anomData.count < 3) {
        assetStats[asset] = {
          asset,
          anomalyCount: anomalyTrs.length,
          normalCount: normalTrs.length,
          anomalyRCount: anomData.count,
          normalRCount: normData.count,
          assetClass: anomData.count < 3 && normData.count >= 5 ? 'insufficient_anomaly_sample' : 'insufficient_baseline'
        };
        return;
      }

      comparableAnomalies.push(...anomalyTrs);

      let assetClass = 'inconclusive';
      let delta = null;
      
      if (normData.avg !== null && anomData.avg !== null) {
          delta = anomData.avg - normData.avg;
          assetClass = this.classifyEdge(normData.avg, anomData.avg);
      }

      // Confidence V7: Independent Dimensions
      let sampleConf = 0;
      if (normData.count >= 20 && anomData.count >= 10) sampleConf = 0.95;
      else if (normData.count >= 10 && anomData.count >= 5) sampleConf = 0.7;
      else if (normData.count >= 5 && anomData.count >= 3) sampleConf = 0.4;
      
      const effectConf = Math.min(1.0, Math.abs(delta || 0) / 0.5);
      
      const coverage = assetBaselineSummary?.riskCoverage || 0;
      let coverageConf = 0.2;
      if (coverage >= 0.8) coverageConf = 0.95;
      else if (coverage >= 0.5) coverageConf = 0.7;
      else if (coverage >= 0.3) coverageConf = 0.4;

      const assetConf = (sampleConf * 0.5) + (effectConf * 0.3) + (coverageConf * 0.2);

      if (delta !== null) {
          const weight = anomData.count * assetConf;
          sumWeightedDeltaR += delta * weight;
          sumDeltaWeights += weight;
      }

      classWeights[assetClass] += anomData.count;
      totalValidAnomRCount += anomData.count;

      assetConfidences.push({ weight: anomData.count, conf: assetConf });

      assetStats[asset] = {
        asset,
        normalCount: normalTrs.length,
        anomalyCount: anomalyTrs.length,
        normalRCount: normData.count,
        anomalyRCount: anomData.count,
        normExpR: normData.avg,
        anomExpR: anomData.avg,
        delta,
        assetClass,
        baseline: assetBaselineSummary
      };
    });

    let classification = 'inconclusive';
    if (detectedAnomalies.length === 0) classification = 'inconclusive'; 
    else if (totalValidAnomRCount >= 3) {
      if (classWeights['harmful'] > 0 && classWeights['effective'] > 0) classification = 'mixed';
      else if (classWeights['harmful'] > 0 && classWeights['underperforming'] > 0) classification = 'harmful'; 
      else {
          const sorted = Object.entries(classWeights).sort((a, b) => b[1] - a[1]);
          if (sorted.length > 0 && sorted[0][1] > 0) {
              classification = sorted[0][0];
          }
      }
    }

    const assets = Object.values(assetStats);
    let topAffectedAsset = null;
    if (assets.length > 0) {
        const sortedAssets = [...assets].sort((a, b) => (b.anomalyCount || 0) - (a.anomalyCount || 0));
        topAffectedAsset = sortedAssets[0];
    }

    let statisticalConf = 0;
    const totalWeights = assetConfidences.reduce((sum, a) => sum + a.weight, 0);
    if (totalWeights > 0) {
        statisticalConf = assetConfidences.reduce((sum, a) => sum + (a.conf * a.weight), 0) / totalWeights;
    }

    const hasDeclared = observations.some(a => a.context.evidenceStatus === 'confirmed' || a.context.evidenceStatus === 'conflicted');
    
    // Ensure statisticalConf is not NaN
    if (isNaN(statisticalConf)) statisticalConf = 0;
    
    const confidence = {
      statistical: statisticalConf,
      declared: hasDeclared ? 0.95 : 0
    };

    let calculatedSeverity = 5.0; 
    if (classification === 'harmful' || classification === 'underperforming') {
        calculatedSeverity = 5.0 + (3.5 * statisticalConf);
        const hasUnacknowledged = detectedAnomalies.some(a => a.context.evidenceStatus === 'statistical');
        if (hasUnacknowledged) calculatedSeverity = Math.min(9.5, calculatedSeverity + 1.0);
    } else if (classification === 'mixed') calculatedSeverity = 6.0;

    const allNormals = populationNormal;
    const allAnomalies = detectedAnomalies.map(a => a.trade);

    let estimatedRiskAdjustedDamage = 0;
    let grossLossExposure = 0;
    
    let weightedDeltaR = null;
    if (sumDeltaWeights > 0) {
        weightedDeltaR = sumWeightedDeltaR / sumDeltaWeights;
    }

    // Move grossLossExposure calculation down
    const calcGlobalMetrics = (arr) => {
        let sumR = 0, count = 0;
        let sumPnL = 0, pnlCount = 0;
        let winCount = 0;
        let worstR = null;
        let worstPnL = null;
        let bestPnL = null;
        const validRs = [];
        const sizes = [];
        const risks = [];
        const tradeDetails = [];
        arr.forEach(t => { 
            const sz = Math.abs(parseFloat(t.size || 0));
            if (sz > 0) sizes.push(sz);
            const rUnits = Math.abs(calculateInitialRisk(t));
            if (rUnits > 0) risks.push(rUnits);
            
            const pnl = parseFloat(t.pnl) || 0;
            sumPnL += pnl;
            pnlCount++;
            
            if (worstPnL === null || pnl < worstPnL) worstPnL = pnl;
            if (bestPnL === null || pnl > bestPnL) bestPnL = pnl;
            
            let r = computeRMultiple(t); 
            if(r != null && !isNaN(r)) { 
                // Cap extreme R values to prevent skewing (e.g. from tiny stop losses)
                r = Math.max(-100, Math.min(100, r));
                sumR+=r; count++; validRs.push(r); 
                if (r > 0) winCount++;
                if (worstR === null || r < worstR) worstR = r;
            } 
            // Always push details for Top 3 Worst Trades based on PnL now
            tradeDetails.push({ id: t.id, asset: t.asset, r, pnl, size: sz, time: t.close_time || t.open_time || '' });
        });
        
        tradeDetails.sort((a, b) => a.pnl - b.pnl);
        
        return { 
            avgR: count > 0 ? sumR/count : null, 
            avgPnL: pnlCount > 0 ? sumPnL / pnlCount : 0,
            worstPnL,
            bestPnL,
            count: arr.length,  
            validRCount: count, 
            validRs,
            winCount,
            winRate: count > 0 ? winCount / count : null,
            worstR,
            top3WorstTrades: tradeDetails.slice(0, 3),
            medianSize: sizes.length > 0 ? median(sizes) : null,
            medianRisk: risks.length > 0 ? median(risks) : null
        };
    };
    
    const globalNormData = calcGlobalMetrics(allNormals);
    const globalAnomData = calcGlobalMetrics(allAnomalies);

    if (allAnomalies.length > 0) {
        grossLossExposure = Math.abs(allAnomalies.map(t => parseFloat(t.pnl) || 0).filter(p => p < 0).reduce((s, x) => s + x, 0));
        
        // Counterfactual Damage in Dollars (PnL Delta)
        const normAvgPnL = globalNormData.avgPnL || 0;
        const anomAvgPnL = globalAnomData.avgPnL || 0;
        const pnlDelta = anomAvgPnL - normAvgPnL;
        
        if (pnlDelta < 0) {
            estimatedRiskAdjustedDamage = pnlDelta * allAnomalies.length;
        } else {
            // Fallback to gross loss if somehow oversized trades are profitable on average but still an anomaly
            estimatedRiskAdjustedDamage = -grossLossExposure;
        }
        
        // Cap unrealistic theoretical damage just in case
        if (Math.abs(estimatedRiskAdjustedDamage) > grossLossExposure * 2) {
            estimatedRiskAdjustedDamage = -grossLossExposure;
        }
    }

    const damagePerTrade = allAnomalies.length > 0 ? estimatedRiskAdjustedDamage / allAnomalies.length : 0;

    const wowMetrics = {
        normal: {
            count: allNormals.length,
            validRCount: globalNormData.count,
            avgR: globalNormData.avgR,
            avgPnL: globalNormData.avgPnL,
            medianR: globalNormData.validRs.length > 0 ? median(globalNormData.validRs) : null,
            medianSize: globalNormData.medianSize,
            medianRisk: globalNormData.medianRisk,
            winRate: globalNormData.winRate,
            worstR: globalNormData.worstR,
            worstPnL: globalNormData.worstPnL,
            bestPnL: globalNormData.bestPnL,
            winCount: globalNormData.winCount
        },
        oversized: {
            count: allAnomalies.length,
            validRCount: globalAnomData.count,
            avgR: globalAnomData.avgR,
            avgPnL: globalAnomData.avgPnL,
            medianR: globalAnomData.validRs.length > 0 ? median(globalAnomData.validRs) : null,
            medianSize: globalAnomData.medianSize,
            medianRisk: globalAnomData.medianRisk,
            winRate: globalAnomData.winRate,
            worstR: globalAnomData.worstR,
            worstPnL: globalAnomData.worstPnL,
            bestPnL: globalAnomData.bestPnL,
            top3WorstTrades: globalAnomData.top3WorstTrades,
            winCount: globalAnomData.winCount
        },
        weightedDeltaR: weightedDeltaR,
        damage: {
            estimatedRiskAdjustedDamage,
            grossExposure: grossLossExposure,
            damagePerTrade
        },
        thresholds: topAffectedAsset ? assetStats[topAffectedAsset.asset]?.baseline : null
    };

    const evidence = this.buildEvidence(observations, classification, assetStats, topAffectedAsset, wowMetrics);
    
    const impact = this.calculateImpact(allAnomalies, trades);
    if (impact) impact.totalDamage = estimatedRiskAdjustedDamage; 
    if (impact) impact.grossLossExposure = grossLossExposure;
    if (impact && weightedDeltaR !== null) {
        impact.edgeDeltaR = weightedDeltaR;
        impact.riskAdjustedDamage = true;
    }

    const detectedTradeIds = detectedAnomalies.map(a => a.trade.id);
    const confirmedTradeIds = observations.filter(a => a.context.evidenceStatus === 'confirmed').map(a => a.trade.id);
    const declaredOnlyTradeIds = observations.filter(a => a.context.evidenceStatus === 'conflicted').map(a => a.trade.id);

    return {
      id: this.id,
      nameKey: 'Risk Oversizing',
      category: this.category,
      description: this.description,
      severity: calculatedSeverity,
      occurrences: detectedAnomalies.length,
      affectedTradeIds: detectedTradeIds, 
      detectedTradeIds,
      confirmedTradeIds,
      declaredOnlyTradeIds,
      confidence,
      impact,
      detection: {
        thresholdLogic: "Risk > LOO_P90 (if n>=10) OR Risk >= LOO_Med * 1.5 (if n>=5)"
      },
      evidence: evidence.toObject(),
      metrics: {
        topAffectedAsset,
        totalAnomalyCount: detectedAnomalies.length,
        assetStats,
        wow: wowMetrics
      },
      classification,
      coaching: this.generateCoaching(classification, topAffectedAsset, { wow: wowMetrics })
    };
  }

  generateCoaching(classification, topAsset, metrics) {
    const { damage } = metrics.wow;
    
    let headline = "Không có khác biệt đáng kể về hiệu suất giữa lệnh rủi ro cao và lệnh thường.";
    if (classification === 'harmful' || classification === 'underperforming') {
        headline = "Bạn đang sử dụng quy mô rủi ro vượt vùng Edge của mình.";
    } else if (classification === 'improved_but_negative') {
        headline = "Bạn đang tăng mức rủi ro và hiệu suất có cải thiện, nhưng tổng PnL vẫn đang âm.";
    } else if (classification === 'effective') {
        headline = "Nhóm lệnh có rủi ro cao đang mang lại hiệu suất vượt trội so với vùng an toàn.";
    } else if (classification === 'mixed') {
        headline = "Việc tăng mức rủi ro đang mang lại kết quả trái chiều tùy theo cặp giao dịch.";
    } else if (classification === 'inconclusive') {
        headline = "Phát hiện lệnh có mức rủi ro bất thường, nhưng chưa đủ dữ liệu để kết luận tác động.";
    }

    const diagnosis = classification === 'harmful' || classification === 'underperforming' 
      ? `Bạn không chỉ đang "vào volume lớn". Dữ liệu cho thấy khi bạn tăng mức rủi ro vượt mốc an toàn của chính mình, Edge giảm đáng kể. Điều đáng chú ý là bạn đã có ${metrics.wow.oversized.count} lệnh trong vùng rủi ro này.`
      : "Hệ thống đang theo dõi các lệnh có mức rủi ro lớn của bạn, tuy nhiên chưa có dấu hiệu suy giảm lợi thế rõ rệt.";

    const action = "Giữ mức rủi ro nằm trong vùng an toàn (baseline range) của bạn. Chỉ tăng rủi ro khi Setup có Edge được chứng minh bằng dữ liệu, không chỉ vì Setup trông có vẻ đẹp.";
    
    const nextTradeRule = "Trước khi vào lệnh, hãy tự hỏi:\n1. Mức rủi ro này có vượt quá vùng an toàn thường ngày của tôi không?\n2. Setup này có lợi thế (Edge) thực sự rõ ràng được chứng minh bằng dữ liệu không?\n3. Tôi đang đánh lớn vì xác suất thắng cao hơn, hay chỉ vì muốn gỡ/ăn nhiều hơn?\n\nMục tiêu không phải là đánh nhỏ lại. Mục tiêu là chỉ đánh lớn khi dữ liệu chứng minh bạn xứng đáng với risk đó.";

    let evidenceInterpretation = "Chưa đủ dữ liệu hoặc không có chênh lệch rõ ràng để ước tính thiệt hại.";
    if (classification === 'harmful' || classification === 'underperforming') {
        evidenceInterpretation = `Chúng tôi so sánh các lệnh vượt mức rủi ro bình thường với các lệnh nằm trong vùng rủi ro an toàn của chính bạn. Nhóm rủi ro cao có kết quả kém hơn. Con số -$${damage.estimatedRiskAdjustedDamage.toFixed(2)} là ước lượng sự suy giảm lợi thế (được chuẩn hóa theo rủi ro), không phải số tiền tuyệt đối chắc chắn mất đi do quy mô lệnh.`;
    }

    return {
      headline,
      diagnosis,
      action,
      nextTradeRule,
      evidenceInterpretation
    };
  }

  run(trades, config) {
    return this.analyze(trades, config);
  }

  buildEvidence(observations, classification, assetStats, topAffectedAsset, metrics) {
    const ev = buildEvidence();

    const statAnomalies = observations.filter(a => a.context.evidenceStatus === 'statistical' || a.context.evidenceStatus === 'confirmed');
    const conflicted = observations.filter(a => a.context.evidenceStatus === 'conflicted');
    const insufficientRiskData = observations.filter(a => a.context.anomalyType === 'INSUFFICIENT_RISK_DATA');
    
    if (statAnomalies.length > 0) {
      ev.addObserved(`Phát hiện ${statAnomalies.length} lệnh có mức rủi ro cao bất thường so với thói quen của bạn.`);
      
      const sample = statAnomalies.slice(0, 2);
      sample.forEach(a => {
        const severityStr = a.context.riskSeverity === 'STRONG' ? '(Ngưỡng Rủi ro rất cao)' : '(Ngưỡng Rủi ro cao)';
        let text = `[${a.context.asset}] Rủi ro ban đầu (Initial Risk): ${a.context.riskUnits.toFixed(2)} ${severityStr}.`;
        ev.addObserved(text);
      });
    }
    
    if (insufficientRiskData.length > 0) {
      ev.addContext(`Có ${insufficientRiskData.length} lệnh khối lượng cực lớn nhưng thiếu điểm Cắt lỗ (Stop Loss), hệ thống không thể tính toán rủi ro chính xác.`);
    }

    if (conflicted.length > 0) {
      ev.addDeclared(`Ghi nhận ${conflicted.length} lệnh bạn tự tag là lỗi "Oversized", nhưng phân tích cho thấy mức rủi ro vẫn nằm trong vùng bình thường của bạn.`);
    }
    
    const confirmed = observations.filter(a => a.context.evidenceStatus === 'confirmed').length;
    if (confirmed > 0) {
      ev.addDeclared(`Có ${confirmed} lệnh bạn tự nhận diện lỗi và hệ thống hoàn toàn đồng tình.`);
    }

    if (classification === 'inconclusive') {
        ev.addContext("Lượng lệnh hợp lệ chưa đủ để phân tích sự chênh lệch lợi thế (Edge).");
    } else if (metrics && metrics.weightedDeltaR !== null) {
        const fmt = n => (n >= 0 ? '+' : '') + n.toFixed(2) + 'R';
        ev.addContext(`Thống kê Edge (R-Multiple): Nhóm rủi ro bất thường (${metrics.oversized.validRCount} lệnh, Trung bình: ${fmt(metrics.oversized.avgR)}) vs Nhóm rủi ro an toàn (${metrics.normal.validRCount} lệnh, Trung bình: ${fmt(metrics.normal.avgR)}).`);
    }

    return ev;
  }
}

export default new OversizedBehavior();
