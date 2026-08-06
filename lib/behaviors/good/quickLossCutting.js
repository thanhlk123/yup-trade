import { hoursBetween } from '../helpers';

export default {
  id: 'quick_loss_cutting',
  nameKey: 'bhQuickLossCutting',
  category: 'good',

  detect(trades, config) {
    const evidence = [];
    let confidence = 0.85;

    const wins = [];
    const losses = [];
    
    trades.forEach(t => {
      const h = hoursBetween(t.trade_time, t.exit_time);
      if (h === null || h <= 0) return;
      if (t.status === 'WIN') wins.push(h);
      else if (t.status === 'LOSS') losses.push(h);
    });

    if (wins.length < 5 || losses.length < 5) return null;

    const avgWinDuration = wins.reduce((a,b) => a+b, 0) / wins.length;
    const avgLossDuration = losses.reduce((a,b) => a+b, 0) / losses.length;

    // Loss duration must be significantly shorter than win duration (< 50%)
    if (avgLossDuration >= avgWinDuration * 0.5) return null;

    // Estimate saved amount assuming they would have held losers as long as winners
    // (Rough approximation: time in market correlates with distance moved against them)
    const lossTrades = trades.filter(t => t.status === 'LOSS');
    const actualLoss = Math.abs(lossTrades.reduce((s,t) => s + parseFloat(t.pnl||0), 0));
    
    let saved = 0;
    if (avgLossDuration > 0) {
      // If they held loss trades as long as win trades, loss could have been proportionally bigger
      const projectedLoss = actualLoss * (avgWinDuration / avgLossDuration);
      saved = Math.round(projectedLoss - actualLoss);
    }
    
    // Cap saved to a reasonable amount to avoid absurd numbers
    saved = Math.min(saved, actualLoss * 2);

    return {
      occurrences: losses.length,
      affectedTradeIds: lossTrades.map(t => t.id),
      metrics: { protectedAmount: saved > 0 ? saved : undefined, avgLossDuration: Math.round(avgLossDuration*10)/10, avgWinDuration: Math.round(avgWinDuration*10)/10 },
      confidence,
      evidence,
      
      status: 'good',
    };
  }
};
