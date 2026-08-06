import { hoursBetween } from '../helpers';

export default {
  id: 'post_loss_discipline',
  nameKey: 'bhPostLossDiscipline',
  category: 'good',

  detect(trades, config) {
    const evidence = [];
    let confidence = 0.85;

    const sorted = [...trades].sort((a,b) => new Date(a.trade_time) - new Date(b.trade_time));
    let validLossEvents = 0;
    let disciplinedResponses = 0;
    
    for (let i = 0; i < sorted.length - 1; i++) {
      if (sorted[i].status !== 'LOSS') continue;
      
      const trigger = sorted[i];
      if (!trigger.exit_time) continue;
      
      const next = sorted[i+1];
      const h = hoursBetween(trigger.exit_time, next.trade_time);
      
      validLossEvents++;

      // Disciplined response: Waited at least 2 hours before the next trade
      // OR reduced size significantly
      const waited = h !== null && h >= 2;
      const reducedSize = parseFloat(next.size||0) <= parseFloat(trigger.size||0) * 0.8;

      if (waited || reducedSize) {
        disciplinedResponses++;
      }
    }

    if (validLossEvents < 3) return null;
    const consistency = Math.round((disciplinedResponses / validLossEvents) * 100);

    if (consistency < 60) return null;

    return {
      occurrences: disciplinedResponses,
      affectedTradeIds: [],
      metrics: { consistency, totalTrades: validLossEvents },
      confidence,
      evidence,
      
      status: 'good',
    };
  }
};
