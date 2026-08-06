export default {
  id: 'planned_tp',
  nameKey: 'bhPlannedTp',
  category: 'good',

  detect(trades, config) {
    const evidence = [];
    let confidence = 0.85;

    const hasTP = trades.filter(t => t.take_profit && parseFloat(t.take_profit) > 0);
    if (hasTP.length < 5) return null;
    const winTrades = hasTP.filter(t => t.status === 'WIN');
    const winrate = Math.round((winTrades.length / hasTP.length) * 100);
    const rrValues = hasTP.filter(t => t.stop_loss && parseFloat(t.stop_loss) > 0).map(t => {
      const entry = parseFloat(t.entry_price), tp = parseFloat(t.take_profit), sl = parseFloat(t.stop_loss);
      const side = (t.side||'').toUpperCase();
      if (side === 'BUY' || side === 'LONG') {
        const risk = Math.abs(entry - sl), reward = Math.abs(tp - entry);
        return risk > 0 ? reward / risk : null;
      } else {
        const risk = Math.abs(sl - entry), reward = Math.abs(entry - tp);
        return risk > 0 ? reward / risk : null;
      }
    }).filter(v => v !== null && v > 0 && v < 20);
    const avgRr = rrValues.length > 0
      ? Math.round((rrValues.reduce((a,b) => a+b, 0) / rrValues.length) * 10) / 10 : 0;
    
    return {
      occurrences: hasTP.length,
      affectedTradeIds: hasTP.map(t => t.id),
      metrics: { winrate, avgRr, totalTrades: hasTP.length },
      confidence,
      evidence,
      
      status: 'good',
    };
  }
};
