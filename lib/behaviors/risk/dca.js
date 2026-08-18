import { BehaviorBase } from '../BehaviorBase';
import { getMonthKey, computeTrend, minutesBetween, noteContains } from '../helpers';
import { buildEvidence } from '../evidenceBuilder';
import { TAGS } from '../tags';

function getEscalationPattern(sizes) {
    if (sizes.length <= 1) return 'FLAT';
    let progressive = 0;
    let decreasing = 0;
    let flat = 0;
    let martingaleSteps = 0;

    for (let i = 1; i < sizes.length; i++) {
        const prevS = sizes[i-1] || sizes[0];
        const s = sizes[i];
        
        if (s >= 1.8 * prevS) martingaleSteps++;
        else if (s > 1.1 * prevS) progressive++;
        else if (s < 0.9 * prevS) decreasing++;
        else flat++;
    }

    if (martingaleSteps >= 2) return 'MARTINGALE';
    if (martingaleSteps === 1) return 'AGGRESSIVE_STEP';
    if (decreasing > 0 && (progressive > 0 || martingaleSteps > 0)) return 'MIXED';
    if (decreasing > 0 && progressive === 0 && martingaleSteps === 0) return 'DECREASING';
    if (progressive > 0 || martingaleSteps > 0) return 'PROGRESSIVE';
    return 'FLAT';
}

function hasOpenTradeInEpisode(cluster, tOpenTime) {
    for (const ct of cluster) {
        const ctExit = ct.exit_time ? new Date(ct.exit_time).getTime() : Infinity;
        if (tOpenTime < ctExit) return true;
    }
    return false;
}

function computeWeightedAvgEntry(cluster) {
    let totalSize = 0;
    let totalValue = 0;
    for (const t of cluster) {
        const size = parseFloat(t.size || 0);
        const price = parseFloat(t.entry_price || 0);
        totalSize += size;
        totalValue += (size * price);
    }
    return totalSize > 0 ? totalValue / totalSize : 0;
}

function getAddDirection(side, prevAvgEntry, newEntry) {
    if (!prevAvgEntry) return 'NEUTRAL';
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
  
  if (orders.length >= 2) {
    let isAveragingDown = false;
    let avgEntry = orders[0].entry;
    let totSize = orders[0].size;
    
    for(let i=1; i<orders.length; i++) {
        const p2 = orders[i].entry;
        const dir = getAddDirection(trade.side, avgEntry, p2);
        if (dir === 'ADVERSE') isAveragingDown = true;
        
        totSize += orders[i].size;
        avgEntry = ((avgEntry * (totSize - orders[i].size)) + (p2 * orders[i].size)) / totSize;
    }

    const initialSize = orders[0].size;
    let addedSize = 0;
    let maxSingleAdd = 0;
    let adverseDistance = 0;
    let adversePct = 0;
    const p1 = orders[0].entry;
    const sizes = [initialSize];

    let initialTradePnl = orders[0].pnl;
    let addedTradesPnl = 0;
    let episodePnl = initialTradePnl;

    for (let i = 1; i < orders.length; i++) {
        sizes.push(orders[i].size);
        addedSize += orders[i].size;
        if (orders[i].size > maxSingleAdd) maxSingleAdd = orders[i].size;
        
        const dist = Math.abs(orders[i].entry - p1);
        if (dist > adverseDistance) adverseDistance = dist;
        const pct = p1 > 0 ? dist / p1 : 0;
        if (pct > adversePct) adversePct = pct;
        
        addedTradesPnl += orders[i].pnl;
        episodePnl += orders[i].pnl;
    }

    const totalSize = initialSize + addedSize;
    const escalationPattern = getEscalationPattern(sizes);

    return {
      isDca: true,
      count: orders.length,
      initialSize,
      addedSize,
      totalSize,
      maxSingleAdd,
      adverseDistance,
      adversePct,
      escalationPattern,
      sizeMultiplier: initialSize > 0 ? totalSize / initialSize : 1,
      orders,
      initialRisk: null,
      totalRisk: null,
      riskMultiplier: null,
      addToInvalidationRatio: null,
      initialTradePnl,
      addedTradesPnl,
      episodePnl,
      isRecovery: initialTradePnl < 0 && episodePnl > 0
    };
  }
  return null;
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

    // 2. Mọi lệnh còn lại được xem là lệnh đơn (non-DCA)
    sorted.forEach(t => {
        if (!usedTradeIds.has(t.id)) {
            nonDcaEpisodes.push({
                type: 'single', 
                trades: [t], 
                pnl: parseFloat(t.pnl||0), 
                initialRisk: parseFloat(t.risk_amount||0)
            });
        }
    });

    return { dcaEpisodes, nonDcaEpisodes };
  }

  _calculateMetrics(episodes) {
      if (episodes.length === 0) {
         return { winRate: 0, profitFactor: 0, expectancy: 0, totalPnl: 0, avgEpisodePnl: 0, avgInitialSize: 0, avgAddedSize: 0, wins: 0, losses: 0, breakeven: 0, worstEpisodePnl: 0, maxPositionMultiplier: 0, expectancyR: null, profitFactorR: null };
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
      let winR = 0;
      let lossR = 0;

      episodes.forEach(ep => {
         const rAmount = ep.features?.initialRisk || ep.initialRisk; 
         if (rAmount && rAmount > 0) {
             const epR = ep.pnl / rAmount;
             if (epR > 0) winR += epR;
             if (epR < 0) lossR += Math.abs(epR);
             validREpisodes++;
         }
      });
      
      let expectancyR = null;
      let profitFactorR = null;
      if (validREpisodes > 0) {
          const avgWinR = winR / (wins.length || 1);
          const avgLossR = lossR / (losses.length || 1);
          expectancyR = (winRate * avgWinR) - (lossRate * avgLossR);
          profitFactorR = lossR > 0 ? winR / lossR : (winR > 0 ? 99 : 0);
      }

      let worstEpisodePnl = 0;
      let totalInitial = 0;
      let totalAdded = 0;
      let maxMultiplier = 1;

      episodes.forEach(ep => {
          if (ep.pnl < worstEpisodePnl) worstEpisodePnl = ep.pnl;
          if (ep.features) {
             totalInitial += ep.features.initialSize;
             totalAdded += ep.features.addedSize;
             if (ep.features.sizeMultiplier > maxMultiplier) maxMultiplier = ep.features.sizeMultiplier;
          }
      });
      
      return {
          winRate, lossRate, profitFactor, expectancy, totalPnl,
          avgEpisodePnl: totalPnl / episodes.length,
          avgInitialSize: totalInitial / episodes.length,
          avgAddedSize: totalAdded / episodes.length,
          wins: wins.length, losses: losses.length, breakeven: breakeven.length,
          worstEpisodePnl, maxPositionMultiplier: maxMultiplier,
          expectancyR, profitFactorR
      };
  }

  _classifyBehavior(episodes) {
     let profile = 'CONTROLLED_SCALE_IN';
     let riskLevel = 'LOW';

     let hasMartingale = false;
     let hasAggressiveStep = false;
     let maxMultiplier = 1;
     let maxRiskMultiplier = 1;
     let maxInvalidation = 0;

     episodes.forEach(ep => {
         if (ep.features) {
            if (ep.features.escalationPattern === 'MARTINGALE') hasMartingale = true;
            if (ep.features.escalationPattern === 'AGGRESSIVE_STEP') hasAggressiveStep = true;
            if (ep.features.sizeMultiplier > maxMultiplier) maxMultiplier = ep.features.sizeMultiplier;
            if (ep.features.riskMultiplier != null && ep.features.riskMultiplier > maxRiskMultiplier) maxRiskMultiplier = ep.features.riskMultiplier;
            if (ep.features.addToInvalidationRatio != null && ep.features.addToInvalidationRatio > maxInvalidation) maxInvalidation = ep.features.addToInvalidationRatio;
         }
     });

     const effectiveMultiplier = Math.max(maxMultiplier, maxRiskMultiplier);

     if (maxInvalidation >= 0.8 || (hasMartingale && effectiveMultiplier >= 4)) {
         profile = 'DESTRUCTIVE_DCA';
         riskLevel = 'CRITICAL';
     } else if (hasMartingale) {
         profile = 'MARTINGALE';
         riskLevel = 'HIGH';
     } else if (effectiveMultiplier >= 3) {
         profile = 'AGGRESSIVE_AVERAGING';
         riskLevel = 'HIGH';
     } else if (effectiveMultiplier > 1.5 || hasAggressiveStep || maxInvalidation >= 0.5) {
         profile = 'AVERAGING_DOWN';
         riskLevel = 'MEDIUM';
     } else if (maxMultiplier > 1.2) {
         profile = 'AGGRESSIVE_SCALE_IN';
         riskLevel = 'LOW';
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
          if (ep.tier === 1) detScore = 0.98;
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
      if (episodes.length >= 5) sampleStrength = 0.95;
      else if (episodes.length >= 3) sampleStrength = 0.70;
      else if (episodes.length === 2) sampleStrength = 0.45;
      else if (episodes.length === 1) sampleStrength = 0.20;

      return { detection, behavior, sampleStrength };
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
    
    // Legacy mapping for UI
    let legacyClassification = 'insufficient_data';
    if (dcaEpisodes.length >= 3) {
       if (profile === 'DESTRUCTIVE_DCA' || profile === 'MARTINGALE' || profile === 'AGGRESSIVE_AVERAGING') legacyClassification = 'harmful';
       else if (profile === 'AVERAGING_DOWN') legacyClassification = 'underperforming';
       else legacyClassification = 'effective';
    }

    const confObj = this._calculateConfidence(dcaEpisodes);
    const evidence = this.buildEvidence(dcaEpisodes, dcaMetrics, nonDcaBaseline, edgeDelta, profile, confObj);
    const aiInsightObj = this._buildAiInsight(dcaEpisodes, dcaMetrics, edgeDelta, profile, performanceStatus, confObj);

    // Affected trades collection
    const dcaTradeIds = new Set();
    dcaEpisodes.forEach(ep => {
       if (ep.type === 'sequence') ep.trades.forEach(t => dcaTradeIds.add(t.id));
       else dcaTradeIds.add(ep.trade.id);
    });

    return {
      behavior: "dca",
      id: this.id, 
      nameKey: this.nameKey, 
      category: 'risk', 
      severity: riskLevel === 'CRITICAL' ? 9.5 : (riskLevel === 'HIGH' ? 8.5 : (riskLevel === 'MEDIUM' ? 6.5 : 4.0)),
      classification: legacyClassification,
      profile,
      performance: performanceStatus,
      confidence: confObj.detection,
      confidenceDetails: confObj,
      episodes: {
        total: dcaEpisodes.length,
        wins: dcaMetrics.wins,
        losses: dcaMetrics.losses,
        breakeven: dcaMetrics.breakeven
      },
      dcaMetrics,
      baseline,
      nonDcaBaseline,
      edgeDelta,
      evidence: evidence.toObject(),
      aiInsight: aiInsightObj,
      
      affectedTradeIds: Array.from(dcaTradeIds),
      occurrences: dcaEpisodes.length,
      impact: {
         totalDamage: dcaMetrics.totalPnl < 0 ? dcaMetrics.totalPnl : 0,
         worstEpisodePnl: dcaMetrics.worstEpisodePnl,
         avgLoss: (dcaMetrics.losses > 0 ? Math.abs(dcaEpisodes.filter(ep => ep.pnl < 0).reduce((s, ep) => s + ep.pnl, 0)) / dcaMetrics.losses : 0),
         maxPositionMultiplier: dcaMetrics.maxPositionMultiplier
      },
      status: riskLevel === 'CRITICAL' || riskLevel === 'HIGH' ? 'high' : (riskLevel === 'MEDIUM' ? 'medium' : 'low')
    };
  }

  _buildAiInsight(episodes, metrics, delta, profile, performanceStatus, confObj) {
      let maxAddCount = 0;
      let maxMult = 1;
      let maxRiskMult = 1;
      let dominantPattern = 'FLAT';
      let maxAdversePct = 0;
      let maxInvalidation = 0;
      
      let totalRecoveries = 0;
      let totalAdverseTrades = 0;

      episodes.forEach(ep => {
          if (ep.features) {
              if (ep.features.count > maxAddCount) maxAddCount = ep.features.count - 1;
              if (ep.features.sizeMultiplier > maxMult) maxMult = ep.features.sizeMultiplier;
              if (ep.features.riskMultiplier != null && ep.features.riskMultiplier > maxRiskMult) maxRiskMult = ep.features.riskMultiplier;
              if (ep.features.adversePct > maxAdversePct) maxAdversePct = ep.features.adversePct;
              if (ep.features.addToInvalidationRatio != null && ep.features.addToInvalidationRatio > maxInvalidation) maxInvalidation = ep.features.addToInvalidationRatio;
              if (ep.features.escalationPattern === 'MARTINGALE') dominantPattern = 'MARTINGALE';
              else if (dominantPattern !== 'MARTINGALE' && ep.features.escalationPattern === 'PROGRESSIVE') dominantPattern = 'PROGRESSIVE';
              
              if (ep.features.initialTradePnl < 0) {
                  totalAdverseTrades++;
                  if (ep.features.isRecovery) totalRecoveries++;
              }
          }
      });

      return {
          profile,
          riskLevel: this.severity > 8 ? 'HIGH' : 'LOW',
          performance: performanceStatus,
          why: {
              addCount: maxAddCount,
              sizeMultiplier: maxMult,
              riskMultiplier: maxRiskMult > 1 ? maxRiskMult : null,
              escalationPattern: dominantPattern,
              adversePct: maxAdversePct,
              addToInvalidationRatio: maxInvalidation > 0 ? maxInvalidation : null
          },
          recovery: {
              attempted: totalAdverseTrades,
              succeeded: totalRecoveries,
              recoveryRate: totalAdverseTrades > 0 ? totalRecoveries / totalAdverseTrades : 0
          },
          outcome: {
              pnl: metrics.totalPnl,
              expectancy: metrics.expectancy,
              expectancyR: metrics.expectancyR,
              edgeDeltaExpectancyR: delta.expectancyR
          },
          confidence: confObj
      };
  }

  buildEvidence(episodes, metrics, nonDcaBaseline, delta, profile, confObj) {
    const ev = buildEvidence();
    
    ev.addContext(`DCA Profile: ${profile}`);
    
    const multiplierPct = (metrics.avgAddedSize / (metrics.avgInitialSize || 1)) * 100;
    const exposurePct = 100 + multiplierPct;
    ev.addContext(`Khi vị thế đi ngược, bạn thường bổ sung lượng vị thế tương đương ${multiplierPct.toFixed(0)}% ban đầu (Tổng exposure ${exposurePct.toFixed(0)}%).`);
    
    let worstEp = episodes[0];
    episodes.forEach(ep => { if (ep.pnl < worstEp.pnl) worstEp = ep; });
    
    if (worstEp && worstEp.features) {
       ev.addContext(`Worst episode: Bắt đầu ${worstEp.features.initialSize} lot, thêm ${worstEp.features.addedSize} → ${worstEp.features.totalSize} lot, tổng exposure ${(worstEp.features.sizeMultiplier).toFixed(1)}x, PnL cuối: $${worstEp.pnl.toFixed(2)}.`);
    }

    if (episodes.length >= 3) {
        if (metrics.expectancyR != null && nonDcaBaseline.expectancyR != null) {
            ev.addContext(`So sánh với lệnh Non-DCA: Expectancy ${metrics.expectancyR.toFixed(2)}R vs ${nonDcaBaseline.expectancyR.toFixed(2)}R`);
        } else {
            ev.addContext(`So sánh với lệnh Non-DCA: Expectancy $${metrics.expectancy.toFixed(2)} vs $${nonDcaBaseline.expectancy.toFixed(2)}`);
        }
    }

    const t3 = episodes.filter(e => e.tier === 3 || e.detectionSource.includes('STRUCTURAL_INFERENCE'));
    if (t3.length > 0) {
       ev.addObserved(`Phát hiện ${t3.length} cụm lệnh Averaging down (nhồi khi giá bất lợi).`);
    }

    return ev;
  }
}

export default new DcaBehavior();
