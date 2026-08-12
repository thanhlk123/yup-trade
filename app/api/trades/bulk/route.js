import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function POST(request) {
  try {
    const { trades } = await request.json();

    if (!trades || !Array.isArray(trades) || trades.length === 0) {
      return NextResponse.json({ success: false, error: 'Danh sách lệnh trống hoặc không hợp lệ.' }, { status: 400 });
    }

    const db = await getDb();

    // Start a transaction for efficient and safe bulk insertion
    await db.run('BEGIN TRANSACTION');

    try {
      let insertedCount = 0;
      let skippedCount = 0;

      for (const trade of trades) {
        const {
          asset,
          side,
          size,
          pnl,
          status,
          trade_time,
          exit_time,
          user_notes,
          setup_tag,
          entry_price = 0,
          exit_price = 0,
          stop_loss = null,
          take_profit = null,
          ai_evaluation = null,
          trade_type = 'LIVE',
          image_url = null
        } = trade;

        // Auto-fill logic
        let inferredSide = side;
        if (!inferredSide && entry_price && exit_price && pnl !== undefined) {
          if (pnl > 0) inferredSide = exit_price > entry_price ? 'BUY' : 'SELL';
          else if (pnl < 0) inferredSide = exit_price < entry_price ? 'BUY' : 'SELL';
          else inferredSide = 'BUY'; // default fallback
        }

        // Perform basic validations
        if (!asset || !inferredSide || size === undefined || pnl === undefined) {
          throw new Error('Thiếu thông tin bắt buộc trong một số lệnh.');
        }

        const upperSide = inferredSide.toUpperCase();

        // Check for duplicates
        const existing = await db.get(
          `SELECT id FROM trades 
           WHERE asset = ? 
              AND side = ? 
              AND trade_type = ?
              AND trade_time IS NOT NULL AND ? IS NOT NULL 
              AND ABS(strftime('%s', trade_time) - strftime('%s', ?)) < 60 
              AND ABS(size - ?) < 0.0001 
              AND ABS(pnl - ?) < 0.01`,
          [asset, upperSide, trade_type || 'LIVE', trade_time, trade_time, parseFloat(size), parseFloat(pnl)]
        );

        if (existing) {
          skippedCount++;
          continue;
        }

        // Session Inference
        let session = 'Unknown';
        if (trade_time) {
          const date = new Date(trade_time);
          const hourUtc = date.getUTCHours();
          if (hourUtc >= 0 && hourUtc < 8) session = 'Asian';
          else if (hourUtc >= 8 && hourUtc < 13) session = 'London';
          else session = 'NY';
        }

        // Duration Inference
        let duration = 'Unknown';
        if (trade_time && exit_time) {
          const start = new Date(trade_time).getTime();
          const end = new Date(exit_time).getTime();
          const diffMins = (end - start) / (1000 * 60);
          if (diffMins < 30) duration = 'Scalping';
          else if (diffMins <= 24 * 60) duration = 'Intraday';
          else duration = 'Swing';
        }

        // R:R Calculation
        let planned_rr = null;
        let actual_rr = null;
        if (entry_price && stop_loss && entry_price !== stop_loss) {
          const risk = Math.abs(entry_price - stop_loss);
          if (take_profit) {
            planned_rr = Math.abs(take_profit - entry_price) / risk;
          }
          if (exit_price) {
            actual_rr = Math.abs(exit_price - entry_price) / risk;
            if (pnl < 0) actual_rr = -actual_rr; // Negative RR for losses
          }
        }

        // Format ai_evaluation if present, otherwise build a simple default
        const aiResult = ai_evaluation || {
          setup_tag: setup_tag || 'Unclassified',
          strengths: [],
          weaknesses: [],
          decision_rating: pnl >= 0 ? 7 : 5,
          advice: pnl >= 0 ? 'Lệnh thắng. Tiếp tục duy trì kỷ luật.' : 'Xem xét lại điểm dừng lỗ và bối cảnh vào lệnh.'
        };

        await db.run(
          `INSERT INTO trades (
            asset, side, entry_price, exit_price, stop_loss, take_profit, 
            size, pnl, status, trade_time, exit_time, user_notes, setup_tag, ai_evaluation,
            trade_type, image_url, session, duration, planned_rr, actual_rr
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            asset,
            upperSide,
            parseFloat(entry_price),
            parseFloat(exit_price),
            stop_loss ? parseFloat(stop_loss) : null,
            take_profit ? parseFloat(take_profit) : null,
            parseFloat(size),
            parseFloat(pnl),
            status ? status.toUpperCase() : (pnl > 0 ? 'WIN' : pnl < 0 ? 'LOSS' : 'BREAKEVEN'),
            trade_time || null,
            exit_time || null,
            user_notes || '',
            setup_tag || aiResult.setup_tag || 'Unclassified',
            JSON.stringify(aiResult),
            trade_type || 'LIVE',
            image_url || null,
            session,
            duration,
            planned_rr,
            actual_rr
          ]
        );

        insertedCount++;
      }

      await db.run('COMMIT');
      return NextResponse.json({ success: true, count: insertedCount, skipped: skippedCount });
    } catch (dbErr) {
      // Rollback transaction on any error during loop
      await db.run('ROLLBACK');
      throw dbErr;
    }
  } catch (error) {
    console.error('Error in bulk inserting trades:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
