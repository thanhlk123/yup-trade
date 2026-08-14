import { BehaviorBase } from '../BehaviorBase';
import { buildEvidence } from '../evidenceBuilder';

class StrictSlBehavior extends BehaviorBase {
  constructor() {
    super();
    this.id = 'strict_sl';
    this.nameKey = 'bhStrictSl';
    this.category = 'good';
    this.severity = 5;
    this.relatedBehaviors = [];
  }

  detect(trades, config) {
    const hasSl = trades.filter(t => t.stop_loss && parseFloat(t.stop_loss) > 0);
    if (hasSl.length < 3) return [];
    return hasSl;
  }
  
  calculateImpact(affectedTrades, allTrades) {
    const impact = super.calculateImpact(affectedTrades, allTrades);
    if (!impact) return null;
    
    const hasSl = affectedTrades.map(a => a.trade ? a.trade : a);
    const lossTrades = hasSl.filter(t => t.status === 'LOSS');
    const avgSlLoss = lossTrades.length > 0
      ? Math.abs(lossTrades.reduce((s,t) => s + parseFloat(t.pnl||0), 0)) / lossTrades.length : 0;
      
    const noSlLosses = allTrades
      .filter(t => (!t.stop_loss || parseFloat(t.stop_loss) === 0) && t.status === 'LOSS')
      .map(t => Math.abs(parseFloat(t.pnl||0)));
      
    const avgNoSlLoss = noSlLosses.length > 0
      ? noSlLosses.reduce((a,b) => a+b, 0) / noSlLosses.length : avgSlLoss * 1.5;
      
    const protectedAmount = Math.round(Math.max(0, (avgNoSlLoss - avgSlLoss) * lossTrades.length));
    
    impact.note = `Ước tính số tiền đã bảo vệ được nhờ kỷ luật đặt SL cứng thay vì thả trôi: ~$${protectedAmount}`;
    return impact;
  }
  
  buildEvidence(affectedTrades) {
    const ev = buildEvidence();
    if (affectedTrades.length > 0) {
      ev.addObserved(`Kỷ luật tuyệt vời! Có ${affectedTrades.length} lệnh tuân thủ thiết lập Stop Loss để bảo vệ tài khoản.`);
    }
    return ev;
  }
}

export default new StrictSlBehavior();
