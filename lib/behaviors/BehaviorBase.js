// lib/behaviors/BehaviorBase.js
import { getMonthKey, computeTrend } from './helpers';
import { buildEvidence } from './evidenceBuilder';

export class BehaviorBase {
  constructor() {
    this.id = 'base';
    this.nameKey = 'base';
    this.category = 'base';
    this.severity = 5;
    this.relatedBehaviors = [];
    this.description = '';
  }

  // To be overridden by subclasses
  detect(trades, config) {
    return []; // Return array of affected trades or objects with {trade, context}
  }

  // Calculate Impact (PnL, Winrate, RR drop)
  calculateImpact(affectedTrades, allTrades) {
    const affected = affectedTrades.map(a => a.trade ? a.trade : a);
    
    if (affected.length === 0) return null;
    
    const lossTrades = affected.filter(t => t.status === 'LOSS');
    const winTrades = affected.filter(t => t.status === 'WIN');
    
    const totalDamage = lossTrades.reduce((s, t) => s + parseFloat(t.pnl || 0), 0);
    const sumWins = winTrades.reduce((s, t) => s + parseFloat(t.pnl || 0), 0);
    const sumLoss = Math.abs(totalDamage);
    
    const globalWinrate = allTrades.length > 0 ? allTrades.filter(t => t.status === 'WIN').length / allTrades.length : 0;
    const affWinrate = affected.length > 0 ? winTrades.length / affected.length : 0;
    
    // Calculate new metrics
    const allLossTrades = allTrades.filter(t => t.status === 'LOSS');
    const allWinTrades = allTrades.filter(t => t.status === 'WIN');
    const globalSumWins = allWinTrades.reduce((s, t) => s + parseFloat(t.pnl || 0), 0);
    const globalSumLoss = Math.abs(allLossTrades.reduce((s, t) => s + parseFloat(t.pnl || 0), 0));
    
    const globalAvgWin = allWinTrades.length > 0 ? globalSumWins / allWinTrades.length : 0;
    const globalAvgLoss = allLossTrades.length > 0 ? globalSumLoss / allLossTrades.length : 0;
    const globalExpectancy = (globalWinrate * globalAvgWin) - ((1 - globalWinrate) * globalAvgLoss);
    const globalProfitFactor = globalSumLoss > 0 ? globalSumWins / globalSumLoss : (globalSumWins > 0 ? 99 : 0);

    const affAvgWin = winTrades.length > 0 ? sumWins / winTrades.length : 0;
    const affAvgLoss = lossTrades.length > 0 ? sumLoss / lossTrades.length : 0;
    const affExpectancy = (affWinrate * affAvgWin) - ((1 - affWinrate) * affAvgLoss);
    const affProfitFactor = sumLoss > 0 ? sumWins / sumLoss : (sumWins > 0 ? 99 : 0);
    
    const isGood = this.category === 'good' || this.isGood;

    if (isGood) {
      const totalProfit = sumWins - sumLoss;
      return {
        totalProfit,
        avgProfit: affAvgWin,
        winrate: affWinrate,
        winrateBoost: affWinrate - globalWinrate,
        profitFactor: affProfitFactor,
        expectancy: affExpectancy,
        baseline: {
          winrate: globalWinrate,
          profitFactor: globalProfitFactor,
          expectancy: globalExpectancy
        },
        edgeImpact: {
          winrateDelta: affWinrate - globalWinrate,
          expectancyDelta: affExpectancy - globalExpectancy
        }
      };
    } else {
      return {
        totalDamage,
        avgDamage: lossTrades.length > 0 ? totalDamage / lossTrades.length : 0,
        worstSingle: lossTrades.length > 0 ? Math.min(...lossTrades.map(t => parseFloat(t.pnl || 0))) : 0,
        winrate: affWinrate,
        winrateDrop: globalWinrate - affWinrate,
        profitFactor: affProfitFactor,
        expectancy: affExpectancy,
        baseline: {
          winrate: globalWinrate,
          profitFactor: globalProfitFactor,
          expectancy: globalExpectancy
        },
        edgeImpact: {
          winrateDelta: affWinrate - globalWinrate,
          expectancyDelta: affExpectancy - globalExpectancy
        }
      };
    }
  }

  // To be overridden
  buildEvidence(affectedTrades) {
    const ev = buildEvidence();
    ev.addObserved(`Detected in ${affectedTrades.length} trades.`);
    return ev;
  }

  calculateConfidence(affectedTrades, evidence) {
    const n = affectedTrades.length;
    // Base confidence scales logarithmically with sample size
    // n=1 → 0.45, n=3 → 0.65, n=10 → 0.80, n=30+ → capped at 0.92
    const sampleScore = Math.min(0.92, 0.35 + Math.log(n + 1) / Math.log(35) * 0.57);
    // Declared evidence boosts confidence (user self-confirmed the pattern)
    const declaredBoost = evidence.declared && evidence.declared.length > 0 ? 0.95 : 0;
    
    return {
      statistical: sampleScore,
      declared: declaredBoost
    };
  }

  // Standard Edge Classification for Behavior Result Contract
  classifyEdge(normalExp, anomalyExp) {
    if (anomalyExp < 0 && anomalyExp < normalExp) return 'harmful';
    if (anomalyExp > 0 && anomalyExp > normalExp) return 'effective';
    if (anomalyExp > 0 && anomalyExp < normalExp) return 'underperforming';
    return 'neutral';
  }

  run(trades, config) {
    const affectedTrades = this.detect(trades, config);
    if (!affectedTrades || affectedTrades.length === 0) return null;
    
    // Normalize affected array
    const normalizedAffected = affectedTrades.map(a => a.trade ? a : { trade: a });

    const impact = this.calculateImpact(normalizedAffected, trades);
    if (!impact) return null;

    const evidence = this.buildEvidence(normalizedAffected);
    let confidenceObj = this.calculateConfidence(normalizedAffected, evidence);
    
    // Backward compatibility for behaviors that override calculateConfidence and return a number
    if (typeof confidenceObj === 'number') {
      confidenceObj = {
        statistical: confidenceObj,
        declared: evidence.declared && evidence.declared.length > 0 ? 0.95 : 0
      };
    }
    const finalConfidence = Math.max(confidenceObj.statistical || 0, confidenceObj.declared || 0);

    const monthly = {};
    normalizedAffected.forEach(a => { const m = getMonthKey(a.trade); if (m) monthly[m] = (monthly[m] || 0) + 1; });

    // Transitioning to Behavior Result Contract
    return {
      // Legacy Base Fields (Kept for compatibility)
      id: this.id,
      nameKey: this.nameKey,
      category: this.category,
      description: this.description,
      severity: this.severity,
      occurrences: affectedTrades.length,
      affectedTradeIds: normalizedAffected.map(a => a.trade.id),
      affectedRatio: affectedTrades.length / trades.length,
      impact,
      trend: computeTrend(monthly),
      relatedBehaviors: this.relatedBehaviors,
      status: (this.category === 'good' || this.isGood) 
                ? 'positive' 
                : (impact.totalDamage < -500 ? 'critical' : (impact.totalDamage < -100 ? 'high' : 'medium')),
      
      // New Contract Fields
      detection: {},
      evidence: evidence.toObject(),
      metrics: {
        normal: impact.baseline,
        anomalous: {
           winrate: impact.winrate,
           profitFactor: impact.profitFactor,
           expectancy: impact.expectancy
        }
      },
      comparison: {
        expectancyDelta: impact.edgeImpact?.expectancyDelta || 0
      },
      classification: (this.category === 'good' || this.isGood) ? 'effective' : 'harmful',
      confidence: finalConfidence,
      confidenceDetails: confidenceObj,
      coaching: ''
    };
  }
}
