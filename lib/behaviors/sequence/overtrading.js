import { BehaviorBase } from '../BehaviorBase';
import { getMonthKey, computeTrend, minutesBetween } from '../helpers';
import { buildEvidence } from '../evidenceBuilder';
import { TAGS } from '../tags';

function getActualExecutions(trade) {
    if (!trade.user_notes || !trade.user_notes.includes('[Giao dịch DCA gộp')) return 1;
    const orderRegex = /- Lệnh #\d+:/g;
    const match = trade.user_notes.match(orderRegex);
    return match ? match.length : 1;
}

class OvertradingBehavior extends BehaviorBase {
  constructor() {
    super();
    this.id = 'overtrading';
    this.nameKey = 'bhOvertrading';
    this.category = 'sequence'; // Default UI category
    this.severity = 6.5;
    this.relatedBehaviors = ['revenge_trading', 'dca'];
  }
  
  _buildSessions(trades) {
      const normalized = trades.map(t => ({
          ...t,
          actualExecutions: getActualExecutions(t)
      })).sort((a,b) => new Date(a.trade_time) - new Date(b.trade_time));
      
      const sessions = [];
      let currentSession = [];
      
      normalized.forEach(t => {
          if (currentSession.length === 0) {
              currentSession.push(t);
          } else {
              const prev = currentSession[currentSession.length - 1];
              const mins = minutesBetween(prev.trade_time, t.trade_time);
              if (mins !== null && mins < 120) {
                  currentSession.push(t);
              } else {
                  sessions.push(this._createSessionObject(currentSession));
                  currentSession = [t];
              }
          }
      });
      if (currentSession.length > 0) {
          sessions.push(this._createSessionObject(currentSession));
      }
      return sessions;
  }
  
  _createSessionObject(trades) {
      const executions = trades.reduce((sum, t) => sum + t.actualExecutions, 0);
      const pnl = trades.reduce((sum, t) => sum + parseFloat(t.pnl || 0), 0);
      const isDeclared = trades.some(t => t.mistakes?.includes(TAGS.MISTAKE_OVERTRADING) || (t.user_notes && t.user_notes.toLowerCase().includes('trade quá nhiều')));
      return {
          trades,
          executions,
          pnl,
          isDeclared,
          startTime: trades[0].trade_time,
          endTime: trades[trades.length - 1].trade_time
      };
  }
  
  _calculateSessionMetrics(sessions) {
      if (sessions.length === 0) return { winRate: 0, profitFactor: 0, expectancy: 0, totalPnl: 0, wins: 0, losses: 0, breakeven: 0 };
      
      const wins = sessions.filter(s => s.pnl > 0);
      const losses = sessions.filter(s => s.pnl < 0);
      const breakeven = sessions.filter(s => s.pnl === 0);
      
      const sumWins = wins.reduce((s, ep) => s + ep.pnl, 0);
      const sumLoss = Math.abs(losses.reduce((s, ep) => s + ep.pnl, 0));
      const totalPnl = sumWins - sumLoss;
      
      const winRate = wins.length / sessions.length;
      const avgWin = wins.length > 0 ? sumWins / wins.length : 0;
      const avgLoss = losses.length > 0 ? sumLoss / losses.length : 0;
      const expectancy = (winRate * avgWin) - ((1 - winRate) * avgLoss);
      const profitFactor = sumLoss > 0 ? sumWins / sumLoss : (sumWins > 0 ? 99 : 0);
      
      return {
          winRate,
          profitFactor,
          expectancy,
          totalPnl,
          wins: wins.length,
          losses: losses.length,
          breakeven: breakeven.length
      };
  }

  _buildCapacityCurve(sessions) {
      const buckets = {
          '1-3': [], '4-6': [], '7-9': [], '10-12': [], '13+': []
      };
      sessions.forEach(s => {
          if (s.executions <= 3) buckets['1-3'].push(s);
          else if (s.executions <= 6) buckets['4-6'].push(s);
          else if (s.executions <= 9) buckets['7-9'].push(s);
          else if (s.executions <= 12) buckets['10-12'].push(s);
          else buckets['13+'].push(s);
      });
      
      const curve = [];
      let tippingPoint = null;
      let peakExpectancy = -999999;
      let peakBucket = '';
      
      Object.keys(buckets).forEach(key => {
          if (buckets[key].length > 0) {
              const metrics = this._calculateSessionMetrics(buckets[key]);
              curve.push({ bucket: key, expectancy: metrics.expectancy, count: buckets[key].length });
              
              if (metrics.expectancy > peakExpectancy) {
                  peakExpectancy = metrics.expectancy;
                  peakBucket = key;
              }
          }
      });
      
      let pastPeak = false;
      for (let i = 0; i < curve.length; i++) {
          if (curve[i].bucket === peakBucket) {
              pastPeak = true;
              continue;
          }
          if (pastPeak && curve[i].expectancy < 0 && !tippingPoint) {
              const parts = curve[i].bucket.split('-');
              tippingPoint = parts.length > 1 ? parseInt(parts[0]) : 13;
          }
      }
      
      return { curve, peakBucket, peakExpectancy, tippingPoint };
  }

  run(trades, config) {
      if (!trades || trades.length === 0) return null;
      
      const allSessions = this._buildSessions(trades);
      
      const sortedExecutions = allSessions.map(s => s.executions).sort((a,b) => a - b);
      const p90Index = Math.floor(sortedExecutions.length * 0.90);
      const p90Threshold = sortedExecutions.length > 0 ? sortedExecutions[p90Index] : 0;
      
      const threshold = Math.max(5, p90Threshold);
      
      const candidateSessions = [];
      const normalSessions = [];
      const affectedTradeIds = new Set();
      
      allSessions.forEach(session => {
          if (session.executions >= threshold) {
              candidateSessions.push(session);
              session.trades.forEach(t => affectedTradeIds.add(t.id));
          } else {
              normalSessions.push(session);
          }
      });
      
      if (candidateSessions.length === 0) return null;
      
      const metrics = this._calculateSessionMetrics(candidateSessions);
      const nonOvertradingBaseline = this._calculateSessionMetrics(normalSessions);
      const capacityData = this._buildCapacityCurve(allSessions);
      
      let classification = 'insufficient_data';
      let expDeltaRatio = 0;
      let expDeltaAbs = metrics.expectancy - nonOvertradingBaseline.expectancy;
      
      if (nonOvertradingBaseline.expectancy !== 0) {
         expDeltaRatio = expDeltaAbs / Math.abs(nonOvertradingBaseline.expectancy);
      } else {
         expDeltaRatio = expDeltaAbs > 0 ? 1 : (expDeltaAbs < 0 ? -1 : 0);
      }
      
      if (allSessions.length < 10 || candidateSessions.length < 3) {
          classification = 'insufficient_data';
      } else {
          if (expDeltaRatio <= -0.20) {
              classification = 'harmful';
          } else if (expDeltaRatio > -0.20 && expDeltaRatio <= -0.05) {
              classification = 'underperforming';
          } else if (expDeltaRatio > -0.05 && expDeltaRatio < 0.05) {
              classification = 'neutral';
          } else {
              classification = 'effective';
          }
      }
      
      const isGood = classification === 'effective';
      
      const evidence = this.buildEvidence(candidateSessions, metrics, nonOvertradingBaseline, threshold, classification, capacityData, expDeltaRatio);
      
      let confidence = 0.8;
      const declaredCount = candidateSessions.filter(e => e.isDeclared).length;
      if (declaredCount > 0) confidence = 0.95;
      else if (candidateSessions.length >= 5) confidence = 0.9;
      
      if (classification === 'insufficient_data') confidence = Math.min(confidence, 0.4);

      const monthly = {};
      Array.from(affectedTradeIds).forEach(id => {
          const t = trades.find(tr => tr.id === id);
          if (t) {
              const m = getMonthKey(t);
              if (m) monthly[m] = (monthly[m] || 0) + 1;
          }
      });

      return {
          behavior: "overtrading",
          id: this.id,
          nameKey: this.nameKey,
          category: isGood ? 'good' : 'sequence', 
          severity: this.severity,
          classification,
          confidence,
          episodes: {
              total: candidateSessions.length,
              wins: metrics.wins,
              losses: metrics.losses,
              breakeven: metrics.breakeven
          },
          overtradingMetrics: metrics,
          baseline: nonOvertradingBaseline,
          nonOvertradingBaseline,
          edgeDelta: {
              expectancy: expDeltaAbs,
              ratio: expDeltaRatio
          },
          evidence: evidence.toObject(),
          
          affectedTradeIds: Array.from(affectedTradeIds),
          occurrences: candidateSessions.length,
          impact: {
              totalDamage: metrics.totalPnl < 0 ? metrics.totalPnl : 0,
              worstSingle: 0,
              avgDamage: 0,
              winrate: metrics.winRate,
              profitFactor: metrics.profitFactor
          },
          trend: computeTrend(monthly),
          status: classification === 'harmful' ? 'high' : (classification === 'insufficient_data' ? 'info' : 'medium')
      };
  }
  
  buildEvidence(episodes, metrics, baseline, threshold, classification, capacity, expDeltaRatio) {
      const ev = buildEvidence();
      
      ev.addContext(`Tổng quan về Giao dịch tần suất cao (Candidate Sessions):`);
      ev.addContext(`${episodes.length} phiên (Sessions) | ${metrics.wins}W - ${metrics.losses}L`);
      ev.addContext(`Tỉ lệ thắng (Win Rate): ${(metrics.winRate * 100).toFixed(1)}%`);
      ev.addContext(`Lợi nhuận ròng (Total PnL): $${metrics.totalPnl.toFixed(2)}`);
      
      if (classification !== 'insufficient_data') {
          ev.addContext(`Phân tích Edge (Overtrading vs Bình thường Tinh khiết):`);
          ev.addContext(`Expectancy (Primary): $${metrics.expectancy.toFixed(2)} vs $${baseline.expectancy.toFixed(2)} (Bình thường) -> Biến thiên ${(expDeltaRatio * 100).toFixed(1)}%`);
          ev.addContext(`Profit Factor (Secondary): ${metrics.profitFactor.toFixed(2)} vs ${baseline.profitFactor.toFixed(2)}`);
          ev.addContext(`Win Rate (Diagnostic): ${(metrics.winRate * 100).toFixed(1)}% vs ${(baseline.winRate * 100).toFixed(1)}%`);
          
          if (capacity && capacity.peakBucket) {
              if (capacity.tippingPoint) {
                  ev.addContext(`DỮ LIỆU CAPACITY (COACHING): Lợi thế giao dịch của bạn đạt đỉnh ở mức ${capacity.peakBucket} lệnh/phiên (Expectancy $${capacity.peakExpectancy.toFixed(2)}). Nhưng khi bạn chạm hoặc vượt ngưỡng ~${capacity.tippingPoint} lệnh/phiên, lợi thế này bắt đầu bốc hơi và chuyển sang âm. Hãy lấy ${capacity.tippingPoint} làm giới hạn chịu đựng (Capacity) của não bộ bạn.`);
              } else {
                  ev.addContext(`DỮ LIỆU CAPACITY (COACHING): Lợi thế giao dịch của bạn đạt đỉnh ở mức ${capacity.peakBucket} lệnh/phiên (Expectancy $${capacity.peakExpectancy.toFixed(2)}).`);
              }
          }

          if (classification === 'harmful') {
              ev.addContext(`ĐÁNH GIÁ (HARMFUL): Hành vi say máu giao dịch đang phá hủy nghiêm trọng lợi thế của bạn (Expectancy giảm sâu <= -20%).`);
          } else if (classification === 'underperforming') {
              ev.addContext(`ĐÁNH GIÁ (UNDERPERFORMING): Bạn vẫn có lãi trong các phiên tần suất cao, nhưng hiệu suất kém hơn đáng kể so với hệ thống giao dịch gốc.`);
          } else if (classification === 'effective') {
              ev.addContext(`ĐÁNH GIÁ (EFFECTIVE): Tuyệt vời. Việc tăng tần suất đang mang lại Edge lớn hơn cho bạn. Bạn đang tận dụng tốt thanh khoản thị trường.`);
          } else {
              ev.addContext(`ĐÁNH GIÁ (NEUTRAL): Tần suất giao dịch cao không làm thay đổi đáng kể lợi thế giao dịch của bạn.`);
          }
      } else {
          ev.addContext(`ĐÁNH GIÁ (INSUFFICIENT DATA): Chưa đủ dữ liệu thống kê (Yêu cầu tối thiểu 10 tổng Sessions và 3 Overtrading Sessions) để kết luận tần suất cao gây hại hay có lợi.`);
      }
      
      const declaredCount = episodes.filter(e => e.isDeclared).length;
      if (declaredCount > 0) {
          ev.addDeclared(`Có ${declaredCount} lần bạn tự khai báo là Overtrading qua Ghi chú hoặc Hashtag.`);
          if (classification === 'effective') {
              ev.addDeclared(`Tuy nhiên, dữ liệu thực tế cho thấy hành vi này đang có lợi chứ không gây hại như bạn nghĩ (Mirroring).`);
          }
      }
      
      const inferred = episodes.filter(e => !e.isDeclared);
      if (inferred.length > 0) {
          ev.addObserved(`Hệ thống phát hiện ${inferred.length} phiên có số lượng lệnh thực thi >= ${threshold} lệnh/phiên (Top 10% phiên cao nhất của bạn).`);
      }
      
      return ev;
  }
}

export default new OvertradingBehavior();
