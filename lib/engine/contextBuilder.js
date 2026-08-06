/**
 * Trading Improvement Engine — Context Builder
 * Compiles a compact JSON context for Gemini from the analysis engine output.
 * Gemini never sees raw trade data — only this pre-computed, curated summary.
 */

import { getDb } from '@/lib/db.js';

/**
 * buildContext({ coreMetrics, breakdown, insights }, tradeType)
 * @returns compact JSON ready to send to Gemini
 */
export async function buildContext({ coreMetrics, breakdown, insights, trades = [] }, tradeType = 'ALL') {
  const { topIssues, topStrengths, topPatterns, primaryFocus } = insights;
  const { bestSession, worstSession, bestAsset, worstAsset } = breakdown;

  // ── Load last 5 coaching sessions from DB (Coaching Memory) ─────────────────
  let previousSessions = [];
  try {
    const db = await getDb();
    previousSessions = await db.all(
      `SELECT * FROM coaching_sessions WHERE trade_type = ? ORDER BY created_at DESC LIMIT 5`,
      [tradeType]
    );
  } catch (e) {
    // DB not ready yet, skip
  }

  const previousSession = previousSessions[0] || null;

  // ── Parse previous mission if exists ──────────────────────────────────────
  let previousFocus = null;
  let previousMission = [];
  let previousMissionCompleted = false;
  let previousGeminiOutput = null;

  if (previousSession) {
    previousFocus = previousSession.coach_focus || null;
    try {
      previousMission = JSON.parse(previousSession.mission_items || '[]');
    } catch (_) {}
    previousMissionCompleted = previousSession.mission_completed === 1;
    try {
      previousGeminiOutput = JSON.parse(previousSession.gemini_output || 'null');
    } catch (_) {}
  }

  // ── Build Coach Timeline & Recovery Progress ───────────────────────────────
  const coachTimeline = [];
  let recoveryProgress = [];
  
  if (previousSessions.length > 0) {
    previousSessions.reverse().forEach((sess, idx) => {
      try {
        const out = JSON.parse(sess.gemini_output);
        if (out && out.diagnosis) {
          coachTimeline.push({
            session: `Tuần ${idx + 1}`,
            disease: out.diagnosis.disease,
            date: sess.session_date || sess.created_at?.split(' ')[0]
          });
        }
      } catch (e) {}
    });
    // Build recovery progress for the CURRENT primary focus
    if (primaryFocus) {
      previousSessions.reverse().forEach(sess => {
        try {
          const snap = JSON.parse(sess.context_snapshot);
          const issue = snap.topIssues?.find(i => i.habitId === primaryFocus.habitId || i.label.includes(primaryFocus.habitId));
          if (issue) recoveryProgress.push(issue.frequency);
        } catch (e) {}
      });
      // Add current week
      const currentIssue = topIssues.find(i => i.habitId === primaryFocus.habitId);
      if (currentIssue) recoveryProgress.push(currentIssue.frequency);
    }
  }

  // ── Build improvement trend (compare last coaching vs current data) ────────
  const improvementTrend = [];
  if (previousFocus) {
    const currentIssue = topIssues.find(i => i.habitId === previousFocus || i.label.includes(previousFocus));
    if (currentIssue && previousSession?.context_snapshot) {
      try {
        const prevContext = JSON.parse(previousSession.context_snapshot);
        const prevIssue = prevContext.topIssues?.find(i => i.habitId === previousFocus);
        if (prevIssue && prevIssue.frequency > 0) {
          const change = Math.round(((currentIssue.frequency - prevIssue.frequency) / prevIssue.frequency) * 100);
          improvementTrend.push({
            habitId: previousFocus,
            prevFrequency: prevIssue.frequency,
            currFrequency: currentIssue.frequency,
            change: `${change > 0 ? '+' : ''}${change}%`,
            improved: change < 0,
          });
        }
      } catch (_) {}
    }
  }

  // ── Format session & asset summaries ──────────────────────────────────────
  const sessionSummary = bestSession && worstSession ? {
    best: `${bestSession.key} (PnL ${bestSession.pnl > 0 ? '+' : ''}${bestSession.pnl}$, WR ${bestSession.winRate}%)`,
    worst: `${worstSession.key} (PnL ${worstSession.pnl}$, WR ${worstSession.winRate}%)`,
  } : null;

  // ── Extract Exhibits (Case Studies) ───────────────────────────────────────
  const exhibits = [];
  if (primaryFocus && primaryFocus.tradeIds && primaryFocus.tradeIds.length > 0 && trades.length > 0) {
    const focusTrades = trades
      .filter(t => primaryFocus.tradeIds.includes(t.id))
      .sort((a, b) => parseFloat(a.pnl) - parseFloat(b.pnl)); // sort by worst PnL first
      
    // Take up to 3 worst trades as case studies
    focusTrades.slice(0, 3).forEach(t => {
      exhibits.push({
        tradeId: t.id,
        asset: t.asset,
        date: t.trade_time,
        pnl: `${t.pnl}$`,
        setup: t.setup_tag || 'none',
        notes: t.user_notes || 'no notes',
      });
    });
  }

  // ── Build the compact context JSON ────────────────────────────────────────
  const uniqueDays = new Set(trades.map(t => {
    if (!t.trade_time) return '';
    const dateStr = typeof t.trade_time === 'number' ? new Date(t.trade_time).toISOString() : t.trade_time;
    return dateStr.split('T')[0] || dateStr.split(' ')[0];
  }).filter(Boolean)).size || 1;
  
  const avgTradesPerDay = (trades.length / uniqueDays).toFixed(1);
  let tradingStyle = 'Day Trader';
  if (avgTradesPerDay > 5) tradingStyle = 'Scalper (Giao dịch tần suất cao)';
  else if (avgTradesPerDay < 1) tradingStyle = 'Swing Trader (Giao dịch dài hạn)';

  const context = {
    summary: {
      totalTrades: coreMetrics.totalTrades,
      averageTradesPerDay: avgTradesPerDay,
      tradingStyle: tradingStyle,
      winRate: `${coreMetrics.winRate}%`,
      totalPnl: `${coreMetrics.totalPnl > 0 ? '+' : ''}${coreMetrics.totalPnl}$`,
      profitFactor: coreMetrics.profitFactor,
      expectancy: coreMetrics.expectancy,
      maxDrawdown: `${coreMetrics.maxDrawdown}$`,
    },
    sessions: sessionSummary,
    topStrengths: topStrengths.map(s => `${s.label} (${s.frequency} lần, Lãi TB: ${s.avgGain}$)`),
    topIssues: topIssues.slice(0, 3).map(h => ({
      habit: h.label,
      frequency: h.frequency,
      impactScore: h.impactScore,
      avgLoss: `${h.avgLoss}$`,
      totalLoss: `${h.totalImpactPnl}$`,
      trend: h.trend,
      lastSeen: h.lastSeen,
    })),
    criticalPatterns: topPatterns.slice(0, 3).map(p => p.finding),
    exhibits,
    coachFocus: primaryFocus ? primaryFocus.habitId : null,
    previousFocus,
    previousMission,
    previousMissionCompleted,
    previousGeminiOutput,
    improvementTrend,
    coachTimeline,
    recoveryProgress,
  };

  return context;
}

/**
 * saveCoachingSession(context, geminiOutput, tradeType)
 * Persists the coaching session for next-session comparison.
 */
export async function saveCoachingSession(context, geminiOutput, tradeType = 'ALL') {
  try {
    const db = await getDb();
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
    const missionItems = JSON.stringify(geminiOutput?.action_plan || []);

    await db.run(
      `INSERT INTO coaching_sessions (session_date, trade_type, coach_focus, mission_items, gemini_output, context_snapshot)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        today,
        tradeType,
        geminiOutput?.focus_one_thing || context.coachFocus || '',
        missionItems,
        JSON.stringify(geminiOutput),
        JSON.stringify({ topIssues: context.topIssues }),
      ]
    );
  } catch (e) {
    console.error('Failed to save coaching session:', e.message);
  }
}
