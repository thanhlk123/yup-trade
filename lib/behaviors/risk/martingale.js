import { getMonthKey, computeTrend, minutesBetween } from '../helpers';

export default {
  id: 'martingale',
  nameKey: 'bhMartingale',
  category: 'risk',
  level: 2,
  severity: 9.5,
  falsePositiveNote: 'Chỉ bắt khi cùng 1 mã, thời gian < 4h, size tăng >= 80% VÀ thiệt hại USD cũng phải tăng >= 50% (tránh bắt nhầm khi user bóp SL ngắn lại nhưng giữ nguyên rủi ro).',

  detect(trades, config) {
    const evidence = [];
    let confidence = 0.85;

    const sorted = [...trades].sort((a,b) => new Date(a.trade_time) - new Date(b.trade_time));
    const escalations = [];
    const volBump = config.thresholds.MARTINGALE_VOLUME_BUMP || 1.8;

    for (let i = 1; i < sorted.length; i++) {
      const tPrev = sorted[i-1];
      const tNext = sorted[i];

      if (tPrev.status !== 'LOSS') continue;
      if (tPrev.asset !== tNext.asset) continue; // Bắt buộc cùng một mã giao dịch
      
      // Bắt buộc thời gian gấp thếp không quá 30 phút (cảm xúc tức thời của Scalper)
      const mins = minutesBetween(tPrev.exit_time, tNext.trade_time);
      if (mins === null || mins > 30) continue;

      const sPrev = parseFloat(tPrev.size||0);
      const sNext = parseFloat(tNext.size||0);

      if (sPrev <= 0 || sNext <= sPrev * volBump) continue;
      
      // Nếu lệnh nhồi volume này cũng thua, nó tạo ra thiệt hại
      if (tNext.status !== 'LOSS') continue;
      
      // False Positive Check: Nếu user chỉ tăng volume vì SL ngắn lại (Risk USD không đổi)
      const pnlPrev = Math.abs(parseFloat(tPrev.pnl||0));
      const pnlNext = Math.abs(parseFloat(tNext.pnl||0));
      if (pnlNext <= pnlPrev * 1.5) continue; // Phải thực sự tăng thiệt hại USD (Tăng rủi ro)
      
      // Đã gộp DCA thành 1 lệnh lúc import, nên nếu 2 lệnh này riêng biệt (không đè lên nhau)
      // mà volume tăng vọt sau khi thua, đây chính xác là Martingale (đóng lệnh cũ mở lệnh mới to hơn)
      escalations.push([tPrev, tNext]);
      evidence.push(`Mã ${tNext.asset}: Thua lệnh #${tPrev.id} (${sPrev} lot) -> Tức tối gấp thếp lệnh #${tNext.id} (${sNext} lot) và tiếp tục lỗ.`);
    }
    if (escalations.length < 2) return null;

    // Chỉ đưa Lệnh Gấp thếp (tNext) vào danh sách Lỗi Sai, không đưa lệnh mồi (tPrev) vào để tránh làm user hoang mang (bắt oan 1 lệnh bình thường)
    const affectedIds = [...new Set(escalations.map(pair => pair[1].id))];
    const lossTrades  = trades.filter(t => affectedIds.includes(t.id) && t.status === 'LOSS');
    const totalDamage = lossTrades.reduce((s,t) => s + parseFloat(t.pnl||0), 0);
    const monthly = {};
    escalations.forEach(([t]) => { const m = getMonthKey(t); if (m) monthly[m] = (monthly[m]||0)+1; });

    return {
      occurrences: escalations.length,
      affectedTradeIds: affectedIds,
      impact: {
        totalDamage,
        avgDamage: escalations.length > 0 ? totalDamage / escalations.length : 0,
        worstSingle: lossTrades.length > 0 ? Math.min(...lossTrades.map(t => parseFloat(t.pnl||0))) : 0,
        winrate: 0, profitFactor: 0,
      },
      confidence,
      evidence,
      
      coverage: { validated: 0, total: affectedIds.length },
      trend: computeTrend(monthly),
      relatedBehaviors: ['dca','revenge_trading','oversized'],
      status: 'critical',
      evidenceQuality: 'high',
    };
  }
};
