// ============================================================
// BEHAVIOR INTELLIGENCE ENGINE (RUNNER)
// Plugin-based Architecture for Layer 1 Deterministic Rules
// ============================================================

import { BAD_BEHAVIORS, GOOD_BEHAVIORS } from './behaviors/registry';
import { BehaviorConfig } from './behaviors/config';

// Compute a deterministic priority score to rank behaviors
function computePriorityScore(b) {
  const damage = Math.abs(b.impact?.totalDamage || 0);
  const severity = b.severity || 1;
  const conf = b.confidence || 0.5;
  const freqBonus = Math.min((b.occurrences || 0) * 10, 200);
  return damage * severity * conf + freqBonus;
}

// Compute Analysis Coverage (Data Evidence Layer)
function computeAnalysisCoverage(trades) {
  if (!trades || trades.length === 0) return { overall: 0 };
  
  const categories = {
    risk: ['size', 'pnl', 'stop_loss', 'take_profit', 'risk_plan'],
    execution: ['entry_time', 'exit_time', 'execution_quality'],
    setup: ['setup_tag', 'setup_grade'],
    context: ['market_trend', 'htf_context', 'poi'],
    psychology: ['emotions', 'mistakes']
  };

  const scores = {};
  let totalFilled = 0;
  let totalExpected = 0;

  Object.entries(categories).forEach(([cat, fields]) => {
    let catFilled = 0;
    let catExpected = trades.length * fields.length;
    
    trades.forEach(t => {
      fields.forEach(f => {
        const val = (f === 'entry_time') ? t.trade_time : t[f];
        if (val !== null && val !== undefined && val !== '') {
          catFilled++;
        }
      });
    });
    
    scores[cat] = catExpected > 0 ? catFilled / catExpected : 0;
    totalFilled += catFilled;
    totalExpected += catExpected;
  });

  scores.overall = totalExpected > 0 ? totalFilled / totalExpected : 0;
  return scores;
}

export function runBehaviorEngine(trades) {
  if (!trades || trades.length < 3) return { bad: [], good: [], topPriority: [], dataCoverage: 0, analysisCoverage: {} };

  const analysisCoverage = computeAnalysisCoverage(trades);
  const dataCoverage = analysisCoverage.overall;

  // 1. Run all BAD behaviors
  const rawBad = BAD_BEHAVIORS.map(plugin => {
    try {
      let result = typeof plugin.run === 'function' ? plugin.run(trades, BehaviorConfig) : plugin.detect(trades, BehaviorConfig);
      if (!result) {
        result = {
          id: plugin.id,
          nameKey: plugin.nameKey || plugin.id,
          category: plugin.category || 'misc',
          severity: 0,
          occurrences: 0,
          affectedTradeIds: [],
          confidence: 0,
          impact: { totalDamage: 0 },
          evidence: []
        };
      }
      
      // Merge plugin metadata with dynamic results, ensuring Schema Compliance
      return {
        ...plugin,
        ...result,
        version: BehaviorConfig.version,
        evidence: result.evidence || [], // Enforce evidence array
        detect: undefined,
        run: undefined,
      };
    } catch (err) {
      console.error(`Error running behavior plugin ${plugin.id}:`, err);
      return null;
    }
  }).filter(Boolean);

  // Sort by calculated priority
  const bad = rawBad.sort((a, b) => computePriorityScore(b) - computePriorityScore(a));

  // 2. Run all GOOD behaviors
  const rawGood = GOOD_BEHAVIORS.map(plugin => {
    try {
      let result = typeof plugin.run === 'function' ? plugin.run(trades, BehaviorConfig) : plugin.detect(trades, BehaviorConfig);
      if (!result) {
        result = {
          id: plugin.id,
          nameKey: plugin.nameKey || plugin.id,
          category: plugin.category || 'misc',
          severity: 0,
          occurrences: 0,
          affectedTradeIds: [],
          confidence: 0,
          impact: { totalDamage: 0 },
          evidence: []
        };
      }
      return {
        ...plugin,
        ...result,
        version: BehaviorConfig.version,
        evidence: result.evidence || [],
        detect: undefined,
        run: undefined,
      };
    } catch (err) {
      console.error(`Error running behavior plugin ${plugin.id}:`, err);
      return null;
    }
  }).filter(Boolean);

  return { bad, good: rawGood, topPriority: bad.slice(0, 3), dataCoverage, analysisCoverage, dataQuality: dataCoverage };
}
