import { getMonthKey, computeTrend, minutesBetween, noteContains } from '../helpers';

export default {
  id: 'pyramid_mismanagement',
  nameKey: 'bhPyramidMismanagement',
  category: 'risk',
  level: 1,
  severity: 8.5,
  falsePositiveNote: 'Bắt hành vi nhồi thêm lệnh thuận chiều khi đang lãi (Pyramiding), nhưng không quản lý rủi ro dẫn đến tổng PnL của cụm lệnh bị LỖ.',

  detect(trades, config) {
    const evidence = [];
    let confidence = 0.85;

    const sorted = [...trades].sort((a,b) => new Date(a.trade_time) - new Date(b.trade_time));
    let clusters = [];
    
    let currentCluster = [];

    for (let i = 0; i < sorted.length; i++) {
      const t = sorted[i];
      if (t.status !== 'LOSS') {
        if (currentCluster.length >= 2) clusters.push(currentCluster);
        currentCluster = [];
        continue;
      }

      if (currentCluster.length === 0) {
        currentCluster.push(t);
        continue;
      }
      
      const prev = currentCluster[currentCluster.length - 1];
      const mins = minutesBetween(prev.trade_time, t.trade_time);
      
      if (mins !== null && mins < 240 && prev.asset === t.asset && prev.side === t.side) {
        
        // BẮT BUỘC: Phải là kẹp lệnh (Lệnh 2 mở khi Lệnh 1 chưa đóng)
        const t1Exit = prev.exit_time ? new Date(prev.exit_time).getTime() : Infinity;
        const t2Open = new Date(t.trade_time).getTime();
        const isOverlapping = t2Open < t1Exit;

        const p1 = parseFloat(prev.entry_price);
        const p2 = parseFloat(t.entry_price);
        // Pyramid (Nhồi thuận/Scale in) = Giá sau cao hơn giá trước (BUY)
        const isPyramid = (t.side === 'BUY' && p2 > p1) || (t.side === 'SELL' && p2 < p1);
        
        if (isOverlapping && isPyramid) {
          currentCluster.push(t);
        } else {
          if (currentCluster.length >= 2) clusters.push(currentCluster);
          currentCluster = [t];
        }
      } else {
        if (currentCluster.length >= 2) clusters.push(currentCluster);
        currentCluster = [t];
      }
    }
    if (currentCluster.length >= 2) clusters.push(currentCluster);

    // Xử lý cho hệ thống của user: User gom tất cả lệnh kẹp (overlap) thành 1 dòng (merged row) trong CSV.
    // Do đó thuật toán dò overlap bên trên sẽ không tìm thấy gì. Chúng ta phải nhặt lại thông qua Ghi chú (Notes).
    const explicitSinglePyramid = trades.filter(t => {
      if (clusters.some(c => c.some(ct => ct.id === t.id))) return false;
      return noteContains(t, ['pyramid', 'nhồi thuận', 'scale in', 'scale-in', 'nhồi lãi']);
    });
    explicitSinglePyramid.forEach(t => clusters.push([t]));

    // Chỉ bắt lỗi khi Nhồi thuận (Pyramid) thất bại dẫn đến nguyên cụm lỗ.
    clusters = clusters.filter(c => {
      const pnl = c.reduce((s,t) => s + parseFloat(t.pnl||0), 0);
      return pnl < 0;
    });

    if (clusters.length === 0) return null;

    let totalDamage = 0;
    const affectedIds = new Set();
    let worstClusterLoss = 0;

    clusters.forEach(c => {
      const pnl = c.reduce((s,t) => s + parseFloat(t.pnl||0), 0);
      totalDamage += pnl;
      if (pnl < worstClusterLoss) worstClusterLoss = pnl;
      
      if (c.length === 1) {
        affectedIds.add(c[0].id);
      } else {
        c.slice(1).forEach(t => affectedIds.add(t.id));
      }
    });

    const monthly = {};
    clusters.forEach(c => { const m = getMonthKey(c[0]); if (m) monthly[m] = (monthly[m]||0)+1; });

    return {
      occurrences: clusters.length,
      affectedTradeIds: Array.from(affectedIds),
      impact: {
        totalDamage: totalDamage,
        avgDamage: totalDamage / clusters.length,
        worstSingle: worstClusterLoss,
        winrate: 0,
        profitFactor: 0,
        note: `Tổng thiệt hại gộp của các cụm lệnh nhồi thuận (Pyramiding) thất bại. Quản lý vốn sai lầm biến setup thắng thành cụm thua kép.`,
      },
      confidence,
      evidence,
      
      coverage: { validated: 0, total: clusters.length },
      trend: computeTrend(monthly),
      relatedBehaviors: ['oversized'],
      status: clusters.length >= 2 ? 'high' : 'medium',
      evidenceQuality: 'high',
    };
  }
};
