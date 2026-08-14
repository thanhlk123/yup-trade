import { BehaviorBase } from '../BehaviorBase';
import { buildEvidence } from '../evidenceBuilder';

class SessionBiasBehavior extends BehaviorBase {
  constructor() {
    super();
    this.id = 'session_bias';
    this.nameKey = 'bhSessionBias';
    this.category = 'context';
    this.severity = 6.5;
    this.relatedBehaviors = [];
  }

  detect(trades, config) {
    if (trades.length < 10) return []; // Need sufficient data

    const sessionStats = {}; 

    trades.forEach(t => {
      // Use the standard hashtag from DB instead of calculating manually
      const sess = t.session;
      if (!sess) return;

      if (!sessionStats[sess]) sessionStats[sess] = { wins: 0, total: 0, pnl: 0 };
      sessionStats[sess].total++;
      if (t.status === 'WIN') sessionStats[sess].wins++;
      sessionStats[sess].pnl += parseFloat(t.pnl || 0);
    });

    const globalWinrate = trades.filter(t => t.status === 'WIN').length / trades.length;

    let worstSession = null;
    let worstPnL = 0;
    let worstWr = 1;

    Object.entries(sessionStats).forEach(([sess, stats]) => {
      const wr = stats.wins / stats.total;
      // 30% worse than average WR and causing overall loss for the session
      if (stats.total >= 3 && stats.pnl < 0 && wr < globalWinrate * 0.7) {
        if (stats.pnl < worstPnL) {
          worstPnL = stats.pnl;
          worstWr = wr;
          worstSession = sess;
        }
      }
    });

    if (!worstSession) return [];

    const affected = [];
    trades.forEach(t => {
      if (t.session === worstSession && t.status === 'LOSS') {
        affected.push({
          trade: t,
          context: {
            worstSession,
            worstPnL,
            worstWr,
            globalWinrate
          }
        });
      }
    });

    return affected;
  }
  
  buildEvidence(affectedTrades) {
    const ev = buildEvidence();
    if (affectedTrades.length === 0) return ev;
    
    const context = affectedTrades[0].context;
    
    // Observed
    ev.addObserved(`Phát hiện thiên kiến thời gian (Session Bias). Bạn giao dịch cực kỳ kém hiệu quả vào ${context.worstSession}.`);
    ev.addObserved(`Winrate của bạn trong phiên này chỉ đạt ${Math.round(context.worstWr * 100)}% (so với trung bình ${Math.round(context.globalWinrate * 100)}%).`);
    
    return ev;
  }

  calculateConfidence(affectedTrades, evidence) {
    const n = affectedTrades.length;
    // Base confidence scales logarithmically with sample size
    const sampleScore = Math.min(0.92, 0.35 + Math.log(n + 1) / Math.log(15) * 0.57);
    return sampleScore;
  }
}

export default new SessionBiasBehavior();
