import { BehaviorBase } from '../BehaviorBase';
import { buildEvidence } from '../evidenceBuilder';
import { TAGS } from '../tags';

class LowConfirmationBehavior extends BehaviorBase {
  constructor() {
    super();
    this.id = 'low_confirmation';
    this.nameKey = 'bhLowConfirmation';
    this.category = 'execution';
    this.severity = 6.5;
    this.relatedBehaviors = ['fomo', 'poor_execution'];
  }

  detect(trades, config) {
    const affected = [];

    trades.forEach(t => {
      let isEarlyEntry = false;
      const evidence = { declared: [], observed: [], derived: [] };

      // 1. Check Declared Evidence (Strong)
      const mistakes = t.mistakes ? t.mistakes.toLowerCase() : '';
      const notes = t.user_notes ? t.user_notes.toLowerCase() : '';
      const exec = t.execution_quality ? t.execution_quality.toLowerCase() : '';

      if (mistakes.includes(TAGS.MISTAKE_EARLY_ENTRY.toLowerCase()) || 
          exec.includes(TAGS.EXEC_FOMO.toLowerCase()) || 
          exec.includes(TAGS.EXEC_CHASING.toLowerCase())) {
        isEarlyEntry = true;
        evidence.declared.push('Bạn đã tự đánh dấu lệnh này là Vào Lệnh Sớm / Thiếu Xác Nhận (Early Entry / FOMO).');
      } else if (notes.includes('vào sớm') || notes.includes('chưa confirm') || notes.includes('chưa xác nhận') || notes.includes('chưa chờ')) {
        isEarlyEntry = true;
        evidence.declared.push(`Ghi chú của bạn chỉ ra sự thiếu kiên nhẫn: "${t.user_notes}"`);
      }

      // 2. Check Observed Evidence (Supporting)
      // Never treat null as 0. Only check if confluences field is explicitly provided.
      if (t.confluences != null && t.confluences.trim() !== '') {
        try {
          const parsed = t.confluences.startsWith('[') 
            ? JSON.parse(t.confluences) 
            : t.confluences.split(',').filter(c => c.trim().length > 0);
            
          // Explicitly filled but 0 confluences is a weak signal
          if (parsed.length === 0) {
            evidence.observed.push('Hệ thống ghi nhận không có yếu tố hợp lưu (confluence) nào được điền.');
            // We flag it if explicitly 0 confluences AND resulted in a LOSS
            if (!isEarlyEntry && t.status === 'LOSS') {
               isEarlyEntry = true;
            }
          }
        } catch (e) {
          // parse error, ignore
        }
      }

      if (isEarlyEntry) {
        affected.push({
          trade: t,
          context: evidence
        });
      }
    });

    return affected;
  }
  
  buildEvidence(affectedTrades) {
    const ev = buildEvidence();
    if (affectedTrades.length === 0) return ev;
    
    let totalDeclared = 0;
    
    affectedTrades.forEach(a => {
      if (a.context.declared && a.context.declared.length > 0) {
        totalDeclared++;
      }
    });
    
    if (totalDeclared > 0) {
      ev.addDeclared(`Có ${totalDeclared} lệnh bạn tự thừa nhận vào lệnh sớm, thiếu xác nhận trước khi setup hoàn tất.`);
    }
    
    const obsCount = affectedTrades.filter(a => a.context.observed && a.context.observed.length > 0).length;
    if (obsCount > 0) {
      ev.addObserved(`Có ${obsCount} lệnh hoàn toàn không có yếu tố hợp lưu nào được ghi nhận.`);
    }

    // Derived: showing the impact without outcome bias on the rule itself
    const lossCount = affectedTrades.filter(a => a.trade.status === 'LOSS').length;
    if (lossCount > 0) {
       ev.addContext(`Vào lệnh thiếu xác nhận đã trực tiếp dẫn đến ${lossCount} lệnh thua lỗ trong tổng số ${affectedTrades.length} lệnh lỗi này.`);
    }

    return ev;
  }
}

export default new LowConfirmationBehavior();
