import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getTradeTypeFilter } from '@/lib/tradeUtils';
import { calculateCoreMetrics, groupBySession, groupByAsset, groupByDayOfWeek } from '@/lib/engine/statsEngine';
import { detectHabits } from '@/lib/engine/behaviorEngine';
import { detectPatterns } from '@/lib/engine/patternEngine';
import { rankInsights } from '@/lib/engine/insightRanker';

/**
 * GET /api/engine/analyze?type=LIVE
 * Returns the full Trading Improvement Engine analysis report (no AI).
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'ALL';

    const db = await getDb();
    let query = 'SELECT * FROM trades';
    const filter = getTradeTypeFilter(type, false);
    query += filter.sql;
    query += ' ORDER BY trade_time ASC';
    const trades = await db.all(query, filter.params);

    if (trades.length === 0) {
      return NextResponse.json({ success: true, data: null, message: 'Không có dữ liệu giao dịch.' });
    }

    // ── Phase 1: Stats ───────────────────────────────────────────────────────
    const coreMetrics = calculateCoreMetrics(trades);
    const sessionBreakdown = groupBySession(trades);
    const assetBreakdown = groupByAsset(trades);
    const dowBreakdown = groupByDayOfWeek(trades);

    const bestSession = sessionBreakdown.sort((a, b) => b.pnl - a.pnl)[0] || null;
    const worstSession = [...sessionBreakdown].sort((a, b) => a.pnl - b.pnl)[0] || null;
    const bestAsset = assetBreakdown.sort((a, b) => b.pnl - a.pnl)[0] || null;
    const worstAsset = [...assetBreakdown].sort((a, b) => a.pnl - b.pnl)[0] || null;

    // ── Phase 2: Behavior ────────────────────────────────────────────────────
    const habits = detectHabits(trades);

    // ── Phase 3: Patterns ────────────────────────────────────────────────────
    const patterns = detectPatterns(trades);

    // ── Phase 4: Ranking ─────────────────────────────────────────────────────
    const { topIssues, topStrengths, topPatterns, primaryFocus } = rankInsights(habits, patterns);

    return NextResponse.json({
      success: true,
      data: {
        tradeSample: trades.length,
        coreMetrics,
        breakdown: {
          sessions: sessionBreakdown,
          assets: assetBreakdown,
          dayOfWeek: dowBreakdown,
          bestSession,
          worstSession,
          bestAsset,
          worstAsset,
        },
        habits: {
          allBad: habits.bad,
          allGood: habits.good,
        },
        patterns,
        insights: {
          topIssues,
          topStrengths,
          topPatterns,
          primaryFocus,
        },
      },
    });
  } catch (error) {
    console.error('Engine analyze error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
