export default {
  id: 'streak_management',
  nameKey: 'bhStreakManagement',
  category: 'good',

  detect(trades, config) {
    const evidence = [];
    let confidence = 0.85;

    const sorted = [...trades].sort((a,b) => new Date(a.trade_time) - new Date(b.trade_time));
    let streaks = 0;
    let controlledPostStreak = 0;
    
    let currentStreak = 0;
    for (let i = 0; i < sorted.length - 1; i++) {
      if (sorted[i].status === 'WIN') {
        currentStreak++;
      } else {
        currentStreak = 0;
      }
      
      // If we are on a winning streak of 3 or more
      if (currentStreak >= 3) {
        streaks++;
        const nextTrade = sorted[i+1];
        const prevAvgSize = sorted.slice(i-2, i+1).reduce((s,t) => s + parseFloat(t.size||0), 0) / 3;
        const nextSize = parseFloat(nextTrade.size||0);
        
        // Good behavior: Next trade size is not aggressively increased (<= 1.2x)
        if (nextSize > 0 && nextSize <= prevAvgSize * 1.2) {
          controlledPostStreak++;
        }
      }
    }

    if (streaks < 2) return null;
    const consistency = Math.round((controlledPostStreak / streaks) * 100);
    
    if (consistency < 60) return null; // Only flag if they actually have good control

    return {
      occurrences: controlledPostStreak,
      affectedTradeIds: [],
      metrics: { consistency, totalTrades: streaks },
      confidence,
      evidence,
      
      status: 'good',
    };
  }
};
