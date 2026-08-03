import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getTradeTypeFilter } from '@/lib/tradeUtils';

/**
 * POST /api/rules/check
 * Kiểm tra xem ngày hôm nay có vi phạm rule nào không theo từng tài khoản.
 * Body: { tradeDate: "YYYY-MM-DD", accountType: "LIVE" | "BACKTEST" | "ALL" | custom }
 * Trả về danh sách vi phạm (violations[])
 */
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { tradeDate, accountType, type } = body;
    const targetAccount = accountType || type || 'ALL';

    // Ngày kiểm tra (mặc định lấy ngày hôm nay theo giờ địa phương YYYY-MM-DD)
    const now = new Date();
    const localYear = now.getFullYear();
    const localMonth = String(now.getMonth() + 1).padStart(2, '0');
    const localDay = String(now.getDate()).padStart(2, '0');
    const todayStr = `${localYear}-${localMonth}-${localDay}`;
    const targetDate = tradeDate || todayStr;

    const db = await getDb();

    // Lấy rules active cho tài khoản này (rules chung 'ALL' + rules riêng của account)
    let rules;
    if (targetAccount !== 'ALL') {
      rules = await db.all(
        "SELECT * FROM user_rules WHERE is_active = 1 AND (account_type = 'ALL' OR account_type IS NULL OR account_type = ?)",
        [targetAccount]
      );
    } else {
      rules = await db.all('SELECT * FROM user_rules WHERE is_active = 1');
    }

    // Lấy tất cả lệnh trong ngày hôm nay theo tài khoản
    const typeFilter = getTradeTypeFilter(targetAccount, true);
    let todayTradesSql = "SELECT * FROM trades WHERE date(datetime(trade_time, '+7 hours')) = ?";
    const todayTradesParams = [targetDate];
    if (typeFilter.sql) {
      todayTradesSql += typeFilter.sql;
      todayTradesParams.push(...typeFilter.params);
    }
    const todayTrades = await db.all(todayTradesSql, todayTradesParams);

    const violations = [];
    const tradeViolationsMap = {}; // trade_id -> { trade_id, asset, trade_time, pnl, violated_rules: [] }

    const markTradeViolation = (trade, ruleName) => {
      if (!trade || !trade.id) return;
      if (!tradeViolationsMap[trade.id]) {
        tradeViolationsMap[trade.id] = {
          trade_id: trade.id,
          asset: trade.asset,
          side: trade.side,
          size: trade.size,
          trade_time: trade.trade_time,
          pnl: trade.pnl,
          violated_rules: []
        };
      }
      if (!tradeViolationsMap[trade.id].violated_rules.includes(ruleName)) {
        tradeViolationsMap[trade.id].violated_rules.push(ruleName);
      }
    };

    for (const rule of rules) {
      if (rule.rule_type === 'no_dca') {
        const dcaViolations = todayTrades.filter(t => 
          (t.user_notes || '').includes('#Mistake_DCA') || 
          (t.user_notes || '').toLowerCase().includes('dca')
        );
        if (dcaViolations.length > 0) {
          dcaViolations.forEach(t => markTradeViolation(t, rule.rule_text || 'Cấm Nhồi Lệnh DCA'));
          violations.push({
            rule_id: rule.id,
            rule_text: rule.rule_text,
            rule_type: rule.rule_type,
            severity: 'critical',
            trade_ids: dcaViolations.map(t => t.id),
            detail: `Ghi nhận ${dcaViolations.length} lệnh nhồi lỗ (DCA) trong hôm nay — Lệnh ID #${dcaViolations.map(t => t.id).join(', #')}!`,
            stat: { current: dcaViolations.length, limit: 0 }
          });
        }
      }

      if (rule.rule_type === 'no_revenge') {
        const revengeViolations = todayTrades.filter(t => 
          (t.user_notes || '').includes('#Mistake_RevengeTrade') || 
          (t.user_notes || '').toLowerCase().includes('trả thù')
        );
        if (revengeViolations.length > 0) {
          revengeViolations.forEach(t => markTradeViolation(t, rule.rule_text || 'Cấm Giao Dịch Trả Thù'));
          violations.push({
            rule_id: rule.id,
            rule_text: rule.rule_text,
            rule_type: rule.rule_type,
            severity: 'critical',
            trade_ids: revengeViolations.map(t => t.id),
            detail: `Ghi nhận ${revengeViolations.length} lệnh giao dịch trả thù — Lệnh ID #${revengeViolations.map(t => t.id).join(', #')}!`,
            stat: { current: revengeViolations.length, limit: 0 }
          });
        }
      }

      if (rule.rule_type === 'max_volume') {
        const limitVol = rule.rule_value || 0.2;
        const overVolTrades = todayTrades.filter(t => (t.size || 0) > limitVol);
        if (overVolTrades.length > 0) {
          overVolTrades.forEach(t => markTradeViolation(t, `Over-Volume > ${limitVol} Lot`));
          violations.push({
            rule_id: rule.id,
            rule_text: rule.rule_text,
            rule_type: rule.rule_type,
            severity: 'critical',
            trade_ids: overVolTrades.map(t => t.id),
            detail: `Phát hiện ${overVolTrades.length} lệnh có Vol (${overVolTrades[0].size} Lot) vượt giới hạn (${limitVol} Lot) — Lệnh ID #${overVolTrades.map(t => t.id).join(', #')}!`,
            stat: { current: overVolTrades[0].size, limit: limitVol }
          });
        }
      }

      if (rule.rule_type === 'strict_sl') {
        const noSlTrades = todayTrades.filter(t => 
          (!t.stop_loss || t.stop_loss === 0) || 
          (t.user_notes || '').includes('#Mistake_MovedSL')
        );
        if (noSlTrades.length > 0) {
          noSlTrades.forEach(t => markTradeViolation(t, 'Không Cài SL / Dời SL'));
          violations.push({
            rule_id: rule.id,
            rule_text: rule.rule_text,
            rule_type: rule.rule_type,
            severity: 'warning',
            trade_ids: noSlTrades.map(t => t.id),
            detail: `Cảnh báo: Có ${noSlTrades.length} lệnh không cài SL hoặc dời SL ra xa — Lệnh ID #${noSlTrades.map(t => t.id).join(', #')}!`,
            stat: { current: noSlTrades.length, limit: 0 }
          });
        }
      }

      if (rule.rule_type === 'daily_trade_limit') {
        const limit = rule.rule_value || 0;
        const count = todayTrades.length;
        if (count > limit) {
          const excessTrades = todayTrades.slice(limit);
          excessTrades.forEach(t => markTradeViolation(t, `Vượt Quota ${limit} Lệnh/Ngày`));
          violations.push({
            rule_id: rule.id,
            rule_text: rule.rule_text,
            rule_type: rule.rule_type,
            severity: count >= limit * 1.5 ? 'critical' : 'warning',
            trade_ids: excessTrades.map(t => t.id),
            detail: `Hôm nay đã giao dịch ${count}/${limit} lệnh. Lệnh ID #${excessTrades.map(t => t.id).join(', #')} VI PHẠM giới hạn số lệnh!`,
            stat: { current: count, limit }
          });
        }
      }

      if (rule.rule_type === 'daily_loss_limit') {
        // Giới hạn thua lỗ trong ngày (USD)
        const limit = Math.abs(rule.rule_value || 0);
        const todayLoss = todayTrades
          .filter(t => t.pnl < 0)
          .reduce((sum, t) => sum + Math.abs(t.pnl), 0);
        if (todayLoss >= limit) {
          violations.push({
            rule_id: rule.id,
            rule_text: rule.rule_text,
            rule_type: rule.rule_type,
            severity: 'critical',
            detail: `Hôm nay đã lỗ $${todayLoss.toFixed(2)}/$${limit}. Bạn đã VƯỢT ngưỡng thua lỗ cho phép trong ngày!`,
            stat: { current: todayLoss.toFixed(2), limit }
          });
        }
      }

      if (rule.rule_type === 'consecutive_loss_limit') {
        // Giới hạn số lệnh thua liên tiếp (tính theo tài khoản được chọn)
        const limit = rule.rule_value || 0;
        const streakFilter = getTradeTypeFilter(targetAccount, false);
        let streakSql = 'SELECT status FROM trades' + streakFilter.sql + ' ORDER BY trade_time DESC LIMIT 20';
        const recentTrades = await db.all(streakSql, streakFilter.params);

        let streak = 0;
        for (const t of recentTrades) {
          if (t.status === 'LOSS') streak++;
          else break;
        }
        if (streak >= limit) {
          violations.push({
            rule_id: rule.id,
            rule_text: rule.rule_text,
            rule_type: rule.rule_type,
            severity: 'critical',
            detail: `Bạn đang trong chuỗi thua ${streak} lệnh liên tiếp (giới hạn: ${limit}). Dừng giao dịch và nghỉ ngơi!`,
            stat: { current: streak, limit }
          });
        }
      }
    }

    // Tính toán thống kê vi phạm lịch sử 30 ngày theo tài khoản
    const violationStats = await computeViolationStats(db, rules, targetAccount);

    return NextResponse.json({
      success: true,
      data: {
        violations,
        violatingTradeList: Object.values(tradeViolationsMap),
        todayTrades: todayTrades.length,
        todayPnl: todayTrades.reduce((s, t) => s + (t.pnl || 0), 0),
        violationStats
      }
    });

  } catch (error) {
    console.error('Error checking rules:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

async function computeViolationStats(db, rules, accountType) {
  const stats = [];
  const typeFilter = getTradeTypeFilter(accountType, true);

  for (const rule of rules) {
    if (rule.rule_type === 'daily_trade_limit') {
      const limit = rule.rule_value || 0;
      let sql = "SELECT date(datetime(trade_time, '+7 hours')) as day, COUNT(*) as count FROM trades WHERE trade_time >= date('now', '-31 days')";
      const params = [];
      if (typeFilter.sql) {
        sql += typeFilter.sql;
        params.push(...typeFilter.params);
      }
      sql += " GROUP BY day";

      const rows = await db.all(sql, params);
      const violations = rows.filter(r => r.count > limit).length;
      const totalDays = rows.length;
      const violationCost = await computeViolationCost(db, rule, rows.filter(r => r.count > limit).map(r => r.day), accountType);
      stats.push({
        rule_id: rule.id,
        rule_text: rule.rule_text,
        violations_30d: violations,
        total_days: totalDays,
        violation_cost_usd: violationCost
      });
    }

    if (rule.rule_type === 'daily_loss_limit') {
      const limit = Math.abs(rule.rule_value || 0);
      let sql = "SELECT date(datetime(trade_time, '+7 hours')) as day, SUM(CASE WHEN pnl < 0 THEN ABS(pnl) ELSE 0 END) as loss FROM trades WHERE trade_time >= date('now', '-31 days')";
      const params = [];
      if (typeFilter.sql) {
        sql += typeFilter.sql;
        params.push(...typeFilter.params);
      }
      sql += " GROUP BY day";

      const rows = await db.all(sql, params);
      const violations = rows.filter(r => r.loss > limit).length;
      stats.push({
        rule_id: rule.id,
        rule_text: rule.rule_text,
        violations_30d: violations,
        total_days: rows.length,
        violation_cost_usd: null
      });
    }
  }
  return stats;
}

async function computeViolationCost(db, rule, violationDays, accountType) {
  if (!violationDays.length) return 0;
  const typeFilter = getTradeTypeFilter(accountType, true);
  let totalCost = 0;

  for (const day of violationDays) {
    let sql = "SELECT pnl FROM trades WHERE date(datetime(trade_time, '+7 hours')) = ?";
    const params = [day];
    if (typeFilter.sql) {
      sql += typeFilter.sql;
      params.push(...typeFilter.params);
    }
    sql += " ORDER BY trade_time ASC";

    const tradesOnDay = await db.all(sql, params);
    const excessTrades = tradesOnDay.slice(Math.floor(rule.rule_value || 0));
    totalCost += excessTrades.reduce((s, t) => s + (t.pnl || 0), 0);
  }
  return Math.round(totalCost * 100) / 100;
}
