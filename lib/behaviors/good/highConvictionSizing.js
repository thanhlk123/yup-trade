import { BehaviorBase } from '../BehaviorBase';
import { median } from '../helpers';
import { buildEvidence } from '../evidenceBuilder';

class HighConvictionSizingBehavior extends BehaviorBase {
  constructor() {
    super();
    this.id = 'high_conviction_sizing';
    this.nameKey = 'bhHighConviction';
    this.category = 'good';
    this.severity = 5;
    this.relatedBehaviors = [];
  }

  detect(trades, config) {
    const sizes = trades.map(t => parseFloat(t.size||0)).filter(s => s > 0);
    if (sizes.length < 10) return [];
    const medSize = median(sizes);
    if (medSize === 0) return [];

    const convictionTrades = trades.filter(t => parseFloat(t.size||0) >= medSize * 1.5);
    if (convictionTrades.length < 3) return [];

    const winTrades = convictionTrades.filter(t => t.status === 'WIN');
    const winrate = (winTrades.length / convictionTrades.length);
    const globalWinrate = trades.length > 0 ? trades.filter(t => t.status === 'WIN').length / trades.length : 0;

    if (winrate < 0.6 || winrate <= globalWinrate) return [];

    const extraProfit = convictionTrades.reduce((s,t) => {
      const pnl = parseFloat(t.pnl||0);
      const actualSize = parseFloat(t.size);
      if (t.status === 'WIN') {
         return s + (pnl - (pnl / actualSize * medSize));
      }
      return s + (pnl - (pnl / actualSize * medSize));
    }, 0);

    if (extraProfit <= 0) return [];

    return convictionTrades.map(t => ({
      trade: t,
      context: { extraProfit }
    }));
  }
  
  calculateImpact(affectedTrades, allTrades) {
    const impact = super.calculateImpact(affectedTrades, allTrades);
    if (!impact) return null;
    if (affectedTrades.length > 0) {
      const ctx = affectedTrades[0].context;
      impact.note = `Việc nhận diện cơ hội tốt và mạnh dạn tăng khối lượng đã mang lại thêm khoản lợi nhuận vượt trội (ước tính ~$${Math.round(ctx.extraProfit)} so với đánh đều tay).`;
    }
    return impact;
  }

  buildEvidence(affectedTrades) {
    const ev = buildEvidence();
    if (affectedTrades.length > 0) {
      ev.addObserved(`Phát hiện ${affectedTrades.length} lệnh bạn đã tăng size lên mức rất cao (>1.5 lần mức trung bình) và đạt winrate cực kỳ xuất sắc ở nhóm lệnh này.`);
    }
    return ev;
  }
}

export default new HighConvictionSizingBehavior();
