import { BehaviorBase } from '../BehaviorBase';
import { getMonthKey, computeTrend, minutesBetween, noteContains, parseTags } from '../helpers';
import { buildEvidence } from '../evidenceBuilder';
import { TAGS } from '../tags';

function getEscalationPattern(sizeHistory) {
    if (sizeHistory.length <= 1) return 'FLAT';
    let progressive = 0;
    let decreasing = 0;
    let flat = 0;
    let martingaleSteps = 0;

    for (let i = 1; i < sizeHistory.length; i++) {
        const prevS = sizeHistory[i-1].size || sizeHistory[0].size;
        const s = sizeHistory[i].size;
        const dir = sizeHistory[i].dir;
        
        if (s >= 1.8 * prevS && dir === 'ADVERSE') martingaleSteps++;
        else if (s >= 1.8 * prevS) progressive++;
        else if (s > 1.1 * prevS) progressive++;
        else if (s < 0.9 * prevS) decreasing++;
        else flat++;
    }

    if (martingaleSteps >= 1) return 'MARTINGALE'; // Strictly loss-conditioned
    if (decreasing > 0 && (progressive > 0 || martingaleSteps > 0)) return 'MIXED';
    if (decreasing > 0 && progressive === 0 && martingaleSteps === 0) return 'DECREASING';
    if (progressive > 0) return 'PROGRESSIVE';
    return 'FLAT';
}



function getAddDirection(side, prevAvgEntry, newEntry) {
    if (!prevAvgEntry || !newEntry) return 'NEUTRAL';
    const diff = Math.abs(newEntry - prevAvgEntry);
    const pctDiff = prevAvgEntry > 0 ? diff / prevAvgEntry : 0;
    
    // Spread / Slippage noise threshold: if price diff < 0.005% (~1 pip / $0.1 Gold), treat as NEUTRAL noise
    if (pctDiff < 0.00005) return 'NEUTRAL';

    if (side === 'BUY') {
        if (newEntry < prevAvgEntry) return 'ADVERSE';
        if (newEntry > prevAvgEntry) return 'FAVORABLE';
        return 'NEUTRAL';
    } else {
        if (newEntry > prevAvgEntry) return 'ADVERSE';
        if (newEntry < prevAvgEntry) return 'FAVORABLE';
        return 'NEUTRAL';
    }
}

function extractDcaFeatures(orders, side) {
    if (!orders || orders.length < 2) return null;
    let isAveragingDown = false;
    let favorableAdds = 0;
    let adverseAdds = 0;
    let neutralAdds = 0;
    
    const initialSize = parseFloat(orders[0].size || 0);
    let avgEntry = parseFloat(orders[0].entry || 0);
    let totSize = initialSize;
    
    let addedSize = 0;
    let maxSingleAdd = 0;
    let adverseDistance = 0;
    let adversePct = 0;
    const p1 = avgEntry;
    const sizeHistory = [{ size: initialSize, dir: 'NEUTRAL' }];

    let initialTradePnl = parseFloat(orders[0].pnl || 0);
    let addedTradesPnl = 0;
    let episodePnl = initialTradePnl;

    for (let i = 1; i < orders.length; i++) {
        const p2 = parseFloat(orders[i].entry || 0);
        const s2 = parseFloat(orders[i].size || 0);
        const pnl2 = parseFloat(orders[i].pnl || 0);
        const dir = getAddDirection(side, avgEntry, p2);
        
        sizeHistory.push({ size: s2, dir });

        if (dir === 'ADVERSE') {
            isAveragingDown = true;
            adverseAdds++;
            const dist = Math.abs(p2 - p1);
            if (dist > adverseDistance) adverseDistance = dist;
            const pct = p1 > 0 ? dist / p1 : 0;
            if (pct > adversePct) adversePct = pct;
        } else if (dir === 'FAVORABLE') {
            favorableAdds++;
        } else {
            neutralAdds++;
        }
        
        addedSize += s2;
        if (s2 > maxSingleAdd) maxSingleAdd = s2;
        addedTradesPnl += pnl2;
        episodePnl += pnl2;

        totSize += s2;
        if (totSize > 0) {
            avgEntry = ((avgEntry * (totSize - s2)) + (p2 * s2)) / totSize;
        }
    }

    const totalSize = initialSize + addedSize;
    const escalationPattern = getEscalationPattern(sizeHistory);

    return {
        initialSize,
        addedSize,
        totalSize,
        maxSingleAdd,
        adverseDistance,
        adversePct,
        escalationPattern,
        adverseAdds,
        favorableAdds,
        neutralAdds,
        isAveragingDown,
        sizeMultiplier: initialSize > 0 ? totalSize / initialSize : 1,
        initialTradePnl,
        addedTradesPnl,
        episodePnl,
        isRecovery: initialTradePnl < 0 && episodePnl > 0
    };
}

function parseAggregateDca(note, trade) {
  if (!note || !note.includes('[Giao dịch DCA gộp')) return null;
  const orderRegex = /- Lệnh #\d+: Vol ([\d.]+) \| Entry ([\d.]+) -> Exit ([\d.]+) \| PnL: ([+\d.-]+)/g;
  const orders = [];
  let match;
  while ((match = orderRegex.exec(note)) !== null) {
    orders.push({
      size: parseFloat(match[1]),
      entry: parseFloat(match[2]),
      exit: parseFloat(match[3]),
      pnl: parseFloat(match[4])
    });
  }
  
  const features = extractDcaFeatures(orders, trade.side);
  if (!features || !features.isAveragingDown) return null;

  let isConflicted = false;
  const dbPnl = parseFloat(trade.pnl || 0);
  const dbSize = parseFloat(trade.size || 0);
  if (Math.abs(features.episodePnl - dbPnl) > 2.0 && Math.abs((features.episodePnl - dbPnl) / (dbPnl || 1)) > 0.05) isConflicted = true;
  if (Math.abs(features.totalSize - dbSize) > 0.01) isConflicted = true;

  return {
    isDca: true,
    count: orders.length,
    orders,
    initialRisk: null,
    totalRisk: null,
    riskMultiplier: null,
    addToInvalidationRatio: null,
    isConflicted,
    ...features
  };
}

class DcaBehavior extends BehaviorBase {
  constructor() {
    super();
    this.id = 'dca';
    this.nameKey = 'bhDca';
    this.category = 'risk';
    this.severity = 9.0;
    this.relatedBehaviors = ['oversized', 'hold_too_long'];
  }

  _analyzeAlgorithmicCluster(orders, side) {
      if (orders.length < 2) return null;
      
      const standardOrders = orders.map(o => ({
          size: parseFloat(o.size || 0),
          entry: parseFloat(o.entry_price || 0),
          pnl: parseFloat(o.pnl || 0)
      }));
      
      const features = extractDcaFeatures(standardOrders, side);
      if (!features || !features.isAveragingDown) return null;

      return {
          isDca: true,
          count: orders.length,
          orders,
          initialRisk: null,
          totalRisk: null,
          riskMultiplier: null,
          addToInvalidationRatio: null,
          ...features
      };
  }

  detectAllEpisodes(trades, config) {
    const dcaEpisodes = [];
    const nonDcaEpisodes = [];
    const usedTradeIds = new Set();
    const sorted = [...trades].sort((a,b) => new Date(a.trade_time) - new Date(b.trade_time));

    // 1. Tier 1: Aggregate Structured Evidence (from user CSV logic)
    sorted.forEach(t => {
       const agg = parseAggregateDca(t.user_notes, t);
       if (agg) {
          dcaEpisodes.push({
             type: 'aggregate',
             tier: 1,
             trade: t,
             features: agg,
             pnl: parseFloat(t.pnl || 0),
             asset: t.asset,
             detectionSource: ['AGGREGATE_STRUCTURED']
          });
          usedTradeIds.add(t.id);
       }
    });

    // 2. Tier 2: Algorithmic Clustering for remaining single trades
    const singleTrades = sorted.filter(t => !usedTradeIds.has(t.id));
    const openClusters = {}; // key: asset, value: { trades: [], maxExitTime: number }
    const finalClusters = []; // array of { asset, trades: [] }

    for (const t of singleTrades) {
       const asset = t.asset;
       const tOpen = new Date(t.trade_time).getTime();
       const tExit = t.exit_time ? new Date(t.exit_time).getTime() : Infinity;

       if (!openClusters[asset]) {
           openClusters[asset] = { trades: [t], maxExitTime: tExit };
       } else {
           const clusterObj = openClusters[asset];
           
           if (tOpen <= clusterObj.maxExitTime) {
               clusterObj.trades.push(t);
               if (tExit > clusterObj.maxExitTime) clusterObj.maxExitTime = tExit;
           } else {
               if (clusterObj.trades.length > 1) {
                   finalClusters.push({ asset, trades: clusterObj.trades });
               }
               openClusters[asset] = { trades: [t], maxExitTime: tExit };
           }
       }
    }
    // Flush remaining open clusters
    Object.keys(openClusters).forEach(asset => {
       const clusterObj = openClusters[asset];
       if (clusterObj.trades.length > 1) {
           finalClusters.push({ asset, trades: clusterObj.trades });
       }
    });

    // Process finalClusters into dcaEpisodes
    finalClusters.forEach(clusterObj => {
       const clusterTrades = clusterObj.trades;
       const sideGroups = { 'BUY': [], 'SELL': [] };
       clusterTrades.forEach(t => {
          if (t.side === 'BUY' || t.side === 'SELL') {
             sideGroups[t.side].push(t);
          }
       });

       for (const side of ['BUY', 'SELL']) {
          const sideTrades = sideGroups[side];
          if (sideTrades.length >= 2) {
             const agg = this._analyzeAlgorithmicCluster(sideTrades, side);
             if (agg) {
                dcaEpisodes.push({
                   type: 'sequence',
                   tier: 2,
                   trades: sideTrades,
                   features: agg,
                   pnl: agg.episodePnl,
                   asset: clusterObj.asset,
                   detectionSource: ['ALGORITHMIC_CLUSTERING']
                });
                sideTrades.forEach(t => usedTradeIds.add(t.id));
             }
          }
       }
    });

    // 3. Any trade still not used is non-DCA
    sorted.forEach(t => {
        if (!usedTradeIds.has(t.id)) {
            const mistakes = parseTags(t.mistakes);
            const userClaimsDca = mistakes.includes(TAGS.MISTAKE_DCA);
            
            nonDcaEpisodes.push({
                type: 'single', 
                trades: [t], 
                pnl: parseFloat(t.pnl||0), 
                initialRisk: parseFloat(t.risk_amount||0),
                userClaimsDca
            });
        }
    });

    // 4. Cross-Validation: Check Tags for DCA Episodes
    dcaEpisodes.forEach(ep => {
       const allMistakes = new Set();
       const allEmotions = new Set();
       const tradesToCheck = ep.type === 'sequence' ? ep.trades : [ep.trade];
       
       tradesToCheck.forEach(t => {
          parseTags(t.mistakes).forEach(tag => allMistakes.add(tag));
          parseTags(t.emotions).forEach(tag => allEmotions.add(tag));
       });

       ep.tags = {
          mistakes: Array.from(allMistakes),
          emotions: Array.from(allEmotions)
       };
       
       ep.userRecognized = allMistakes.has(TAGS.MISTAKE_DCA);
    });

    return { dcaEpisodes, nonDcaEpisodes };
  }

  _calculateMetrics(episodes) {
      if (episodes.length === 0) {
         return { winRate: 0, profitFactor: 0, expectancy: 0, totalPnl: 0, avgEpisodePnl: 0, avgInitialSize: 0, avgAddedSize: 0, wins: 0, losses: 0, breakeven: 0, worstEpisodePnl: 0, maxPositionMultiplier: 0, expectancyR: null, profitFactorR: null, validREpisodes: 0 };
      }
      
      const wins = episodes.filter(ep => ep.pnl > 0);
      const losses = episodes.filter(ep => ep.pnl < 0);
      const breakeven = episodes.filter(ep => ep.pnl === 0);
      
      const sumWins = wins.reduce((s, ep) => s + ep.pnl, 0);
      const sumLoss = Math.abs(losses.reduce((s, ep) => s + ep.pnl, 0));
      const totalPnl = sumWins - sumLoss;
      
      const winRate = wins.length / episodes.length;
      const lossRate = losses.length / episodes.length;
      
      const avgWin = wins.length > 0 ? sumWins / wins.length : 0;
      const avgLoss = losses.length > 0 ? sumLoss / losses.length : 0;
      const expectancy = (winRate * avgWin) - (lossRate * avgLoss);
      const profitFactor = sumLoss > 0 ? sumWins / sumLoss : (sumWins > 0 ? 99 : 0);
      
      // R-Multiple metrics
      let validREpisodes = 0;
      let validRWins = 0;
      let validRLosses = 0;
      let winR = 0;
      let lossR = 0;

      episodes.forEach(ep => {
         const rAmount = ep.features?.initialRisk || ep.initialRisk; 
         if (rAmount && rAmount > 0) {
             const epR = ep.pnl / rAmount;
             if (epR > 0) {
                 winR += epR;
                 validRWins++;
             } else if (epR < 0) {
                 lossR += Math.abs(epR);
                 validRLosses++;
             }
             validREpisodes++;
         }
      });
      
      let expectancyR = null;
      let profitFactorR = null;
      if (validREpisodes > 0) {
          const avgWinR = validRWins > 0 ? winR / validRWins : 0;
          const avgLossR = validRLosses > 0 ? lossR / validRLosses : 0;
          const winRateR = validRWins / validREpisodes;
          const lossRateR = validRLosses / validREpisodes;
          expectancyR = (winRateR * avgWinR) - (lossRateR * avgLossR);
          profitFactorR = lossR > 0 ? winR / lossR : (winR > 0 ? 99 : 0);
      }

      let worstEpisodePnl = 0;
      let bestEpisodePnl = 0;
      let totalInitial = 0;
      let totalAdded = 0;
      let maxMultiplier = 1;

      episodes.forEach(ep => {
          if (ep.pnl < worstEpisodePnl) worstEpisodePnl = ep.pnl;
          if (ep.pnl > bestEpisodePnl) bestEpisodePnl = ep.pnl;
          if (ep.features) {
             totalInitial += ep.features.initialSize;
             totalAdded += ep.features.addedSize;
             if (ep.features.sizeMultiplier > maxMultiplier) maxMultiplier = ep.features.sizeMultiplier;
          } else {
             // Non-DCA baseline fallback
             const singleSize = ep.trades ? ep.trades.reduce((s,t) => s + parseFloat(t.size||0), 0) : 0;
             totalInitial += singleSize;
          }
      });
      
      return {
          winRate, lossRate, profitFactor, expectancy, totalPnl,
          avgEpisodePnl: totalPnl / episodes.length,
          avgLoss: -avgLoss,
          avgInitialSize: totalInitial / episodes.length,
          avgAddedSize: totalAdded / episodes.length,
          wins: wins.length, losses: losses.length, breakeven: breakeven.length,
          worstEpisodePnl, bestEpisodePnl, maxPositionMultiplier: maxMultiplier,
          expectancyR, profitFactorR, validREpisodes
      };
  }

  _classifyBehavior(episodes) {
     let profile = 'CONTROLLED_SCALE_IN';
     let riskLevel = 'LOW';

     let martingaleCount = 0;
     let aggressiveCount = 0;
     let averagingDownCount = 0;
     let totalCount = episodes.length || 1;
     let maxMultiplier = 1;
     let maxRiskMultiplier = 1;
     let maxInvalidation = 0;
     let totalAdverseAdds = 0;

     const multipliers = [];

     episodes.forEach(ep => {
         if (ep.features) {
            if (ep.features.escalationPattern === 'MARTINGALE') martingaleCount++;
            else if (ep.features.escalationPattern === 'AGGRESSIVE_ESCALATION') aggressiveCount++;
            
            if (ep.features.isAveragingDown) averagingDownCount++;
            totalAdverseAdds += (ep.features.adverseAdds || 0);
            
            if (ep.features.sizeMultiplier > maxMultiplier) maxMultiplier = ep.features.sizeMultiplier;
            multipliers.push(ep.features.sizeMultiplier);
            if (ep.features.riskMultiplier != null && ep.features.riskMultiplier > maxRiskMultiplier) maxRiskMultiplier = ep.features.riskMultiplier;
            if (ep.features.addToInvalidationRatio != null && ep.features.addToInvalidationRatio > maxInvalidation) maxInvalidation = ep.features.addToInvalidationRatio;
         }
     });

     multipliers.sort((a,b) => a - b);
     const medianMultiplier = multipliers.length > 0 ? multipliers[Math.floor(multipliers.length/2)] : 1;
     const effectiveMultiplier = medianMultiplier;

     if (martingaleCount >= totalCount * 0.3) {
         profile = 'MARTINGALE';
         riskLevel = 'CRITICAL';
     } else if (averagingDownCount >= totalCount * 0.5 && effectiveMultiplier >= 2.5) {
         profile = 'AGGRESSIVE_AVERAGING';
         riskLevel = 'CRITICAL';
     } else if (averagingDownCount >= totalCount * 0.5) {
         profile = 'AVERAGING_DOWN';
         riskLevel = 'HIGH';
     } else if (aggressiveCount >= totalCount * 0.3 || effectiveMultiplier >= 2) {
         profile = 'AGGRESSIVE_SCALE_IN';
         riskLevel = 'HIGH';
     } else {
         profile = 'CONTROLLED_SCALE_IN';
         riskLevel = 'LOW';
     }

     return { profile, riskLevel };
  }

  _calculateConfidence(episodes) {
      let sumDetection = 0;
      let sumBehavior = 0;
      
      episodes.forEach(ep => {
          let detScore = 0;
          if (ep.tier === 1) detScore = ep.features?.isConflicted ? 0.70 : 0.98;
          else if (ep.tier === 2) detScore = 0.95;
          else if (ep.tier === 3) detScore = 0.88;
          else detScore = 0.70;
          
          let behavScore = 0.50; // Baseline behavior confidence
          if (ep.features) {
              if (ep.features.sizeMultiplier > 2 || (ep.features.riskMultiplier != null && ep.features.riskMultiplier > 2)) behavScore += 0.30;
              else if (ep.features.sizeMultiplier > 1.2) behavScore += 0.15;
              
              if (ep.features.adversePct > 0.005) behavScore += 0.15;
              if (ep.features.escalationPattern === 'MARTINGALE') behavScore += 0.20;
              if (ep.features.addToInvalidationRatio > 0.7) behavScore += 0.15;
          }
          
          sumDetection += Math.min(detScore, 0.99);
          sumBehavior += Math.min(behavScore, 0.99);
      });

      const detection = episodes.length > 0 ? sumDetection / episodes.length : 0;
      const behavior = episodes.length > 0 ? sumBehavior / episodes.length : 0;
      
      let sampleStrength = 0;
      if (episodes.length >= 20) sampleStrength = 0.95;
      else if (episodes.length >= 10) sampleStrength = 0.80;
      else if (episodes.length >= 5) sampleStrength = 0.60;
      else if (episodes.length >= 3) sampleStrength = 0.40;
      else sampleStrength = 0.20;

      const overall = (detection * 0.4) + (behavior * 0.3) + (sampleStrength * 0.3);

      return { 
          overallConfidence: overall, 
          detectionConfidence: detection, 
          behaviorConfidence: behavior, 
          sampleStrength 
      };
  }

  run(trades, config) {
    const { dcaEpisodes, nonDcaEpisodes } = this.detectAllEpisodes(trades, config);
    if (!dcaEpisodes || dcaEpisodes.length === 0) return null;
    
    const dcaMetrics = this._calculateMetrics(dcaEpisodes);
    const nonDcaBaseline = this._calculateMetrics(nonDcaEpisodes); // Episode-level comparison
    const baseline = this._calculateMetrics([...dcaEpisodes, ...nonDcaEpisodes]);
    
    const edgeDelta = {
        winRate: dcaMetrics.winRate - nonDcaBaseline.winRate,
        profitFactor: dcaMetrics.profitFactor - nonDcaBaseline.profitFactor,
        expectancy: dcaMetrics.expectancy - nonDcaBaseline.expectancy,
        expectancyR: dcaMetrics.expectancyR != null && nonDcaBaseline.expectancyR != null ? dcaMetrics.expectancyR - nonDcaBaseline.expectancyR : null
    };

    const { profile, riskLevel } = this._classifyBehavior(dcaEpisodes);
    const performanceStatus = dcaMetrics.totalPnl > 0 ? 'POSITIVE' : (dcaMetrics.totalPnl < 0 ? 'NEGATIVE' : 'NEUTRAL');
    


    let estimatedEdgeDamage = 0;
    
    // Normalize edge comparison
    if (dcaMetrics.validREpisodes > 0 && nonDcaBaseline.validREpisodes > 0) {
        // Calculate damage based on edgeDelta R
        const avgRiskPerEpisode = dcaEpisodes.reduce((s, ep) => s + (ep.features?.initialRisk || ep.initialRisk || 0), 0) / (dcaEpisodes.length || 1);
        if (edgeDelta.expectancyR < 0) {
            estimatedEdgeDamage = Math.abs(edgeDelta.expectancyR) * avgRiskPerEpisode * dcaEpisodes.length;
        }
    } else {
        // Fallback: per lot expectancy
        const dcaExpectancyPerLot = dcaMetrics.avgInitialSize > 0 ? dcaMetrics.expectancy / dcaMetrics.avgInitialSize : 0;
        const nonDcaExpectancyPerLot = nonDcaBaseline.avgInitialSize > 0 ? nonDcaBaseline.expectancy / nonDcaBaseline.avgInitialSize : 0;
        const deltaPerLot = dcaExpectancyPerLot - nonDcaExpectancyPerLot;
        
        if (deltaPerLot < 0) {
             estimatedEdgeDamage = Math.abs(deltaPerLot) * dcaMetrics.avgInitialSize * dcaEpisodes.length;
        }
    }

    const confObj = this._calculateConfidence(dcaEpisodes);
    const evidence = this.buildEvidence(dcaEpisodes, dcaMetrics, nonDcaBaseline, edgeDelta, profile, confObj);
    const aiInsightObj = this._buildAiInsight(dcaEpisodes, dcaMetrics, edgeDelta, profile, performanceStatus, confObj, riskLevel, baseline, estimatedEdgeDamage);

    // Affected trades collection
    const dcaTradeIds = new Set();
    dcaEpisodes.forEach(ep => {
       if (ep.type === 'sequence') ep.trades.forEach(t => dcaTradeIds.add(t.id));
       else dcaTradeIds.add(ep.trade.id);
    });

    const allDcaUnrecognized = dcaEpisodes.length > 0 && dcaEpisodes.every(ep => !ep.userRecognized);
    let finalSeverity = riskLevel === 'CRITICAL' ? 9.5 : (riskLevel === 'HIGH' ? 8.5 : (riskLevel === 'MEDIUM' ? 6.5 : 4.0));
    
    if (allDcaUnrecognized && (riskLevel === 'HIGH' || riskLevel === 'CRITICAL')) {
       finalSeverity = Math.min(10.0, finalSeverity + 1.0);
    }

    return {
      behavior: "dca",
      id: this.id, 
      nameKey: this.nameKey, 
      category: 'risk', 
      severity: finalSeverity,
      profile,
      performance: performanceStatus,
      confidence: confObj.overallConfidence,
      episodes: {
        total: dcaEpisodes.length,
        wins: dcaMetrics.wins,
        losses: dcaMetrics.losses,
        breakeven: dcaMetrics.breakeven,
        details: dcaEpisodes.map(ep => {
          const firstTrade = ep.type === 'sequence' ? ep.trades?.[0] : ep.trade;
          return {
            id: ep.id || firstTrade?.id,
            asset: firstTrade?.asset || 'Unknown',
            pnl: ep.pnl,
            totalSize: (ep.features?.initialSize || 0) + (ep.features?.addedSize || 0)
          };
        })
      },
      dcaMetrics,
      nonDcaBaseline,
      edgeDelta,
      estimatedEdgeDamage,
      evidence: evidence.toObject(),
      aiInsight: aiInsightObj,
      
      affectedTradeIds: Array.from(dcaTradeIds),
      occurrences: dcaEpisodes.length,
      impact: {
         totalDamage: -Math.abs(estimatedEdgeDamage),
         realizedLoss: dcaMetrics.totalPnl < 0 ? dcaMetrics.totalPnl : 0,
         worstEpisodePnl: dcaMetrics.worstEpisodePnl,
         avgLoss: (dcaMetrics.losses > 0 ? Math.abs(dcaEpisodes.filter(ep => ep.pnl < 0).reduce((s, ep) => s + ep.pnl, 0)) / dcaMetrics.losses : 0),
         maxPositionMultiplier: dcaMetrics.maxPositionMultiplier
      },
      status: riskLevel === 'CRITICAL' || riskLevel === 'HIGH' ? 'high' : (riskLevel === 'MEDIUM' ? 'medium' : 'low')
    };
  }

  _buildAiInsight(episodes, metrics, delta, profile, performanceStatus, confObj, riskLevel, baseline, estimatedEdgeDamage) {
      let coachingMessage = null;
      if (profile === 'MARTINGALE' || profile === 'AGGRESSIVE_AVERAGING') {
          coachingMessage = `🚨 BẠN ĐANG ĐÁNH BẠC, KHÔNG PHẢI GIAO DỊCH! Việc x2, x3 khối lượng khi gồng lỗ (Martingale/Nhồi lệnh hung hãn) là con đường ngắn nhất dẫn đến cháy tài khoản. Bạn đang dùng tiền thật để mua lấy sự ảo tưởng rằng giá sẽ quay đầu. Sớm muộn cũng sẽ có 1 cú quét sạch toàn bộ tài khoản của bạn.`;
      } else if (estimatedEdgeDamage > 0) {
          coachingMessage = `💸 HÀNH VI ĐỐT TIỀN: Thói quen nhồi lệnh vô kỷ luật này đã bốc hơi trực tiếp $${estimatedEdgeDamage.toFixed(2)} khỏi tài khoản của bạn so với việc đánh 1 lệnh đơn thuần. Thay vì chấp nhận 1 khoản lỗ nhỏ, bạn tự trói mình và để thị trường cắt tiết dần.`;
      } else if (delta.expectancyR && delta.expectancyR < 0) {
          const dmgR = Math.abs(delta.expectancyR).toFixed(2);
          coachingMessage = `🩸 CHẢY MÁU HỆ THỐNG: Mỗi lần bạn ngoan cố bấm nút nhồi thêm lệnh khi giá đi ngược, bạn đang tự cầm dao cắt đi ${dmgR}R lợi nhuận kỳ vọng của chính mình. Hành vi này đang phá nát lợi thế (Edge) mà bạn khó khăn lắm mới xây dựng được.`;
      } else if (metrics.expectancy < baseline.expectancy) {
          const dmg$ = Math.abs(metrics.expectancy - baseline.expectancy).toFixed(2);
          coachingMessage = `📉 LỢI NHUẬN TỤT DỐC: Thống kê không biết nói dối. Khi bạn nhồi lệnh, lợi nhuận kỳ vọng tụt thảm hại (bạn vứt đi $${dmg$} mỗi lệnh so với lúc giữ kỷ luật). Hãy dừng ngay việc tự đào hố chôn mình!`;
      } else {
          coachingMessage = `⚠️ Bạn đang Scale-in (nhồi thêm vị thế). Hãy giữ kỷ luật thép và đảm bảo tổng rủi ro tuyệt đối không vượt quá ngưỡng cho phép của hệ thống.`;
      }

      return {
          profile,
          riskLevel,
          performance: performanceStatus,
          coachingMessage
      };
  }

  buildEvidence(episodes, metrics, nonDcaBaseline, delta, profile, confObj) {
    const ev = buildEvidence();
    
    
    if (metrics.maxPositionMultiplier > 1.2) {
        ev.addContext(`🚨 MỨC ĐỘ BƠM RỦI RO: Khối lượng tối đa từng bị nhồi lên tới ${(metrics.maxPositionMultiplier).toFixed(1)} lần so với lệnh ban đầu.`);
    }
    
    let worstEp = episodes[0];
    episodes.forEach(ep => { if (ep.pnl < worstEp.pnl) worstEp = ep; });
    
    if (worstEp && worstEp.features && worstEp.pnl < 0) {
       ev.addContext(`💥 VẾT THƯƠNG TRÍ MẠNG: Lần nhồi lệnh tệ nhất đã thổi bay $${Math.abs(worstEp.pnl).toFixed(2)} (Từ ${worstEp.features.initialSize} lot bị độn lên ${worstEp.features.totalSize} lot, exposure x${(worstEp.features.sizeMultiplier).toFixed(1)}).`);
    }

    if (episodes.length >= 3) {
        if (metrics.expectancyR != null && nonDcaBaseline.expectancyR != null && delta.expectancyR < 0) {
            ev.addContext(`📉 CHẢY MÁU TÀI KHOẢN: Cứ mỗi lần DCA, bạn lại vứt đi ${Math.abs(delta.expectancyR).toFixed(2)}R lợi nhuận kỳ vọng so với lệnh Non-DCA.`);
        } else if (metrics.expectancy < nonDcaBaseline.expectancy) {
            ev.addContext(`📉 CHẢY MÁU TÀI KHOẢN: Cứ mỗi lần DCA, bạn lại vứt đi $${Math.abs(metrics.expectancy - nonDcaBaseline.expectancy).toFixed(2)} lợi nhuận kỳ vọng so với lệnh Non-DCA.`);
        }
    }
    
    let totalAdverseTrades = 0;
    let totalRecoveries = 0;
    episodes.forEach(ep => {
        if (ep.features && ep.features.initialTradePnl < 0) {
            totalAdverseTrades++;
            if (ep.features.isRecovery) totalRecoveries++;
        }
    });

    if (totalAdverseTrades > 0) {
        const rate = (totalRecoveries / totalAdverseTrades) * 100;
        ev.addContext(`🪤 ẢO TƯỞNG CỨU LỖ: Bạn đã ${totalAdverseTrades} lần nhồi lệnh để cứu giá, nhưng chỉ thành công ${totalRecoveries} lần (Tỷ lệ thoát hiểm: ${rate.toFixed(1)}%). Phần lớn nỗ lực chỉ làm khoản lỗ phình to hơn!`);
    }

    const t3 = episodes.filter(e => e.tier === 3 || e.detectionSource.includes('STRUCTURAL_INFERENCE') || e.detectionSource.includes('ALGORITHMIC_CLUSTERING'));
    if (t3.length > 0) {
       ev.addObserved(`Phát hiện ${t3.length} cụm lệnh DCA (tự động nhóm các lệnh chồng lấp thời gian).`);
    }
    
    const emotionsFound = new Set();
    episodes.forEach(ep => {
       if (ep.tags && ep.tags.emotions) {
          ep.tags.emotions.forEach(e => emotionsFound.add(e));
       }
    });
    if (emotionsFound.size > 0) {
        ev.addObserved(`Có dấu hiệu cảm xúc chi phối khi nhồi lệnh: ${Array.from(emotionsFound).join(', ')}.`);
    }

    return ev;
  }
}

export default new DcaBehavior();
