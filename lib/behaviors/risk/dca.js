import { getMonthKey, computeTrend, minutesBetween, noteContains } from '../helpers';

export default {
  id: 'dca',
  nameKey: 'bhDca',
  category: 'risk',
  level: 2,
  severity: 9.0,
  falsePositiveNote: 'Chỉ bắt các cụm lệnh nhồi lỗ (Average Down). Nhồi lãi (Pyramid) sẽ lọt vào rule khác.',

  detect(trades, config) {
    const evidence = [];
    let confidence = 0.70;

    const sorted = [...trades].sort((a,b) => new Date(a.trade_time) - new Date(b.trade_time));
    let clusters = [];
    
    let currentCluster = [];

    for (let i = 0; i < sorted.length; i++) {
      const t = sorted[i];

      if (currentCluster.length === 0) {
        currentCluster.push(t);
        continue;
      }
      
      const prev = currentCluster[currentCluster.length - 1];
      const mins = minutesBetween(prev.trade_time, t.trade_time);
      
      const thresholdMins = config.timeWindows.DCA_CLUSTER_MINS || 240;

      if (mins !== null && mins < thresholdMins && prev.asset === t.asset && prev.side === t.side) {
        
        // BẮT BUỘC: Lệnh sau phải được mở khi lệnh trước VẪN ĐANG MỞ (Kẹp lệnh/Concurrent)
        // Nếu lệnh trước đã đóng rồi mới mở lệnh sau, đó là 2 lệnh hoàn toàn độc lập, không phải DCA!
        const t1Exit = prev.exit_time ? new Date(prev.exit_time).getTime() : Infinity;
        const t2Open = new Date(t.trade_time).getTime();
        const isOverlapping = t2Open < t1Exit;

        const p1 = parseFloat(prev.entry_price);
        const p2 = parseFloat(t.entry_price);
        // DCA (Averaging Down) = Giá sau tệ hơn giá trước
        const isAveragingDown = (t.side === 'BUY' && p2 < p1) || (t.side === 'SELL' && p2 > p1);
        
        if (isOverlapping && isAveragingDown) {
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

    // Bổ sung xử lý: Nếu user đã tự gộp các lệnh DCA thành 1 lệnh duy nhất trong CSV và có ghi chú "dca"
    // Thuật toán quét cụm lệnh ở trên sẽ bỏ qua (vì length = 1). Chúng ta cần nhặt lại chúng.
    const explicitSingleDca = trades.filter(t => {
      // Bỏ qua nếu lệnh này đã nằm trong 1 cụm DCA hợp lệ (tránh lặp)
      if (clusters.some(c => c.some(ct => ct.id === t.id))) return false;
      return noteContains(t, ['dca', 'nhồi', 'bắt thêm', 'average down']);
    });
    
    // Ép mỗi lệnh single này thành một cụm 1-lệnh để engine xử lý chung form
    explicitSingleDca.forEach(t => clusters.push([t]));

    // Chỉ tính các cụm DCA (nhồi lệnh) dẫn đến kết quả cuối cùng là THUA LỖ.
    // Nếu nhồi lỗ mà về bờ (Hòa hoặc Thắng), hệ thống tạm thời tha bổng để tránh bắt oan các chiến lược lưới (Grid/Recovery) có tính toán.
    clusters = clusters.filter(c => {
      const pnl = c.reduce((s,t) => s + parseFloat(t.pnl||0), 0);
      return pnl < 0;
    });

    if (clusters.length === 0) return null;

    let totalDamage = 0;
    const affectedIds = new Set();
    let noteValidatedCount = 0;

    clusters.forEach(c => {
      const pnl = c.reduce((s,t) => s + parseFloat(t.pnl||0), 0);
      totalDamage += pnl;
      
      const hasNote = c.some(t => noteContains(t, ['dca', 'nhồi', 'bắt thêm', 'gồng']));
      if (hasNote) noteValidatedCount++;

      // Ngoại trừ Single DCA, các cụm DCA thông thường chỉ đưa Lệnh Nhồi (từ vị trí số 1 trở đi) vào danh sách lỗi
      if (c.length === 1) {
        affectedIds.add(c[0].id);
      } else {
        c.slice(1).forEach(t => affectedIds.add(t.id));
      }
      evidence.push(`Phát hiện cụm ${c.length} lệnh nhồi lỗ (DCA) mã ${c[0].asset}, tổng PnL: $${pnl.toFixed(2)}`);
    });

    if (noteValidatedCount > 0) confidence = 0.96;

    const monthly = {};
    clusters.forEach(c => { const m = getMonthKey(c[0]); if (m) monthly[m] = (monthly[m]||0)+1; });

    return {
      occurrences: clusters.length,
      affectedTradeIds: Array.from(affectedIds),
      impact: {
        totalDamage: totalDamage,
        avgDamage: totalDamage / clusters.length,
        worstSingle: 0,
        winrate: 0,
        profitFactor: 0,
        isOpportunityCost: false,
        note: `Tổng thiệt hại gộp của các cụm lệnh nhồi ngược xu hướng (Averaging Down).`
      },
      confidence,
      evidence,
      coverage: { validated: noteValidatedCount, total: clusters.length },
      trend: computeTrend(monthly),
      relatedBehaviors: ['oversized', 'hold_too_long'],
      status: clusters.length >= 2 ? 'critical' : 'high',
      evidenceQuality: noteValidatedCount > 0 ? 'high' : 'medium',
    };
  }
};
