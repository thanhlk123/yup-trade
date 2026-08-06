export default {
  id: 'strict_sl',
  nameKey: 'bhStrictSl',
  category: 'good',

  detect(trades, config) {
    const evidence = [];
    let confidence = 0.85;

    const hasSl = trades.filter(t => t.stop_loss && parseFloat(t.stop_loss) > 0);
    if (hasSl.length < 3) return null;
    const consistency = Math.round((hasSl.length / trades.length) * 100);
    const lossTrades = hasSl.filter(t => t.status === 'LOSS');
    const avgSlLoss = lossTrades.length > 0
      ? Math.abs(lossTrades.reduce((s,t) => s + parseFloat(t.pnl||0), 0)) / lossTrades.length : 0;
    const noSlLosses = trades
      .filter(t => (!t.stop_loss || parseFloat(t.stop_loss) === 0) && t.status === 'LOSS')
      .map(t => Math.abs(parseFloat(t.pnl||0)));
    const avgNoSlLoss = noSlLosses.length > 0
      ? noSlLosses.reduce((a,b) => a+b, 0) / noSlLosses.length : avgSlLoss * 1.5;
    const protectedAmount = Math.round(Math.max(0, (avgNoSlLoss - avgSlLoss) * lossTrades.length));
    
    return {
      occurrences: hasSl.length,
      affectedTradeIds: hasSl.map(t => t.id),
      metrics: { consistency, protectedAmount, avgLoss: Math.round(avgSlLoss * 100) / 100 },
      confidence,
      evidence,
      
      status: 'good',
    };
  }
};
