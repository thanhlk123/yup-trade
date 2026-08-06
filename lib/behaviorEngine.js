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

// Compute Data Quality Score (TDD Requirement)
function computeDataQuality(trades) {
  if (!trades || trades.length === 0) return 0;
  let notesCount = 0;
  trades.forEach(t => {
    if (t.note && t.note.trim().length > 0) notesCount++;
  });
  // CSV gives 60% base quality. Notes give remaining 40%.
  const noteRatio = notesCount / trades.length;
  return 0.6 + (noteRatio * 0.4);
}

export function runBehaviorEngine(trades) {
  if (!trades || trades.length < 3) return { bad: [], good: [], topPriority: [], dataQuality: 0 };

  const dataQuality = computeDataQuality(trades);

  // 1. Run all BAD behaviors
  const rawBad = BAD_BEHAVIORS.map(plugin => {
    try {
      const result = plugin.detect(trades, BehaviorConfig);
      if (!result) return null;
      
      // Merge plugin metadata with dynamic results, ensuring Schema Compliance
      return {
        ...plugin,
        ...result,
        version: BehaviorConfig.version,
        evidence: result.evidence || [], // Enforce evidence array
        detect: undefined,
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
      const result = plugin.detect(trades, BehaviorConfig);
      if (!result) return null;
      return {
        ...plugin,
        ...result,
        version: BehaviorConfig.version,
        evidence: result.evidence || [],
        detect: undefined,
      };
    } catch (err) {
      console.error(`Error running behavior plugin ${plugin.id}:`, err);
      return null;
    }
  }).filter(Boolean);

  return { bad, good: rawGood, topPriority: bad.slice(0, 3), dataQuality };
}
