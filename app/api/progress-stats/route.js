import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getTradeTypeFilter } from '@/lib/tradeUtils';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'ALL';
    const timeRange = searchParams.get('timeRange') || 'week'; // 'today' | 'week' | 'month' | 'all'
    const dataFilter = searchParams.get('dataFilter') || 'all'; // 'all' | 'rich'
    const lang = searchParams.get('lang') || 'vi';

    const db = await getDb();
    let query = 'SELECT * FROM trades';
    const filter = getTradeTypeFilter(type, false);
    query += filter.sql;
    const params = filter.params;

    query += ' ORDER BY trade_time ASC';

    let trades = await db.all(query, params);

    if (trades.length === 0) {
      return NextResponse.json({ success: true, data: getEmptyData() });
    }

    // Tag rich journal vs raw CSV trades
    const rawCsvCount = trades.filter(t => !t.user_notes || t.user_notes.trim().length <= 10).length;
    const richJournalCount = trades.filter(t => t.user_notes && t.user_notes.trim().length > 10).length;

    if (dataFilter === 'rich') {
      trades = trades.filter(t => t.user_notes && t.user_notes.trim().length > 10);
    }

    if (trades.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          ...getEmptyData(),
          dataMeta: { rawCsvCount, richJournalCount, dataFilter, timeRange }
        }
      });
    }

    // ── 1. EQUITY CURVE (cộng dồn theo thứ tự thời gian) ──────────────────
    let cumulative = 0;
    const equityCurve = trades.map((t, idx) => {
      cumulative += t.pnl || 0;
      return {
        label: `#${idx + 1}`,
        trade_time: t.trade_time,
        pnl: Math.round(cumulative * 100) / 100,
        tradePnl: Math.round((t.pnl || 0) * 100) / 100,
        status: t.status,
      };
    });

    // ── 2. DAILY WINRATE (14 ngày giao dịch gần nhất) ────────────────────
    const dailyMap = {};
    trades.forEach(t => {
      if (!t.trade_time) return;
      const dayKey = getLocalDayKey(t.trade_time);
      if (!dayKey) return;
      if (!dailyMap[dayKey]) {
        dailyMap[dayKey] = { day: dayKey, wins: 0, losses: 0, total: 0, pnl: 0 };
      }
      dailyMap[dayKey].total += 1;
      dailyMap[dayKey].pnl += t.pnl || 0;
      if (t.status === 'WIN') dailyMap[dayKey].wins += 1;
      else if (t.status === 'LOSS') dailyMap[dayKey].losses += 1;
    });

    const dailyData = Object.values(dailyMap)
      .sort((a, b) => a.day.localeCompare(b.day))
      .slice(-14)
      .map(d => {
        const parts = d.day.split('-');
        return {
          ...d,
          winrate: d.total > 0 ? Math.round((d.wins / d.total) * 1000) / 10 : 0,
          pnl: Math.round(d.pnl * 100) / 100,
          label: parts.length === 3 ? `${parts[2]}/${parts[1]}` : d.day, // "28/07"
        };
      });

    // ── 3. WEEKLY WINRATE (12 tuần gần nhất) ──────────────────────────────
    const weeklyMap = {};
    trades.forEach(t => {
      if (!t.trade_time) return;
      const d = new Date(t.trade_time.replace(' ', 'T') + 'Z');
      const weekKey = getISOWeekKey(d);
      if (!weeklyMap[weekKey]) {
        weeklyMap[weekKey] = { week: weekKey, wins: 0, losses: 0, total: 0, pnl: 0 };
      }
      weeklyMap[weekKey].total += 1;
      weeklyMap[weekKey].pnl += t.pnl || 0;
      if (t.status === 'WIN') weeklyMap[weekKey].wins += 1;
      else if (t.status === 'LOSS') weeklyMap[weekKey].losses += 1;
    });

    const weeklyData = Object.values(weeklyMap)
      .sort((a, b) => a.week.localeCompare(b.week))
      .slice(-12)
      .map(w => ({
        ...w,
        winrate: w.total > 0 ? Math.round((w.wins / w.total) * 1000) / 10 : 0,
        pnl: Math.round(w.pnl * 100) / 100,
        label: w.week.replace(/^\d{4}-/, ''),
      }));

    // ── 4. MONTHLY COMPARISON (6 tháng gần nhất) ─────────────────────────
    const monthlyMap = {};
    trades.forEach(t => {
      if (!t.trade_time) return;
      const key = getLocalMonthKey(t.trade_time);
      if (!monthlyMap[key]) {
        monthlyMap[key] = { month: key, wins: 0, losses: 0, total: 0, pnl: 0 };
      }
      monthlyMap[key].total += 1;
      monthlyMap[key].pnl += t.pnl || 0;
      if (t.status === 'WIN') monthlyMap[key].wins += 1;
      else if (t.status === 'LOSS') monthlyMap[key].losses += 1;
    });

    const monthlyData = Object.values(monthlyMap)
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-6)
      .map(m => ({
        ...m,
        winrate: m.total > 0 ? Math.round((m.wins / m.total) * 1000) / 10 : 0,
        pnl: Math.round(m.pnl * 100) / 100,
        label: formatMonthLabel(m.month),
      }));

    // ── Filter Trades by timeRange ─────────────────────────────────────────
    const now = new Date();
    const todayStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
    const currentISOWeek = getISOWeekKey(now);
    const currentMonthStr = todayStr.substring(0, 7);

    let targetTrades = trades;
    if (timeRange === 'today') {
      const todayTrades = trades.filter(t => t.trade_time && getLocalDayKey(t.trade_time) === todayStr);
      if (todayTrades.length > 0) {
        targetTrades = todayTrades;
      } else {
        // Fallback to the latest single trading day if today has no trades
        const lastTime = trades[trades.length - 1]?.trade_time;
        const lastDayStr = getLocalDayKey(lastTime) || todayStr;
        targetTrades = trades.filter(t => t.trade_time && getLocalDayKey(t.trade_time) === lastDayStr);
      }
    } else if (timeRange === 'week') {
      const weekTrades = trades.filter(t => t.trade_time && getISOWeekKey(new Date(t.trade_time.replace(' ', 'T') + 'Z')) === currentISOWeek);
      targetTrades = weekTrades.length > 0 ? weekTrades : trades.slice(-25);
    } else if (timeRange === 'month') {
      const monthTrades = trades.filter(t => t.trade_time && getLocalMonthKey(t.trade_time) === currentMonthStr);
      targetTrades = monthTrades.length > 0 ? monthTrades : trades.slice(-60);
    }

    // ── 6. OVERALL SUMMARY CALCULATIONS FOR TARGET TIME PERIOD ────────────
    const wins = targetTrades.filter(t => t.status === 'WIN').length;
    const losses = targetTrades.filter(t => t.status === 'LOSS').length;
    const totalPnl = targetTrades.reduce((s, t) => s + (t.pnl || 0), 0);
    const avgPnlPerTrade = targetTrades.length > 0 ? totalPnl / targetTrades.length : 0;
    const bestTrade = targetTrades.reduce((b, t) => (t.pnl > (b?.pnl || -Infinity) ? t : b), null);
    const worstTrade = targetTrades.reduce((w, t) => (t.pnl < (w?.pnl || Infinity) ? t : w), null);

    // ── 7. STREAK & SCORECARD CALCULATIONS FOR TARGET PERIOD ───────────────
    const streaks = calculateStreaks(targetTrades);

    const slDisciplineTrades = targetTrades.filter(t => (t.stop_loss && t.stop_loss > 0) || (t.user_notes || '').includes('#Strength_StrictSL')).length;
    const slRate = targetTrades.length > 0 ? Math.round((slDisciplineTrades / targetTrades.length) * 100) : 100;
    
    const dcaTrades = targetTrades.filter(t => (t.user_notes || '').includes('#Mistake_DCA') || (t.user_notes || '').toLowerCase().includes('dca')).length;
    const noDcaRate = targetTrades.length > 0 ? Math.round(((targetTrades.length - dcaTrades) / targetTrades.length) * 100) : 100;
    
    const wr = targetTrades.length > 0 ? (wins / targetTrades.length) : 0;
    const wrScore = Math.min(30, Math.round(wr * 30));

    const consistencyScore = Math.min(100, Math.round((slRate * 0.45) + (noDcaRate * 0.35) + (wrScore * 0.67)));
    
    let consistencyGrade = 'C';
    if (consistencyScore >= 85) consistencyGrade = 'S';
    else if (consistencyScore >= 75) consistencyGrade = 'A';
    else if (consistencyScore >= 60) consistencyGrade = 'B';
    else if (consistencyScore >= 45) consistencyGrade = 'C';
    else consistencyGrade = 'D';

    // Milestones
    const cleanTrades = targetTrades.filter(t => !(t.user_notes || '').includes('#Mistake_')).length;
    const milestones = {
      maxWinStreak: streaks.maxWinStreak,
      cleanTradeRate: targetTrades.length > 0 ? Math.round((cleanTrades / targetTrades.length) * 100) : 100,
      bestTradePnl: bestTrade ? Math.round(bestTrade.pnl * 100) / 100 : 0,
      totalProfitableTrades: wins,
    };

    // Next Best Action Advice
    let nextBestAction = "Tiếp tục tuân thủ kỷ luật đặt Cắt lỗ (SL) và giữ vững khối lượng giao dịch chuẩn.";
    if (lang === 'en') {
      nextBestAction = "Continue maintaining Stop Loss (SL) discipline and standard position sizing.";
    } else if (lang === 'zh') {
      nextBestAction = "继续保持止损 (SL) 纪律并维持标准仓位管理。";
    } else if (lang === 'ko') {
      nextBestAction = "손절가(SL) 원칙 준수와 표준 수량 포지션 관리를 계속 유지하세요.";
    } else if (lang === 'es') {
      nextBestAction = "Continúa manteniendo la disciplina de Stop Loss (SL) y el tamaño de posición estándar.";
    }

    if (dcaTrades > 0) {
      if (lang === 'en') nextBestAction = "Completely eliminate averaging down losses (#Mistake_DCA). This single habit reduces your overall profit by up to 80%.";
      else if (lang === 'zh') nextBestAction = "彻底杜绝逆势加仓 (#Mistake_DCA) 行为。这是导致您总体利润减少高达 80% 的主要因素。";
      else if (lang === 'ko') nextBestAction = "물타기(#Mistake_DCA) 습관을 완전히 제거하세요. 이는 전체 수익을 최대 80% 감소시키는 주원인입니다.";
      else if (lang === 'es') nextBestAction = "Elimina por completo promediar pérdidas (#Mistake_DCA). Este hábito reduce tu beneficio general hasta un 80%.";
      else nextBestAction = "Loại bỏ hoàn toàn hành vi nhồi lệnh âm (#Mistake_DCA). Đây là yếu tố làm giảm đến 80% lợi nhuận của bạn.";
    } else if (slRate < 80) {
      if (lang === 'en') nextBestAction = "Raise your Stop Loss (SL) compliance rate to 100% before entering any order to protect capital.";
      else if (lang === 'zh') nextBestAction = "在下单前将止损 (SL) 执行率提高至 100%，以保护您的交易本金。";
      else if (lang === 'ko') nextBestAction = "자본을 보호하기 위해 매매 진입 전 손절가(SL) 설정 비율을 100%로 높이세요.";
      else if (lang === 'es') nextBestAction = "Aumenta la tasa de cumplimiento de Stop Loss (SL) al 100% antes de ingresar cualquier orden para proteger tu capital.";
      else nextBestAction = "Nâng tỷ lệ cài Cắt Lỗ (SL) lên 100% trước khi bấm lệnh để bảo vệ vốn.";
    }

    // ── 8. DETAILED PROGRESS & REGRESSION ANALYSIS ────────────────────────
    const comparison = generateProgressAnalysis(trades, weeklyData, monthlyData, lang);

    return NextResponse.json({
      success: true,
      data: {
        dataMeta: {
          rawCsvCount,
          richJournalCount,
          dataFilter,
          timeRange,
          hasRichData: richJournalCount > 0
        },
        consistency: {
          score: consistencyScore,
          grade: consistencyGrade,
          slRate,
          noDcaRate,
        },
        milestones,
        nextBestAction,
        comparison,
        summary: {
          totalTrades: trades.length,
          wins,
          losses,
          winrate: trades.length > 0 ? Math.round((wins / trades.length) * 1000) / 10 : 0,
          totalPnl: Math.round(totalPnl * 100) / 100,
          avgPnlPerTrade: Math.round(avgPnlPerTrade * 100) / 100,
          bestTradePnl: bestTrade ? Math.round(bestTrade.pnl * 100) / 100 : 0,
          worstTradePnl: worstTrade ? Math.round(worstTrade.pnl * 100) / 100 : 0,
        }
      }
    });

  } catch (error) {
    console.error('Error generating progress stats:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────

function getISOWeekKey(dateInput) {
  const d = typeof dateInput === 'string' ? new Date(dateInput.replace(' ', 'T') + 'Z') : new Date(dateInput);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  const weekNum = 1 + Math.round(((d - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

const getLocalDayKey = (dateStr) => {
  if (!dateStr) return '';
  const isoStr = dateStr.replace(' ', 'T') + 'Z';
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }); // YYYY-MM-DD
};

const getLocalMonthKey = (dateStr) => {
  if (!dateStr) return '';
  const dayKey = getLocalDayKey(dateStr);
  return dayKey ? dayKey.substring(0, 7) : ''; // YYYY-MM
};

function formatMonthLabel(monthStr) {
  const [year, month] = monthStr.split('-');
  const months = ['Th1', 'Th2', 'Th3', 'Th4', 'Th5', 'Th6', 'Th7', 'Th8', 'Th9', 'Th10', 'Th11', 'Th12'];
  return `${months[parseInt(month) - 1]}/${year.slice(2)}`;
}

function calculateStreaks(trades) {
  const ordered = [...trades].sort((a, b) => new Date(a.trade_time.replace(' ', 'T') + 'Z') - new Date(b.trade_time.replace(' ', 'T') + 'Z'));

  let currentWinStreak = 0;
  let currentLossStreak = 0;
  let maxWinStreak = 0;
  let maxLossStreak = 0;
  let tempWin = 0;
  let tempLoss = 0;

  ordered.forEach(t => {
    if (t.status === 'WIN') {
      tempWin += 1;
      tempLoss = 0;
      if (tempWin > maxWinStreak) maxWinStreak = tempWin;
    } else if (t.status === 'LOSS') {
      tempLoss += 1;
      tempWin = 0;
      if (tempLoss > maxLossStreak) maxLossStreak = tempLoss;
    } else {
      // BREAKEVEN resets streaks
      tempWin = 0;
      tempLoss = 0;
    }
  });

  // Current streak = last N consecutive same status
  let i = ordered.length - 1;
  if (i >= 0) {
    const lastStatus = ordered[i].status;
    if (lastStatus === 'WIN') {
      let streak = 0;
      while (i >= 0 && ordered[i].status === 'WIN') { streak++; i--; }
      currentWinStreak = streak;
    } else if (lastStatus === 'LOSS') {
      let streak = 0;
      while (i >= 0 && ordered[i].status === 'LOSS') { streak++; i--; }
      currentLossStreak = streak;
    }
  }

  return { currentWinStreak, currentLossStreak, maxWinStreak, maxLossStreak };
}

function generateProgressAnalysis(trades, weeklyData, monthlyData, lang = 'vi') {
  const improvements = [];
  const regressions = [];
  const isEn = lang === 'en';
  const isZh = lang === 'zh';
  const isKo = lang === 'ko';
  const isEs = lang === 'es';

  // Compare recent vs previous weekly data
  if (weeklyData.length >= 2) {
    const curr = weeklyData[weeklyData.length - 1];
    const prev = weeklyData[weeklyData.length - 2];

    const wrDiff = Math.round((curr.winrate - prev.winrate) * 10) / 10;
    if (wrDiff > 0) {
      if (isEn) improvements.push(`This week's win rate (${curr.winrate}%) increased by +${wrDiff}% vs last week (${prev.winrate}%)`);
      else if (isZh) improvements.push(`本周胜率 (${curr.winrate}%) 较上周 (${prev.winrate}%) 提升了 +${wrDiff}%`);
      else if (isKo) improvements.push(`이번 주 승률(${curr.winrate}%)이 지난주(${prev.winrate}%) 대비 +${wrDiff}% 상승했습니다.`);
      else if (isEs) improvements.push(`La tasa de acierto de esta semana (${curr.winrate}%) aumentó +${wrDiff}% frente a la semana anterior (${prev.winrate}%)`);
      else improvements.push(`Tỷ lệ thắng tuần này (${curr.winrate}%) tăng +${wrDiff}% so với tuần trước (${prev.winrate}%)`);
    } else if (wrDiff < 0) {
      if (isEn) regressions.push(`This week's win rate (${curr.winrate}%) dropped by ${wrDiff}% vs last week (${prev.winrate}%)`);
      else if (isZh) regressions.push(`本周胜率 (${curr.winrate}%) 较上周 (${prev.winrate}%) 下降了 ${wrDiff}%`);
      else if (isKo) regressions.push(`이번 주 승률(${curr.winrate}%)이 지난주(${prev.winrate}%) 대비 ${wrDiff}% 하락했습니다.`);
      else if (isEs) regressions.push(`La tasa de acierto de esta semana (${curr.winrate}%) cayó ${wrDiff}% frente a la semana anterior (${prev.winrate}%)`);
      else regressions.push(`Tỷ lệ thắng tuần này (${curr.winrate}%) sụt giảm ${wrDiff}% so với tuần trước (${prev.winrate}%)`);
    }

    const pnlDiff = Math.round((curr.pnl - prev.pnl) * 100) / 100;
    if (pnlDiff > 0) {
      if (isEn) improvements.push(`This week's PnL (${curr.pnl >= 0 ? '+' : ''}${curr.pnl}$) improved by +${pnlDiff}$ vs last week (${prev.pnl >= 0 ? '+' : ''}${prev.pnl}$)`);
      else if (isZh) improvements.push(`本周 PnL (${curr.pnl >= 0 ? '+' : ''}${curr.pnl}$) 较上周 (${prev.pnl >= 0 ? '+' : ''}${prev.pnl}$) 改善了 +${pnlDiff}$`);
      else if (isKo) improvements.push(`이번 주 손익(${curr.pnl >= 0 ? '+' : ''}${curr.pnl}$)이 지난주(${prev.pnl >= 0 ? '+' : ''}${prev.pnl}$) 대비 +${pnlDiff}$ 개선되었습니다.`);
      else if (isEs) improvements.push(`El PnL de esta semana (${curr.pnl >= 0 ? '+' : ''}${curr.pnl}$) mejoró +${pnlDiff}$ frente a la semana anterior (${prev.pnl >= 0 ? '+' : ''}${prev.pnl}$)`);
      else improvements.push(`PnL tuần này (${curr.pnl >= 0 ? '+' : ''}${curr.pnl}$) cải thiện +${pnlDiff}$ so với tuần trước (${prev.pnl >= 0 ? '+' : ''}${prev.pnl}$)`);
    } else if (pnlDiff < 0) {
      if (isEn) regressions.push(`This week's PnL (${curr.pnl >= 0 ? '+' : ''}${curr.pnl}$) dropped by ${pnlDiff}$ vs last week (${prev.pnl >= 0 ? '+' : ''}${prev.pnl}$)`);
      else if (isZh) regressions.push(`本周 PnL (${curr.pnl >= 0 ? '+' : ''}${curr.pnl}$) 较上周 (${prev.pnl >= 0 ? '+' : ''}${prev.pnl}$) 减少了 ${pnlDiff}$`);
      else if (isKo) regressions.push(`이번 주 손익(${curr.pnl >= 0 ? '+' : ''}${curr.pnl}$)이 지난주(${prev.pnl >= 0 ? '+' : ''}${prev.pnl}$) 대비 ${pnlDiff}$ 감소했습니다.`);
      else if (isEs) regressions.push(`El PnL de esta semana (${curr.pnl >= 0 ? '+' : ''}${curr.pnl}$) se redujo en ${pnlDiff}$ frente a la semana anterior (${prev.pnl >= 0 ? '+' : ''}${prev.pnl}$)`);
      else regressions.push(`PnL tuần này (${curr.pnl >= 0 ? '+' : ''}${curr.pnl}$) bị giảm ${pnlDiff}$ so với tuần trước (${prev.pnl >= 0 ? '+' : ''}${prev.pnl}$)`);
    }
  }

  // Analyze trade patterns (DCA, SL discipline, etc.)
  const recent10 = trades.slice(-10);
  const prev10 = trades.slice(-20, -10);

  if (recent10.length > 0) {
    const dcaRecent = recent10.filter(t => (t.user_notes || '').includes('#Mistake_DCA') || (t.user_notes || '').toLowerCase().includes('dca')).length;
    const dcaPrev = prev10.filter(t => (t.user_notes || '').includes('#Mistake_DCA') || (t.user_notes || '').toLowerCase().includes('dca')).length;

    if (prev10.length > 0 && dcaRecent < dcaPrev) {
      if (isEn) improvements.push(`DCA mistake frequency decreased from ${dcaPrev} to ${dcaRecent} times in the last 10 trades`);
      else if (isZh) improvements.push(`最近10笔交易中逆势加仓 (DCA) 错误从 ${dcaPrev} 次减少至 ${dcaRecent} 次`);
      else if (isKo) improvements.push(`최근 10개 매매에서 물타기(DCA) 실수 빈도가 ${dcaPrev}회에서 ${dcaRecent}회로 감소했습니다.`);
      else if (isEs) improvements.push(`La frecuencia del error DCA disminuyó de ${dcaPrev} a ${dcaRecent} en las últimas 10 operaciones`);
      else improvements.push(`Tần suất dính lỗi DCA giảm từ ${dcaPrev} lần xuống còn ${dcaRecent} lần trong 10 lệnh gần nhất`);
    } else if (dcaRecent > 0) {
      if (isEn) regressions.push(`Recorded ${dcaRecent} DCA violations in the last 10 trades`);
      else if (isZh) regressions.push(`最近10笔交易中记录了 ${dcaRecent} 次逆势加仓违规`);
      else if (isKo) regressions.push(`최근 10개 매매에서 ${dcaRecent}회의 물타기(DCA) 원칙 위반이 기록되었습니다.`);
      else if (isEs) regressions.push(`Se registraron ${dcaRecent} violaciones de DCA en las últimas 10 operaciones`);
      else regressions.push(`Ghi nhận ${dcaRecent} lần vi phạm lỗi DCA trong 10 lệnh gần nhất`);
    }

    const strictSlCount = recent10.filter(t => (t.user_notes || '').includes('#Strength_StrictSL') || (t.stop_loss && t.stop_loss > 0)).length;
    if (strictSlCount >= 8) {
      improvements.push(`Duy trì kỷ luật đặt Cắt lỗ (SL) tốt: ${strictSlCount}/10 lệnh gần nhất có SL rõ ràng`);
    }
  }

  if (improvements.length === 0) {
    improvements.push("Đang tích lũy thêm dữ liệu để đánh giá điểm tiến bộ cụ thể.");
  }
  if (regressions.length === 0) {
    regressions.push("Không ghi nhận điểm suy giảm lớn nào trong giai đoạn này. Hãy tiếp tục duy trì!");
  }

  return { improvements, regressions };
}

function getEmptyData() {
  return {
    equityCurve: [],
    dailyData: [],
    weeklyData: [],
    monthlyData: [],
    streaks: { currentWinStreak: 0, currentLossStreak: 0, maxWinStreak: 0, maxLossStreak: 0 },
    comparison: { improvements: ["Chưa có đủ dữ liệu"], regressions: ["Chưa có đủ dữ liệu"] },
    summary: { totalTrades: 0, wins: 0, losses: 0, winrate: 0, totalPnl: 0, avgPnlPerTrade: 0, bestTradePnl: 0, worstTradePnl: 0 }
  };
}
