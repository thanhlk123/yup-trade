import { median } from '../helpers';

export default {
  id: 'high_conviction_sizing',
  nameKey: 'bhHighConviction',
  category: 'good',

  detect(trades, config) {
    const evidence = [];
    let confidence = 0.85;

    const sizes = trades.map(t => parseFloat(t.size||0)).filter(s => s > 0);
    if (sizes.length < 10) return null;
    const medSize = median(sizes);
    if (medSize === 0) return null;

    // High conviction trades = sizes significantly larger than median
    const convictionTrades = trades.filter(t => parseFloat(t.size||0) >= medSize * 1.5);
    if (convictionTrades.length < 3) return null;

    const winTrades = convictionTrades.filter(t => t.status === 'WIN');
    const winrate = (winTrades.length / convictionTrades.length);
    const globalWinrate = trades.filter(t => t.status === 'WIN').length / trades.length;

    // Only flag if big sizes actually yield great results (Winrate >= 60% and > global winrate)
    if (winrate < 0.6 || winrate <= globalWinrate) return null;

    const extraProfit = convictionTrades.reduce((s,t) => {
      const pnl = parseFloat(t.pnl||0);
      const actualSize = parseFloat(t.size);
      // Extra profit = PnL - (PnL if they traded median size)
      if (t.status === 'WIN') {
         return s + (pnl - (pnl / actualSize * medSize));
      }
      // Deduct extra loss if any
      return s + (pnl - (pnl / actualSize * medSize));
    }, 0);

    if (extraProfit <= 0) return null;

    return {
      occurrences: convictionTrades.length,
      affectedTradeIds: convictionTrades.map(t => t.id),
      metrics: { winrate: Math.round(winrate * 100), extraProfit: Math.round(extraProfit) },
      confidence,
      evidence,
      
      status: 'good',
    };
  }
};
