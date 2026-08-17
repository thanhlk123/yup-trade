import { BehaviorBase } from '../BehaviorBase';
import { buildEvidence } from '../evidenceBuilder';
import { noteContains } from '../helpers';

class NoTpBehavior extends BehaviorBase {
  constructor() {
    super();
    this.id = 'no_tp';
    this.nameKey = 'bhNoTp';
    this.category = 'execution';
    this.severity = 5.5;
    
    // Đổi related thành indicators (Potential Contributor) thay vì Causation trực tiếp
    this.indicators = ['hold_too_long', 'exit_too_early'];
  }

  detect(trades, config) {
    const affected = [];

    // Centralized Feature Layer (Feature Flag / Future-proof)
    // Ưu tiên dùng config.features để tránh tính toán trùng lặp ở nhiều behavior.
    let pf = config?.features?.profitFactor;
    let winCount = config?.features?.winCount;
    
    // Fallback tự tính nếu config.features chưa có (đang trong quá trình migrate)
    if (pf === undefined || winCount === undefined) {
      const winTrades = trades.filter(t => t.status === 'WIN');
      const lossTrades = trades.filter(t => t.status === 'LOSS');
      const sumWins = winTrades.reduce((s, t) => s + parseFloat(t.pnl || 0), 0);
      const sumLoss = Math.abs(lossTrades.reduce((s, t) => s + parseFloat(t.pnl || 0), 0));
      
      pf = pf ?? (sumLoss > 0 ? sumWins / sumLoss : 0);
      winCount = winCount ?? winTrades.length;
    }
    
    // High-Performance Suppression: Bỏ qua cho những chuỗi lệnh có hiệu suất vượt trội
    if (pf > 2.5 && winCount >= 5) return affected;

    trades.forEach(t => {
      const hasNoTp = !t.take_profit || parseFloat(t.take_profit) === 0 || t.take_profit === '';
      if (!hasNoTp) return;
      
      // Execution-based Detection: Dùng trường dữ liệu chuẩn hóa exit_mode nếu có
      let isExempted = false;
      
      if (t.exit_mode) {
        // Data đã chuẩn hóa
        const mode = t.exit_mode.toLowerCase();
        // Trừ khi exit_mode là 'fixed' hoặc 'fixed_target' (kế hoạch cố định bắt buộc phải có TP),
        // các mode khác như unknown, manual, signal_based, trailing, v.v đều không đủ evidence kết tội No TP.
        if (mode !== 'fixed' && mode !== 'fixed_target') {
          isExempted = true;
        }
      } else {
        // Legacy fallback only: Tạm thời nếu data chưa chuẩn hóa xong.
        isExempted = noteContains(t, ['trailing', 'trail', 'partial', 'scale out', 'market exit', 'discretionary', 'tùy nghi']);
      }
      
      // Nếu không đủ bằng chứng kết tội từ exit_mode (hợp lệ hoặc unknown) thì bỏ qua
      if (isExempted) return;

      const declaredMistake = noteContains(t, ['quên tp', 'không tp', 'no tp']);
      
      affected.push({
        trade: t,
        context: {
          hasNoTp,
          declaredMistake
        }
      });
    });

    return affected;
  }
  
  buildEvidence(affectedTrades) {
    const ev = buildEvidence();
    
    const count = affectedTrades.length;
    if (count > 0) {
      ev.addObserved(`Có ${count} lệnh không thiết lập kế hoạch chốt lời rõ ràng (No Take Profit).`);
    }

    const declaredCount = affectedTrades.filter(a => a.context.declaredMistake).length;
    if (declaredCount > 0) {
      ev.addDeclared(`Ghi chú của bạn đã xác nhận quên/không set TP trong ${declaredCount} lệnh.`);
    }

    return ev;
  }
  
  calculateConfidence(affectedTrades, evidence) {
    const n = affectedTrades.length;
    // Sửa lại công thức Confidence để scale hợp lý với số lượng lệnh vi phạm thực tế (đạt ~0.90 với n = 15)
    // Thay vì dùng n=30 quá lớn và khó đạt được.
    const sampleScore = Math.min(0.90, 0.40 + (Math.log(n + 1) / Math.log(15)) * 0.50);
    
    // Nếu có lời thú nhận thì độ tin cậy được cộng thêm 0.10 thay vì 0.15 để tránh vọt max quá dễ
    const declaredBoost = evidence.declared.length > 0 ? 0.10 : 0;
    
    return Math.min(0.98, sampleScore + declaredBoost);
  }
}

export default new NoTpBehavior();
