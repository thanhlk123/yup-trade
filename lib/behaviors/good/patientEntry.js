import { noteContains } from '../helpers';

export default {
  id: 'patient_entry',
  nameKey: 'bhPatientEntry',
  category: 'good',

  detect(trades, config) {
    const evidence = [];
    let confidence = 0.85;

    const patientTrades = trades.filter(t => 
      noteContains(t, ['chờ', 'đợi', 'kiên nhẫn', 'limit', 'confirm', 'xác nhận', 'patient', 'wait'])
    );

    if (patientTrades.length < 3) return null;

    const winTrades = patientTrades.filter(t => t.status === 'WIN');
    const winrate = (winTrades.length / patientTrades.length);
    const globalWinrate = trades.filter(t => t.status === 'WIN').length / trades.length;

    // Must show that patience pays off
    if (winrate < 0.5 || winrate < globalWinrate) return null;

    return {
      occurrences: patientTrades.length,
      affectedTradeIds: patientTrades.map(t => t.id),
      metrics: { winrate: Math.round(winrate * 100), totalTrades: patientTrades.length },
      confidence,
      evidence,
      
      status: 'good',
    };
  }
};
