import { BehaviorBase } from '../BehaviorBase';
import { noteContains } from '../helpers';
import { buildEvidence } from '../evidenceBuilder';

class PatientEntryBehavior extends BehaviorBase {
  constructor() {
    super();
    this.id = 'patient_entry';
    this.nameKey = 'bhPatientEntry';
    this.category = 'good';
    this.severity = 5;
    this.relatedBehaviors = [];
  }

  detect(trades, config) {
    const patientTrades = trades.filter(t => 
      noteContains(t, ['chờ', 'đợi', 'kiên nhẫn', 'limit', 'confirm', 'xác nhận', 'patient', 'wait'])
    );

    if (patientTrades.length < 3) return [];

    const winTrades = patientTrades.filter(t => t.status === 'WIN');
    const winrate = (winTrades.length / patientTrades.length);
    const globalWinrate = trades.length > 0 ? trades.filter(t => t.status === 'WIN').length / trades.length : 0;

    if (winrate < 0.5 || winrate < globalWinrate) return [];

    return patientTrades;
  }
  
  calculateImpact(affectedTrades, allTrades) {
    const impact = super.calculateImpact(affectedTrades, allTrades);
    if (!impact) return null;
    impact.note = `Sự kiên nhẫn chờ xác nhận đã mang lại Winrate xuất sắc (${Math.round(impact.winrate * 100)}%), cao hơn mức trung bình chung.`;
    return impact;
  }

  buildEvidence(affectedTrades) {
    const ev = buildEvidence();
    if (affectedTrades.length > 0) {
      ev.addDeclared(`Bạn đã ghi chú/khai báo sự kiên nhẫn (chờ đợi xác nhận, vào bằng lệnh Limit...) trong ${affectedTrades.length} lệnh và đạt tỷ lệ thắng ấn tượng.`);
    }
    return ev;
  }
}

export default new PatientEntryBehavior();
