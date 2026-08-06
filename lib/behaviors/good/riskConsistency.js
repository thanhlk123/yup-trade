import { stddev } from '../helpers';

export default {
  id: 'risk_consistency',
  nameKey: 'bhRiskConsistency',
  category: 'good',

  detect(trades, config) {
    const evidence = [];
    let confidence = 0.85;

    const sizes = trades.map(t => parseFloat(t.size||0)).filter(s => s > 0);
    if (sizes.length < 10) return null;
    const mean = sizes.reduce((a,b) => a+b, 0) / sizes.length;
    const cv = stddev(sizes) / mean;
    const consistency = Math.round(Math.max(0, (1 - Math.min(cv, 1))) * 100);
    if (consistency < 70) return null;
    
    return {
      occurrences: trades.length,
      affectedTradeIds: trades.map(t => t.id),
      metrics: { consistency, avgSize: Math.round(mean * 100) / 100, cv: Math.round(cv * 100) },
      confidence,
      evidence,
      
      status: 'good',
    };
  }
};
