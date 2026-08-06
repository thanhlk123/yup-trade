import { getMonthKey, computeTrend } from '../helpers';

export default {
  id: 'session_bias',
  nameKey: 'bhSessionBias',
  category: 'context',
  level: 1,
  severity: 6.5,
  falsePositiveNote: 'Phát hiện thiên kiến thời gian (Time-based bias). Trader có một khoảng thời gian (giờ/ngày) có Winrate và PnL cực kỳ thấp so với trung bình.',

  detect(trades, config) {
    const evidence = [];
    let confidence = 0.85;

    if (trades.length < 20) return null; // Need sufficient data for bias analysis

    const dayStats = {}; // Monday = 1 ... Sunday = 0
    const hourStats = { 'Asian': 0, 'London': 0, 'NY': 0 };

    trades.forEach(t => {
      const d = new Date(t.trade_time);
      if (!d) return;

      const day = d.getDay();
      if (!dayStats[day]) dayStats[day] = { wins: 0, total: 0, pnl: 0 };
      dayStats[day].total++;
      if (t.status === 'WIN') dayStats[day].wins++;
      dayStats[day].pnl += parseFloat(t.pnl||0);

      const h = d.getUTCHours();
      let session = '';
      if (h >= 0 && h < 7) session = 'Asian';
      else if (h >= 7 && h < 13) session = 'London';
      else session = 'NY';

      if (!hourStats[session]) hourStats[session] = { wins: 0, total: 0, pnl: 0 };
      hourStats[session].total++;
      if (t.status === 'WIN') hourStats[session].wins++;
      hourStats[session].pnl += parseFloat(t.pnl||0);
    });

    const globalWinrate = trades.filter(t => t.status === 'WIN').length / trades.length;

    let worstContext = null;
    let worstPnL = 0;
    let worstWr = 1;
    const affectedTrades = [];

    // Check Days
    Object.entries(dayStats).forEach(([dayStr, stats]) => {
      const wr = stats.wins / stats.total;
      if (stats.total >= 5 && stats.pnl < 0 && wr < globalWinrate * 0.7) { // 30% worse than average
        if (stats.pnl < worstPnL) {
          worstPnL = stats.pnl;
          worstWr = wr;
          const days = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
          worstContext = `Ngày ${days[parseInt(dayStr)]}`;
        }
      }
    });

    // Check Sessions
    Object.entries(hourStats).forEach(([sess, stats]) => {
      const wr = stats.wins / stats.total;
      if (stats.total >= 5 && stats.pnl < 0 && wr < globalWinrate * 0.7) {
        if (stats.pnl < worstPnL) {
          worstPnL = stats.pnl;
          worstWr = wr;
          worstContext = `Phiên ${sess}`;
        }
      }
    });

    if (!worstContext) return null;

    // Collect affected trades for this worst context
    trades.forEach(t => {
      const d = new Date(t.trade_time);
      if (!d) return;
      const day = d.getDay();
      const h = d.getUTCHours();
      const days = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
      
      let session = '';
      if (h >= 0 && h < 7) session = 'Phiên Asian';
      else if (h >= 7 && h < 13) session = 'Phiên London';
      else session = 'Phiên NY';

      if (worstContext === `Ngày ${days[day]}` || worstContext === session) {
        if (t.status === 'LOSS') affectedTrades.push(t);
      }
    });

    if (affectedTrades.length === 0) return null;

    const monthly = {};
    affectedTrades.forEach(t => { const m = getMonthKey(t); if (m) monthly[m] = (monthly[m]||0)+1; });

    return {
      occurrences: affectedTrades.length,
      affectedTradeIds: affectedTrades.map(t => t.id),
      impact: {
        totalDamage: worstPnL,
        avgDamage: worstPnL / affectedTrades.length,
        worstSingle: Math.min(...affectedTrades.map(t => parseFloat(t.pnl||0))),
        winrate: worstWr,
        profitFactor: 0,
        note: `Hoàn cảnh (Context): Hệ thống phát hiện bạn có tỷ lệ Winrate cực thấp (${Math.round(worstWr*100)}%) và thua lỗ nặng khi giao dịch vào ${worstContext}.`,
      },
      confidence,
      evidence,
      
      coverage: { validated: 0, total: affectedTrades.length },
      trend: computeTrend(monthly),
      relatedBehaviors: [],
      status: 'medium',
      evidenceQuality: 'high',
    };
  }
};
