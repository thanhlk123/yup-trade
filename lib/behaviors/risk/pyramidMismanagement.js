import { BehaviorBase } from '../BehaviorBase';
import { getMonthKey, computeTrend, minutesBetween, noteContains } from '../helpers';
import { buildEvidence } from '../evidenceBuilder';

class PyramidMismanagementBehavior extends BehaviorBase {
  constructor() {
    super();
    this.id = 'pyramid_mismanagement';
    this.nameKey = 'bhPyramidMismanagement';
    this.category = 'risk';
    this.severity = 8.5;
    this.relatedBehaviors = ['oversized'];
  }

  detect(trades, config) {
    const affected = [];
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
      
      if (mins !== null && mins < 240 && prev.asset === t.asset && prev.side === t.side) {
        const t1Exit = prev.exit_time ? new Date(prev.exit_time).getTime() : Infinity;
        const t2Open = new Date(t.trade_time).getTime();
        const isOverlapping = t2Open < t1Exit;

        const p1 = parseFloat(prev.entry_price);
        const p2 = parseFloat(t.entry_price);
        const isPyramid = (t.side === 'BUY' && p2 > p1) || (t.side === 'SELL' && p2 < p1);
        
        if (isOverlapping && isPyramid) {
          currentCluster.push(t);
        } else {
          if (currentCluster.length >= 2) clusters.push([...currentCluster]);
          currentCluster = [t];
        }
      } else {
        if (currentCluster.length >= 2) clusters.push([...currentCluster]);
        currentCluster = [t];
      }
    }
    if (currentCluster.length >= 2) clusters.push([...currentCluster]);

    const explicitSinglePyramid = trades.filter(t => {
      if (clusters.some(c => c.some(ct => ct.id === t.id))) return false;
      return noteContains(t, ['pyramid', 'nhồi thuận', 'scale in', 'scale-in', 'nhồi lãi']);
    });
    explicitSinglePyramid.forEach(t => clusters.push([t]));

    clusters = clusters.filter(c => {
      const pnl = c.reduce((s,t) => s + parseFloat(t.pnl||0), 0);
      return pnl < 0;
    });

    if (clusters.length === 0) return affected;

    clusters.forEach(c => {
      const pnl = c.reduce((s,t) => s + parseFloat(t.pnl||0), 0);
      const isSequencePyramid = c.length >= 2;
      const declaredPyramid = c.some(t => noteContains(t, ['pyramid', 'nhồi thuận', 'scale in', 'scale-in', 'nhồi lãi']));
      
      const badTrades = c.length === 1 ? [c[0]] : c.slice(1);
      
      badTrades.forEach(t => {
        affected.push({
          trade: t,
          context: {
            clusterSize: c.length,
            clusterPnl: pnl,
            asset: c[0].asset,
            isSequencePyramid,
            declaredPyramid
          }
        });
      });
    });

    return affected;
  }
  
  buildEvidence(affectedTrades) {
    const ev = buildEvidence();
    
    const sequenceTrades = affectedTrades.filter(a => a.context.isSequencePyramid);
    if (sequenceTrades.length > 0) {
      const uniqueAssets = [...new Set(sequenceTrades.map(a => a.context.asset))];
      ev.addObserved(`Phát hiện tự động các cụm lệnh nhồi thuận (Pyramiding/Scale-in) thất bại trên các mã ${uniqueAssets.join(', ')} dẫn đến thua lỗ ròng.`);
    }

    const declaredCount = affectedTrades.filter(a => a.context.declaredPyramid).length;
    if (declaredCount > 0) {
      ev.addDeclared(`Bạn đã tự ghi chú/khai báo ${declaredCount} lệnh là lệnh nhồi thuận (Pyramid/Scale-in).`);
    }

    return ev;
  }
  
  calculateConfidence(affectedTrades, evidence) {
    const declaredBoost = evidence.declared.length > 0 ? 0.2 : 0;
    const baseScore = evidence.observed.length > 0 ? 0.85 : 0.70;
    return Math.min(0.98, baseScore + declaredBoost);
  }
}

export default new PyramidMismanagementBehavior();
