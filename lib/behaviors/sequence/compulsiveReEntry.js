import { BehaviorBase } from '../BehaviorBase';
import { getMonthKey, computeTrend, minutesBetween } from '../helpers';
import { buildEvidence } from '../evidenceBuilder';
import { TAGS } from '../tags';

class CompulsiveReEntryBehavior extends BehaviorBase {
  constructor() {
    super();
    this.id = 'compulsive_re_entry';
    this.nameKey = 'Re-entry Pattern';
    this.category = 'sequence'; 
    this.severity = 8.0;
    this.relatedBehaviors = ['revenge_trading', 'overtrading'];
  }
  
  _buildEpisodes(trades, maxGapMins) {
      const sorted = [...trades].sort((a,b) => new Date(a.trade_time) - new Date(b.trade_time));
      const episodes = [];
      const usedTradeIds = new Set();
      
      for (let i = 0; i < sorted.length; i++) {
          const t1 = sorted[i];
          if (t1.status !== 'LOSS' || usedTradeIds.has(t1.id)) continue;
          
          let currentChain = [t1];
          usedTradeIds.add(t1.id);
          
          let lastTrade = t1;
          for (let j = i + 1; j < sorted.length; j++) {
              const nextTrade = sorted[j];
              if (usedTradeIds.has(nextTrade.id)) continue;
              
              if (nextTrade.asset === t1.asset && nextTrade.side === t1.side) {
                  const mins = minutesBetween(lastTrade.exit_time, nextTrade.trade_time);
                  if (mins !== null && mins < maxGapMins) {
                      currentChain.push(nextTrade);
                      usedTradeIds.add(nextTrade.id);
                      lastTrade = nextTrade;
                      
                      // Break chain if the trade is not a LOSS (win/breakeven ends the episode)
                      if (nextTrade.status !== 'LOSS') {
                          break;
                      }
                  }
              }
          }
          
          if (currentChain.length > 1) {
              episodes.push({
                  trades: currentChain,
                  asset: t1.asset,
                  side: t1.side
              });
          } else {
              usedTradeIds.delete(t1.id);
          }
      }
      
      const normalTrades = trades.filter(t => !usedTradeIds.has(t.id));
      
      return { episodes, normalTrades, usedTradeIds };
  }
  
  _calculateMetrics(tradesArray) {
      if (!tradesArray || tradesArray.length === 0) return { winRate: 0, profitFactor: 0, expectancy: 0, count: 0, totalPnl: 0, wins: 0, losses: 0, breakeven: 0 };
      
      const wins = tradesArray.filter(t => t.status === 'WIN');
      const losses = tradesArray.filter(t => t.status === 'LOSS');
      const breakeven = tradesArray.filter(t => t.status === 'BREAKEVEN' || t.pnl === 0);
      
      const sumWins = wins.reduce((s, t) => s + parseFloat(t.pnl || 0), 0);
      const sumLoss = Math.abs(losses.reduce((s, t) => s + parseFloat(t.pnl || 0), 0));
      const totalPnl = sumWins - sumLoss;
      
      const count = tradesArray.length;
      const winRate = count > 0 ? wins.length / count : 0;
      const expectancy = count > 0 ? totalPnl / count : 0;
      const profitFactor = sumLoss > 0 ? sumWins / sumLoss : (sumWins > 0 ? 99 : 0);
      
      return {
          winRate,
          profitFactor,
          expectancy,
          count,
          totalPnl,
          wins: wins.length,
          losses: losses.length,
          breakeven: breakeven.length
      };
  }

  run(trades, config) {
      if (!trades || trades.length === 0) return null;
      
      const maxGapMins = config?.reEntry?.maxGapMinutes || 15;
      
      const { episodes, normalTrades, usedTradeIds } = this._buildEpisodes(trades, maxGapMins);
      if (episodes.length === 0) return null;
      
      const normalBaseline = this._calculateMetrics(normalTrades);
      
      const attempts = {}; 
      episodes.forEach(ep => {
          ep.trades.forEach((t, index) => {
              if (!attempts[index]) attempts[index] = [];
              attempts[index].push(t);
          });
      });
      
      const attemptMetrics = {};
      Object.keys(attempts).forEach(key => {
          attemptMetrics[key] = this._calculateMetrics(attempts[key]);
      });
      
      const attempt2 = attemptMetrics[1] || this._calculateMetrics([]);
      
      let classification = 'insufficient_data';
      
      if (episodes.length < 3) {
          classification = 'insufficient_data';
      } else {
          if (attempt2.expectancy < 0) {
              classification = 'harmful';
          } else {
              const delta = attempt2.expectancy - normalBaseline.expectancy;
              const tolerance = Math.max(Math.abs(normalBaseline.expectancy * 0.1), 2); // +/- 10% or +/- $2 tolerance
              
              if (delta < -tolerance) {
                  classification = 'underperforming';
              } else if (delta > tolerance) {
                  classification = 'effective';
              } else {
                  classification = 'neutral';
              }
          }
      }
      
      const isGood = classification === 'effective';
      
      const evidence = this.buildEvidence(episodes, maxGapMins);
      
      let confidence = 0.8;
      if (episodes.length >= 5) confidence = 0.9;
      if (classification === 'insufficient_data') confidence = Math.min(confidence, 0.4);

      const affectedTradeIds = Array.from(usedTradeIds);
      
      const monthly = {};
      affectedTradeIds.forEach(id => {
          const t = trades.find(tr => tr.id === id);
          if (t) {
              const m = getMonthKey(t);
              if (m) monthly[m] = (monthly[m] || 0) + 1;
          }
      });
      
      // Impact corresponds specifically to Attempt 2 (First Re-entry)
      const impactMetrics = attemptMetrics[1] || this._calculateMetrics([]);

      return {
          behavior: "compulsive_re_entry",
          id: this.id,
          nameKey: this.nameKey,
          category: isGood ? 'good' : 'sequence',
          severity: this.severity,
          classification,
          confidence,
          episodesCount: episodes.length,
          attemptMetrics,
          baseline: normalBaseline,
          evidence: evidence.toObject(),
          
          affectedTradeIds,
          occurrences: episodes.length,
          impact: {
              totalDamage: impactMetrics.totalPnl < 0 ? impactMetrics.totalPnl : 0,
              worstSingle: 0,
              avgDamage: 0,
              winrate: impactMetrics.winRate,
              profitFactor: impactMetrics.profitFactor
          },
          trend: computeTrend(monthly),
          status: classification === 'harmful' ? 'high' : (classification === 'insufficient_data' ? 'info' : 'medium')
      };
  }
  
  buildEvidence(episodes, maxGapMins) {
      const ev = buildEvidence();
      
      // Simplified evidence string, UI will render custom visuals
      ev.addDerived(`${episodes.length} Re-entry Episodes`);
      ev.addDerived(`Same asset + same direction`);
      ev.addDerived(`Entry gap <${maxGapMins} minutes`);
      ev.addDerived(`Triggered after LOSS`);
      
      const declaredCount = episodes.filter(e => e.trades.some(t => t.mistakes?.includes(TAGS.MISTAKE_REVENGE) || t.mistakes?.includes(TAGS.MISTAKE_FOMO))).length;
      if (declaredCount > 0) {
          ev.addDeclared(`Có ${declaredCount} chuỗi bạn tự khai báo là Trả thù thị trường hoặc FOMO.`);
      }
      
      return ev;
  }
}

export default new CompulsiveReEntryBehavior();
