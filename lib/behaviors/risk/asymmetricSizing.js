import { getMonthKey, computeTrend, median } from '../helpers';

export default {
  id: 'asymmetric_sizing',
  nameKey: 'bhAsymmetricSizing',
  category: 'risk',
  level: 2,
  severity: 7.5,
  falsePositiveNote: 'Kích hoạt khi volume trung vị lệnh thua > 1.5 lần lệnh thắng. Tính thiệt hại dựa trên PnL lý tưởng (nếu đi đều vol).',

  detect(trades, config) {
    const evidence = [];
    let confidence = 0.85;

    const winTrades = trades.filter(t => t.status === 'WIN' && parseFloat(t.size||0) > 0);
    const lossTrades = trades.filter(t => t.status === 'LOSS' && parseFloat(t.size||0) > 0);
    
    if (winTrades.length < 5 || lossTrades.length < 5) return null;

    const winSizes = winTrades.map(t => parseFloat(t.size));
    const lossSizes = lossTrades.map(t => parseFloat(t.size));
    
    const medWinSize = median(winSizes);
    const medLossSize = median(lossSizes);

    if (medLossSize <= medWinSize * 1.5) return null;

    // Damage Calculation:
    // If they traded uniformly using medWinSize for losers too...
    const actualLossPnL = Math.abs(lossTrades.reduce((s,t) => s + parseFloat(t.pnl||0), 0));
    
    let idealLossPnL = 0;
    lossTrades.forEach(t => {
      const pnl = Math.abs(parseFloat(t.pnl||0));
      const sz = parseFloat(t.size);
      if (sz > 0) {
        idealLossPnL += (pnl / sz) * medWinSize; // Scale down the loss to the medWinSize
      }
    });

    const damage = actualLossPnL - idealLossPnL;
    if (damage <= 0) return null;

    const monthly = {};
    lossTrades.forEach(t => { const m = getMonthKey(t); if (m) monthly[m] = (monthly[m]||0)+1; });

    return {
      occurrences: lossTrades.length,
      affectedTradeIds: lossTrades.map(t => t.id),
      impact: {
        totalDamage: -damage,
        avgDamage: -damage / lossTrades.length,
        worstSingle: Math.min(...lossTrades.map(t => parseFloat(t.pnl||0))),
        winrate: winTrades.length / (winTrades.length + lossTrades.length),
        profitFactor: 0,
        note: `Size Lãi: ${medWinSize.toFixed(2)} | Size Lỗ: ${medLossSize.toFixed(2)}. Thiệt hại là số tiền mất thêm do nhồi size lúc thua.`,
      },
      confidence,
      evidence,
      
      coverage: { validated: lossTrades.length, total: lossTrades.length },
      trend: computeTrend(monthly),
      relatedBehaviors: ['oversized', 'martingale'],
      status: damage > 200 ? 'high' : 'medium',
      evidenceQuality: 'high',
    };
  }
};
