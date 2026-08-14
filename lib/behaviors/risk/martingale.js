import { BehaviorBase } from '../BehaviorBase';
import { minutesBetween } from '../helpers';
import { buildEvidence } from '../evidenceBuilder';

class MartingaleBehavior extends BehaviorBase {
  constructor() {
    super();
    this.id = 'martingale';
    this.nameKey = 'bhMartingale';
    this.category = 'risk';
    this.severity = 9.5;
    this.relatedBehaviors = ['dca','revenge_trading','oversized'];
  }

  detect(trades, config) {
    const affected = [];
    const sorted = [...trades].sort((a,b) => new Date(a.trade_time) - new Date(b.trade_time));
    const volBump = config?.thresholds?.MARTINGALE_VOLUME_BUMP || 1.8;

    for (let i = 1; i < sorted.length; i++) {
      const tPrev = sorted[i-1];
      const tNext = sorted[i];

      if (tPrev.status !== 'LOSS') continue;
      if (tPrev.asset !== tNext.asset) continue; 
      
      const mins = minutesBetween(tPrev.exit_time, tNext.trade_time);
      if (mins === null || mins > 30) continue;

      const sPrev = parseFloat(tPrev.size||0);
      const sNext = parseFloat(tNext.size||0);

      if (sPrev <= 0 || sNext <= sPrev * volBump) continue;
      if (tNext.status !== 'LOSS') continue;
      
      const pnlPrev = Math.abs(parseFloat(tPrev.pnl||0));
      const pnlNext = Math.abs(parseFloat(tNext.pnl||0));
      if (pnlNext <= pnlPrev * 1.5) continue; 
      
      affected.push({
        trade: tNext,
        context: {
          tPrev,
          sPrev,
          sNext,
          asset: tNext.asset
        }
      });
    }

    return affected;
  }
  
  buildEvidence(affectedTrades) {
    const ev = buildEvidence();
    
    if (affectedTrades.length > 0) {
      ev.addObserved(`Phát hiện ${affectedTrades.length} lệnh có dấu hiệu Gấp thếp (Martingale): Tăng khối lượng lệnh (Size) đột ngột ngay sau khi bị thua lỗ trên cùng một mã giao dịch.`);
    }

    return ev;
  }
  
  calculateConfidence(affectedTrades, evidence) {
    // Very clear mechanical pattern
    return affectedTrades.length > 0 ? 0.95 : 0;
  }
}

export default new MartingaleBehavior();
