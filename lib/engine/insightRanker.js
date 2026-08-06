/**
 * Trading Improvement Engine — Insight Ranker
 * Takes behavior habits + patterns, ranks them by Impact Score, returns Top 5.
 * This is the "Decision Layer" that decides what gets sent to Gemini.
 */

/**
 * rankInsights({ bad, good }, patterns)
 * @returns { topIssues: [...], topStrengths: [...], topPatterns: [...] }
 */
export function rankInsights(habits, patterns) {
  const { bad = [], good = [] } = habits || {};

  // ── Top Issues (bad habits ranked by impactScore) ─────────────────────────
  const topIssues = bad
    .filter(h => h.frequency >= 2) // at least 2 occurrences to be significant
    .sort((a, b) => b.impactScore - a.impactScore)
    .slice(0, 5)
    .map((h, idx) => ({
      rank: idx + 1,
      habitId: h.habitId,
      label: h.label,
      frequency: h.frequency,
      lastSeen: h.lastSeen,
      avgLoss: h.avgLoss,
      totalImpactPnl: h.totalImpactPnl,
      trend: h.trend,
      impactScore: h.impactScore,
      confidence: h.confidence,
      tradeIds: h.tradeIds || [],
    }));

  // ── Top Strengths (good habits) ───────────────────────────────────────────
  const topStrengths = good
    .filter(h => h.frequency >= 2)
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 3)
    .map((h, idx) => ({
      rank: idx + 1,
      habitId: h.habitId,
      label: h.label,
      frequency: h.frequency,
      avgGain: h.avgGain,
      totalImpactPnl: h.totalImpactPnl,
    }));

  // ── Top Patterns (most impactful cross-dimension findings) ─────────────────
  const topPatterns = (patterns || [])
    .sort((a, b) => b.impact - a.impact)
    .slice(0, 5)
    .map((p, idx) => ({
      rank: idx + 1,
      dimension: p.dimension,
      key: p.key,
      finding: p.finding,
      pnl: p.pnl,
      winRate: p.winRate,
      sampleSize: p.sampleSize,
      isPositive: p.isPositive,
    }));

  // ── Primary Focus: the #1 issue to fix ───────────────────────────────────
  const primaryFocus = topIssues[0] || null;

  return { topIssues, topStrengths, topPatterns, primaryFocus };
}
