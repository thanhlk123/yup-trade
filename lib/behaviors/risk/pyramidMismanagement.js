import { BehaviorBase } from '../BehaviorBase';
import { getMonthKey, computeTrend, minutesBetween, noteContains, parseTags } from '../helpers';
import { buildEvidence } from '../evidenceBuilder';
import { TAGS } from '../tags';

function getPyramidAddDirection(side, prevAvgEntry, newEntry) {
    if (!prevAvgEntry || !newEntry) return 'NEUTRAL';
    const diff = Math.abs(newEntry - prevAvgEntry);
    const pctDiff = prevAvgEntry > 0 ? diff / prevAvgEntry : 0;
    
    // Spread / Slippage noise threshold: if price diff < 0.005% (~1 pip / $0.1 Gold), treat as NEUTRAL noise
    if (pctDiff < 0.00005) return 'NEUTRAL';

    if (side === 'BUY') {
        if (newEntry > prevAvgEntry) return 'PYRAMID';
        if (newEntry < prevAvgEntry) return 'DCA';
        return 'NEUTRAL';
    } else if (side === 'SELL') {
        if (newEntry < prevAvgEntry) return 'PYRAMID';
        if (newEntry > prevAvgEntry) return 'DCA';
        return 'NEUTRAL';
    }
    return 'NEUTRAL';
}

function extractPyramidFeatures(orders, side) {
    if (!orders || orders.length < 2) return null;
    let isPyramiding = false;
    let pyramidAdds = 0;
    
    const initialSize = parseFloat(orders[0].size || 0);
    let avgEntry = parseFloat(orders[0].entry_price || 0);
    let totSize = initialSize;
    let addedSize = 0;
    
    let initialTradePnl = parseFloat(orders[0].pnl || 0);
    let episodePnl = initialTradePnl;
    
    for (let i = 1; i < orders.length; i++) {
        const p2 = parseFloat(orders[i].entry_price || 0);
        const s2 = parseFloat(orders[i].size || 0);
        const pnl2 = parseFloat(orders[i].pnl || 0);
        
        const dir = getPyramidAddDirection(side, avgEntry, p2);
        
        if (dir === 'PYRAMID') {
            isPyramiding = true;
            pyramidAdds++;
        }
        
        addedSize += s2;
        episodePnl += pnl2;
        totSize += s2;
        if (totSize > 0) {
            avgEntry = ((avgEntry * (totSize - s2)) + (p2 * s2)) / totSize;
        }
    }
    
    if (!isPyramiding) return null; // Only care about sequences that actually pyramid

    const totalSize = initialSize + addedSize;
    
    return {
        initialSize,
        addedSize,
        totalSize,
        pyramidAdds,
        sizeMultiplier: initialSize > 0 ? totalSize / initialSize : 1,
        initialTradePnl,
        episodePnl,
        isMismanaged: episodePnl < 0 // Pyramid is mismanaged if the overall episode is a loss
    };
}

function parseAggregatePyramid(note, trade) {
  if (!note || !note.includes('[Giao dịch DCA gộp')) return null;
  const orderRegex = /- Lệnh #\d+: Vol ([\d.]+) \| Entry ([\d.]+) -> Exit ([\d.]+) \| PnL: ([+\d.-]+)/g;
  const orders = [];
  let match;
  while ((match = orderRegex.exec(note)) !== null) {
    orders.push({
      size: parseFloat(match[1]),
      entry_price: parseFloat(match[2]),
      exit: parseFloat(match[3]),
      pnl: parseFloat(match[4])
    });
  }
  
  const features = extractPyramidFeatures(orders, trade.side);
  if (!features || features.pyramidAdds === 0) return null;

  return {
    isPyramid: true,
    count: orders.length,
    orders,
    ...features
  };
}

class PyramidMismanagementBehavior extends BehaviorBase {
  constructor() {
    super();
    this.id = 'pyramid_mismanagement';
    this.nameKey = 'bhPyramidMismanagement';
    this.category = 'risk';
    this.severity = 8.5;
    this.relatedBehaviors = ['oversized', 'hold_too_long'];
  }

  detectAllEpisodes(trades, config) {
    const pyramidEpisodes = [];
    const nonPyramidEpisodes = [];
    const usedTradeIds = new Set();
    const sorted = [...trades].sort((a,b) => new Date(a.trade_time) - new Date(b.trade_time));

    // Tier 1: Aggregate Structured Evidence (from user CSV logic)
    sorted.forEach(t => {
       const agg = parseAggregatePyramid(t.user_notes, t);
       if (agg) {
          pyramidEpisodes.push({
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

    // Tier 2: Algorithmic Clustering for single trades
    const singleTrades = sorted.filter(t => !usedTradeIds.has(t.id));
    const openClusters = {}; // key: asset, value: { trades: [], maxExitTime: number }
    const finalClusters = []; 

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
             const features = extractPyramidFeatures(sideTrades, side);
             if (features) {
                pyramidEpisodes.push({
                   type: 'sequence',
                   tier: 2,
                   trades: sideTrades,
                   features: features,
                   pnl: features.episodePnl,
                   asset: clusterObj.asset,
                   detectionSource: ['ALGORITHMIC_CLUSTERING']
                });
                sideTrades.forEach(t => usedTradeIds.add(t.id));
             }
          }
       }
    });

    // Tier 3: Single trades explicitly tagged as pyramid by user
    singleTrades.forEach(t => {
        if (!usedTradeIds.has(t.id)) {
            const mistakes = parseTags(t.mistakes);
            const userClaimsPyramid = mistakes.includes(TAGS.MISTAKE_PYRAMID) || noteContains(t, ['pyramid', 'nhồi thuận', 'scale in', 'scale-in', 'nhồi lãi']);
            
            if (userClaimsPyramid) {
                pyramidEpisodes.push({
                   type: 'single_declared',
                   tier: 1,
                   trade: t,
                   features: { initialSize: parseFloat(t.size||0), addedSize: 0, totalSize: parseFloat(t.size||0), sizeMultiplier: 1, isMismanaged: parseFloat(t.pnl||0) < 0 },
                   pnl: parseFloat(t.pnl||0),
                   asset: t.asset,
                   detectionSource: ['USER_DECLARED']
                });
                usedTradeIds.add(t.id);
            }
        }
    });

    // Baseline: Any trade still not used is non-Pyramid
    singleTrades.forEach(t => {
        if (!usedTradeIds.has(t.id)) {
            nonPyramidEpisodes.push({
                type: 'single', 
                trades: [t], 
                pnl: parseFloat(t.pnl||0), 
                initialRisk: parseFloat(t.risk_amount||0)
            });
        }
    });

    // Cross-Validation: Check Tags for Pyramid Episodes
    pyramidEpisodes.forEach(ep => {
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
       
       ep.userRecognized = allMistakes.has(TAGS.MISTAKE_PYRAMID) || tradesToCheck.some(t => noteContains(t, ['pyramid', 'nhồi thuận', 'scale in']));
    });

    return { pyramidEpisodes, nonPyramidEpisodes };
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
      let totalInitial = 0;
      let totalAdded = 0;
      let maxMultiplier = 1;

      episodes.forEach(ep => {
          if (ep.pnl < worstEpisodePnl) worstEpisodePnl = ep.pnl;
          if (ep.features) {
             totalInitial += ep.features.initialSize;
             totalAdded += ep.features.addedSize;
             if (ep.features.sizeMultiplier > maxMultiplier) maxMultiplier = ep.features.sizeMultiplier;
          } else {
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
          worstEpisodePnl, maxPositionMultiplier: maxMultiplier,
          expectancyR, profitFactorR, validREpisodes
      };
  }

  _classifyBehavior(episodes) {
     let mismanagedCount = 0;
     let totalCount = episodes.length || 1;
     let maxMultiplier = 1;

     episodes.forEach(ep => {
         if (ep.features) {
            if (ep.features.isMismanaged) mismanagedCount++;
            if (ep.features.sizeMultiplier > maxMultiplier) maxMultiplier = ep.features.sizeMultiplier;
         }
     });

     const mismanageRate = mismanagedCount / totalCount;
     
     let profile = 'EFFECTIVE_PYRAMID';
     let riskLevel = 'LOW';

     if (mismanageRate >= 0.7 && maxMultiplier >= 2) {
         profile = 'RECKLESS_SCALE_IN';
         riskLevel = 'CRITICAL';
     } else if (mismanageRate >= 0.5) {
         profile = 'POOR_MANAGEMENT';
         riskLevel = 'HIGH';
     } else if (mismanageRate > 0) {
         profile = 'SUBOPTIMAL_PYRAMID';
         riskLevel = 'MEDIUM';
     }

     return { profile, riskLevel, mismanageRate };
  }

  _calculateConfidence(episodes) {
      let sumDetection = 0;
      let sumBehavior = 0;
      
      episodes.forEach(ep => {
          let detScore = ep.tier === 1 ? 0.98 : 0.85;
          let behavScore = 0.50; 
          
          if (ep.features) {
              if (ep.features.isMismanaged) behavScore += 0.30;
              if (ep.features.sizeMultiplier > 1.5) behavScore += 0.15;
          }
          
          sumDetection += Math.min(detScore, 0.99);
          sumBehavior += Math.min(behavScore, 0.99);
      });

      const detection = episodes.length > 0 ? sumDetection / episodes.length : 0;
      const behavior = episodes.length > 0 ? sumBehavior / episodes.length : 0;
      
      let sampleStrength = 0;
      if (episodes.length >= 10) sampleStrength = 0.95;
      else if (episodes.length >= 5) sampleStrength = 0.80;
      else if (episodes.length >= 2) sampleStrength = 0.60;
      else sampleStrength = 0.20;

      const overall = (detection * 0.4) + (behavior * 0.3) + (sampleStrength * 0.3);

      return { overallConfidence: overall, detectionConfidence: detection, behaviorConfidence: behavior, sampleStrength };
  }

  run(trades, config) {
    const { pyramidEpisodes, nonPyramidEpisodes } = this.detectAllEpisodes(trades, config);
    // Pyramid behavior only triggers if there are mismanaged pyramid episodes.
    const mismanagedEpisodes = pyramidEpisodes.filter(ep => ep.features?.isMismanaged);
    
    if (!pyramidEpisodes || pyramidEpisodes.length === 0 || mismanagedEpisodes.length === 0) return null;
    
    const pyramidMetrics = this._calculateMetrics(pyramidEpisodes);
    const nonPyramidBaseline = this._calculateMetrics(nonPyramidEpisodes);
    const baseline = this._calculateMetrics([...pyramidEpisodes, ...nonPyramidEpisodes]);
    
    const edgeDelta = {
        winRate: pyramidMetrics.winRate - nonPyramidBaseline.winRate,
        profitFactor: pyramidMetrics.profitFactor - nonPyramidBaseline.profitFactor,
        expectancy: pyramidMetrics.expectancy - nonPyramidBaseline.expectancy,
        expectancyR: pyramidMetrics.expectancyR != null && nonPyramidBaseline.expectancyR != null ? pyramidMetrics.expectancyR - nonPyramidBaseline.expectancyR : null
    };

    const { profile, riskLevel, mismanageRate } = this._classifyBehavior(pyramidEpisodes);
    const performanceStatus = pyramidMetrics.totalPnl > 0 ? 'POSITIVE' : (pyramidMetrics.totalPnl < 0 ? 'NEGATIVE' : 'NEUTRAL');
    
    let estimatedEdgeDamage = 0;
    
    if (pyramidMetrics.validREpisodes > 0 && nonPyramidBaseline.validREpisodes > 0) {
        const avgRiskPerEpisode = pyramidEpisodes.reduce((s, ep) => s + (ep.features?.initialRisk || ep.initialRisk || 0), 0) / (pyramidEpisodes.length || 1);
        if (edgeDelta.expectancyR < 0) {
            estimatedEdgeDamage = Math.abs(edgeDelta.expectancyR) * avgRiskPerEpisode * pyramidEpisodes.length;
        }
    } else {
        const dcaExpectancyPerLot = pyramidMetrics.avgInitialSize > 0 ? pyramidMetrics.expectancy / pyramidMetrics.avgInitialSize : 0;
        const nonDcaExpectancyPerLot = nonPyramidBaseline.avgInitialSize > 0 ? nonPyramidBaseline.expectancy / nonPyramidBaseline.avgInitialSize : 0;
        const deltaPerLot = dcaExpectancyPerLot - nonDcaExpectancyPerLot;
        
        if (deltaPerLot < 0) {
             estimatedEdgeDamage = Math.abs(deltaPerLot) * pyramidMetrics.avgInitialSize * pyramidEpisodes.length;
        }
    }

    const confObj = this._calculateConfidence(pyramidEpisodes);
    const aiInsightObj = this._buildAiInsight(pyramidEpisodes, pyramidMetrics, edgeDelta, profile, performanceStatus, riskLevel, baseline, estimatedEdgeDamage, mismanageRate);
    const evidence = this.buildEvidence(pyramidEpisodes, pyramidMetrics, nonPyramidBaseline, edgeDelta, profile, confObj);

    const affectedTradeIds = new Set();
    pyramidEpisodes.forEach(ep => {
       if (ep.type === 'sequence') ep.trades.forEach(t => affectedTradeIds.add(t.id));
       else affectedTradeIds.add(ep.trade.id);
    });

    const allUnrecognized = pyramidEpisodes.every(ep => !ep.userRecognized);
    let finalSeverity = riskLevel === 'CRITICAL' ? 9.0 : (riskLevel === 'HIGH' ? 8.0 : (riskLevel === 'MEDIUM' ? 6.0 : 4.0));
    
    if (allUnrecognized && (riskLevel === 'HIGH' || riskLevel === 'CRITICAL')) {
       finalSeverity = Math.min(10.0, finalSeverity + 1.0);
    }

    return {
      behavior: "pyramid_mismanagement",
      id: this.id, 
      nameKey: this.nameKey, 
      category: 'risk', 
      severity: finalSeverity,
      profile,
      performance: performanceStatus,
      confidence: confObj.overallConfidence,
      episodes: {
        total: pyramidEpisodes.length,
        wins: pyramidMetrics.wins,
        losses: pyramidMetrics.losses,
        breakeven: pyramidMetrics.breakeven,
        details: pyramidEpisodes.map(ep => {
          const firstTrade = ep.type === 'sequence' ? ep.trades?.[0] : ep.trade;
          return {
            id: ep.id || firstTrade?.id,
            asset: firstTrade?.asset || 'Unknown',
            pnl: ep.pnl,
            totalSize: (ep.features?.initialSize || 0) + (ep.features?.addedSize || 0)
          };
        })
      },
      metrics: pyramidMetrics,
      baseline: nonPyramidBaseline,
      edgeDelta,
      estimatedEdgeDamage,
      evidence: evidence.toObject(),
      aiInsight: aiInsightObj,
      
      affectedTradeIds: Array.from(affectedTradeIds),
      occurrences: pyramidEpisodes.length,
      impact: {
         totalDamage: -Math.abs(estimatedEdgeDamage),
         realizedLoss: pyramidMetrics.totalPnl < 0 ? pyramidMetrics.totalPnl : 0,
         worstEpisodePnl: pyramidMetrics.worstEpisodePnl,
         maxPositionMultiplier: pyramidMetrics.maxPositionMultiplier
      },
      status: riskLevel === 'CRITICAL' || riskLevel === 'HIGH' ? 'high' : (riskLevel === 'MEDIUM' ? 'medium' : 'low')
    };
  }

  _buildAiInsight(episodes, metrics, delta, profile, performanceStatus, riskLevel, baseline, estimatedEdgeDamage, mismanageRate) {
      let coachingMessage = null;
      if (profile === 'RECKLESS_SCALE_IN') {
          coachingMessage = `🚨 BẠN ĐANG NHỒI LỆNH TRÊN ĐỈNH/ĐÁY! Pyramiding là chiến lược tốt để tối đa hóa lợi nhuận theo xu hướng, nhưng bạn đang Scale-in quá trễ hoặc quá lớn khi giá đã đi xa. Hậu quả là giá giật lùi nhẹ (pullback) đã lập tức biến một lệnh đang LÃI TO thành một lệnh LỖ NẶNG.`;
      } else if (estimatedEdgeDamage > 0) {
          coachingMessage = `💸 PHÁ NÁT LỢI THẾ: Việc nhồi thuận sai cách đã thổi bay $${estimatedEdgeDamage.toFixed(2)} lợi nhuận tiềm năng của bạn. Nếu bạn chỉ giữ nguyên khối lượng ban đầu, bạn đã có lãi, nhưng lòng tham nhồi thêm đã khiến giá trung bình bị kéo lại quá sát giá hiện tại.`;
      } else if (delta.expectancyR && delta.expectancyR < 0) {
          const dmgR = Math.abs(delta.expectancyR).toFixed(2);
          coachingMessage = `🩸 CHẢY MÁU HỆ THỐNG: Mỗi lần bạn nhồi thuận thất bại, bạn tự cắt đi ${dmgR}R lợi nhuận kỳ vọng. Pyramiding cần dời Stoploss lên Break-even hoặc khóa lãi trước khi nhồi. Bạn đang nhồi lệnh trong khi vẫn thả nổi rủi ro!`;
      } else if (mismanageRate > 0.5) {
          coachingMessage = `📉 QUẢN LÝ VỊ THẾ KÉM: Hơn 50% số lần bạn nhồi lệnh thuận đều dẫn đến kết cục thua lỗ. Hãy xem lại điểm nhồi lệnh, đừng nhồi khi xu hướng đã có dấu hiệu kiệt sức.`;
      } else {
          coachingMessage = `⚠️ Bạn đang sử dụng chiến lược Scale-in (Nhồi thuận). Hãy nhớ dời Stop-loss để khóa lãi phần lệnh đầu trước khi nhồi lệnh thứ 2 để không biến lệnh thắng thành lệnh thua.`;
      }

      return {
          profile,
          riskLevel,
          performance: performanceStatus,
          coachingMessage
      };
  }

  buildEvidence(episodes, metrics, nonPyramidBaseline, delta, profile, confObj) {
    const ev = buildEvidence();
    
    if (metrics.maxPositionMultiplier > 1.5) {
        ev.addContext(`🚨 MỨC ĐỘ BƠM KHỐI LƯỢNG: Khi nhồi thuận, khối lượng tối đa từng bị nhồi lên tới ${(metrics.maxPositionMultiplier).toFixed(1)} lần so với lệnh ban đầu.`);
    }
    
    const mismanagedEps = episodes.filter(ep => ep.features?.isMismanaged);
    
    let worstEp = mismanagedEps[0];
    mismanagedEps.forEach(ep => { if (ep.pnl < worstEp?.pnl) worstEp = ep; });
    
    if (worstEp && worstEp.pnl < 0) {
       ev.addContext(`💥 VẾT THƯƠNG TRÍ MẠNG: Cụm nhồi thuận tệ nhất đã biến thành khoản lỗ $${Math.abs(worstEp.pnl).toFixed(2)}. Thay vì chốt lời, vị thế bị kéo giá trung bình (Entry) lên quá sát và bị Stop-loss quét sạch.`);
    }

    if (episodes.length >= 3) {
        if (metrics.expectancyR != null && nonPyramidBaseline.expectancyR != null && delta.expectancyR < 0) {
            ev.addContext(`📉 HỦY HOẠI LỢI THẾ: Cứ mỗi lần nhồi thuận sai cách, bạn vứt đi ${Math.abs(delta.expectancyR).toFixed(2)}R lợi nhuận kỳ vọng so với việc giữ lệnh đơn (Non-Pyramid).`);
        } else if (metrics.expectancy < nonPyramidBaseline.expectancy) {
            ev.addContext(`📉 HỦY HOẠI LỢI THẾ: Cứ mỗi lần nhồi thuận sai cách, bạn vứt đi $${Math.abs(metrics.expectancy - nonPyramidBaseline.expectancy).toFixed(2)} lợi nhuận kỳ vọng.`);
        }
    }
    
    const emotionsFound = new Set();
    episodes.forEach(ep => {
       if (ep.tags && ep.tags.emotions) {
          ep.tags.emotions.forEach(e => emotionsFound.add(e));
       }
    });
    if (emotionsFound.size > 0) {
        ev.addObserved(`Có dấu hiệu cảm xúc chi phối khi nhồi lệnh thuận: ${Array.from(emotionsFound).join(', ')}. Sự Tham Lam (Greed) hoặc FOMO có thể là nguyên nhân bạn nhồi đỉnh.`);
    }

    return ev;
  }
}

export default new PyramidMismanagementBehavior();
