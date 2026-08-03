import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

// GET: Lấy sessions + correlation với trades
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30');
    const db = await getDb();

    // Lấy tất cả sessions trong X ngày gần nhất
    const sessions = await db.all(
      `SELECT * FROM daily_sessions ORDER BY session_date DESC LIMIT ?`,
      [days]
    );

    // Tính correlation: mỗi session → kết quả giao dịch ngày đó
    const sessionWithStats = await Promise.all(sessions.map(async (s) => {
      const dayTrades = await db.all(
        "SELECT pnl, status FROM trades WHERE date(datetime(trade_time, '+7 hours')) = ?",
        [s.session_date]
      );
      const wins = dayTrades.filter(t => t.status === 'WIN').length;
      const losses = dayTrades.filter(t => t.status === 'LOSS').length;
      const totalPnl = dayTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
      const winrate = dayTrades.length > 0 ? Math.round((wins / dayTrades.length) * 100) : null;
      return {
        ...s,
        day_total_trades: dayTrades.length,
        day_wins: wins,
        day_losses: losses,
        day_pnl: Math.round(totalPnl * 100) / 100,
        day_winrate: winrate,
      };
    }));

    // Tính correlation insights (nhóm theo mood/sleep/stress)
    const insights = computeCorrelationInsights(sessionWithStats);

    return NextResponse.json({ success: true, data: { sessions: sessionWithStats, insights } });
  } catch (error) {
    console.error('Error fetching daily sessions:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST: Tạo hoặc cập nhật session hôm nay
export async function POST(request) {
  try {
    const body = await request.json();
    const { session_date, mood_score, sleep_hours, stress_level, goal_note, risk_warning } = body;

    if (!session_date || mood_score == null || sleep_hours == null || stress_level == null) {
      return NextResponse.json({ success: false, error: 'Thiếu thông tin bắt buộc.' }, { status: 400 });
    }

    const db = await getDb();

    // Upsert (INSERT OR REPLACE)
    await db.run(
      `INSERT INTO daily_sessions (session_date, mood_score, sleep_hours, stress_level, goal_note, risk_warning)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(session_date) DO UPDATE SET
         mood_score = excluded.mood_score,
         sleep_hours = excluded.sleep_hours,
         stress_level = excluded.stress_level,
         goal_note = excluded.goal_note,
         risk_warning = excluded.risk_warning`,
      [session_date, mood_score, sleep_hours, stress_level, goal_note || '', risk_warning || '']
    );

    const saved = await db.get('SELECT * FROM daily_sessions WHERE session_date = ?', [session_date]);
    return NextResponse.json({ success: true, data: saved });
  } catch (error) {
    console.error('Error saving daily session:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// ── Correlation Engine ────────────────────────────────────────────────────
function computeCorrelationInsights(sessions) {
  const insights = [];
  const hasTrades = sessions.filter(s => s.day_total_trades > 0);
  if (hasTrades.length < 3) return insights; // cần ít nhất 3 ngày có giao dịch

  // 1. Sleep correlation
  const goodSleepDays = hasTrades.filter(s => s.sleep_hours >= 7);
  const badSleepDays = hasTrades.filter(s => s.sleep_hours < 6);
  if (goodSleepDays.length >= 2 && badSleepDays.length >= 2) {
    const goodWR = avg(goodSleepDays.map(s => s.day_winrate ?? 0));
    const badWR = avg(badSleepDays.map(s => s.day_winrate ?? 0));
    if (Math.abs(goodWR - badWR) > 5) {
      insights.push({
        type: 'sleep',
        emoji: '😴',
        title: `Ngủ đủ giấc → Winrate cao hơn ${(goodWR - badWR).toFixed(0)}%`,
        detail: `Ngủ ≥7h: Winrate trung bình ${goodWR.toFixed(0)}% | Ngủ <6h: Winrate ${badWR.toFixed(0)}%`,
        color: 'sky',
        isPositive: goodWR > badWR
      });
    }
  }

  // 2. Stress correlation
  const lowStress = hasTrades.filter(s => s.stress_level <= 2);
  const highStress = hasTrades.filter(s => s.stress_level >= 4);
  if (lowStress.length >= 2 && highStress.length >= 2) {
    const lowWR = avg(lowStress.map(s => s.day_winrate ?? 0));
    const highWR = avg(highStress.map(s => s.day_winrate ?? 0));
    if (Math.abs(lowWR - highWR) > 5) {
      insights.push({
        type: 'stress',
        emoji: '😤',
        title: `Stress cao → Winrate thấp hơn ${(lowWR - highWR).toFixed(0)}%`,
        detail: `Stress thấp (1-2): ${lowWR.toFixed(0)}% | Stress cao (4-5): ${highWR.toFixed(0)}%`,
        color: 'rose',
        isPositive: false
      });
    }
  }

  // 3. Mood correlation
  const goodMood = hasTrades.filter(s => s.mood_score >= 4);
  const badMood = hasTrades.filter(s => s.mood_score <= 2);
  if (goodMood.length >= 2 && badMood.length >= 2) {
    const goodWR = avg(goodMood.map(s => s.day_winrate ?? 0));
    const badWR = avg(badMood.map(s => s.day_winrate ?? 0));
    if (Math.abs(goodWR - badWR) > 5) {
      insights.push({
        type: 'mood',
        emoji: '😊',
        title: `Tâm trạng tốt → Winrate cao hơn ${(goodWR - badWR).toFixed(0)}%`,
        detail: `Tâm trạng tốt (4-5⭐): ${goodWR.toFixed(0)}% | Tâm trạng xấu (1-2⭐): ${badWR.toFixed(0)}%`,
        color: 'emerald',
        isPositive: true
      });
    }
  }

  return insights;
}

function avg(arr) {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}
