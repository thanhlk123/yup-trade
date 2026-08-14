import { BehaviorBase } from '../BehaviorBase';
import { getMonthKey, computeTrend, minutesBetween, noteContains } from '../helpers';
import { buildEvidence } from '../evidenceBuilder';
import { TAGS } from '../tags';

function parseAggregateDca(note, trade) {
  if (!note || !note.includes('[Giao dịch DCA gộp')) return null;
  const orderRegex = /- Lệnh #\d+: Vol ([\d.]+) \| Entry ([\d.]+) -> Exit ([\d.]+) \| PnL: ([\d.-]+)/g;
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
    // Validate averaging down based on trade side for ALL subsequent orders
    const p1 = orders[0].entry;
    let isAveragingDown = true;
    for(let i=1; i<orders.length; i++) {
        const p2 = orders[i].entry;
        if (trade.side === 'BUY' && p2 >= p1) isAveragingDown = false;
        if (trade.side === 'SELL' && p2 <= p1) isAveragingDown = false;
    }
    
    if (!isAveragingDown) {
       return null; // This is a scale-in (pyramid), not averaging down DCA
    }

    const initialSize = orders[0].size;
    const addedSize = orders.slice(1).reduce((s, o) => s + o.size, 0);
    const totalSize = initialSize + addedSize;
    return {
      isDca: true,
      count: orders.length,
      initialSize,
      addedSize,
      totalSize,
      orders
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

  detectEpisodes(trades, config) {
    const episodes = [];
    const usedTradeIds = new Set();
    const sorted = [...trades].sort((a,b) => new Date(a.trade_time) - new Date(b.trade_time));

    // 1. Tier 1: Aggregate Structured Evidence
    sorted.forEach(t => {
       const agg = parseAggregateDca(t.user_notes, t);
       if (agg) {
          episodes.push({
             type: 'aggregate',
             tier: 1,
             trade: t,
             metadata: agg,
             pnl: parseFloat(t.pnl || 0),
             asset: t.asset,
             detectionSource: ['AGGREGATE_STRUCTURED']
          });
          usedTradeIds.add(t.id);
       }
    });

    // 2. Tier 3: Strong Inferred (Auto clustering)
    let currentCluster = [];
    for (let i = 0; i < sorted.length; i++) {
      const t = sorted[i];
      if (usedTradeIds.has(t.id)) continue;

      if (currentCluster.length === 0) {
        currentCluster.push(t);
        continue;
      }
      
      const prev = currentCluster[currentCluster.length - 1];
      const mins = minutesBetween(prev.trade_time, t.trade_time);
      const thresholdMins = config?.timeWindows?.DCA_CLUSTER_MINS || 240;

      if (mins !== null && mins < thresholdMins && prev.asset === t.asset && prev.side === t.side) {
        const t1Exit = prev.exit_time ? new Date(prev.exit_time).getTime() : Infinity;
        const t2Open = new Date(t.trade_time).getTime();
        const isOverlapping = t2Open < t1Exit;
        
        const p1 = parseFloat(prev.entry_price);
        const p2 = parseFloat(t.entry_price);
        const isAveragingDown = (t.side === 'BUY' && p2 < p1) || (t.side === 'SELL' && p2 > p1);
        
        if (isOverlapping && isAveragingDown) {
          currentCluster.push(t);
        } else {
          if (currentCluster.length >= 2) {
             episodes.push(this._createSequenceEpisode(currentCluster));
             currentCluster.forEach(ct => usedTradeIds.add(ct.id));
          }
          currentCluster = [t];
        }
      } else {
        if (currentCluster.length >= 2) {
           episodes.push(this._createSequenceEpisode(currentCluster));
           currentCluster.forEach(ct => usedTradeIds.add(ct.id));
        }
        currentCluster = [t];
      }
    }
    if (currentCluster.length >= 2) {
       episodes.push(this._createSequenceEpisode(currentCluster));
       currentCluster.forEach(ct => usedTradeIds.add(ct.id));
    }

    // 3. Tier 2 & Tier 4: Single Declared & Text Keyword
    sorted.forEach(t => {
       if (usedTradeIds.has(t.id)) return;
       const isTier2 = t.mistakes?.includes(TAGS.MISTAKE_DCA);
       const hasDcaKeyword = noteContains(t, ['dca', 'nhồi lỗ', 'average down', 'bắt thêm']);
       const hasNegation = noteContains(t, ['không dca', 'no dca']);
       const isTier4 = hasDcaKeyword && !hasNegation;
       
       if (isTier2 || isTier4) {
          episodes.push({
             type: 'single',
             tier: isTier2 ? 2 : 4,
             trade: t,
             pnl: parseFloat(t.pnl || 0),
             asset: t.asset,
             detectionSource: [isTier2 ? 'USER_DECLARED' : 'TEXT_KEYWORD']
          });
          usedTradeIds.add(t.id);
       }
    });

    return episodes;
  }
  
  _createSequenceEpisode(cluster) {
     const sources = ['STRUCTURAL_INFERENCE'];
     let tier = 3;
     if (cluster.some(t => t.mistakes?.includes(TAGS.MISTAKE_DCA))) {
        tier = 2; 
        sources.push('USER_DECLARED');
     } else if (cluster.some(t => noteContains(t, ['dca', 'nhồi']))) {
        sources.push('TEXT_KEYWORD');
     }
     
     return {
        type: 'sequence',
        tier,
        trades: [...cluster],
        pnl: cluster.reduce((sum, t) => sum + parseFloat(t.pnl || 0), 0),
        asset: cluster[0].asset,
        detectionSource: sources
     };
  }

  _calculateMetrics(episodes) {
      if (episodes.length === 0) return { winRate: 0, profitFactor: 0, expectancy: 0, totalPnl: 0, avgEpisodePnl: 0, avgInitialSize: 0, avgAddedSize: 0, wins: 0, losses: 0, breakeven: 0 };
      
      const wins = episodes.filter(ep => ep.pnl > 0);
      const losses = episodes.filter(ep => ep.pnl < 0);
      const breakeven = episodes.filter(ep => ep.pnl === 0);
      
      const sumWins = wins.reduce((s, ep) => s + ep.pnl, 0);
      const sumLoss = Math.abs(losses.reduce((s, ep) => s + ep.pnl, 0));
      const totalPnl = sumWins - sumLoss;
      
      const winRate = wins.length / episodes.length;
      const avgWin = wins.length > 0 ? sumWins / wins.length : 0;
      const avgLoss = losses.length > 0 ? sumLoss / losses.length : 0;
      const expectancy = (winRate * avgWin) - ((1 - winRate) * avgLoss);
      const profitFactor = sumLoss > 0 ? sumWins / sumLoss : (sumWins > 0 ? 99 : 0);
      
      let totalInitial = 0;
      let totalAdded = 0;
      episodes.forEach(ep => {
          if (ep.type === 'aggregate' && ep.metadata) {
              totalInitial += ep.metadata.initialSize;
              totalAdded += ep.metadata.addedSize;
          } else if (ep.type === 'sequence') {
              totalInitial += parseFloat(ep.trades[0].size || 0);
              totalAdded += ep.trades.slice(1).reduce((s, t) => s + parseFloat(t.size || 0), 0);
          } else {
              totalInitial += parseFloat(ep.trade.size || 0);
          }
      });
      
      return {
          winRate,
          profitFactor,
          expectancy,
          totalPnl,
          avgEpisodePnl: totalPnl / episodes.length,
          avgInitialSize: totalInitial / episodes.length,
          avgAddedSize: totalAdded / episodes.length,
          wins: wins.length,
          losses: losses.length,
          breakeven: breakeven.length
      };
  }

  _calculateBaseline(trades) {
      if (trades.length === 0) return { winRate: 0, profitFactor: 0, expectancy: 0 };
      const wins = trades.filter(t => t.status === 'WIN');
      const losses = trades.filter(t => t.status === 'LOSS');
      
      const sumWins = wins.reduce((s, t) => s + parseFloat(t.pnl || 0), 0);
      const sumLoss = Math.abs(losses.reduce((s, t) => s + parseFloat(t.pnl || 0), 0));
      
      const winRate = wins.length / trades.length;
      const avgWin = wins.length > 0 ? sumWins / wins.length : 0;
      const avgLoss = losses.length > 0 ? sumLoss / losses.length : 0;
      const expectancy = (winRate * avgWin) - ((1 - winRate) * avgLoss);
      const profitFactor = sumLoss > 0 ? sumWins / sumLoss : (sumWins > 0 ? 99 : 0);
      
      return { winRate, profitFactor, expectancy };
  }

  run(trades, config) {
    const episodes = this.detectEpisodes(trades, config);
    if (!episodes || episodes.length === 0) return null;
    
    // DCA Metrics
    const dcaMetrics = this._calculateMetrics(episodes);
    
    // Baselines
    const baseline = this._calculateBaseline(trades);
    
    // Non-DCA baseline
    const dcaTradeIds = new Set();
    episodes.forEach(ep => {
       if (ep.type === 'sequence') ep.trades.forEach(t => dcaTradeIds.add(t.id));
       else dcaTradeIds.add(ep.trade.id);
    });
    const nonDcaTrades = trades.filter(t => !dcaTradeIds.has(t.id));
    const nonDcaBaseline = this._calculateBaseline(nonDcaTrades);
    
    // Edge Delta vs Non-DCA
    const edgeDelta = {
        winRate: dcaMetrics.winRate - nonDcaBaseline.winRate,
        profitFactor: dcaMetrics.profitFactor - nonDcaBaseline.profitFactor,
        expectancy: dcaMetrics.expectancy - nonDcaBaseline.expectancy
    };

    // Classification
    let classification = 'insufficient_data';
    const totalEpisodes = episodes.length;
    
    if (totalEpisodes >= 3) {
        if (dcaMetrics.expectancy < 0 && dcaMetrics.profitFactor < 1) {
            classification = 'harmful';
        } else if (edgeDelta.expectancy < -5 || edgeDelta.winRate < -0.05) {
            classification = 'harmful';
        } else if (edgeDelta.expectancy >= 0 && edgeDelta.profitFactor >= 0 && totalEpisodes >= 5) {
            classification = 'effective';
        } else if (dcaMetrics.expectancy > 0 && edgeDelta.expectancy < 0) {
            classification = 'underperforming';
        } else {
            classification = 'neutral';
        }
    }

    const isGood = classification === 'effective';
    
    const evidence = this.buildEvidence(episodes, dcaMetrics, baseline, nonDcaBaseline, edgeDelta, classification);
    
    let sumConf = 0;
    episodes.forEach(ep => {
       if (ep.tier === 1) sumConf += 0.98;
       else if (ep.tier === 2) sumConf += 0.92;
       else if (ep.tier === 3) sumConf += 0.85;
       else sumConf += 0.70;
    });
    const avgConf = episodes.length > 0 ? sumConf / episodes.length : 0;
    
    let confPenalty = 0;
    if (totalEpisodes < 3) confPenalty = 0.5;
    else if (totalEpisodes <= 9) confPenalty = 0.15;
    else if (totalEpisodes <= 19) confPenalty = 0.05;
    
    const finalConfidence = Math.max(0.1, avgConf - confPenalty);

    return {
      behavior: "dca",
      id: this.id, 
      nameKey: this.nameKey, 
      category: isGood ? 'good' : 'risk', // Bridge for UI compatibility
      severity: this.severity,
      classification,
      confidence: finalConfidence,
      episodes: {
        total: totalEpisodes,
        wins: dcaMetrics.wins,
        losses: dcaMetrics.losses,
        breakeven: dcaMetrics.breakeven
      },
      dcaMetrics,
      baseline,
      nonDcaBaseline,
      edgeDelta,
      evidence: evidence.toObject(),
      
      // Legacy UI Support
      affectedTradeIds: Array.from(dcaTradeIds),
      occurrences: totalEpisodes,
      impact: {
         totalDamage: dcaMetrics.totalPnl < 0 ? dcaMetrics.totalPnl : 0,
         worstSingle: 0,
         avgDamage: 0
      },
      status: classification === 'harmful' ? 'high' : (classification === 'insufficient_data' ? 'info' : 'medium')
    };
  }

  buildEvidence(episodes, metrics, baseline, nonDcaBaseline, delta, classification) {
    const ev = buildEvidence();
    
    ev.addDerived(`Tổng quan về Averaging Down (Nhồi lỗ):`);
    ev.addDerived(`${episodes.length} chu kỳ (Episodes) | ${metrics.wins}W - ${metrics.losses}L`);
    ev.addDerived(`Tỉ lệ thắng (Win Rate): ${(metrics.winRate * 100).toFixed(1)}%`);
    ev.addDerived(`Lợi nhuận ròng (Total PnL): $${metrics.totalPnl.toFixed(2)}`);

    if (episodes.length >= 3) {
        ev.addDerived(`Phân tích Edge (DCA vs Non-DCA):`);
        ev.addDerived(`Win Rate: ${(metrics.winRate * 100).toFixed(1)}% vs ${(nonDcaBaseline.winRate * 100).toFixed(1)}% (Non-DCA)`);
        ev.addDerived(`Profit Factor: ${metrics.profitFactor.toFixed(2)} vs ${nonDcaBaseline.profitFactor.toFixed(2)} (Non-DCA)`);
        ev.addDerived(`Expectancy: ${metrics.expectancy.toFixed(2)} vs ${nonDcaBaseline.expectancy.toFixed(2)} (Non-DCA)`);

        ev.addDerived(`Added Risk / Exposure (Gia tăng rủi ro):`);
        ev.addDerived(`Trung bình bạn đã tăng khối lượng vị thế thêm ${((metrics.avgAddedSize / metrics.avgInitialSize) * 100).toFixed(0)}% sau khi lệnh ban đầu bị âm.`);

        if (classification === 'harmful') {
           ev.addDerived(`ĐÁNH GIÁ (HARMFUL): Hành vi DCA đang phá hủy lợi thế giao dịch của bạn. Expectancy giảm mạnh so với những lệnh bạn không nhồi.`);
        } else if (classification === 'underperforming') {
           ev.addDerived(`ĐÁNH GIÁ (UNDERPERFORMING): DCA vẫn có lãi, nhưng hiệu suất kém hơn đáng kể so với hệ thống giao dịch gốc của bạn.`);
        } else if (classification === 'effective') {
           ev.addDerived(`ĐÁNH GIÁ (EFFECTIVE): Hệ thống ghi nhận DCA của bạn là một chiến lược Scale-in có Edge dương.`);
        } else {
           ev.addDerived(`ĐÁNH GIÁ (NEUTRAL): DCA không gây ảnh hưởng tiêu cực đáng kể lên hệ thống của bạn.`);
        }
    } else {
        ev.addDerived(`ĐÁNH GIÁ (INSUFFICIENT DATA): Bạn mới có ${episodes.length} chu kỳ DCA được ghi nhận. Chưa đủ dữ liệu để kết luận DCA là chiến lược có lợi hay gây hại.`);
    }

    const t1 = episodes.filter(e => e.tier === 1);
    if (t1.length > 0) {
       const sample = t1[0];
       ev.addObserved(`Ví dụ lệnh gộp cấu trúc (Aggregate) - Lệnh ${sample.asset}:`);
       ev.addObserved(`${sample.metadata.count} lệnh con (Size đầu: ${sample.metadata.initialSize} → Thêm: +${sample.metadata.addedSize})`);
       ev.addObserved(`PnL chu kỳ: $${sample.pnl.toFixed(2)}`);
    }

    const t3 = episodes.filter(e => e.tier === 3 || e.detectionSource.includes('STRUCTURAL_INFERENCE'));
    if (t3.length > 0) {
       ev.addObserved(`Phát hiện tự động ${t3.length} cụm lệnh nhồi lỗ liên tiếp.`);
    }

    const declared = episodes.filter(e => e.detectionSource.includes('USER_DECLARED'));
    if (declared.length > 0) {
       ev.addDeclared(`Có ${declared.length} lần bạn tự khai báo là nhồi lệnh/DCA qua Ghi chú hoặc Hashtag.`);
    }

    return ev;
  }
}

export default new DcaBehavior();
