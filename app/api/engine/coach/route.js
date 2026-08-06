import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getTradeTypeFilter } from '@/lib/tradeUtils';
import { calculateCoreMetrics, groupBySession, groupByAsset, groupByDayOfWeek } from '@/lib/engine/statsEngine';
import { detectHabits } from '@/lib/engine/behaviorEngine';
import { detectPatterns } from '@/lib/engine/patternEngine';
import { rankInsights } from '@/lib/engine/insightRanker';
import { buildContext, saveCoachingSession } from '@/lib/engine/contextBuilder';
import { callGeminiCoach } from '@/lib/engine/geminiCoach';

/**
 * POST /api/engine/coach
 * Body: { type: 'ALL' | 'LIVE', lang: 'vi' | 'en' }
 * Runs the full pipeline: Stats → Behavior → Pattern → Rank → Context → Gemini → Save
 */
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const type = body.type || 'ALL';
    const lang = body.lang || 'vi';
    const timeframe = body.timeframe || 'last_50';

    // 1. Load trades from DB
    const db = await getDb();
    let query = 'SELECT * FROM trades';
    const filter = getTradeTypeFilter(type, false);
    query += filter.sql;

    if (timeframe === 'last_30_days') {
      query += query.includes('WHERE') ? " AND trade_time >= date('now', '-30 days')" : " WHERE trade_time >= date('now', '-30 days')";
    }

    if (timeframe === 'last_50') {
      query += ' ORDER BY trade_time DESC LIMIT 50';
    } else {
      query += ' ORDER BY trade_time ASC';
    }

    let trades = await db.all(query, filter.params);

    if (timeframe === 'last_50') {
      trades = trades.reverse(); // Reverse back to ASC for chronological processing
    }

    if (!trades || trades.length < 5) {
      return NextResponse.json({
        success: false,
        error: 'Cần ít nhất 5 lệnh để tạo Coaching Plan.',
      }, { status: 400 });
    }

    // 2. Stats Engine
    const coreMetrics = calculateCoreMetrics(trades);
    const sessionBreakdown = groupBySession(trades);
    const assetBreakdown = groupByAsset(trades);
    const dowBreakdown = groupByDayOfWeek(trades);

    const sessionSorted = [...sessionBreakdown].sort((a, b) => b.pnl - a.pnl);
    const assetSorted = [...assetBreakdown].sort((a, b) => b.pnl - a.pnl);

    const breakdown = {
      sessions: sessionBreakdown,
      assets: assetBreakdown,
      dayOfWeek: dowBreakdown,
      bestSession: sessionSorted[0] || null,
      worstSession: sessionSorted[sessionSorted.length - 1] || null,
      bestAsset: assetSorted[0] || null,
      worstAsset: assetSorted[assetSorted.length - 1] || null,
    };

    // 3. Behavior Engine
    const habits = detectHabits(trades);

    // 4. Pattern Engine
    const patterns = detectPatterns(trades);

    // 5. Insight Ranker
    const insights = rankInsights(habits, patterns);

    // 6. Context Builder
    const context = await buildContext({
      coreMetrics,
      breakdown,
      insights,
      trades
    }, type);

    // 7. Gemini Coach (Reasoning Engine)
    const geminiOutput = await callGeminiCoach(context, lang);

    // 8. Save session to DB (Coaching Memory)
    await saveCoachingSession(context, geminiOutput, type);

    return NextResponse.json({
      success: true,
      data: {
        coaching: geminiOutput,
        context,              // Return for UI display / debug
        insights,
        coreMetrics,
        breakdown,
      },
    });
  } catch (error) {
    console.error('[/api/engine/coach] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/**
 * GET /api/engine/coach?type=ALL
 * Returns the last saved coaching session (for display without regenerating).
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'ALL';

    const db = await getDb();
    const session = await db.get(
      `SELECT * FROM coaching_sessions WHERE trade_type = ? ORDER BY created_at DESC LIMIT 1`,
      [type]
    );

    if (!session) {
      return NextResponse.json({ success: true, data: null });
    }

    return NextResponse.json({
      success: true,
      data: {
        sessionDate: session.session_date,
        coaching: JSON.parse(session.gemini_output || 'null'),
        missionCompleted: session.mission_completed === 1,
        coachFocus: session.coach_focus,
      },
    });
  } catch (error) {
    console.error('[/api/engine/coach GET] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/**
 * PATCH /api/engine/coach
 * Body: { type: 'ALL', completed: true } — marks last mission as completed
 */
export async function PATCH(request) {
  try {
    const { type = 'ALL', completed = true } = await request.json();
    const db = await getDb();
    const session = await db.get(
      `SELECT id FROM coaching_sessions WHERE trade_type = ? ORDER BY created_at DESC LIMIT 1`,
      [type]
    );
    if (!session) return NextResponse.json({ success: false, error: 'No session found.' }, { status: 404 });

    await db.run(
      `UPDATE coaching_sessions SET mission_completed = ? WHERE id = ?`,
      [completed ? 1 : 0, session.id]
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
